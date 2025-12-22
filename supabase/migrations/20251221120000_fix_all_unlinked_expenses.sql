-- Migration: Comprehensive fix for all unlinked expenses
-- This catches any remaining expenses that should be linked to subcontracts

-- Method 1: Fix expenses via daily_attendance.expense_id
UPDATE expenses e
SET contract_id = da.subcontract_id
FROM daily_attendance da
WHERE da.expense_id = e.id
  AND da.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- Method 2: Fix expenses via market_laborer_attendance.expense_id
UPDATE expenses e
SET contract_id = ma.subcontract_id
FROM market_laborer_attendance ma
WHERE ma.expense_id = e.id
  AND ma.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- Method 3: Fix expenses via daily_attendance.engineer_transaction_id
UPDATE expenses e
SET contract_id = da.subcontract_id
FROM daily_attendance da
WHERE da.engineer_transaction_id IS NOT NULL
  AND e.engineer_transaction_id = da.engineer_transaction_id
  AND da.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- Method 4: Fix expenses via market_laborer_attendance.engineer_transaction_id
UPDATE expenses e
SET contract_id = ma.subcontract_id
FROM market_laborer_attendance ma
WHERE ma.engineer_transaction_id IS NOT NULL
  AND e.engineer_transaction_id = ma.engineer_transaction_id
  AND ma.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- Method 5: Fix expenses via site_engineer_transactions.related_subcontract_id
UPDATE expenses e
SET contract_id = t.related_subcontract_id
FROM site_engineer_transactions t
WHERE e.engineer_transaction_id = t.id
  AND t.related_subcontract_id IS NOT NULL
  AND e.contract_id IS NULL;

-- Method 6: Match expenses by date and amount to attendance records
-- For labor module expenses without direct links
UPDATE expenses e
SET contract_id = da.subcontract_id
FROM daily_attendance da
WHERE e.module = 'labor'
  AND e.date = da.date
  AND da.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL
  AND da.is_paid = true
  AND e.site_id = da.site_id;

UPDATE expenses e
SET contract_id = ma.subcontract_id
FROM market_laborer_attendance ma
WHERE e.module = 'labor'
  AND e.date = ma.date
  AND ma.subcontract_id IS NOT NULL
  AND e.contract_id IS NULL
  AND ma.is_paid = true
  AND e.site_id = ma.site_id;

-- Also ensure engineer transactions have related_subcontract_id synced
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
  unlinked_count INTEGER;
  linked_count INTEGER;
BEGIN
  -- Count remaining unlinked labor expenses
  SELECT COUNT(*) INTO unlinked_count
  FROM expenses
  WHERE module = 'labor'
    AND contract_id IS NULL
    AND is_cleared = true;

  -- Count linked labor expenses
  SELECT COUNT(*) INTO linked_count
  FROM expenses
  WHERE module = 'labor'
    AND contract_id IS NOT NULL
    AND is_cleared = true;

  RAISE NOTICE 'Migration complete.';
  RAISE NOTICE 'Linked cleared labor expenses: %', linked_count;
  RAISE NOTICE 'Remaining unlinked cleared labor expenses: %', unlinked_count;
END $$;
