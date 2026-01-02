-- Migration: Add function to safely delete transactions
-- Purpose: Handle all FK constraints and ensure clean deletion

-- ============================================================================
-- 1. Create function to safely delete a transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_engineer_transaction(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_deleted BOOLEAN := false;
BEGIN
  -- Step 1: Delete batch usage records that reference this transaction
  DELETE FROM engineer_wallet_batch_usage
  WHERE transaction_id = p_transaction_id
     OR batch_transaction_id = p_transaction_id;

  -- Step 2: Unlink daily_attendance records
  UPDATE daily_attendance
  SET engineer_transaction_id = NULL
  WHERE engineer_transaction_id = p_transaction_id;

  -- Step 3: Unlink market_laborer_attendance records
  UPDATE market_laborer_attendance
  SET engineer_transaction_id = NULL
  WHERE engineer_transaction_id = p_transaction_id;

  -- Step 4: Unlink expenses records
  UPDATE expenses
  SET engineer_transaction_id = NULL
  WHERE engineer_transaction_id = p_transaction_id;

  -- Step 5: Unlink local_purchases reimbursement records
  UPDATE local_purchases
  SET reimbursement_transaction_id = NULL
  WHERE reimbursement_transaction_id = p_transaction_id;

  -- Step 6: Unlink settlement_groups records
  UPDATE settlement_groups
  SET engineer_transaction_id = NULL
  WHERE engineer_transaction_id = p_transaction_id;

  -- Step 7: Delete the transaction itself
  DELETE FROM site_engineer_transactions
  WHERE id = p_transaction_id;

  -- Check if deletion happened
  IF FOUND THEN
    v_deleted := true;
  END IF;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_engineer_transaction IS 'Safely deletes a transaction by first unlinking all FK references';

-- ============================================================================
-- 2. Grant execute permission
-- ============================================================================

GRANT EXECUTE ON FUNCTION delete_engineer_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION delete_engineer_transaction TO anon;
