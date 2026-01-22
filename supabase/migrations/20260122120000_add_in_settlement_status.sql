-- Migration: Add 'in_settlement' status to batch_usage_records
-- This status indicates that a settlement has been generated but not yet paid

-- Drop the existing check constraint
ALTER TABLE batch_usage_records
DROP CONSTRAINT IF EXISTS batch_usage_records_settlement_status_check;

-- Add the new check constraint with 'in_settlement' included
ALTER TABLE batch_usage_records
ADD CONSTRAINT batch_usage_records_settlement_status_check
CHECK (settlement_status IN ('pending', 'in_settlement', 'settled', 'self_use'));

-- Add a comment explaining the statuses
COMMENT ON COLUMN batch_usage_records.settlement_status IS
'Settlement status: pending (not yet in settlement), in_settlement (settlement generated but not paid), settled (payment completed), self_use (payer site usage)';
