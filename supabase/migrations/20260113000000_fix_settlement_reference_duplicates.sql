-- Migration: Fix Settlement Reference Duplicates
-- Purpose: Find and report duplicate/malformed settlement references
-- Add diagnostic functions and optimized indexes

-- =============================================================================
-- STEP 1: Diagnostic - Find Duplicate Settlement References
-- =============================================================================

-- This query identifies duplicate settlement_reference values
-- Run this manually FIRST to review before any automatic fixes
-- DO NOT automatically fix duplicates - manual review required!

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT settlement_reference)
  INTO duplicate_count
  FROM (
    SELECT settlement_reference, COUNT(*) as cnt
    FROM settlement_groups
    WHERE NOT is_cancelled
    GROUP BY settlement_reference
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % duplicate settlement references. Manual review required!', duplicate_count;
    RAISE NOTICE 'Run this query to see duplicates:';
    RAISE NOTICE 'SELECT settlement_reference, COUNT(*) as cnt, array_agg(id) as ids, array_agg(settlement_date) as dates FROM settlement_groups WHERE NOT is_cancelled GROUP BY settlement_reference HAVING COUNT(*) > 1;';
  ELSE
    RAISE NOTICE 'Good: No duplicate settlement references found';
  END IF;
END $$;

-- =============================================================================
-- STEP 2: Diagnostic - Find Malformed Settlement References
-- =============================================================================

-- Valid format: SET-YYMMDD-NNN (e.g., SET-260113-001)
-- This query identifies references that don't match the expected pattern

DO $$
DECLARE
  malformed_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO malformed_count
  FROM settlement_groups
  WHERE NOT is_cancelled
    AND settlement_reference !~ '^SET-\d{6}-\d+$';

  IF malformed_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % malformed settlement references', malformed_count;
    RAISE NOTICE 'Check settlement_groups table for malformed references';
  ELSE
    RAISE NOTICE 'Good: All settlement references match expected format';
  END IF;
END $$;

-- =============================================================================
-- STEP 3: Create Diagnostic Function
-- =============================================================================

CREATE OR REPLACE FUNCTION check_settlement_reference_integrity(
  p_site_id uuid DEFAULT NULL
)
RETURNS TABLE (
  issue_type text,
  settlement_reference text,
  settlement_id uuid,
  settlement_date date,
  details text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for duplicates
  RETURN QUERY
  SELECT
    'DUPLICATE' as issue_type,
    sg.settlement_reference,
    sg.id as settlement_id,
    sg.settlement_date,
    format('Found %s records with this reference', dup_count::text) as details
  FROM settlement_groups sg
  JOIN (
    SELECT settlement_reference, COUNT(*) as dup_count
    FROM settlement_groups
    WHERE NOT is_cancelled
      AND (p_site_id IS NULL OR site_id = p_site_id)
    GROUP BY settlement_reference
    HAVING COUNT(*) > 1
  ) dups ON sg.settlement_reference = dups.settlement_reference
  WHERE NOT sg.is_cancelled
    AND (p_site_id IS NULL OR sg.site_id = p_site_id)
  ORDER BY sg.settlement_reference, sg.created_at;

  -- Check for malformed references
  RETURN QUERY
  SELECT
    'MALFORMED' as issue_type,
    sg.settlement_reference,
    sg.id as settlement_id,
    sg.settlement_date,
    'Reference does not match expected pattern SET-YYMMDD-NNN' as details
  FROM settlement_groups sg
  WHERE NOT sg.is_cancelled
    AND sg.settlement_reference !~ '^SET-\d{6}-\d+$'
    AND (p_site_id IS NULL OR sg.site_id = p_site_id)
  ORDER BY sg.created_at DESC;

  -- Check for sequence gaps (informational only)
  RETURN QUERY
  WITH numbered_refs AS (
    SELECT
      settlement_reference,
      id,
      settlement_date,
      SUBSTRING(settlement_reference FROM 'SET-(\d{6})-\d+') as date_code,
      CAST(SUBSTRING(settlement_reference FROM 'SET-\d{6}-(\d+)') AS INTEGER) as seq_num,
      ROW_NUMBER() OVER (
        PARTITION BY site_id, SUBSTRING(settlement_reference FROM 'SET-(\d{6})-\d+')
        ORDER BY CAST(SUBSTRING(settlement_reference FROM 'SET-\d{6}-(\d+)') AS INTEGER)
      ) as expected_seq
    FROM settlement_groups
    WHERE NOT is_cancelled
      AND settlement_reference ~ '^SET-\d{6}-\d+$'
      AND (p_site_id IS NULL OR site_id = p_site_id)
  )
  SELECT
    'SEQUENCE_GAP' as issue_type,
    settlement_reference,
    id as settlement_id,
    settlement_date,
    format('Expected sequence %s but got %s', expected_seq, seq_num) as details
  FROM numbered_refs
  WHERE seq_num != expected_seq;
END;
$$;

COMMENT ON FUNCTION check_settlement_reference_integrity IS
  'Diagnose settlement reference integrity issues: duplicates, malformed references, and sequence gaps. Pass site_id to check specific site, or NULL for all sites.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_settlement_reference_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION check_settlement_reference_integrity TO service_role;

-- =============================================================================
-- STEP 4: Create Optimized Index
-- =============================================================================

-- This index speeds up the MAX sequence lookup in create_settlement_group function
-- Only indexes active (non-cancelled) settlements
CREATE INDEX IF NOT EXISTS idx_settlement_groups_site_date_ref
  ON settlement_groups (site_id, settlement_date, settlement_reference)
  WHERE is_cancelled = false;

-- Additional index for fast reference uniqueness checks
CREATE INDEX IF NOT EXISTS idx_settlement_groups_reference_active
  ON settlement_groups (settlement_reference)
  WHERE is_cancelled = false;

COMMENT ON INDEX idx_settlement_groups_site_date_ref IS
  'Optimizes sequence lookup in create_settlement_group function';

COMMENT ON INDEX idx_settlement_groups_reference_active IS
  'Fast uniqueness check for active settlement references';

-- =============================================================================
-- STEP 5: Add Helper Function to Check Reference Availability
-- =============================================================================

CREATE OR REPLACE FUNCTION is_settlement_reference_available(
  p_settlement_reference text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM settlement_groups
    WHERE settlement_reference = p_settlement_reference
      AND NOT is_cancelled
  );
$$;

COMMENT ON FUNCTION is_settlement_reference_available IS
  'Quick check if a settlement reference is available (not used by any active settlement)';

GRANT EXECUTE ON FUNCTION is_settlement_reference_available TO authenticated;
GRANT EXECUTE ON FUNCTION is_settlement_reference_available TO service_role;

-- =============================================================================
-- STEP 6: Create Manual Fix Helper Function (USE WITH CAUTION)
-- =============================================================================

-- This function can be used to manually fix a duplicate reference
-- by appending a suffix to make it unique
-- ONLY use this after manual review and approval!

CREATE OR REPLACE FUNCTION fix_duplicate_settlement_reference(
  p_settlement_id uuid,
  p_new_suffix text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_ref text;
  v_new_ref text;
  v_suffix text;
  v_counter integer := 1;
BEGIN
  -- Get current reference
  SELECT settlement_reference INTO v_old_ref
  FROM settlement_groups
  WHERE id = p_settlement_id;

  IF v_old_ref IS NULL THEN
    RAISE EXCEPTION 'Settlement with ID % not found', p_settlement_id;
  END IF;

  -- Generate new reference
  IF p_new_suffix IS NOT NULL THEN
    v_new_ref := v_old_ref || '-' || p_new_suffix;
  ELSE
    -- Auto-generate suffix
    LOOP
      v_new_ref := v_old_ref || '-FIX' || v_counter::text;
      EXIT WHEN is_settlement_reference_available(v_new_ref);
      v_counter := v_counter + 1;

      IF v_counter > 100 THEN
        RAISE EXCEPTION 'Could not generate unique reference after 100 attempts';
      END IF;
    END LOOP;
  END IF;

  -- Verify new reference is available
  IF NOT is_settlement_reference_available(v_new_ref) THEN
    RAISE EXCEPTION 'New reference % is already in use', v_new_ref;
  END IF;

  -- Update the reference
  UPDATE settlement_groups
  SET settlement_reference = v_new_ref,
      updated_at = now()
  WHERE id = p_settlement_id;

  RAISE NOTICE 'Updated settlement % reference from % to %', p_settlement_id, v_old_ref, v_new_ref;

  RETURN v_new_ref;
END;
$$;

COMMENT ON FUNCTION fix_duplicate_settlement_reference IS
  'MANUAL USE ONLY: Fix a duplicate settlement reference by appending a suffix. Use after manual review.';

GRANT EXECUTE ON FUNCTION fix_duplicate_settlement_reference TO service_role;
-- DO NOT grant to authenticated - this should only be run by admins

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Migration 20260113000000 completed successfully';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run: SELECT * FROM check_settlement_reference_integrity() to review issues';
  RAISE NOTICE '2. If duplicates found, manually review and fix using fix_duplicate_settlement_reference()';
  RAISE NOTICE '3. Proceed with migration 20260113000001 (improved atomic function)';
  RAISE NOTICE '====================================================================';
END $$;
