-- Migration: Fix Ref Code Duplicates and Format
-- Purpose:
--   1. Add advisory locks to prevent race conditions in ref code generation
--   2. Convert old YYYYMM format refs to YYMMDD format
--   3. Fix any duplicate ref codes

-- ============================================================================
-- PART A: Fix generate_settlement_reference with Advisory Lock
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_settlement_reference(p_site_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_code TEXT;
  v_next_seq INT;
  v_reference TEXT;
  v_lock_key BIGINT;
BEGIN
  -- Create unique lock key from site_id (using hash of site_id)
  -- This ensures only one process per site can generate a ref at a time
  v_lock_key := ('x' || substr(md5(p_site_id::text || 'settlement'), 1, 15))::bit(64)::bigint;

  -- Acquire advisory lock for this site (automatically released at transaction end)
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Get current date in YYMMDD format
  v_date_code := TO_CHAR(CURRENT_DATE, 'YYMMDD');

  -- Find the next sequence number for this site and day
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(settlement_reference FROM 'SET-' || v_date_code || '-(\d+)')
      AS INT
    )
  ), 0) + 1
  INTO v_next_seq
  FROM settlement_groups
  WHERE site_id = p_site_id
    AND settlement_reference LIKE 'SET-' || v_date_code || '-%';

  -- Format: SET-YYMMDD-NNN (padded to 3 digits)
  v_reference := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_reference;
END;
$$;

COMMENT ON FUNCTION generate_settlement_reference IS 'Generates unique settlement reference in SET-YYMMDD-NNN format with advisory lock to prevent race conditions';

-- ============================================================================
-- PART B: Fix generate_payment_reference with Advisory Lock
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_payment_reference(p_site_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_code TEXT;
  v_next_seq INT;
  v_reference TEXT;
  v_lock_key BIGINT;
BEGIN
  -- Create unique lock key from site_id (different from settlement lock)
  v_lock_key := ('x' || substr(md5(p_site_id::text || 'payment'), 1, 15))::bit(64)::bigint;

  -- Acquire advisory lock for this site
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Get current date in YYMMDD format
  v_date_code := TO_CHAR(CURRENT_DATE, 'YYMMDD');

  -- Find the next sequence number for this site and day
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(payment_reference FROM 'PAY-' || v_date_code || '-(\d+)')
      AS INT
    )
  ), 0) + 1
  INTO v_next_seq
  FROM labor_payments
  WHERE site_id = p_site_id
    AND payment_reference LIKE 'PAY-' || v_date_code || '-%';

  -- Format: PAY-YYMMDD-NNN
  v_reference := 'PAY-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_reference;
END;
$$;

COMMENT ON FUNCTION generate_payment_reference(UUID) IS 'Generates unique payment reference in PAY-YYMMDD-NNN format with advisory lock to prevent race conditions';

-- ============================================================================
-- PART C: Convert Old YYYYMM Format to YYMMDD Format
-- ============================================================================

-- C1. Convert settlement_groups references from SET-YYYYMM-NNN to SET-YYMMDD-NNN
-- Uses settlement_date to get the correct day
DO $$
DECLARE
  rec RECORD;
  v_new_ref TEXT;
  v_date_code TEXT;
  v_seq TEXT;
  v_counter INT := 0;
BEGIN
  RAISE NOTICE 'Starting settlement_groups format conversion...';

  -- Find all old format refs (SET-YYYYMM-NNN where YYYYMM is 6 digits)
  FOR rec IN
    SELECT
      id,
      settlement_reference,
      settlement_date,
      site_id
    FROM settlement_groups
    WHERE settlement_reference ~ '^SET-[0-9]{6}-[0-9]+$'
      AND LENGTH(SUBSTRING(settlement_reference FROM 'SET-([0-9]+)-')) = 6
      AND is_cancelled = false
    ORDER BY created_at ASC
  LOOP
    -- Extract the sequence number from old format
    v_seq := SUBSTRING(rec.settlement_reference FROM 'SET-[0-9]+-([0-9]+)');

    -- Use settlement_date to create new date code (YYMMDD)
    IF rec.settlement_date IS NOT NULL THEN
      v_date_code := TO_CHAR(rec.settlement_date, 'YYMMDD');
    ELSE
      -- Fallback: extract year-month from old ref and use 01 as day
      v_date_code := SUBSTRING(rec.settlement_reference FROM 'SET-([0-9]{2})[0-9]{2}[0-9]{2}-')
                     || SUBSTRING(rec.settlement_reference FROM 'SET-[0-9]{2}([0-9]{2})[0-9]{2}-')
                     || '01';
    END IF;

    -- Create new reference
    v_new_ref := 'SET-' || v_date_code || '-' || LPAD(v_seq, 3, '0');

    -- Check if new ref already exists (avoid collision)
    WHILE EXISTS (
      SELECT 1 FROM settlement_groups
      WHERE settlement_reference = v_new_ref AND id != rec.id
    ) LOOP
      -- Increment sequence to avoid collision
      v_seq := LPAD((v_seq::INT + 1)::TEXT, 3, '0');
      v_new_ref := 'SET-' || v_date_code || '-' || v_seq;
    END LOOP;

    -- Update the record
    UPDATE settlement_groups
    SET settlement_reference = v_new_ref
    WHERE id = rec.id;

    v_counter := v_counter + 1;

    IF v_counter % 100 = 0 THEN
      RAISE NOTICE 'Processed % settlement records...', v_counter;
    END IF;
  END LOOP;

  RAISE NOTICE 'Converted % settlement_groups records from YYYYMM to YYMMDD format', v_counter;
