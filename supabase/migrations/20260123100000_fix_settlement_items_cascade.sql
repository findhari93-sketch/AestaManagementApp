-- Migration: Fix inter_site_settlement_items FK Cascade
-- Purpose: Fix 409 Conflict error when deleting group_stock_transactions
-- The transaction_id FK was missing ON DELETE CASCADE

-- =====================================================
-- Step 1: Fix the transaction_id FK on inter_site_settlement_items
-- =====================================================

-- Drop the existing FK constraint (no CASCADE)
ALTER TABLE "public"."inter_site_settlement_items"
DROP CONSTRAINT IF EXISTS "inter_site_settlement_items_transaction_id_fkey";

-- Recreate with ON DELETE CASCADE
ALTER TABLE "public"."inter_site_settlement_items"
ADD CONSTRAINT "inter_site_settlement_items_transaction_id_fkey"
FOREIGN KEY ("transaction_id")
REFERENCES "public"."group_stock_transactions"("id")
ON DELETE CASCADE;

-- =====================================================
-- Step 2: Update delete_batch_cascade function
-- Now explicitly deletes inter_site_settlement_items and allocated expenses
-- =====================================================

-- Drop the existing function first (return type is changing)
DROP FUNCTION IF EXISTS delete_batch_cascade(TEXT);

CREATE OR REPLACE FUNCTION delete_batch_cascade(p_batch_ref_code TEXT)
RETURNS TABLE (
  deleted_settlements INT,
  deleted_usage_records INT,
  deleted_transactions INT,
  deleted_expense_items INT,
  deleted_settlement_items INT,
  deleted_allocated_expenses INT,
  deleted_batch BOOLEAN
) AS $$
DECLARE
  v_deleted_settlements INT := 0;
  v_deleted_usage_records INT := 0;
  v_deleted_transactions INT := 0;
  v_deleted_expense_items INT := 0;
  v_deleted_settlement_items INT := 0;
  v_deleted_allocated_expenses INT := 0;
  v_batch_id UUID;
  v_settlement_ids UUID[];
  v_transaction_ids UUID[];
BEGIN
  -- Get batch ID
  SELECT id INTO v_batch_id
  FROM material_purchase_expenses
  WHERE ref_code = p_batch_ref_code;

  IF v_batch_id IS NULL THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_ref_code;
  END IF;

  -- Get settlement IDs linked to this batch
  SELECT ARRAY_AGG(id) INTO v_settlement_ids
  FROM inter_site_material_settlements
  WHERE batch_ref_code = p_batch_ref_code;

  -- Get transaction IDs linked to this batch
  SELECT ARRAY_AGG(id) INTO v_transaction_ids
  FROM group_stock_transactions
  WHERE batch_ref_code = p_batch_ref_code;

  -- Step 1: Delete inter_site_settlement_items FIRST (before transactions)
  -- Delete by settlement_id
  IF v_settlement_ids IS NOT NULL AND array_length(v_settlement_ids, 1) > 0 THEN
    DELETE FROM inter_site_settlement_items
    WHERE settlement_id = ANY(v_settlement_ids);
    GET DIAGNOSTICS v_deleted_settlement_items = ROW_COUNT;
  END IF;

  -- Also delete by transaction_id (some items may reference transactions directly)
  IF v_transaction_ids IS NOT NULL AND array_length(v_transaction_ids, 1) > 0 THEN
    DELETE FROM inter_site_settlement_items
    WHERE transaction_id = ANY(v_transaction_ids);
    v_deleted_settlement_items := v_deleted_settlement_items + ROW_COUNT;
  END IF;

  -- Step 2: Delete settlement payments
  IF v_settlement_ids IS NOT NULL AND array_length(v_settlement_ids, 1) > 0 THEN
    DELETE FROM inter_site_settlement_payments
    WHERE settlement_id = ANY(v_settlement_ids);
  END IF;

  -- Step 3: Delete settlement expense allocations
  IF v_settlement_ids IS NOT NULL AND array_length(v_settlement_ids, 1) > 0 THEN
    DELETE FROM settlement_expense_allocations
    WHERE settlement_id = ANY(v_settlement_ids);
  END IF;

  -- Step 4: Delete settlements (this will trigger reset of usage records via trigger)
  DELETE FROM inter_site_material_settlements
  WHERE batch_ref_code = p_batch_ref_code;
  GET DIAGNOSTICS v_deleted_settlements = ROW_COUNT;

  -- Step 5: Delete batch usage records
  DELETE FROM batch_usage_records
  WHERE batch_ref_code = p_batch_ref_code;
  GET DIAGNOSTICS v_deleted_usage_records = ROW_COUNT;

  -- Step 6: Delete transactions (NOW safe - FK references removed)
  DELETE FROM group_stock_transactions
  WHERE batch_ref_code = p_batch_ref_code;
  GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;

  -- Step 7: Delete allocated expenses (child expenses created from this batch)
  DELETE FROM material_purchase_expenses
  WHERE original_batch_code = p_batch_ref_code;
  GET DIAGNOSTICS v_deleted_allocated_expenses = ROW_COUNT;

  -- Step 8: Count expense items (will cascade when we delete the batch)
  SELECT COUNT(*) INTO v_deleted_expense_items
  FROM material_purchase_expense_items
  WHERE purchase_expense_id = v_batch_id;

  -- Step 9: Delete the batch itself (this will cascade to expense_items)
  DELETE FROM material_purchase_expenses
  WHERE ref_code = p_batch_ref_code;

  RETURN QUERY SELECT
    v_deleted_settlements,
    v_deleted_usage_records,
    v_deleted_transactions,
    v_deleted_expense_items,
    v_deleted_settlement_items,
    v_deleted_allocated_expenses,
    TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_batch_cascade(TEXT) IS
'Safely deletes a batch and all related records in correct order:
1. Settlement items (to avoid FK conflicts)
2. Settlement payments
3. Settlement expense allocations
4. Settlements
5. Batch usage records
6. Group stock transactions
7. Allocated expenses (debtor expenses from this batch)
8. Expense items (via cascade)
9. The batch itself
Returns counts of deleted records for auditing.';

GRANT EXECUTE ON FUNCTION delete_batch_cascade(TEXT) TO authenticated;

-- =====================================================
-- Step 3: Create function to cancel allocated expense
-- This deletes the expense and cancels the associated settlement
-- =====================================================

CREATE OR REPLACE FUNCTION cancel_allocated_expense(
  p_expense_id UUID,
  p_settlement_reference TEXT
)
RETURNS TABLE (
  cancelled_settlement_id UUID,
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
    -- Reset batch_usage_records to pending
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

    -- DELETE the settlement entirely (so usage records go back to Unsettled Balances)
    -- This allows the usage to be re-settled fresh, rather than showing as "Cancelled"
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
