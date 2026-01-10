-- Migration: Fix RLS policies for all tables
-- Run this in Supabase SQL Editor to fix permission denied errors
-- Created: 2026-01-10

-- =====================================================
-- STEP 1: Ensure RLS is enabled on key tables
-- =====================================================

ALTER TABLE IF EXISTS daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS market_laborer_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_work_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_expense_sync ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Drop existing policies to avoid conflicts
-- =====================================================

-- daily_attendance policies
DROP POLICY IF EXISTS "allow_all_select_daily_attendance" ON daily_attendance;
DROP POLICY IF EXISTS "allow_all_insert_daily_attendance" ON daily_attendance;
DROP POLICY IF EXISTS "allow_all_update_daily_attendance" ON daily_attendance;
DROP POLICY IF EXISTS "allow_all_delete_daily_attendance" ON daily_attendance;
DROP POLICY IF EXISTS "allow_anon_select_daily_attendance" ON daily_attendance;
DROP POLICY IF EXISTS "allow_anon_insert_daily_attendance" ON daily_attendance;
DROP POLICY IF EXISTS "allow_anon_update_daily_attendance" ON daily_attendance;
DROP POLICY IF EXISTS "allow_anon_delete_daily_attendance" ON daily_attendance;

-- market_laborer_attendance policies
DROP POLICY IF EXISTS "allow_all_select_market_laborer_attendance" ON market_laborer_attendance;
DROP POLICY IF EXISTS "allow_all_insert_market_laborer_attendance" ON market_laborer_attendance;
DROP POLICY IF EXISTS "allow_all_update_market_laborer_attendance" ON market_laborer_attendance;
DROP POLICY IF EXISTS "allow_all_delete_market_laborer_attendance" ON market_laborer_attendance;

-- daily_work_summary policies
DROP POLICY IF EXISTS "allow_all_select_daily_work_summary" ON daily_work_summary;
DROP POLICY IF EXISTS "allow_all_insert_daily_work_summary" ON daily_work_summary;
DROP POLICY IF EXISTS "allow_all_update_daily_work_summary" ON daily_work_summary;
DROP POLICY IF EXISTS "allow_all_delete_daily_work_summary" ON daily_work_summary;

-- expenses policies
DROP POLICY IF EXISTS "allow_all_select_expenses" ON expenses;
DROP POLICY IF EXISTS "allow_all_insert_expenses" ON expenses;
DROP POLICY IF EXISTS "allow_all_update_expenses" ON expenses;
DROP POLICY IF EXISTS "allow_all_delete_expenses" ON expenses;

-- expense_categories policies
DROP POLICY IF EXISTS "allow_all_select_expense_categories" ON expense_categories;
DROP POLICY IF EXISTS "allow_all_insert_expense_categories" ON expense_categories;
DROP POLICY IF EXISTS "allow_all_update_expense_categories" ON expense_categories;
DROP POLICY IF EXISTS "allow_all_delete_expense_categories" ON expense_categories;

-- attendance_expense_sync policies
DROP POLICY IF EXISTS "allow_all_select_attendance_expense_sync" ON attendance_expense_sync;
DROP POLICY IF EXISTS "allow_all_insert_attendance_expense_sync" ON attendance_expense_sync;
DROP POLICY IF EXISTS "allow_all_update_attendance_expense_sync" ON attendance_expense_sync;
DROP POLICY IF EXISTS "allow_all_delete_attendance_expense_sync" ON attendance_expense_sync;

-- =====================================================
-- STEP 3: Create permissive policies for authenticated users
-- =====================================================

-- daily_attendance - Full access for authenticated users
CREATE POLICY "allow_all_select_daily_attendance" ON daily_attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_insert_daily_attendance" ON daily_attendance
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_all_update_daily_attendance" ON daily_attendance
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_delete_daily_attendance" ON daily_attendance
  FOR DELETE TO authenticated USING (true);

-- market_laborer_attendance - Full access for authenticated users
CREATE POLICY "allow_all_select_market_laborer_attendance" ON market_laborer_attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_insert_market_laborer_attendance" ON market_laborer_attendance
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_all_update_market_laborer_attendance" ON market_laborer_attendance
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_delete_market_laborer_attendance" ON market_laborer_attendance
  FOR DELETE TO authenticated USING (true);

-- daily_work_summary - Full access for authenticated users
CREATE POLICY "allow_all_select_daily_work_summary" ON daily_work_summary
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_insert_daily_work_summary" ON daily_work_summary
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_all_update_daily_work_summary" ON daily_work_summary
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_delete_daily_work_summary" ON daily_work_summary
  FOR DELETE TO authenticated USING (true);

-- expenses - Full access for authenticated users
CREATE POLICY "allow_all_select_expenses" ON expenses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_insert_expenses" ON expenses
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_all_update_expenses" ON expenses
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_delete_expenses" ON expenses
  FOR DELETE TO authenticated USING (true);

-- expense_categories - Full access for authenticated users
CREATE POLICY "allow_all_select_expense_categories" ON expense_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_insert_expense_categories" ON expense_categories
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_all_update_expense_categories" ON expense_categories
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_delete_expense_categories" ON expense_categories
  FOR DELETE TO authenticated USING (true);

-- attendance_expense_sync - Full access for authenticated users
CREATE POLICY "allow_all_select_attendance_expense_sync" ON attendance_expense_sync
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_insert_attendance_expense_sync" ON attendance_expense_sync
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_all_update_attendance_expense_sync" ON attendance_expense_sync
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_delete_attendance_expense_sync" ON attendance_expense_sync
  FOR DELETE TO authenticated USING (true);

-- =====================================================
-- STEP 4: Also add policies for anon role (fallback)
-- =====================================================

-- daily_attendance - anon access
CREATE POLICY "allow_anon_select_daily_attendance" ON daily_attendance
  FOR SELECT TO anon USING (true);
CREATE POLICY "allow_anon_insert_daily_attendance" ON daily_attendance
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_anon_update_daily_attendance" ON daily_attendance
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_delete_daily_attendance" ON daily_attendance
  FOR DELETE TO anon USING (true);

-- =====================================================
-- DONE: All policies created
-- =====================================================
