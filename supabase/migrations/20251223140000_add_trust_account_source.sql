-- Add trust_account as a valid payer source option
-- This allows tracking payments made from a trust account

-- Update site_engineer_transactions money_source constraint
ALTER TABLE site_engineer_transactions DROP CONSTRAINT IF EXISTS site_engineer_transactions_money_source_check;
ALTER TABLE site_engineer_transactions ADD CONSTRAINT site_engineer_transactions_money_source_check
  CHECK (money_source IS NULL OR money_source IN ('own_money', 'amma_money', 'client_money', 'other_site_money', 'custom', 'trust_account'));

-- Update daily_attendance payer_source constraint
ALTER TABLE daily_attendance DROP CONSTRAINT IF EXISTS daily_attendance_payer_source_check;
ALTER TABLE daily_attendance ADD CONSTRAINT daily_attendance_payer_source_check
  CHECK (payer_source IS NULL OR payer_source IN ('own_money', 'amma_money', 'client_money', 'other_site_money', 'custom', 'mothers_money', 'trust_account'));

-- Update market_laborer_attendance payer_source constraint
ALTER TABLE market_laborer_attendance DROP CONSTRAINT IF EXISTS market_laborer_attendance_payer_source_check;
ALTER TABLE market_laborer_attendance ADD CONSTRAINT market_laborer_attendance_payer_source_check
  CHECK (payer_source IS NULL OR payer_source IN ('own_money', 'amma_money', 'client_money', 'other_site_money', 'custom', 'mothers_money', 'trust_account'));

-- Update column comments
COMMENT ON COLUMN site_engineer_transactions.money_source IS 'Source of money: own_money, amma_money, client_money, other_site_money, custom, trust_account';
COMMENT ON COLUMN daily_attendance.payer_source IS 'Source of money used for payment: own_money, amma_money, client_money, other_site_money, custom, mothers_money, trust_account';
COMMENT ON COLUMN market_laborer_attendance.payer_source IS 'Source of money used for payment: own_money, amma_money, client_money, other_site_money, custom, mothers_money, trust_account';
