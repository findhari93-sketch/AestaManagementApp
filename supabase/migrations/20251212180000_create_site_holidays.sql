-- Migration: Site Holidays Table
-- Creates table for tracking site-specific holidays
-- Used to mark days when no attendance is expected

-- ============================================
-- Table: site_holidays
-- Stores holidays for each construction site
-- ============================================
CREATE TABLE IF NOT EXISTS site_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  is_paid_holiday BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Ensure no duplicate holidays for the same site and date
  CONSTRAINT unique_site_holiday UNIQUE(site_id, date)
);

-- Index for fetching holidays by site and date range
CREATE INDEX IF NOT EXISTS idx_site_holidays_site_date ON site_holidays(site_id, date DESC);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_site_holidays_date ON site_holidays(date);

-- ============================================
-- RLS Policies for site_holidays table
-- ============================================
ALTER TABLE site_holidays ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (in case of re-run)
DROP POLICY IF EXISTS "Users can view holidays for accessible sites" ON site_holidays;
DROP POLICY IF EXISTS "Users with edit permissions can insert holidays" ON site_holidays;
DROP POLICY IF EXISTS "Users with edit permissions can update holidays" ON site_holidays;
DROP POLICY IF EXISTS "Users with edit permissions can delete holidays" ON site_holidays;

-- All authenticated users can view holidays for sites they have access to
CREATE POLICY "Users can view holidays for accessible sites"
  ON site_holidays FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND (
        u.role = 'admin'
        OR site_id = ANY(u.assigned_sites)
      )
    )
  );

-- Users with edit permissions can insert holidays (admin and site_engineer)
CREATE POLICY "Users with edit permissions can insert holidays"
  ON site_holidays FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'site_engineer')
    )
  );

-- Users with edit permissions can update holidays
CREATE POLICY "Users with edit permissions can update holidays"
  ON site_holidays FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'site_engineer')
    )
  );

-- Users with edit permissions can delete holidays
CREATE POLICY "Users with edit permissions can delete holidays"
  ON site_holidays FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'site_engineer')
    )
  );

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL ON site_holidays TO authenticated;
GRANT ALL ON site_holidays TO service_role;
