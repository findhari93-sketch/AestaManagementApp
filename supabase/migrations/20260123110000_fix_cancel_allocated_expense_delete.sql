-- Migration: Fix cancel_allocated_expense to DELETE settlement instead of marking as cancelled
-- Purpose: When deleting an allocated expense, the settlement should be deleted entirely
-- so usage records go back to "Unsettled Balances" instead of showing as "Cancelled"

-- Drop and recreate the function with corrected behavior
DROP FUNCTION IF EXISTS cancel_allocated_expense(UUID, TEXT);

CREATE OR REPLACE FUNCTION cancel_allocated_expense(
  p_expense_id UUID,
  p_settlement_reference TEXT
)
RETURNS TABLE (
  deleted_settlement_id UUID,
  reset_usage_records INT,
  deleted_expense BOOLEAN
) AS $$
DECLARE
  v_settlement_id UUID;
  v_reset_count INT := 0;
BEGIN
  -- Find the settlement by settlement_code
  SELECT id INTO v_settlement_id
  FROM inter_site_material_settlements
  WHERE settlement_code = p_settlement_reference;

  IF v_settlement_id IS NOT NULL THEN
    -- Reset batch_usage_records to pending (so they appear in Unsettled Balances)
    UPDATE batch_usage_records
    SET
      settlement_id = NULL,
      settlement_status = 'pending',
      updated_at = NOW()
    WHERE settlement_id = v_settlement_id;
    GET DIAGNOSTICS v_reset_count = ROW_COUNT;

    -- Reset group_stock_transactions
    UPDATE group_stock_transactions
    SET
      settlement_id = NULL,
      updated_at = NOW()
    WHERE settlement_id = v_settlement_id;

    -- Delete settlement items
    DELETE FROM inter_site_settlement_items
    WHERE settlement_id = v_settlement_id;

    -- Delete settlement payments
    DELETE FROM inter_site_settlement_payments
    WHERE settlement_id = v_settlement_id;

    -- Delete settlement expense allocations
    DELETE FROM settlement_expense_allocations
    WHERE settlement_id = v_settlement_id;

    -- DELETE the settlement entirely (not just mark as cancelled)
    -- This allows the usage to be re-settled fresh from Unsettled Balances
    DELETE FROM inter_site_material_settlements
    WHERE id = v_settlement_id;
  END IF;

  -- Delete the allocated expense
  DELETE FROM material_purchase_expenses
  WHERE id = p_expense_id;

  RETURN QUERY SELECT
    v_settlement_id,
    v_reset_count,
    TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancel_allocated_expense(UUID, TEXT) IS
'Deletes an allocated expense and its associated inter-site settlement.
Resets usage records back to pending status so they appear in Unsettled Balances and can be re-settled.';

GRANT EXECUTE ON FUNCTION cancel_allocated_expense(UUID, TEXT) TO authenticated;
