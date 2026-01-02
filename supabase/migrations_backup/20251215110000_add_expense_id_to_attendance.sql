-- Add expense_id to attendance tables for linking direct payments to expenses
-- This allows tracking which expense was created for each payment

-- Add to daily_attendance
ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL;

-- Add to market_laborer_attendance
ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_daily_attendance_expense_id
ON daily_attendance(expense_id)
WHERE expense_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_laborer_attendance_expense_id
ON market_laborer_attendance(expense_id)
WHERE expense_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN daily_attendance.expense_id IS 'Links to expenses table for salary payments (direct payments)';
COMMENT ON COLUMN market_laborer_attendance.expense_id IS 'Links to expenses table for salary payments (direct payments)';
