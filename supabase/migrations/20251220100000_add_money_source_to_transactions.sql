-- Add money_source tracking to site_engineer_transactions
-- This tracks whose money was used when company sends funds to engineer

-- Add columns to site_engineer_transactions
ALTER TABLE site_engineer_transactions ADD COLUMN IF NOT EXISTS money_source TEXT;
ALTER TABLE site_engineer_transactions ADD COLUMN IF NOT EXISTS money_source_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN site_engineer_transactions.money_source IS 'Source of money: own_money, amma_money, client_money, other_site_money, custom';
COMMENT ON COLUMN site_engineer_transactions.money_source_name IS 'Custom source name when money_source is other_site_money or custom';

-- Add check constraint for valid money_source values
ALTER TABLE site_engineer_transactions DROP CONSTRAINT IF EXISTS site_engineer_transactions_money_source_check;
ALTER TABLE site_engineer_transactions ADD CONSTRAINT site_engineer_transactions_money_source_check
  CHECK (money_source IS NULL OR money_source IN ('own_money', 'amma_money', 'client_money', 'other_site_money', 'custom'));

-- Create index for faster aggregations by money_source
CREATE INDEX IF NOT EXISTS idx_site_engineer_transactions_money_source
ON site_engineer_transactions(money_source, site_id)
WHERE money_source IS NOT NULL;

-- Update constraints on attendance tables to support new values
ALTER TABLE daily_attendance DROP CONSTRAINT IF EXISTS daily_attendance_payer_source_check;
ALTER TABLE daily_attendance ADD CONSTRAINT daily_attendance_payer_source_check
  CHECK (payer_source IS NULL OR payer_source IN ('own_money', 'amma_money', 'client_money', 'other_site_money', 'custom', 'mothers_money'));

ALTER TABLE market_laborer_attendance DROP CONSTRAINT IF EXISTS market_laborer_attendance_payer_source_check;
ALTER TABLE market_laborer_attendance ADD CONSTRAINT market_laborer_attendance_payer_source_check
  CHECK (payer_source IS NULL OR payer_source IN ('own_money', 'amma_money', 'client_money', 'other_site_money', 'custom', 'mothers_money'));
