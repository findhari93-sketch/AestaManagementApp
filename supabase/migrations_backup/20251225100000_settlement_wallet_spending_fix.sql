-- Migration: Fix Engineer Wallet Spending Tracking for Salary Settlements
-- This adds columns to link wallet transactions to settlements

-- Add settlement_reference column to site_engineer_transactions
-- This stores the settlement reference (e.g., SET-202412-001) for easy cross-referencing
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS settlement_reference TEXT;

-- Add settlement_group_id for direct linking to settlement_groups
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS settlement_group_id UUID REFERENCES settlement_groups(id) ON DELETE SET NULL;

-- Index for settlement reference queries
CREATE INDEX IF NOT EXISTS idx_set_transactions_settlement_ref
ON site_engineer_transactions(settlement_reference)
WHERE settlement_reference IS NOT NULL;

-- Index for settlement group queries
CREATE INDEX IF NOT EXISTS idx_set_transactions_settlement_group
ON site_engineer_transactions(settlement_group_id)
WHERE settlement_group_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN site_engineer_transactions.settlement_reference IS
  'Links spending transaction to settlement group reference (e.g., SET-202412-001)';
COMMENT ON COLUMN site_engineer_transactions.settlement_group_id IS
  'Direct FK to settlement_groups for wallet spending transactions';
