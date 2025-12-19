-- Add 'draft' as valid attendance_status value
-- This fixes the constraint violation error when saving attendance as draft

-- Drop existing constraint and add new one with 'draft' status for daily_attendance
ALTER TABLE daily_attendance DROP CONSTRAINT IF EXISTS daily_attendance_attendance_status_check;
ALTER TABLE daily_attendance ADD CONSTRAINT daily_attendance_attendance_status_check
  CHECK (attendance_status IN ('morning_entry', 'confirmed', 'draft'));

-- Drop existing constraint and add new one with 'draft' status for market_laborer_attendance
ALTER TABLE market_laborer_attendance DROP CONSTRAINT IF EXISTS market_laborer_attendance_attendance_status_check;
ALTER TABLE market_laborer_attendance ADD CONSTRAINT market_laborer_attendance_attendance_status_check
  CHECK (attendance_status IN ('morning_entry', 'confirmed', 'draft'));
