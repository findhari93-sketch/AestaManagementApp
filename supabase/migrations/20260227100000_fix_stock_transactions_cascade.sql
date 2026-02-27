-- Fix PO deletion FK constraint error on stock_transactions_inventory_id_fkey
-- Problem: The cascade_delete_purchase_order RPC's safety cleanup deletes zero-qty
-- stock_inventory site-wide, but stock_transactions referencing them block the delete
-- because the FK has no ON DELETE CASCADE.
-- Also improves stock inventory detection in the RPC to use UNION approach.

-- ===== Part A: Fix FK constraint =====

ALTER TABLE stock_transactions
DROP CONSTRAINT IF EXISTS stock_transactions_inventory_id_fkey;

ALTER TABLE stock_transactions
ADD CONSTRAINT stock_transactions_inventory_id_fkey
FOREIGN KEY (inventory_id) REFERENCES stock_inventory(id)
ON DELETE CASCADE;

-- ===== Part B: Improved cascade_delete_purchase_order RPC =====

CREATE OR REPLACE FUNCTION cascade_delete_purchase_order(
  p_po_id UUID,
  p_site_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_delivery_ids UUID[];
  v_expense_ids UUID[];
  v_batch_ref_codes TEXT[];
  v_settlement_ids UUID[];
  v_inventory_ids UUID[];
  v_group_stock_inv_ids UUID[];
  v_delivery_count INT := 0;
  v_expense_count INT := 0;
  v_stock_count INT := 0;
  v_settlement_count INT := 0;
  v_derived_expense_count INT := 0;
BEGIN
  -- ===== Collect all IDs first =====

  -- Collect delivery IDs
  SELECT ARRAY_AGG(id) INTO v_delivery_ids
  FROM deliveries
  WHERE po_id = p_po_id;

  IF v_delivery_ids IS NULL THEN
    v_delivery_ids := ARRAY[]::UUID[];
  END IF;

  v_delivery_count := COALESCE(array_length(v_delivery_ids, 1), 0);

  -- Collect ALL material expense IDs and ALL batch ref codes
  SELECT ARRAY_AGG(id), ARRAY_AGG(DISTINCT ref_code)
  INTO v_expense_ids, v_batch_ref_codes
  FROM material_purchase_expenses
  WHERE purchase_order_id = p_po_id;

  IF v_expense_ids IS NULL THEN
    v_expense_ids := ARRAY[]::UUID[];
  END IF;

  IF v_batch_ref_codes IS NULL THEN
    v_batch_ref_codes := ARRAY[]::TEXT[];
  END IF;

  -- Remove NULLs from batch_ref_codes
  v_batch_ref_codes := array_remove(v_batch_ref_codes, NULL);

  v_expense_count := COALESCE(array_length(v_expense_ids, 1), 0);

  -- ===== Stock Inventory Cleanup (improved detection) =====
  IF v_delivery_count > 0 THEN
    -- Use UNION approach: match by material+brand AND by stock_transaction reference
    SELECT ARRAY_AGG(DISTINCT inv_id) INTO v_inventory_ids
    FROM (
      -- Method 1: Via delivery_items material matching (original logic)
      SELECT si.id AS inv_id
      FROM stock_inventory si
      INNER JOIN (
        SELECT DISTINCT di.material_id, di.brand_id
        FROM delivery_items di
        WHERE di.delivery_id = ANY(v_delivery_ids)
      ) dm
        ON si.material_id = dm.material_id
        AND (si.brand_id = dm.brand_id OR (si.brand_id IS NULL AND dm.brand_id IS NULL))
      WHERE si.site_id = p_site_id

      UNION

      -- Method 2: Via stock_transactions reference_id (catches trigger-created records)
      SELECT DISTINCT st.inventory_id AS inv_id
      FROM stock_transactions st
      WHERE st.reference_type = 'delivery'
        AND st.reference_id = ANY(v_delivery_ids)
    ) AS combined_inventory;

    IF v_inventory_ids IS NULL THEN
      v_inventory_ids := ARRAY[]::UUID[];
    END IF;

    v_stock_count := COALESCE(array_length(v_inventory_ids, 1), 0);

    IF v_stock_count > 0 THEN
      -- Delete stock transactions first (FK constraint - also handled by CASCADE now)
      DELETE FROM stock_transactions
      WHERE inventory_id = ANY(v_inventory_ids);

      -- Delete daily_material_usage for these materials
      DELETE FROM daily_material_usage
      WHERE site_id = p_site_id
        AND material_id IN (
          SELECT DISTINCT di.material_id
          FROM delivery_items di
          WHERE di.delivery_id = ANY(v_delivery_ids)
        );

      -- Delete stock inventory
      DELETE FROM stock_inventory
      WHERE id = ANY(v_inventory_ids);
    END IF;
  END IF;

  -- ===== Group Stock Cascade (for ALL batch ref codes) =====
  IF array_length(v_batch_ref_codes, 1) > 0 THEN
    -- Get settlement IDs for all batch codes
    SELECT ARRAY_AGG(id) INTO v_settlement_ids
    FROM inter_site_material_settlements
    WHERE batch_ref_code = ANY(v_batch_ref_codes);

    IF v_settlement_ids IS NULL THEN
      v_settlement_ids := ARRAY[]::UUID[];
    END IF;

    v_settlement_count := COALESCE(array_length(v_settlement_ids, 1), 0);

    IF v_settlement_count > 0 THEN
      -- Delete settlement expense allocations (now has CASCADE but explicit is safer)
      DELETE FROM settlement_expense_allocations
      WHERE settlement_id = ANY(v_settlement_ids);

      -- Delete settlement payments (now has CASCADE but explicit is safer)
      DELETE FROM inter_site_settlement_payments
      WHERE settlement_id = ANY(v_settlement_ids);

      -- Delete settlement items
      DELETE FROM inter_site_settlement_items
      WHERE settlement_id = ANY(v_settlement_ids);

      -- Delete settlements themselves
      DELETE FROM inter_site_material_settlements
      WHERE id = ANY(v_settlement_ids);
    END IF;

    -- Also delete settlement_expense_allocations by batch_ref_code (catches any not linked by settlement_id)
    DELETE FROM settlement_expense_allocations
    WHERE batch_ref_code = ANY(v_batch_ref_codes);

    -- Delete batch usage records
    DELETE FROM batch_usage_records
    WHERE batch_ref_code = ANY(v_batch_ref_codes);

    -- Get group stock inventory IDs before deleting transactions
    SELECT ARRAY_AGG(id) INTO v_group_stock_inv_ids
    FROM group_stock_inventory
    WHERE batch_code = ANY(v_batch_ref_codes);

    IF v_group_stock_inv_ids IS NULL THEN
      v_group_stock_inv_ids := ARRAY[]::UUID[];
    END IF;

    -- Delete group stock transactions by batch_ref_code
    DELETE FROM group_stock_transactions
    WHERE batch_ref_code = ANY(v_batch_ref_codes);

    -- Delete group stock transactions by inventory_id (catches usage transactions without batch_ref_code)
    IF array_length(v_group_stock_inv_ids, 1) > 0 THEN
      DELETE FROM group_stock_transactions
      WHERE inventory_id = ANY(v_group_stock_inv_ids);
    END IF;

    -- Delete group stock inventory
    DELETE FROM group_stock_inventory
    WHERE batch_code = ANY(v_batch_ref_codes);

    -- Delete derived expenses (debtor + self-use expenses from batch settlements)
    SELECT COUNT(*) INTO v_derived_expense_count
    FROM material_purchase_expenses
    WHERE original_batch_code = ANY(v_batch_ref_codes);

    DELETE FROM material_purchase_expenses
    WHERE original_batch_code = ANY(v_batch_ref_codes);
  END IF;

  -- ===== Standard PO Delete Chain =====

  -- Delete purchase_order_request_items junction records (via PO items)
  DELETE FROM purchase_order_request_items
  WHERE po_item_id IN (
    SELECT id FROM purchase_order_items WHERE po_id = p_po_id
  );

  -- Delete delivery items and deliveries
  IF v_delivery_count > 0 THEN
    DELETE FROM delivery_items
    WHERE delivery_id = ANY(v_delivery_ids);

    DELETE FROM deliveries
    WHERE id = ANY(v_delivery_ids);
  END IF;

  -- Delete material expense items + expenses
  IF v_expense_count > 0 THEN
    DELETE FROM material_purchase_expense_items
    WHERE purchase_expense_id = ANY(v_expense_ids);

    DELETE FROM material_purchase_expenses
    WHERE id = ANY(v_expense_ids);
  END IF;

  -- Delete PO items
  DELETE FROM purchase_order_items
  WHERE po_id = p_po_id;

  -- Delete the PO itself
  DELETE FROM purchase_orders
  WHERE id = p_po_id;

  -- Safety cleanup: remove zero-qty stock_inventory for this site
  -- Now safe because stock_transactions FK has ON DELETE CASCADE
  DELETE FROM stock_inventory
  WHERE site_id = p_site_id AND current_qty <= 0;

  -- Build result JSON
  v_result := json_build_object(
    'success', true,
    'po_id', p_po_id,
    'deleted_deliveries', v_delivery_count,
    'deleted_expenses', v_expense_count,
    'deleted_stock_items', v_stock_count,
    'deleted_settlements', v_settlement_count,
    'deleted_derived_expenses', v_derived_expense_count
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION cascade_delete_purchase_order(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION cascade_delete_purchase_order IS
'Atomic cascade delete for purchase orders. Handles ALL linked records:
PO items, deliveries, delivery items, stock inventory, stock transactions,
daily material usage, material expenses, expense items, batch usage records,
group stock transactions, group stock inventory, inter-site settlements,
settlement items, settlement payments, settlement expense allocations,
purchase_order_request_items junction records, and derived expenses.
Single atomic transaction replaces 30+ sequential client-side calls.';