END $$;

-- C2. Convert labor_payments references from PAY-YYYYMM-NNN to PAY-YYMMDD-NNN
DO $$
DECLARE
  rec RECORD;
  v_new_ref TEXT;
  v_date_code TEXT;
  v_seq TEXT;
  v_counter INT := 0;
BEGIN
  RAISE NOTICE 'Starting labor_payments format conversion...';

  -- Find all old format refs
  FOR rec IN
    SELECT
      id,
      payment_reference,
      payment_for_date,
      payment_date,
      site_id
    FROM labor_payments
    WHERE payment_reference ~ '^PAY-[0-9]{6}-[0-9]+$'
      AND LENGTH(SUBSTRING(payment_reference FROM 'PAY-([0-9]+)-')) = 6
    ORDER BY created_at ASC
  LOOP
    -- Extract the sequence number
    v_seq := SUBSTRING(rec.payment_reference FROM 'PAY-[0-9]+-([0-9]+)');

    -- Use payment_for_date or payment_date to create new date code
    IF rec.payment_for_date IS NOT NULL THEN
      v_date_code := TO_CHAR(rec.payment_for_date, 'YYMMDD');
    ELSIF rec.payment_date IS NOT NULL THEN
      v_date_code := TO_CHAR(rec.payment_date, 'YYMMDD');
    ELSE
      -- Fallback
      v_date_code := SUBSTRING(rec.payment_reference FROM 'PAY-([0-9]{2})[0-9]{2}[0-9]{2}-')
                     || SUBSTRING(rec.payment_reference FROM 'PAY-[0-9]{2}([0-9]{2})[0-9]{2}-')
                     || '01';
    END IF;

    -- Create new reference
    v_new_ref := 'PAY-' || v_date_code || '-' || LPAD(v_seq, 3, '0');

    -- Check if new ref already exists
    WHILE EXISTS (
      SELECT 1 FROM labor_payments
      WHERE payment_reference = v_new_ref AND id != rec.id
    ) LOOP
      v_seq := LPAD((v_seq::INT + 1)::TEXT, 3, '0');
      v_new_ref := 'PAY-' || v_date_code || '-' || v_seq;
    END LOOP;

    -- Update the record
    UPDATE labor_payments
    SET payment_reference = v_new_ref
    WHERE id = rec.id;

    v_counter := v_counter + 1;
  END LOOP;

  RAISE NOTICE 'Converted % labor_payments records from YYYYMM to YYMMDD format', v_counter;
END $$;

-- ============================================================================
-- PART D: Fix Any Remaining Duplicate Ref Codes
-- ============================================================================

-- D1. Fix duplicate settlement references
DO $$
DECLARE
  dup_rec RECORD;
  fix_rec RECORD;
  v_new_ref TEXT;
  v_date_code TEXT;
  v_next_seq INT;
  v_fixed_count INT := 0;
BEGIN
  RAISE NOTICE 'Checking for duplicate settlement references...';

  -- Find all duplicate settlement_references
  FOR dup_rec IN
    SELECT settlement_reference, COUNT(*) as cnt
    FROM settlement_groups
    WHERE is_cancelled = false
    GROUP BY settlement_reference
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Found duplicate: % (% occurrences)', dup_rec.settlement_reference, dup_rec.cnt;

    -- For each duplicate, keep the oldest and fix the rest
    FOR fix_rec IN
      SELECT id, settlement_date, site_id, created_at
      FROM settlement_groups
      WHERE settlement_reference = dup_rec.settlement_reference
        AND is_cancelled = false
      ORDER BY created_at ASC
      OFFSET 1  -- Skip the oldest one
    LOOP
      -- Generate new unique reference based on settlement_date
      v_date_code := TO_CHAR(COALESCE(fix_rec.settlement_date, CURRENT_DATE), 'YYMMDD');

      -- Find next available sequence for this date
      SELECT COALESCE(MAX(
        CAST(SUBSTRING(settlement_reference FROM 'SET-' || v_date_code || '-(\d+)') AS INT)
      ), 0) + 1
      INTO v_next_seq
      FROM settlement_groups
      WHERE site_id = fix_rec.site_id
        AND settlement_reference LIKE 'SET-' || v_date_code || '-%';

      v_new_ref := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

      -- Ensure uniqueness
      WHILE EXISTS (SELECT 1 FROM settlement_groups WHERE settlement_reference = v_new_ref) LOOP
        v_next_seq := v_next_seq + 1;
        v_new_ref := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');
      END LOOP;

      -- Update the duplicate
      UPDATE settlement_groups
      SET settlement_reference = v_new_ref
      WHERE id = fix_rec.id;

      v_fixed_count := v_fixed_count + 1;
      RAISE NOTICE 'Fixed: % -> %', dup_rec.settlement_reference, v_new_ref;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Fixed % duplicate settlement references', v_fixed_count;
