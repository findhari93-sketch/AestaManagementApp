-- Migration: Fix settlement_groups missing subcontract_id and handle duplicates
-- Purpose:
--   1. Backfill subcontract_id for settlement_groups created by migration 20251228200000
--   2. Identify and handle duplicate settlement_groups for the same site/date
-- Root cause: Migration 20251228200000 didn't preserve subcontract_id from attendance records

-- ============================================================================
-- 1. Backfill subcontract_id for settlement_groups that are missing it
-- ============================================================================

-- First, update from daily_attendance records
UPDATE settlement_groups sg
SET subcontract_id = (
  SELECT da.subcontract_id
  FROM daily_attendance da
  WHERE da.settlement_group_id = sg.id
    AND da.subcontract_id IS NOT NULL
  LIMIT 1
)
WHERE sg.subcontract_id IS NULL
  AND EXISTS (
    SELECT 1 FROM daily_attendance da
    WHERE da.settlement_group_id = sg.id
      AND da.subcontract_id IS NOT NULL
  );

-- Then, update from market_laborer_attendance records (for those still NULL)
UPDATE settlement_groups sg
SET subcontract_id = (
  SELECT ma.subcontract_id
  FROM market_laborer_attendance ma
  WHERE ma.settlement_group_id = sg.id
    AND ma.subcontract_id IS NOT NULL
  LIMIT 1
)
WHERE sg.subcontract_id IS NULL
  AND EXISTS (
    SELECT 1 FROM market_laborer_attendance ma
    WHERE ma.settlement_group_id = sg.id
      AND ma.subcontract_id IS NOT NULL
  );

-- ============================================================================
-- 2. Also update individual attendance records to match settlement_group's subcontract
-- This ensures all records in a settlement have consistent subcontract_id
-- ============================================================================

-- Update daily_attendance records where settlement_group has subcontract but record doesn't
UPDATE daily_attendance da
SET subcontract_id = sg.subcontract_id
FROM settlement_groups sg
WHERE da.settlement_group_id = sg.id
  AND da.subcontract_id IS NULL
  AND sg.subcontract_id IS NOT NULL;

-- Update market_laborer_attendance records where settlement_group has subcontract but record doesn't
UPDATE market_laborer_attendance ma
SET subcontract_id = sg.subcontract_id
FROM settlement_groups sg
WHERE ma.settlement_group_id = sg.id
  AND ma.subcontract_id IS NULL
  AND sg.subcontract_id IS NOT NULL;

-- ============================================================================
-- 3. Fix duplicate settlement_groups by cancelling System Migration duplicates
-- ============================================================================
DO $$
DECLARE
  dup_rec RECORD;
  keep_id UUID;
  cancel_id UUID;
  moved_count INT := 0;
  cancelled_count INT := 0;
BEGIN
  -- For each date that has duplicates, find System Migration entries to cancel
  FOR dup_rec IN
    SELECT sg.site_id, sg.settlement_date
    FROM settlement_groups sg
    WHERE sg.is_cancelled = false
      AND (sg.payment_type IS NULL OR sg.payment_type NOT IN ('advance', 'other'))
    GROUP BY sg.site_id, sg.settlement_date
    HAVING COUNT(*) > 1
  LOOP
    -- Find the "proper" settlement_group (created by user, not System Migration)
    SELECT id INTO keep_id
    FROM settlement_groups
    WHERE site_id = dup_rec.site_id
      AND settlement_date = dup_rec.settlement_date
      AND is_cancelled = false
      AND (created_by_name IS NULL OR created_by_name NOT LIKE '%System%')
    ORDER BY created_at ASC
    LIMIT 1;

    -- If we found a proper group to keep
    IF keep_id IS NOT NULL THEN
      -- Find the System Migration duplicate(s) to cancel
      FOR cancel_id IN
        SELECT id
        FROM settlement_groups
        WHERE site_id = dup_rec.site_id
          AND settlement_date = dup_rec.settlement_date
          AND is_cancelled = false
          AND created_by_name LIKE '%System%'
          AND id != keep_id
      LOOP
        -- Move daily_attendance records to the proper settlement_group
        UPDATE daily_attendance
        SET settlement_group_id = keep_id
        WHERE settlement_group_id = cancel_id;
        GET DIAGNOSTICS moved_count = ROW_COUNT;

        -- Move market_laborer_attendance records to the proper settlement_group
        UPDATE market_laborer_attendance
        SET settlement_group_id = keep_id
        WHERE settlement_group_id = cancel_id;

        -- Cancel the duplicate settlement_group
        UPDATE settlement_groups
        SET is_cancelled = true,
            notes = COALESCE(notes, '') || ' [Auto-cancelled: duplicate merged to ' || keep_id || ']'
        WHERE id = cancel_id;

        cancelled_count := cancelled_count + 1;
        RAISE NOTICE 'Cancelled duplicate group % for date %, moved % records to %',
          cancel_id, dup_rec.settlement_date, moved_count, keep_id;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Cancelled % duplicate System Migration settlement_groups', cancelled_count;
