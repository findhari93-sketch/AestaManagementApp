-- Migration: Fix RLS policies for ALL tables
-- Run this to ensure all authenticated users have full access
-- Created: 2026-01-11

-- =====================================================
-- COMPREHENSIVE FIX: Allow all authenticated users
-- full access to all tables during development
-- =====================================================

DO $$
DECLARE
    tbl RECORD;
    pol RECORD;
BEGIN
    -- Loop through all tables in public schema
    FOR tbl IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        -- Enable RLS on the table
        EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);

        -- Drop existing policies for this table
        FOR pol IN
            SELECT policyname
            FROM pg_policies
            WHERE tablename = tbl.tablename AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl.tablename);
        END LOOP;

        -- Create permissive policies for authenticated users
        EXECUTE format('CREATE POLICY "allow_authenticated_select_%s" ON public.%I FOR SELECT TO authenticated USING (true)', tbl.tablename, tbl.tablename);
        EXECUTE format('CREATE POLICY "allow_authenticated_insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', tbl.tablename, tbl.tablename);
        EXECUTE format('CREATE POLICY "allow_authenticated_update_%s" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', tbl.tablename, tbl.tablename);
        EXECUTE format('CREATE POLICY "allow_authenticated_delete_%s" ON public.%I FOR DELETE TO authenticated USING (true)', tbl.tablename, tbl.tablename);

        -- Also create policies for anon role (fallback)
        EXECUTE format('CREATE POLICY "allow_anon_select_%s" ON public.%I FOR SELECT TO anon USING (true)', tbl.tablename, tbl.tablename);
        EXECUTE format('CREATE POLICY "allow_anon_insert_%s" ON public.%I FOR INSERT TO anon WITH CHECK (true)', tbl.tablename, tbl.tablename);
        EXECUTE format('CREATE POLICY "allow_anon_update_%s" ON public.%I FOR UPDATE TO anon USING (true) WITH CHECK (true)', tbl.tablename, tbl.tablename);
        EXECUTE format('CREATE POLICY "allow_anon_delete_%s" ON public.%I FOR DELETE TO anon USING (true)', tbl.tablename, tbl.tablename);

        RAISE NOTICE 'Fixed RLS policies for table: %', tbl.tablename;
    END LOOP;
END $$;

-- =====================================================
-- GRANT permissions to authenticated and anon roles
-- This ensures the roles have base table access
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
