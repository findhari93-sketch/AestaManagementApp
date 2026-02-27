-- RPC to edit material request items (add/remove) with cascade effects
-- Handles: junction record cleanup, orphaned PO deletion, PO draft revert

CREATE OR REPLACE FUNCTION edit_material_request_items(
  p_request_id UUID,
  p_site_id UUID,
  p_items_to_remove UUID[] DEFAULT ARRAY[]::UUID[],
  p_items_to_add JSONB DEFAULT '[]'::JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_items_with_deliveries UUID[];
  v_affected_po_ids UUID[];
  v_po_id UUID;
  v_remaining_links INT;
  v_removed_count INT := 0;
  v_added_count INT := 0;
  v_pos_deleted INT := 0;
  v_pos_reverted INT := 0;
  v_item JSONB;
  v_cascade_result JSON;
BEGIN
  -- ===== Validate: check items to remove don't have delivery records =====
  IF array_length(p_items_to_remove, 1) > 0 THEN
    SELECT ARRAY_AGG(DISTINCT pori.request_item_id)
    INTO v_items_with_deliveries
    FROM purchase_order_request_items pori
    INNER JOIN purchase_order_items poi ON poi.id = pori.po_item_id
    INNER JOIN delivery_items di ON di.po_item_id = poi.id
    WHERE pori.request_item_id = ANY(p_items_to_remove);

    -- Remove NULLs
    IF v_items_with_deliveries IS NOT NULL THEN
      v_items_with_deliveries := array_remove(v_items_with_deliveries, NULL);
    END IF;

    IF v_items_with_deliveries IS NOT NULL AND array_length(v_items_with_deliveries, 1) > 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Cannot remove items that have delivery records',
        'blocked_items', to_json(v_items_with_deliveries)
      );
    END IF;

    -- ===== Collect affected PO IDs before removing junction records =====
    SELECT ARRAY_AGG(DISTINCT poi.po_id)
    INTO v_affected_po_ids
    FROM purchase_order_request_items pori
    INNER JOIN purchase_order_items poi ON poi.id = pori.po_item_id
    WHERE pori.request_item_id = ANY(p_items_to_remove);

    IF v_affected_po_ids IS NULL THEN
      v_affected_po_ids := ARRAY[]::UUID[];
    END IF;

    -- ===== Remove junction records for items being removed =====
    DELETE FROM purchase_order_request_items
    WHERE request_item_id = ANY(p_items_to_remove);

    -- ===== Delete the material_request_items =====
    DELETE FROM material_request_items
    WHERE id = ANY(p_items_to_remove)
      AND request_id = p_request_id;

    GET DIAGNOSTICS v_removed_count = ROW_COUNT;

    -- ===== Handle affected POs =====
    IF array_length(v_affected_po_ids, 1) > 0 THEN
      FOREACH v_po_id IN ARRAY v_affected_po_ids
      LOOP
        -- Check if this PO still has any junction links
        SELECT COUNT(*) INTO v_remaining_links
        FROM purchase_order_request_items pori
        INNER JOIN purchase_order_items poi ON poi.id = pori.po_item_id
        WHERE poi.po_id = v_po_id;

        IF v_remaining_links = 0 THEN
          -- PO has no remaining linked request items
          -- Check if PO has any deliveries - if so, just revert to draft
          IF EXISTS (SELECT 1 FROM deliveries WHERE po_id = v_po_id) THEN
            UPDATE purchase_orders SET status = 'draft', updated_at = now()
            WHERE id = v_po_id;
            v_pos_reverted := v_pos_reverted + 1;
          ELSE
            -- No deliveries, safe to delete this orphaned PO
            SELECT cascade_delete_purchase_order(v_po_id, p_site_id) INTO v_cascade_result;
            v_pos_deleted := v_pos_deleted + 1;
          END IF;
        ELSE
          -- PO still has some linked items, revert to draft for re-processing
          UPDATE purchase_orders SET status = 'draft', updated_at = now()
          WHERE id = v_po_id
            AND status NOT IN ('delivered', 'partially_delivered');
          v_pos_reverted := v_pos_reverted + 1;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ===== Add new items =====
  IF p_items_to_add IS NOT NULL AND jsonb_array_length(p_items_to_add) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_to_add)
    LOOP
      INSERT INTO material_request_items (
        request_id,
        material_id,
        brand_id,
        requested_qty,
        notes
      ) VALUES (
        p_request_id,
        (v_item->>'material_id')::UUID,
        CASE WHEN v_item->>'brand_id' IS NOT NULL AND v_item->>'brand_id' != ''
          THEN (v_item->>'brand_id')::UUID
          ELSE NULL
        END,
        (v_item->>'requested_qty')::NUMERIC,
        v_item->>'notes'
      );
      v_added_count := v_added_count + 1;
    END LOOP;
  END IF;

  -- ===== Update request's updated_at timestamp =====
  UPDATE material_requests
  SET updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'removed_items', v_removed_count,
    'added_items', v_added_count,
    'pos_deleted', v_pos_deleted,
    'pos_reverted', v_pos_reverted
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION edit_material_request_items(UUID, UUID, UUID[], JSONB) TO authenticated;

COMMENT ON FUNCTION edit_material_request_items IS
'Edit material request items with cascade effects. Validates no delivery records
exist for removed items, cleans up junction records, deletes orphaned POs,
reverts affected POs to draft, and inserts new items.';
