-- Migration: Add settlement_group_id to labor_payments table
-- Purpose: Allow weekly contract payments to have settlement reference codes

-- Add settlement_group_id to labor_payments table
ALTER TABLE labor_payments
ADD COLUMN IF NOT EXISTS settlement_group_id UUID REFERENCES settlement_groups(id) ON DELETE SET NULL;

-- Add index for the FK
CREATE INDEX IF NOT EXISTS idx_labor_payments_settlement_group
ON labor_payments(settlement_group_id) WHERE settlement_group_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN labor_payments.settlement_group_id IS 'Link to settlement_groups for reference code and tracking';
