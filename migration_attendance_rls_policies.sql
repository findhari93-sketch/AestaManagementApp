-- =====================================================
-- MIGRATION: Add RLS Policies for Attendance Tables
-- =====================================================
-- Problem: daily_attendance and market_laborer_attendance tables
-- have RLS enabled but missing DELETE (and possibly other) policies.
-- This causes Supabase queries to hang indefinitely.
--
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: Diagnostic - Check current RLS status
-- =====================================================
-- Run this first to see the current state:
/*
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('daily_attendance', 'market_laborer_attendance', 'daily_work_summary');

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('daily_attendance', 'market_laborer_attendance');
*/

-- =====================================================
-- STEP 2: Enable RLS (if not already enabled)
-- =====================================================
ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_laborer_attendance ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: Drop existing policies to avoid conflicts
-- =====================================================
DROP POLICY IF EXISTS "Users can view daily attendance" ON daily_attendance;
DROP POLICY IF EXISTS "Users can insert daily attendance" ON daily_attendance;
DROP POLICY IF EXISTS "Users can update daily attendance" ON daily_attendance;
DROP POLICY IF EXISTS "Users can delete daily attendance" ON daily_attendance;

DROP POLICY IF EXISTS "Users can view market laborer attendance" ON market_laborer_attendance;
DROP POLICY IF EXISTS "Users can insert market laborer attendance" ON market_laborer_attendance;
DROP POLICY IF EXISTS "Users can update market laborer attendance" ON market_laborer_attendance;
DROP POLICY IF EXISTS "Users can delete market laborer attendance" ON market_laborer_attendance;

-- =====================================================
-- STEP 4: Create policies for daily_attendance
-- =====================================================
CREATE POLICY "Users can view daily attendance"
  ON daily_attendance
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert daily attendance"
  ON daily_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update daily attendance"
  ON daily_attendance
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete daily attendance"
  ON daily_attendance
  FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- STEP 5: Create policies for market_laborer_attendance
-- =====================================================
CREATE POLICY "Users can view market laborer attendance"
  ON market_laborer_attendance
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert market laborer attendance"
  ON market_laborer_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update market laborer attendance"
  ON market_laborer_attendance
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete market laborer attendance"
  ON market_laborer_attendance
  FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- STEP 6: Verification - Run after migration
-- =====================================================
-- Verify policies were created:
/*
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('daily_attendance', 'market_laborer_attendance')
ORDER BY tablename, cmd;
*/

-- Expected output:
-- | tablename                  | policyname                            | cmd    |
-- |---------------------------|---------------------------------------|--------|
-- | daily_attendance          | Users can delete daily attendance     | DELETE |
-- | daily_attendance          | Users can insert daily attendance     | INSERT |
-- | daily_attendance          | Users can view daily attendance       | SELECT |
-- | daily_attendance          | Users can update daily attendance     | UPDATE |
-- | market_laborer_attendance | Users can delete market laborer...    | DELETE |
-- | market_laborer_attendance | Users can insert market laborer...    | INSERT |
-- | market_laborer_attendance | Users can view market laborer...      | SELECT |
-- | market_laborer_attendance | Users can update market laborer...    | UPDATE |
