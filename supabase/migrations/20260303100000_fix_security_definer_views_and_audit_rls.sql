-- Migration: Fix Security Definer Views and Enable RLS on settlement_creation_audit
-- Purpose: Address Supabase dashboard security warnings:
--   1. "Security Definer View" - views bypass RLS because they run as postgres owner
--   2. "RLS Disabled in Public" - settlement_creation_audit table missing RLS
--
-- Fix: Set security_invoker = true on all public views (PostgreSQL 15+ feature)
--      so they respect the calling user's RLS policies instead of the owner's.
--
-- Safety: Since all current RLS policies are permissive (USING (true)) for
--         authenticated users, this change has zero functional impact --
--         it only establishes the correct security posture.
--
-- Created: 2026-03-03

-- =============================================================================
-- PART 1: Fix Security Definer Views
-- Dynamically set security_invoker = true on ALL public views
-- =============================================================================

DO $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT viewname FROM pg_views WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_name);
    RAISE NOTICE 'Set security_invoker on view: %', v_name;
  END LOOP;
END $$;

-- =============================================================================
-- PART 2: Enable RLS on settlement_creation_audit table (if it exists)
-- This table was created after the comprehensive RLS fix migration and was missed
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'settlement_creation_audit') THEN
    EXECUTE 'ALTER TABLE public.settlement_creation_audit ENABLE ROW LEVEL SECURITY';

    -- Drop any existing policies first to avoid conflicts
    DROP POLICY IF EXISTS "allow_authenticated_select_settlement_creation_audit" ON public.settlement_creation_audit;
    DROP POLICY IF EXISTS "allow_authenticated_insert_settlement_creation_audit" ON public.settlement_creation_audit;
    DROP POLICY IF EXISTS "allow_authenticated_update_settlement_creation_audit" ON public.settlement_creation_audit;
    DROP POLICY IF EXISTS "allow_authenticated_delete_settlement_creation_audit" ON public.settlement_creation_audit;
    DROP POLICY IF EXISTS "allow_anon_select_settlement_creation_audit" ON public.settlement_creation_audit;
    DROP POLICY IF EXISTS "allow_anon_insert_settlement_creation_audit" ON public.settlement_creation_audit;
    DROP POLICY IF EXISTS "allow_anon_update_settlement_creation_audit" ON public.settlement_creation_audit;
    DROP POLICY IF EXISTS "allow_anon_delete_settlement_creation_audit" ON public.settlement_creation_audit;

    -- Create permissive policies matching the pattern from fix_all_rls_policies migration
    CREATE POLICY "allow_authenticated_select_settlement_creation_audit"
      ON public.settlement_creation_audit FOR SELECT
      TO authenticated USING (true);

    CREATE POLICY "allow_authenticated_insert_settlement_creation_audit"
      ON public.settlement_creation_audit FOR INSERT
      TO authenticated WITH CHECK (true);

    CREATE POLICY "allow_authenticated_update_settlement_creation_audit"
      ON public.settlement_creation_audit FOR UPDATE
      TO authenticated USING (true) WITH CHECK (true);

    CREATE POLICY "allow_authenticated_delete_settlement_creation_audit"
      ON public.settlement_creation_audit FOR DELETE
      TO authenticated USING (true);

    CREATE POLICY "allow_anon_select_settlement_creation_audit"
      ON public.settlement_creation_audit FOR SELECT
      TO anon USING (true);

    CREATE POLICY "allow_anon_insert_settlement_creation_audit"
      ON public.settlement_creation_audit FOR INSERT
      TO anon WITH CHECK (true);

    CREATE POLICY "allow_anon_update_settlement_creation_audit"
      ON public.settlement_creation_audit FOR UPDATE
      TO anon USING (true) WITH CHECK (true);

    CREATE POLICY "allow_anon_delete_settlement_creation_audit"
      ON public.settlement_creation_audit FOR DELETE
      TO anon USING (true);

    RAISE NOTICE 'Enabled RLS and created policies on settlement_creation_audit';
  ELSE
    RAISE NOTICE 'settlement_creation_audit table does not exist, skipping';
  END IF;
END $$;
