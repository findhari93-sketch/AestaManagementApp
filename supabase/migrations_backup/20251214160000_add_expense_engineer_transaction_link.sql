-- Add engineer_transaction_id to expenses table for tracking salary payments
-- This allows linking expenses to engineer transactions for:
-- 1. Tracking which expense came from which engineer payment
-- 2. Updating expense status when engineer is reimbursed

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS engineer_transaction_id UUID REFERENCES site_engineer_transactions(id);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_expenses_engineer_transaction_id
ON expenses(engineer_transaction_id)
WHERE engineer_transaction_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN expenses.engineer_transaction_id IS 'Links to site_engineer_transactions for salary payments made via engineer';
