-- Performance Optimization: Atomic cascade delete for material requests
-- Replaces 30+ sequential DB calls with a single atomic function
-- Used by useDeleteMaterialRequestCascade in useMaterialRequests.ts

CREATE OR REPLACE FUNCTION cascade_delete_material_request(
  p_request_id UUID,
  p_site_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_po_ids UUID[];
  v_delivery_ids UUID[];
  v_expense_ids UUID[];
  v_batch_ref_codes TEXT[];
  v_settlement_ids UUID[];
  v_inventory_ids UUID[];
  v_request_item_ids UUID[];
  v_po_count INT := 0;
  v_delivery_count INT := 0;
  v_expense_count INT := 0;
  v_stock_count INT := 0;
BEGIN
  -- Collect all linked PO IDs
  SELECT ARRAY_AGG(id) INTO v_po_ids
  FROM purchase_orders
  WHERE source_request_id = p_request_id;

  IF v_po_ids IS NULL THEN
    v_po_ids := ARRAY[]::UUID[];
  END IF;

  v_po_count := COALESCE(array_length(v_po_ids, 1), 0);

  -- If there are linked POs, handle cascade delete
  IF v_po_count > 0 THEN
    -- Collect all delivery IDs from linked POs
    SELECT ARRAY_AGG(id) INTO v_delivery_ids
    FROM deliveries
    WHERE po_id = ANY(v_po_ids);

    IF v_delivery_ids IS NULL THEN
      v_delivery_ids := ARRAY[]::UUID[];
    END IF;

    v_delivery_count := COALESCE(array_length(v_delivery_ids, 1), 0);

    -- Get stock inventory IDs to delete (based on deliveries)
    IF v_delivery_count > 0 THEN
      WITH delivery_materials AS (
        SELECT DISTINCT di.material_id, di.brand_id
        FROM delivery_items di
        WHERE di.delivery_id = ANY(v_delivery_ids)
      )
      SELECT ARRAY_AGG(si.id) INTO v_inventory_ids
      FROM stock_inventory si
      INNER JOIN delivery_materials dm
        ON si.material_id = dm.material_id
        AND (si.brand_id = dm.brand_id OR (si.brand_id IS NULL AND dm.brand_id IS NULL))
      WHERE si.site_id = p_site_id;

      IF v_inventory_ids IS NULL THEN
        v_inventory_ids := ARRAY[]::UUID[];
      END IF;

      v_stock_count := COALESCE(array_length(v_inventory_ids, 1), 0);

      -- Delete stock transactions first (FK constraint)
      IF v_stock_count > 0 THEN
        DELETE FROM stock_transactions
        WHERE inventory_id = ANY(v_inventory_ids);

        -- Delete stock inventory
        DELETE FROM stock_inventory
        WHERE id = ANY(v_inventory_ids);
      END IF;

      -- Delete delivery items and deliveries
      DELETE FROM delivery_items
      WHERE delivery_id = ANY(v_delivery_ids);

      DELETE FROM deliveries
      WHERE id = ANY(v_delivery_ids);
    END IF;

    -- Collect material expense data for group stock cleanup
    SELECT ARRAY_AGG(mpe.id), ARRAY_AGG(DISTINCT mpe.ref_code)
    INTO v_expense_ids, v_batch_ref_codes
    FROM material_purchase_expenses mpe
    WHERE mpe.purchase_order_id = ANY(v_po_ids);

    IF v_expense_ids IS NULL THEN
      v_expense_ids := ARRAY[]::UUID[];
    END IF;

    IF v_batch_ref_codes IS NULL THEN
      v_batch_ref_codes := ARRAY[]::TEXT[];
    END IF;

    v_expense_count := COALESCE(array_length(v_expense_ids, 1), 0);

    -- Handle group stock cascade (if any expenses have batch ref codes)
    IF array_length(v_batch_ref_codes, 1) > 0 THEN
      -- Get settlement IDs for these batch codes
      SELECT ARRAY_AGG(id) INTO v_settlement_ids
      FROM inter_site_material_settlements
      WHERE batch_ref_code = ANY(v_batch_ref_codes);

      IF v_settlement_ids IS NOT NULL AND array_length(v_settlement_ids, 1) > 0 THEN
        -- Delete settlement payments
        DELETE FROM inter_site_settlement_payments
        WHERE settlement_id = ANY(v_settlement_ids);

        -- Delete settlement items
        DELETE FROM inter_site_settlement_items
        WHERE settlement_id = ANY(v_settlement_ids);

        -- Delete settlements
        DELETE FROM inter_site_material_settlements
        WHERE id = ANY(v_settlement_ids);
      END IF;

      -- Delete settlement expense allocations
      DELETE FROM settlement_expense_allocations
      WHERE batch_ref_code = ANY(v_batch_ref_codes);

      -- Delete derived expenses (original_batch_code)
      DELETE FROM material_purchase_expenses
      WHERE original_batch_code = ANY(v_batch_ref_codes);

      -- Delete batch usage records
      DELETE FROM batch_usage_records
      WHERE batch_ref_code = ANY(v_batch_ref_codes);
    END IF;

    -- Delete material expense items
    IF v_expense_count > 0 THEN
      DELETE FROM material_purchase_expense_items
      WHERE purchase_expense_id = ANY(v_expense_ids);

      -- Delete material purchase expenses
      DELETE FROM material_purchase_expenses
      WHERE id = ANY(v_expense_ids);
    END IF;

    -- Delete PO items
    DELETE FROM purchase_order_items
    WHERE po_id = ANY(v_po_ids);

    -- Delete POs
    DELETE FROM purchase_orders
    WHERE id = ANY(v_po_ids);
  END IF;

  -- Get request item IDs
  SELECT ARRAY_AGG(id) INTO v_request_item_ids
  FROM material_request_items
  WHERE request_id = p_request_id;

  -- Delete junction table records
  IF v_request_item_ids IS NOT NULL AND array_length(v_request_item_ids, 1) > 0 THEN
    DELETE FROM purchase_order_request_items
    WHERE request_item_id = ANY(v_request_item_ids);
  END IF;

  -- Delete request items
  DELETE FROM material_request_items
  WHERE request_id = p_request_id;

  -- Delete the material request itself
  DELETE FROM material_requests
  WHERE id = p_request_id;

  -- Build result JSON
  v_result := json_build_object(
    'success', true,
    'request_id', p_request_id,
    'deleted_pos', v_po_count,
    'deleted_deliveries', v_delivery_count,
    'deleted_expenses', v_expense_count,
    'deleted_stock_items', v_stock_count
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cascade_delete_material_request(UUID, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION cascade_delete_material_request IS 'Atomic cascade delete for material requests. Replaces N+1 query pattern with single function call. Deletes: POs, deliveries, stock, expenses, settlements, and request items.';
