-- Engineer Settlement Workflow Enhancement
-- Adds columns for tracking payment settlement status and confirmation flow

-- Add settlement workflow columns to site_engineer_transactions
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending_settlement',
ADD COLUMN IF NOT EXISTS settlement_mode TEXT,
ADD COLUMN IF NOT EXISTS settlement_proof_url TEXT,
ADD COLUMN IF NOT EXISTS confirmed_by TEXT,
ADD COLUMN IF NOT EXISTS confirmed_by_user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispute_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN site_engineer_transactions.settlement_status IS 'Status: pending_settlement, pending_confirmation, confirmed, disputed';
COMMENT ON COLUMN site_engineer_transactions.settlement_mode IS 'Payment mode used by engineer when settling (upi, cash, net_banking, other)';
COMMENT ON COLUMN site_engineer_transactions.settlement_proof_url IS 'Proof uploaded by engineer when settling';
COMMENT ON COLUMN site_engineer_transactions.confirmed_by IS 'Name of admin who confirmed the settlement';
COMMENT ON COLUMN site_engineer_transactions.confirmed_by_user_id IS 'User ID of admin who confirmed';
COMMENT ON COLUMN site_engineer_transactions.confirmed_at IS 'Timestamp when settlement was confirmed';
COMMENT ON COLUMN site_engineer_transactions.dispute_notes IS 'Notes if settlement is disputed';

-- Create index for faster queries on settlement status
CREATE INDEX IF NOT EXISTS idx_site_engineer_transactions_settlement_status
ON site_engineer_transactions(settlement_status)
WHERE settlement_status IS NOT NULL;

-- Update existing records to have a default settlement_status based on is_settled
UPDATE site_engineer_transactions
SET settlement_status = CASE
  WHEN is_settled = true THEN 'confirmed'
  ELSE 'pending_settlement'
END
WHERE settlement_status IS NULL;