END $$;

-- ============================================================================
-- 3b. Report remaining duplicates (those without System Migration)
-- ============================================================================
DO $$
DECLARE
  dup_count INT;
  rec RECORD;
BEGIN
  -- Count remaining duplicates
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT site_id, settlement_date, COUNT(*) as cnt
    FROM settlement_groups
    WHERE is_cancelled = false
      AND (payment_type IS NULL OR payment_type NOT IN ('advance', 'other'))
    GROUP BY site_id, settlement_date
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE NOTICE 'Remaining % date(s) with duplicate settlement_groups (need manual review):', dup_count;

    FOR rec IN
      SELECT site_id, settlement_date, COUNT(*) as cnt,
             STRING_AGG(created_by_name, ', ' ORDER BY created_at) as creators
      FROM settlement_groups
      WHERE is_cancelled = false
        AND (payment_type IS NULL OR payment_type NOT IN ('advance', 'other'))
      GROUP BY site_id, settlement_date
      HAVING COUNT(*) > 1
      ORDER BY settlement_date
    LOOP
      RAISE NOTICE '  Date: %, Count: %, Creators: %', rec.settlement_date, rec.cnt, rec.creators;
    END LOOP;
  ELSE
    RAISE NOTICE 'All duplicate settlement_groups resolved';
  END IF;
END $$;

-- ============================================================================
-- 4. Verify backfill results
-- ============================================================================
DO $$
DECLARE
  sg_with_subcontract INT;
  sg_without_subcontract INT;
  daily_mismatched INT;
  market_mismatched INT;
BEGIN
  -- Count settlement_groups with/without subcontract_id
  SELECT COUNT(*) INTO sg_with_subcontract
  FROM settlement_groups
  WHERE subcontract_id IS NOT NULL AND is_cancelled = false;

  SELECT COUNT(*) INTO sg_without_subcontract
  FROM settlement_groups
  WHERE subcontract_id IS NULL AND is_cancelled = false;

  -- Count attendance records that don't match their settlement_group's subcontract
  SELECT COUNT(*) INTO daily_mismatched
  FROM daily_attendance da
  JOIN settlement_groups sg ON da.settlement_group_id = sg.id
  WHERE da.subcontract_id IS DISTINCT FROM sg.subcontract_id
    AND sg.subcontract_id IS NOT NULL;

  SELECT COUNT(*) INTO market_mismatched
  FROM market_laborer_attendance ma
  JOIN settlement_groups sg ON ma.settlement_group_id = sg.id
  WHERE ma.subcontract_id IS DISTINCT FROM sg.subcontract_id
    AND sg.subcontract_id IS NOT NULL;

  RAISE NOTICE 'Settlement groups with subcontract: %, without: %', sg_with_subcontract, sg_without_subcontract;
  RAISE NOTICE 'Daily records with mismatched subcontract: %', daily_mismatched;
  RAISE NOTICE 'Market records with mismatched subcontract: %', market_mismatched;
END $$;
