-- Add soft delete support to subcontract_payments table
-- This allows payments to be marked as deleted without losing data

-- Add is_deleted column with default false
ALTER TABLE subcontract_payments
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;

-- Create partial index for efficient filtering of non-deleted payments
CREATE INDEX IF NOT EXISTS idx_subcontract_payments_is_deleted
ON subcontract_payments(is_deleted) WHERE is_deleted = false;

-- Add index for contract_id + is_deleted for common query pattern
CREATE INDEX IF NOT EXISTS idx_subcontract_payments_contract_not_deleted
ON subcontract_payments(contract_id) WHERE is_deleted = false;
