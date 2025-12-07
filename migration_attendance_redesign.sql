-- =====================================================
-- ATTENDANCE SYSTEM REDESIGN MIGRATION
-- =====================================================
-- This migration adds:
-- 1. Time tracking columns to daily_attendance
-- 2. Time tracking columns to market_laborer_attendance
-- 3. New daily_work_summary table for work descriptions
-- =====================================================

-- =====================================================
-- PART 1: Modify daily_attendance table
-- =====================================================

-- Add time tracking columns
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS in_time TIME;
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS lunch_out TIME;
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS lunch_in TIME;
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS out_time TIME;

-- Add calculated hour columns
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS work_hours DECIMAL(4,2);
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS break_hours DECIMAL(4,2);
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS total_hours DECIMAL(4,2);

-- Add day units (1, 1.5, or 2 based on hours worked)
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS day_units DECIMAL(2,1) DEFAULT 1;

-- Add snacks amount per person
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS snacks_amount DECIMAL(10,2) DEFAULT 0;

-- =====================================================
-- PART 2: Modify market_laborer_attendance table
-- =====================================================

-- Add time tracking columns (group-level for anonymous workers)
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS in_time TIME;
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS lunch_out TIME;
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS lunch_in TIME;
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS out_time TIME;

-- Add calculated hour columns
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS work_hours DECIMAL(4,2);
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS break_hours DECIMAL(4,2);
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS total_hours DECIMAL(4,2);

-- Add day units
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS day_units DECIMAL(2,1) DEFAULT 1;

-- Add snacks columns (per person and total)
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS snacks_per_person DECIMAL(10,2) DEFAULT 0;
ALTER TABLE market_laborer_attendance ADD COLUMN IF NOT EXISTS total_snacks DECIMAL(10,2) DEFAULT 0;

-- =====================================================
-- PART 3: Create daily_work_summary table
-- =====================================================
-- This table stores per-date work descriptions, status, and comments
-- Also stores aggregated counts and amounts for the day

CREATE TABLE IF NOT EXISTS daily_work_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Work description fields (same for all laborers on this day)
  work_description TEXT,
  work_status TEXT,
  comments TEXT,

  -- Aggregated time info (earliest in, latest out)
  first_in_time TIME,
  last_out_time TIME,

  -- Aggregated laborer counts by type
  daily_laborer_count INTEGER DEFAULT 0,
  contract_laborer_count INTEGER DEFAULT 0,
  market_laborer_count INTEGER DEFAULT 0,
  total_laborer_count INTEGER DEFAULT 0,

  -- Aggregated amounts
  total_salary DECIMAL(12,2) DEFAULT 0,
  total_snacks DECIMAL(10,2) DEFAULT 0,
  total_expense DECIMAL(12,2) DEFAULT 0,

  -- Default snacks amount per person for this day
  -- User can enter this once and it applies to all laborers
  default_snacks_per_person DECIMAL(10,2) DEFAULT 0,

  -- Audit fields
  entered_by VARCHAR(255),
  entered_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one summary per site per date
  UNIQUE(site_id, date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_work_summary_site_date
ON daily_work_summary(site_id, date);

-- =====================================================
-- PART 4: Create trigger for updated_at
-- =====================================================

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_daily_work_summary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (to avoid errors on re-run)
DROP TRIGGER IF EXISTS daily_work_summary_updated_at ON daily_work_summary;

-- Create trigger
CREATE TRIGGER daily_work_summary_updated_at
  BEFORE UPDATE ON daily_work_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_work_summary_timestamp();

-- =====================================================
-- PART 5: Enable RLS on daily_work_summary
-- =====================================================

ALTER TABLE daily_work_summary ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to select
CREATE POLICY "Users can view daily work summaries"
  ON daily_work_summary
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated users to insert
CREATE POLICY "Users can insert daily work summaries"
  ON daily_work_summary
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated users to update
CREATE POLICY "Users can update daily work summaries"
  ON daily_work_summary
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users to delete
CREATE POLICY "Users can delete daily work summaries"
  ON daily_work_summary
  FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- VERIFICATION QUERIES (run after migration)
-- =====================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'daily_attendance';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'market_laborer_attendance';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'daily_work_summary';
