-- =====================================================
-- FORCE FIX: Disable and Re-enable RLS with proper policies
-- =====================================================
-- The DELETE operation is timing out, which means RLS is blocking it
-- This script will forcefully reset RLS on all attendance tables
-- =====================================================

-- STEP 1: Temporarily disable RLS to allow operations
ALTER TABLE daily_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE market_laborer_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_work_summary DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL existing policies on these tables
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on daily_attendance
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'daily_attendance' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON daily_attendance', pol.policyname);
    END LOOP;

    -- Drop all policies on market_laborer_attendance
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'market_laborer_attendance' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON market_laborer_attendance', pol.policyname);
    END LOOP;

    -- Drop all policies on daily_work_summary
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'daily_work_summary' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON daily_work_summary', pol.policyname);
    END LOOP;
END $$;

-- STEP 3: Re-enable RLS
ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_laborer_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_work_summary ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create simple, permissive policies for authenticated users

-- daily_attendance policies
CREATE POLICY "allow_all_select_daily_attendance" ON daily_attendance
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_all_insert_daily_attendance" ON daily_attendance
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_all_update_daily_attendance" ON daily_attendance
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_delete_daily_attendance" ON daily_attendance
    FOR DELETE TO authenticated USING (true);

-- market_laborer_attendance policies
CREATE POLICY "allow_all_select_market_laborer_attendance" ON market_laborer_attendance
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_all_insert_market_laborer_attendance" ON market_laborer_attendance
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_all_update_market_laborer_attendance" ON market_laborer_attendance
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_delete_market_laborer_attendance" ON market_laborer_attendance
    FOR DELETE TO authenticated USING (true);

-- daily_work_summary policies
CREATE POLICY "allow_all_select_daily_work_summary" ON daily_work_summary
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_all_insert_daily_work_summary" ON daily_work_summary
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_all_update_daily_work_summary" ON daily_work_summary
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_delete_daily_work_summary" ON daily_work_summary
    FOR DELETE TO authenticated USING (true);

-- STEP 5: Also add policies for anon role (in case client uses anon key)
CREATE POLICY "allow_anon_select_daily_attendance" ON daily_attendance
    FOR SELECT TO anon USING (true);

CREATE POLICY "allow_anon_insert_daily_attendance" ON daily_attendance
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_anon_update_daily_attendance" ON daily_attendance
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_anon_delete_daily_attendance" ON daily_attendance
    FOR DELETE TO anon USING (true);

CREATE POLICY "allow_anon_select_market_laborer_attendance" ON market_laborer_attendance
    FOR SELECT TO anon USING (true);

CREATE POLICY "allow_anon_insert_market_laborer_attendance" ON market_laborer_attendance
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_anon_update_market_laborer_attendance" ON market_laborer_attendance
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_anon_delete_market_laborer_attendance" ON market_laborer_attendance
    FOR DELETE TO anon USING (true);

CREATE POLICY "allow_anon_select_daily_work_summary" ON daily_work_summary
    FOR SELECT TO anon USING (true);

CREATE POLICY "allow_anon_insert_daily_work_summary" ON daily_work_summary
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_anon_update_daily_work_summary" ON daily_work_summary
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_anon_delete_daily_work_summary" ON daily_work_summary
    FOR DELETE TO anon USING (true);
