-- =====================================================
-- FORCE FIX: Disable and Re-enable RLS with proper policies
-- =====================================================
-- NOTE: Wrapped in IF EXISTS checks to handle case when tables don't exist yet

DO $$
DECLARE
  pol RECORD;
BEGIN
  -- Only run if tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_attendance' AND table_schema = 'public') THEN
    RAISE NOTICE 'Tables do not exist yet, skipping RLS policy setup';
    RETURN;
  END IF;

  -- STEP 1: Temporarily disable RLS to allow operations
  ALTER TABLE daily_attendance DISABLE ROW LEVEL SECURITY;
  ALTER TABLE market_laborer_attendance DISABLE ROW LEVEL SECURITY;
  ALTER TABLE daily_work_summary DISABLE ROW LEVEL SECURITY;

  -- STEP 2: Drop ALL existing policies on these tables
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

  RAISE NOTICE 'RLS policies applied successfully';
END $$;
