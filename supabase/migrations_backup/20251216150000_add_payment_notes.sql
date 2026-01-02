-- Add payment_notes column to daily_attendance and market_laborer_attendance tables
-- This allows saving notes/comments when settling payments

-- Add payment_notes column to daily_attendance
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Add payment_notes column to market_laborer_attendance
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN daily_attendance.payment_notes IS 'Notes/comments added when settling the payment';
COMMENT ON COLUMN market_laborer_attendance.payment_notes IS 'Notes/comments added when settling the payment';
