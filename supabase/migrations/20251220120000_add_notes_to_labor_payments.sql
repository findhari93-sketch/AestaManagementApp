-- Add notes column to labor_payments table
-- This allows saving notes/comments when settling weekly contract payments

ALTER TABLE labor_payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN labor_payments.notes IS 'Notes/comments added when settling the payment';
