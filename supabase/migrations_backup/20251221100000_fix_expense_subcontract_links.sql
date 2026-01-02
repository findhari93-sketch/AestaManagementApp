-- Migration: Fix expense subcontract links
-- This migration syncs contract_id on expenses from attendance records and engineer transactions
-- Run this after deploying the code fixes for settlement subcontract linking

-- 1. Fix expenses linked via daily_attendance
-- Update expenses where attendance has subcontract_id but expense doesn't have contract_id
UPDATE expenses e
SET contract_id = da.subcontract_id
FROM daily_attendance da
WHERE da.expense_id = e.id
  AND da.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- 2. Fix expenses linked via market_laborer_attendance
-- Update expenses where market attendance has subcontract_id but expense doesn't have contract_id
UPDATE expenses e
SET contract_id = ma.subcontract_id
FROM market_laborer_attendance ma
WHERE ma.expense_id = e.id
  AND ma.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- 3. Fix expenses linked via engineer_transaction_id
-- Update expenses where transaction has related_subcontract_id but expense doesn't have contract_id
UPDATE expenses e
SET contract_id = t.related_subcontract_id
FROM site_engineer_transactions t
WHERE e.engineer_transaction_id = t.id
  AND t.related_subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- Log the results (optional - can be viewed in migration output)
DO $$
DECLARE
  daily_count INTEGER;
  market_count INTEGER;
  tx_count INTEGER;
BEGIN
  -- Count how many could have been updated (for logging purposes)
  SELECT COUNT(*) INTO daily_count
  FROM expenses e
  JOIN daily_attendance da ON da.expense_id = e.id
  WHERE da.subcontract_id IS NOT NULL AND e.contract_id IS NOT NULL;

  SELECT COUNT(*) INTO market_count
  FROM expenses e
  JOIN market_laborer_attendance ma ON ma.expense_id = e.id
  WHERE ma.subcontract_id IS NOT NULL AND e.contract_id IS NOT NULL;

  SELECT COUNT(*) INTO tx_count
  FROM expenses e
  JOIN site_engineer_transactions t ON e.engineer_transaction_id = t.id
  WHERE t.related_subcontract_id IS NOT NULL AND e.contract_id IS NOT NULL;

  RAISE NOTICE 'Expense subcontract link migration complete.';
  RAISE NOTICE 'Expenses linked via daily_attendance: %', daily_count;
  RAISE NOTICE 'Expenses linked via market_attendance: %', market_count;
  RAISE NOTICE 'Expenses linked via engineer_transactions: %', tx_count;
END $$;
