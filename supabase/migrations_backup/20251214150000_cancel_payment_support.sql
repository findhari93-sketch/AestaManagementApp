-- Migration: Add cancel payment support for engineer transactions
-- Purpose: Allow admin to cancel payments sent to engineer that haven't been settled yet

-- Add cancel-related columns to site_engineer_transactions
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add index for cancelled transactions
CREATE INDEX IF NOT EXISTS idx_site_engineer_transactions_cancelled
ON site_engineer_transactions(cancelled_at)
WHERE cancelled_at IS NOT NULL;

-- Comment explaining the new columns
COMMENT ON COLUMN site_engineer_transactions.cancelled_at IS 'Timestamp when transaction was cancelled';
COMMENT ON COLUMN site_engineer_transactions.cancelled_by IS 'Name of user who cancelled the transaction';
COMMENT ON COLUMN site_engineer_transactions.cancelled_by_user_id IS 'User ID of who cancelled the transaction';
COMMENT ON COLUMN site_engineer_transactions.cancellation_reason IS 'Optional reason for cancellation';
