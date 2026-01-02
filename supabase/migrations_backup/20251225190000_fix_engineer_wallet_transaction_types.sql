-- Migration: Fix engineer wallet transaction types
-- Purpose: Convert transactions linked to settlements from received_from_company to spent_on_behalf
-- Also create missing batch_usage records

-- ============================================================================
-- 1. Check current state
-- ============================================================================

DO $$
DECLARE
  received_count INT;
  spent_count INT;
  linked_received INT;
BEGIN
  SELECT COUNT(*) INTO received_count FROM site_engineer_transactions WHERE transaction_type = 'received_from_company';
  SELECT COUNT(*) INTO spent_count FROM site_engineer_transactions WHERE transaction_type = 'spent_on_behalf';

  SELECT COUNT(*) INTO linked_received
  FROM site_engineer_transactions t
  JOIN settlement_groups sg ON sg.engineer_transaction_id = t.id
  WHERE t.transaction_type = 'received_from_company';

  RAISE NOTICE '=== Before Fix ===';
  RAISE NOTICE 'Total received_from_company: %', received_count;
  RAISE NOTICE 'Total spent_on_behalf: %', spent_count;
  RAISE NOTICE 'received_from_company linked to settlements: %', linked_received;
END $$;

-- ============================================================================
-- 2. Fix transactions that are linked to settlements but have wrong type
-- ============================================================================

-- These are transactions that are spending (settlement payments) but incorrectly marked as received
UPDATE site_engineer_transactions t
SET transaction_type = 'spent_on_behalf'
FROM settlement_groups sg
WHERE sg.engineer_transaction_id = t.id
  AND t.transaction_type = 'received_from_company';

-- ============================================================================
-- 3. Also fix any transaction with settlement_reference but wrong type
-- ============================================================================

UPDATE site_engineer_transactions
SET transaction_type = 'spent_on_behalf'
WHERE settlement_reference IS NOT NULL
  AND settlement_group_id IS NOT NULL
  AND transaction_type = 'received_from_company';

-- ============================================================================
-- 4. Check and report final state
-- ============================================================================

DO $$
DECLARE
  received_count INT;
  spent_count INT;
  total_spent_amount NUMERIC;
BEGIN
  SELECT COUNT(*) INTO received_count FROM site_engineer_transactions WHERE transaction_type = 'received_from_company';
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO spent_count, total_spent_amount
  FROM site_engineer_transactions WHERE transaction_type = 'spent_on_behalf';

  RAISE NOTICE '=== After Fix ===';
  RAISE NOTICE 'Total received_from_company: %', received_count;
  RAISE NOTICE 'Total spent_on_behalf: % (Amount: Rs. %)', spent_count, total_spent_amount;
END $$;
