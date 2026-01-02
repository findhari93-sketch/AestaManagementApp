-- Migration: Add payment type, actual payment date, and unique reference to labor_payments
-- Purpose: Track actual payment dates, distinguish salary vs advance payments, and unique ref per payment

-- Add payment type to labor_payments (salary reduces weekly due, advance tracked separately)
ALTER TABLE labor_payments
ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('salary', 'advance', 'other')) DEFAULT 'salary';

-- Add actual payment date (when payment was actually made, vs created_at which is entry time)
ALTER TABLE labor_payments
ADD COLUMN IF NOT EXISTS actual_payment_date DATE DEFAULT CURRENT_DATE;

-- Add unique payment reference per payment (format: PAY-YYYYMM-NNN)
ALTER TABLE labor_payments
ADD COLUMN IF NOT EXISTS payment_reference TEXT UNIQUE;

-- Add same fields to settlement_groups for consistency
ALTER TABLE settlement_groups
ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('salary', 'advance', 'other')) DEFAULT 'salary';

ALTER TABLE settlement_groups
ADD COLUMN IF NOT EXISTS actual_payment_date DATE DEFAULT CURRENT_DATE;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_labor_payments_payment_type ON labor_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_labor_payments_actual_date ON labor_payments(actual_payment_date);
CREATE INDEX IF NOT EXISTS idx_labor_payments_reference ON labor_payments(payment_reference);

-- Add comments for documentation
COMMENT ON COLUMN labor_payments.payment_type IS 'Type of payment: salary (reduces weekly due), advance (tracked separately, does not reduce weekly due), other (misc)';
COMMENT ON COLUMN labor_payments.actual_payment_date IS 'Actual date when payment was made (vs created_at which is entry time)';
COMMENT ON COLUMN labor_payments.payment_reference IS 'Unique reference code per payment: PAY-YYYYMM-NNN format';

COMMENT ON COLUMN settlement_groups.payment_type IS 'Type of payment in this settlement group';
COMMENT ON COLUMN settlement_groups.actual_payment_date IS 'Actual date when payment was made';