END $$;

-- D2. Fix duplicate payment references
DO $$
DECLARE
  dup_rec RECORD;
  fix_rec RECORD;
  v_new_ref TEXT;
  v_date_code TEXT;
  v_next_seq INT;
  v_fixed_count INT := 0;
BEGIN
  RAISE NOTICE 'Checking for duplicate payment references...';

  -- Find all duplicate payment_references
  FOR dup_rec IN
    SELECT payment_reference, COUNT(*) as cnt
    FROM labor_payments
    WHERE payment_reference IS NOT NULL
    GROUP BY payment_reference
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Found duplicate: % (% occurrences)', dup_rec.payment_reference, dup_rec.cnt;

    -- For each duplicate, keep the oldest and fix the rest
    FOR fix_rec IN
      SELECT id, payment_for_date, payment_date, site_id, created_at
      FROM labor_payments
      WHERE payment_reference = dup_rec.payment_reference
      ORDER BY created_at ASC
      OFFSET 1
    LOOP
      -- Generate new unique reference
      v_date_code := TO_CHAR(COALESCE(fix_rec.payment_for_date, fix_rec.payment_date, CURRENT_DATE), 'YYMMDD');

      SELECT COALESCE(MAX(
        CAST(SUBSTRING(payment_reference FROM 'PAY-' || v_date_code || '-(\d+)') AS INT)
      ), 0) + 1
      INTO v_next_seq
      FROM labor_payments
      WHERE site_id = fix_rec.site_id
        AND payment_reference LIKE 'PAY-' || v_date_code || '-%';

      v_new_ref := 'PAY-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

      WHILE EXISTS (SELECT 1 FROM labor_payments WHERE payment_reference = v_new_ref) LOOP
        v_next_seq := v_next_seq + 1;
        v_new_ref := 'PAY-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');
      END LOOP;

      UPDATE labor_payments
      SET payment_reference = v_new_ref
      WHERE id = fix_rec.id;

      v_fixed_count := v_fixed_count + 1;
      RAISE NOTICE 'Fixed: % -> %', dup_rec.payment_reference, v_new_ref;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Fixed % duplicate payment references', v_fixed_count;
END $$;

-- ============================================================================
-- PART E: Verification Query (for logging purposes)
-- ============================================================================
DO $$
DECLARE
  v_settlement_dups INT;
  v_payment_dups INT;
  v_old_format_settlements INT;
  v_old_format_payments INT;
BEGIN
  -- Check for remaining duplicates
  SELECT COUNT(*) INTO v_settlement_dups
  FROM (
    SELECT settlement_reference
    FROM settlement_groups
    WHERE is_cancelled = false
    GROUP BY settlement_reference
    HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO v_payment_dups
  FROM (
    SELECT payment_reference
    FROM labor_payments
    WHERE payment_reference IS NOT NULL
    GROUP BY payment_reference
    HAVING COUNT(*) > 1
  ) t;

  -- Check for remaining old format refs
  SELECT COUNT(*) INTO v_old_format_settlements
  FROM settlement_groups
  WHERE settlement_reference ~ '^SET-[0-9]{6}-[0-9]+$'
    AND LENGTH(SUBSTRING(settlement_reference FROM 'SET-([0-9]+)-')) = 6
    AND is_cancelled = false;

  SELECT COUNT(*) INTO v_old_format_payments
  FROM labor_payments
  WHERE payment_reference ~ '^PAY-[0-9]{6}-[0-9]+$'
    AND LENGTH(SUBSTRING(payment_reference FROM 'PAY-([0-9]+)-')) = 6;

  RAISE NOTICE '=== VERIFICATION RESULTS ===';
  RAISE NOTICE 'Remaining duplicate settlement refs: %', v_settlement_dups;
  RAISE NOTICE 'Remaining duplicate payment refs: %', v_payment_dups;
  RAISE NOTICE 'Remaining old format settlement refs: %', v_old_format_settlements;
  RAISE NOTICE 'Remaining old format payment refs: %', v_old_format_payments;

  IF v_settlement_dups > 0 OR v_payment_dups > 0 THEN
    RAISE WARNING 'Some duplicates could not be fixed automatically!';
  END IF;

  IF v_old_format_settlements > 0 OR v_old_format_payments > 0 THEN
    RAISE WARNING 'Some old format refs could not be converted!';
  END IF;
END $$;
