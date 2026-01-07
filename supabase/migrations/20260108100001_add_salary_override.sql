-- Migration: Add salary override fields
-- Description: Allows users to override calculated salary with a final amount and optional reason

-- Add salary override fields to daily_attendance table
ALTER TABLE public.daily_attendance
  ADD COLUMN IF NOT EXISTS salary_override numeric NULL,
  ADD COLUMN IF NOT EXISTS salary_override_reason text NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.daily_attendance.salary_override IS 'User-overridden final salary amount. When set, this takes precedence over calculated salary (work_days * daily_rate_applied).';
COMMENT ON COLUMN public.daily_attendance.salary_override_reason IS 'Reason for salary override (e.g., "Festival bonus", "Early arrival", "Quality work")';

-- Add salary override fields to market_laborer_attendance table for consistency
ALTER TABLE public.market_laborer_attendance
  ADD COLUMN IF NOT EXISTS salary_override_per_person numeric NULL,
  ADD COLUMN IF NOT EXISTS salary_override_reason text NULL;

COMMENT ON COLUMN public.market_laborer_attendance.salary_override_per_person IS 'User-overridden rate per person. When set, total_cost = count * salary_override_per_person * day_units.';
COMMENT ON COLUMN public.market_laborer_attendance.salary_override_reason IS 'Reason for salary override.';

-- Create index for performance on reports querying overridden salaries
CREATE INDEX IF NOT EXISTS idx_daily_attendance_salary_override
  ON public.daily_attendance(salary_override)
  WHERE salary_override IS NOT NULL;
