-- Migration: Clean up orphaned wallet records
-- Purpose: Remove references to deleted settlement_groups and clean up inconsistent data

-- ============================================================================
-- 1. Clear orphaned settlement references in transactions
-- ============================================================================

-- Find transactions that reference settlement_groups that no longer exist
UPDATE site_engineer_transactions t
SET
  settlement_reference = NULL,
  settlement_group_id = NULL
WHERE t.settlement_group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM settlement_groups sg
    WHERE sg.id = t.settlement_group_id
  );

-- Log how many were cleaned up
DO $$
DECLARE
  orphaned_count INT;
BEGIN
  GET DIAGNOSTICS orphaned_count = ROW_COUNT;
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Cleared % orphaned settlement references from transactions', orphaned_count;
  END IF;
END $$;

-- ============================================================================
-- 2. Clean up orphaned batch usage records
-- ============================================================================

-- Delete batch usage records where the spending transaction no longer exists
DELETE FROM engineer_wallet_batch_usage ewbu
WHERE NOT EXISTS (
  SELECT 1 FROM site_engineer_transactions t
  WHERE t.id = ewbu.transaction_id
);

-- Delete batch usage records where the batch transaction no longer exists
DELETE FROM engineer_wallet_batch_usage ewbu
WHERE NOT EXISTS (
  SELECT 1 FROM site_engineer_transactions t
  WHERE t.id = ewbu.batch_transaction_id
);

-- ============================================================================
-- 3. Fix remaining_balance for batches that had inconsistent usage
-- ============================================================================

-- Recalculate remaining_balance based on actual usage
UPDATE site_engineer_transactions batch
SET remaining_balance = batch.amount - COALESCE(
  (SELECT SUM(ewbu.amount_used)
   FROM engineer_wallet_batch_usage ewbu
   WHERE ewbu.batch_transaction_id = batch.id),
  0
)
WHERE batch.transaction_type = 'received_from_company'
  AND batch.batch_code IS NOT NULL;

-- ============================================================================
-- 4. Clear settlement references that point to cancelled settlements
-- ============================================================================

-- Clear references to cancelled settlements (soft-deleted)
UPDATE site_engineer_transactions t
SET
  settlement_reference = NULL,
  settlement_group_id = NULL
FROM settlement_groups sg
WHERE t.settlement_group_id = sg.id
  AND sg.is_cancelled = true;

-- ============================================================================
-- 5. Summary report
-- ============================================================================

DO $$
DECLARE
  batches_with_balance INT;
  total_remaining NUMERIC;
  orphaned_tx INT;
BEGIN
  -- Count batches with remaining balance
  SELECT COUNT(*), COALESCE(SUM(remaining_balance), 0)
  INTO batches_with_balance, total_remaining
  FROM site_engineer_transactions
  WHERE transaction_type = 'received_from_company'
    AND remaining_balance > 0;

  -- Count transactions without proper links
  SELECT COUNT(*)
  INTO orphaned_tx
  FROM site_engineer_transactions
  WHERE settlement_reference IS NOT NULL
    AND settlement_group_id IS NULL;

  RAISE NOTICE '=== Cleanup Summary ===';
  RAISE NOTICE 'Batches with remaining balance: % (Total: Rs. %)', batches_with_balance, total_remaining;
  RAISE NOTICE 'Transactions with settlement_reference but no group_id: %', orphaned_tx;
END $$;
