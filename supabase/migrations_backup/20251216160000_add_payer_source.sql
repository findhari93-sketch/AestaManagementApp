-- Add payer_source columns to track whose money was used for settlements
-- Options: own_money, client_money, mothers_money, custom

-- Add columns to daily_attendance
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS payer_source TEXT;
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS payer_name TEXT;

-- Add columns to market_laborer_attendance
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS payer_source TEXT;
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS payer_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN daily_attendance.payer_source IS 'Source of money used for payment: own_money, client_money, mothers_money, custom';
COMMENT ON COLUMN daily_attendance.payer_name IS 'Custom payer name when payer_source is custom';
COMMENT ON COLUMN market_laborer_attendance.payer_source IS 'Source of money used for payment: own_money, client_money, mothers_money, custom';
COMMENT ON COLUMN market_laborer_attendance.payer_name IS 'Custom payer name when payer_source is custom';

-- Add check constraints to ensure valid payer_source values
ALTER TABLE daily_attendance DROP CONSTRAINT IF EXISTS daily_attendance_payer_source_check;
ALTER TABLE daily_attendance ADD CONSTRAINT daily_attendance_payer_source_check
  CHECK (payer_source IS NULL OR payer_source IN ('own_money', 'client_money', 'mothers_money', 'custom'));

ALTER TABLE market_laborer_attendance DROP CONSTRAINT IF EXISTS market_laborer_attendance_payer_source_check;
ALTER TABLE market_laborer_attendance ADD CONSTRAINT market_laborer_attendance_payer_source_check
  CHECK (payer_source IS NULL OR payer_source IN ('own_money', 'client_money', 'mothers_money', 'custom'));
