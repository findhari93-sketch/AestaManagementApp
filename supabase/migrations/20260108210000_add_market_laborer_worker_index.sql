-- Migration: Add worker_index to market_laborer_attendance
-- Purpose: Allow multiple entries for the same role (e.g., Mason #1, Mason #2) with different work days/rates
-- Date: 2026-01-08

-- Step 1: Add worker_index column to distinguish multiple workers of same role
ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS worker_index INTEGER NOT NULL DEFAULT 1;

-- Step 2: Drop the old unique constraint that prevents multiple entries per role
ALTER TABLE market_laborer_attendance
DROP CONSTRAINT IF EXISTS market_laborer_attendance_site_id_date_role_id_key;

-- Step 3: Add new unique constraint that includes worker_index (if not exists)
-- This allows: (site_1, 2026-01-06, mason_role, 1) AND (site_1, 2026-01-06, mason_role, 2)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'market_laborer_attendance_site_date_role_worker_key'
    ) THEN
        ALTER TABLE market_laborer_attendance
        ADD CONSTRAINT market_laborer_attendance_site_date_role_worker_key
        UNIQUE (site_id, date, role_id, worker_index);
    END IF;
END
$$;

-- Step 4: For existing records with count > 1, we'll keep them as-is
-- The application will handle individual workers going forward
-- Existing aggregated records will continue to work with their current count values

COMMENT ON COLUMN market_laborer_attendance.worker_index IS 'Index to distinguish multiple workers of the same role on the same day (1, 2, 3...). Allows individual work day/rate tracking per worker.';
