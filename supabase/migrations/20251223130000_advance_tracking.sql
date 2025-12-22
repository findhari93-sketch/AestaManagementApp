-- Migration: Add advance tracking fields
-- Purpose: Track total advances given to laborers and advance deductions from payments

-- Add advance tracking columns to laborers table
ALTER TABLE laborers
ADD COLUMN IF NOT EXISTS total_advance_given NUMERIC(12,2) DEFAULT 0;

ALTER TABLE laborers
ADD COLUMN IF NOT EXISTS total_advance_deducted NUMERIC(12,2) DEFAULT 0;

-- Add advance deduction tracking to labor_payments
-- This allows marking a payment as an advance deduction and linking to the original advance
ALTER TABLE labor_payments
ADD COLUMN IF NOT EXISTS is_advance_deduction BOOLEAN DEFAULT false;

ALTER TABLE labor_payments
ADD COLUMN IF NOT EXISTS advance_deduction_from_payment_id UUID REFERENCES labor_payments(id);

-- Create index for advance payments lookup
CREATE INDEX IF NOT EXISTS idx_labor_payments_advance ON labor_payments(laborer_id, payment_type) WHERE payment_type = 'advance';

-- Add comments for documentation
COMMENT ON COLUMN laborers.total_advance_given IS 'Cumulative total of advance payments given to this laborer (reduces subcontract, tracked separately from salary)';
COMMENT ON COLUMN laborers.total_advance_deducted IS 'Cumulative total of advances that have been deducted from subsequent salary payments';
COMMENT ON COLUMN labor_payments.is_advance_deduction IS 'True if this payment record represents a deduction of a previously given advance';
COMMENT ON COLUMN labor_payments.advance_deduction_from_payment_id IS 'Links to the original advance payment that is being deducted';

-- Create a view to get laborer advance summary
CREATE OR REPLACE VIEW v_laborer_advance_summary AS
SELECT
  l.id AS laborer_id,
  l.name AS laborer_name,
  l.total_advance_given,
  l.total_advance_deducted,
  (l.total_advance_given - l.total_advance_deducted) AS pending_advance,
  COALESCE(
    (SELECT SUM(lp.amount) FROM labor_payments lp WHERE lp.laborer_id = l.id AND lp.payment_type = 'advance' AND lp.is_advance_deduction = false),
    0
  ) AS calculated_advance_given,
  COALESCE(
    (SELECT SUM(lp.amount) FROM labor_payments lp WHERE lp.laborer_id = l.id AND lp.is_advance_deduction = true),
    0
  ) AS calculated_advance_deducted
FROM laborers l
WHERE l.laborer_type = 'contract';

COMMENT ON VIEW v_laborer_advance_summary IS 'Summary of advance payments and deductions for contract laborers';
