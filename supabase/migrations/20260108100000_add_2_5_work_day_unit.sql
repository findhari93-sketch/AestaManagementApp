-- Migration: Add 2.5 work day unit option
-- Description: Adds 2.5 as a valid work_days value for extra long shifts (6 AM - 11 PM)

-- Add 2.5 to the work_days_value enum
ALTER TYPE public.work_days_value ADD VALUE IF NOT EXISTS '2.5';

-- Update the check constraint on daily_attendance table to allow 2.5
ALTER TABLE public.daily_attendance DROP CONSTRAINT IF EXISTS daily_attendance_work_days_check;
ALTER TABLE public.daily_attendance ADD CONSTRAINT daily_attendance_work_days_check
  CHECK (work_days = ANY (ARRAY[0.5, (1)::numeric, 1.5, (2)::numeric, 2.5]));

-- Update comment to reflect new allowed values
COMMENT ON COLUMN public.daily_attendance.work_days IS 'Number of days worked: 0.5, 1, 1.5, 2, or 2.5';
