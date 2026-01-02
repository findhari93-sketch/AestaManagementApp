-- Fix labor_payments payment_channel check constraint
-- The existing constraint only allows certain values, but we need 'direct' and 'engineer_wallet'

-- First, drop the existing check constraint
ALTER TABLE labor_payments DROP CONSTRAINT IF EXISTS labor_payments_payment_channel_check;

-- Update existing rows to use valid values
-- Map old values to new: anything not 'engineer_wallet' becomes 'direct'
UPDATE labor_payments
SET payment_channel = 'direct'
WHERE payment_channel IS NULL OR payment_channel NOT IN ('direct', 'engineer_wallet');

-- Add the new check constraint with the correct values
ALTER TABLE labor_payments ADD CONSTRAINT labor_payments_payment_channel_check
  CHECK (payment_channel IN ('direct', 'engineer_wallet'));

-- Add comment for documentation
COMMENT ON COLUMN labor_payments.payment_channel IS 'Payment channel: direct (company pays directly) or engineer_wallet (via site engineer)';
