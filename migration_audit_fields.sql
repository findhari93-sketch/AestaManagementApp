-- Migration: Add updated_by audit columns to priority tables
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. Add updated_by columns to daily_attendance
-- =====================================================
ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES users(id);

COMMENT ON COLUMN daily_attendance.updated_by IS 'Name of user who last updated this record';
COMMENT ON COLUMN daily_attendance.updated_by_user_id IS 'UUID of user who last updated this record';

-- =====================================================
-- 2. Add updated_by columns to tea_shop_entries
-- =====================================================
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES users(id);

COMMENT ON COLUMN tea_shop_entries.updated_by IS 'Name of user who last updated this record';
COMMENT ON COLUMN tea_shop_entries.updated_by_user_id IS 'UUID of user who last updated this record';

-- =====================================================
-- 3. Add updated_by columns to market_laborer_attendance
-- =====================================================
ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES users(id);

COMMENT ON COLUMN market_laborer_attendance.updated_by IS 'Name of user who last updated this record';
COMMENT ON COLUMN market_laborer_attendance.updated_by_user_id IS 'UUID of user who last updated this record';

-- =====================================================
-- 4. Add updated_by columns to daily_work_summary
-- =====================================================
ALTER TABLE daily_work_summary
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES users(id);

COMMENT ON COLUMN daily_work_summary.updated_by IS 'Name of user who last updated this record';
COMMENT ON COLUMN daily_work_summary.updated_by_user_id IS 'UUID of user who last updated this record';

-- =====================================================
-- 5. Create indexes for efficient user lookups
-- =====================================================
-- Only create indexes for columns that actually exist
CREATE INDEX IF NOT EXISTS idx_daily_attendance_updated_by_user_id
ON daily_attendance(updated_by_user_id);

CREATE INDEX IF NOT EXISTS idx_tea_shop_entries_updated_by_user_id
ON tea_shop_entries(updated_by_user_id);

CREATE INDEX IF NOT EXISTS idx_market_laborer_attendance_updated_by_user_id
ON market_laborer_attendance(updated_by_user_id);

CREATE INDEX IF NOT EXISTS idx_daily_work_summary_updated_by_user_id
ON daily_work_summary(updated_by_user_id);