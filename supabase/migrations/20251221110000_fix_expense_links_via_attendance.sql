-- Migration: Fix expense subcontract links via attendance records
-- This fixes expenses where the attendance record has subcontract_id but the expense doesn't have contract_id
-- Specifically handles cases where subcontract was linked AFTER settlement was made

-- 1. Fix expenses linked via daily_attendance that has engineer_transaction_id
-- When attendance has both subcontract_id and engineer_transaction_id, update expense via the transaction link
UPDATE expenses e
SET contract_id = da.subcontract_id
FROM daily_attendance da
WHERE da.engineer_transaction_id IS NOT NULL
  AND e.engineer_transaction_id = da.engineer_transaction_id
  AND da.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- 2. Fix expenses linked via market_laborer_attendance that has engineer_transaction_id
UPDATE expenses e
SET contract_id = ma.subcontract_id
FROM market_laborer_attendance ma
WHERE ma.engineer_transaction_id IS NOT NULL
  AND e.engineer_transaction_id = ma.engineer_transaction_id
  AND ma.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- 3. Also update engineer_transactions to have related_subcontract_id for consistency
-- This ensures future lookups work correctly
UPDATE site_engineer_transactions t
SET related_subcontract_id = da.subcontract_id
FROM daily_attendance da
WHERE da.engineer_transaction_id = t.id
  AND da.subcontract_id IS NOT NULL
  AND t.related_subcontract_id IS NULL;

UPDATE site_engineer_transactions t
SET related_subcontract_id = ma.subcontract_id
FROM market_laborer_attendance ma
WHERE ma.engineer_transaction_id = t.id
  AND ma.subcontract_id IS NOT NULL
  AND t.related_subcontract_id IS NULL;

-- Log results
DO $$
DECLARE
  expense_count INTEGER;
  tx_count INTEGER;
BEGIN
  -- Count expenses that now have contract_id
  SELECT COUNT(*) INTO expense_count
  FROM expenses e
  WHERE e.contract_id IS NOT NULL
    AND e.engineer_transaction_id IS NOT NULL;

  -- Count transactions that now have related_subcontract_id
  SELECT COUNT(*) INTO tx_count
  FROM site_engineer_transactions t
  WHERE t.related_subcontract_id IS NOT NULL;

  RAISE NOTICE 'Migration complete: % expenses with contract_id via engineer_transaction', expense_count;
  RAISE NOTICE 'Transactions with related_subcontract_id: %', tx_count;
END $$;
