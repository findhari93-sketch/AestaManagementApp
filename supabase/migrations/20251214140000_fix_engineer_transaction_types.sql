-- Migration: Fix engineer transaction types for payment settlements
-- Purpose: Update existing transactions that were incorrectly created with 'spent_on_behalf'
--          when they should have been 'received_from_company' (company sending money to engineer to pay laborers)

-- This fixes records where:
-- 1. The transaction was created when company sent money via engineer wallet
-- 2. The transaction is linked to daily_attendance or market_laborer_attendance records
-- 3. The transaction_type was incorrectly set to 'spent_on_behalf' instead of 'received_from_company'

UPDATE site_engineer_transactions
SET transaction_type = 'received_from_company',
    settlement_status = COALESCE(settlement_status, 'pending_settlement'),
    updated_at = NOW()
WHERE transaction_type = 'spent_on_behalf'
AND id IN (
  SELECT DISTINCT engineer_transaction_id
  FROM daily_attendance
  WHERE engineer_transaction_id IS NOT NULL
  UNION
  SELECT DISTINCT engineer_transaction_id
  FROM market_laborer_attendance
  WHERE engineer_transaction_id IS NOT NULL
);

-- Add comment explaining the change
COMMENT ON COLUMN site_engineer_transactions.transaction_type IS
'Transaction type: received_from_company (company sends money to engineer), spent_on_behalf (engineer pays for company expenses), used_own_money (engineer uses personal funds), returned_to_company (engineer returns unused funds)';
