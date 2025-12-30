-- Migration: Fix Settlement Groups by Timestamp Clustering
-- Purpose: Create proper settlement_groups for each unique settlement batch
--          based on payment_date + payer_source combinations
--
-- Problem: Previous migration merged multiple settlements into single groups
--          when they had same date/source. Need to separate them properly.
--
-- Approach:
-- 1. Reset attendance records that have incorrect settlement_group links
-- 2. Recalculate totals for existing settlement_groups
-- 3. Create new settlement_groups for orphaned attendance records
-- 4. Use payment_date + payer_source + payment_time as unique batch identifiers

-- ============================================================================
-- STEP 1: Audit current state
-- ============================================================================
DO $$
DECLARE
  v_total_paid_attendance INT;
  v_attendance_with_group INT;
  v_attendance_without_group INT;
  v_total_settlement_groups INT;
  v_daily_salary_groups INT;
BEGIN
  -- Count total paid daily attendance (excluding contract laborers)
  SELECT COUNT(*) INTO v_total_paid_attendance
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.is_paid = true
    AND l.laborer_type != 'contract';

  -- Count with settlement_group_id
  SELECT COUNT(*) INTO v_attendance_with_group
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.is_paid = true
    AND da.settlement_group_id IS NOT NULL
    AND l.laborer_type != 'contract';

  -- Count without settlement_group_id
  v_attendance_without_group := v_total_paid_attendance - v_attendance_with_group;

  -- Count total non-cancelled settlement_groups
  SELECT COUNT(*) INTO v_total_settlement_groups
  FROM settlement_groups
  WHERE is_cancelled = false;

  -- Count "Daily Salary" type groups (no labor_payments with is_under_contract=true)
  SELECT COUNT(*) INTO v_daily_salary_groups
  FROM settlement_groups sg
  WHERE sg.is_cancelled = false
    AND sg.payment_type != 'advance'
    AND NOT EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    );

  RAISE NOTICE '=== AUDIT BEFORE FIX ===';
  RAISE NOTICE 'Total paid daily attendance (non-contract): %', v_total_paid_attendance;
  RAISE NOTICE 'Attendance WITH settlement_group_id: %', v_attendance_with_group;
  RAISE NOTICE 'Attendance WITHOUT settlement_group_id: %', v_attendance_without_group;
  RAISE NOTICE 'Total active settlement_groups: %', v_total_settlement_groups;
  RAISE NOTICE 'Daily Salary type groups: %', v_daily_salary_groups;
END $$;

-- ============================================================================
-- STEP 2: Create settlement_groups for unique payment batches
-- Key: Group by (site_id, date, payment_date, payer_source, payer_name)
-- This ensures each unique payment gets its own settlement_group
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_settlement_group_id UUID;
  v_settlement_ref TEXT;
  v_date_code TEXT;
  v_next_seq INT;
  v_created_count INT := 0;
  v_updated_count INT := 0;
BEGIN
  RAISE NOTICE 'Creating settlement_groups for unique payment batches...';

  -- Find unique payment batches from daily attendance
  -- Each unique combination of (site, date, payment_date, payer_source) = 1 settlement batch
  FOR rec IN
    SELECT
      da.site_id,
      da.date as settlement_date,
      da.payment_date,
      COALESCE(da.payer_source, 'own_money') as payer_source,
      COALESCE(da.payer_name, '') as payer_name,
      da.paid_via as payment_channel,
      da.payment_mode,
      da.engineer_transaction_id,
      da.subcontract_id,
      COUNT(*) as laborer_count,
      SUM(COALESCE(da.daily_earnings, 0)) as total_amount,
      MIN(da.updated_at) as first_updated_at,
      ARRAY_AGG(da.id) as attendance_ids
    FROM daily_attendance da
    JOIN laborers l ON da.laborer_id = l.id
    WHERE da.is_paid = true
      AND l.laborer_type != 'contract'
    GROUP BY
      da.site_id,
      da.date,
      da.payment_date,
      COALESCE(da.payer_source, 'own_money'),
      COALESCE(da.payer_name, ''),
      da.paid_via,
      da.payment_mode,
      da.engineer_transaction_id,
      da.subcontract_id
    ORDER BY da.date ASC, da.payment_date ASC
  LOOP
    -- Check if a matching settlement_group already exists
    SELECT id INTO v_settlement_group_id
    FROM settlement_groups
    WHERE site_id = rec.site_id
      AND settlement_date = rec.settlement_date
      AND is_cancelled = false
      AND payment_channel = COALESCE(rec.payment_channel, 'direct')
      AND payer_source = rec.payer_source
      AND COALESCE(payer_name, '') = rec.payer_name
      AND actual_payment_date IS NOT DISTINCT FROM rec.payment_date
      AND engineer_transaction_id IS NOT DISTINCT FROM rec.engineer_transaction_id
      AND subcontract_id IS NOT DISTINCT FROM rec.subcontract_id
    LIMIT 1;

    IF v_settlement_group_id IS NOT NULL THEN
      -- Update existing settlement_group with correct totals
      UPDATE settlement_groups
      SET
        total_amount = rec.total_amount,
        laborer_count = rec.laborer_count,
        updated_at = NOW()
      WHERE id = v_settlement_group_id;

      v_updated_count := v_updated_count + 1;
    ELSE
      -- Create new settlement_group
      v_date_code := TO_CHAR(rec.settlement_date, 'YYMMDD');

      -- Find next sequence for this site and date
      SELECT COALESCE(MAX(
        CAST(SUBSTRING(settlement_reference FROM 'SET-' || v_date_code || '-(\d+)') AS INT)
      ), 0) + 1
      INTO v_next_seq
      FROM settlement_groups
      WHERE site_id = rec.site_id
        AND settlement_reference LIKE 'SET-' || v_date_code || '-%';

      v_settlement_ref := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

      -- Ensure uniqueness
      WHILE EXISTS (SELECT 1 FROM settlement_groups WHERE settlement_reference = v_settlement_ref) LOOP
        v_next_seq := v_next_seq + 1;
        v_settlement_ref := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');
      END LOOP;

      INSERT INTO settlement_groups (
        id,
        settlement_reference,
        site_id,
        settlement_date,
        total_amount,
        laborer_count,
        payment_channel,
        payment_mode,
        payer_source,
        payer_name,
        subcontract_id,
        engineer_transaction_id,
        is_cancelled,
        payment_type,
        settlement_type,
        actual_payment_date,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_settlement_ref,
        rec.site_id,
        rec.settlement_date,
        rec.total_amount,
        rec.laborer_count,
        COALESCE(rec.payment_channel, 'direct'),
        rec.payment_mode,
        rec.payer_source,
        NULLIF(rec.payer_name, ''),
        rec.subcontract_id,
        rec.engineer_transaction_id,
        false,
        'salary',
        'date_wise',
        COALESCE(rec.payment_date, rec.settlement_date),
        COALESCE(rec.first_updated_at, NOW()),
        NOW()
      )
      RETURNING id INTO v_settlement_group_id;

      v_created_count := v_created_count + 1;

      RAISE NOTICE 'Created settlement_group % for date %, payer %, amount Rs.%',
        v_settlement_ref, rec.settlement_date, rec.payer_source, rec.total_amount;
    END IF;

    -- Link all attendance records in this batch to the settlement_group
    UPDATE daily_attendance
    SET settlement_group_id = v_settlement_group_id
    WHERE id = ANY(rec.attendance_ids);
  END LOOP;

  RAISE NOTICE 'Created % new settlement_groups', v_created_count;
  RAISE NOTICE 'Updated % existing settlement_groups', v_updated_count;
END $$;

-- ============================================================================
-- STEP 3: Do the same for market_laborer_attendance
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_settlement_group_id UUID;
  v_settlement_ref TEXT;
  v_date_code TEXT;
  v_next_seq INT;
  v_created_count INT := 0;
BEGIN
  RAISE NOTICE 'Processing market_laborer_attendance...';

  FOR rec IN
    SELECT
      ma.site_id,
      ma.date as settlement_date,
      ma.payment_date,
      COALESCE(ma.payer_source, 'own_money') as payer_source,
      COALESCE(ma.payer_name, '') as payer_name,
      ma.paid_via as payment_channel,
      ma.payment_mode,
      ma.engineer_transaction_id,
      ma.subcontract_id,
      SUM(ma.count) as laborer_count,
      SUM(COALESCE(ma.total_cost, 0)) as total_amount,
      MIN(ma.updated_at) as first_updated_at,
      ARRAY_AGG(ma.id) as attendance_ids
    FROM market_laborer_attendance ma
    WHERE ma.is_paid = true
    GROUP BY
      ma.site_id,
      ma.date,
      ma.payment_date,
      COALESCE(ma.payer_source, 'own_money'),
      COALESCE(ma.payer_name, ''),
      ma.paid_via,
      ma.payment_mode,
      ma.engineer_transaction_id,
      ma.subcontract_id
    ORDER BY ma.date ASC
  LOOP
    -- Check if can merge with existing settlement_group for same batch
    SELECT id INTO v_settlement_group_id
    FROM settlement_groups
    WHERE site_id = rec.site_id
      AND settlement_date = rec.settlement_date
      AND is_cancelled = false
      AND payment_channel = COALESCE(rec.payment_channel, 'direct')
      AND payer_source = rec.payer_source
      AND COALESCE(payer_name, '') = rec.payer_name
      AND actual_payment_date IS NOT DISTINCT FROM rec.payment_date
      AND engineer_transaction_id IS NOT DISTINCT FROM rec.engineer_transaction_id
      AND subcontract_id IS NOT DISTINCT FROM rec.subcontract_id
    LIMIT 1;

    IF v_settlement_group_id IS NOT NULL THEN
      -- Add market labor to existing group
      UPDATE settlement_groups
      SET
        total_amount = total_amount + rec.total_amount,
        laborer_count = laborer_count + rec.laborer_count,
        updated_at = NOW()
      WHERE id = v_settlement_group_id;
    ELSE
      -- Create new
      v_date_code := TO_CHAR(rec.settlement_date, 'YYMMDD');

      SELECT COALESCE(MAX(
        CAST(SUBSTRING(settlement_reference FROM 'SET-' || v_date_code || '-(\d+)') AS INT)
      ), 0) + 1
      INTO v_next_seq
      FROM settlement_groups
      WHERE site_id = rec.site_id
        AND settlement_reference LIKE 'SET-' || v_date_code || '-%';

      v_settlement_ref := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

      WHILE EXISTS (SELECT 1 FROM settlement_groups WHERE settlement_reference = v_settlement_ref) LOOP
        v_next_seq := v_next_seq + 1;
        v_settlement_ref := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');
      END LOOP;

      INSERT INTO settlement_groups (
        id,
        settlement_reference,
        site_id,
        settlement_date,
        total_amount,
        laborer_count,
        payment_channel,
        payment_mode,
        payer_source,
        payer_name,
        subcontract_id,
        engineer_transaction_id,
        is_cancelled,
        payment_type,
        settlement_type,
        actual_payment_date,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_settlement_ref,
        rec.site_id,
        rec.settlement_date,
        rec.total_amount,
        rec.laborer_count,
        COALESCE(rec.payment_channel, 'direct'),
        rec.payment_mode,
        rec.payer_source,
        NULLIF(rec.payer_name, ''),
        rec.subcontract_id,
        rec.engineer_transaction_id,
        false,
        'salary',
        'date_wise',
        COALESCE(rec.payment_date, rec.settlement_date),
        COALESCE(rec.first_updated_at, NOW()),
        NOW()
      )
      RETURNING id INTO v_settlement_group_id;

      v_created_count := v_created_count + 1;
    END IF;

    -- Link market attendance
    UPDATE market_laborer_attendance
    SET settlement_group_id = v_settlement_group_id
    WHERE id = ANY(rec.attendance_ids);
  END LOOP;

  RAISE NOTICE 'Created/merged % market settlement_groups', v_created_count;
END $$;

-- ============================================================================
-- STEP 4: Clean up - remove settlement_groups with 0 amount or cancelled
-- ============================================================================
DO $$
DECLARE
  v_deleted_count INT;
BEGIN
  -- Mark empty groups as cancelled
  UPDATE settlement_groups
  SET
    is_cancelled = true,
    cancelled_at = NOW(),
    cancellation_reason = 'Migration cleanup: group had no linked attendance records'
  WHERE is_cancelled = false
    AND total_amount = 0
    AND NOT EXISTS (
      SELECT 1 FROM daily_attendance WHERE settlement_group_id = settlement_groups.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM market_laborer_attendance WHERE settlement_group_id = settlement_groups.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM labor_payments WHERE settlement_group_id = settlement_groups.id
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cancelled % empty settlement_groups', v_deleted_count;
END $$;

-- ============================================================================
-- STEP 5: Final verification
-- ============================================================================
DO $$
DECLARE
  v_daily_salary_count INT;
  v_contract_salary_count INT;
  v_advance_count INT;
  v_total_daily_amount NUMERIC;
  v_attendance_covered INT;
  v_attendance_total INT;
BEGIN
  -- Count Daily Salary groups
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
  INTO v_daily_salary_count, v_total_daily_amount
  FROM settlement_groups sg
  WHERE sg.is_cancelled = false
    AND sg.payment_type != 'advance'
    AND NOT EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    );

  -- Count Contract Salary groups
  SELECT COUNT(*) INTO v_contract_salary_count
  FROM settlement_groups sg
  WHERE sg.is_cancelled = false
    AND EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    );

  -- Count Advance groups
  SELECT COUNT(*) INTO v_advance_count
  FROM settlement_groups
  WHERE is_cancelled = false
    AND payment_type = 'advance';

  -- Count attendance with settlement_group
  SELECT COUNT(*) INTO v_attendance_covered
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.is_paid = true
    AND da.settlement_group_id IS NOT NULL
    AND l.laborer_type != 'contract';

  SELECT COUNT(*) INTO v_attendance_total
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.is_paid = true
    AND l.laborer_type != 'contract';

  RAISE NOTICE '=== FINAL VERIFICATION ===';
  RAISE NOTICE 'Daily Salary settlement_groups: % (Total: Rs.%)', v_daily_salary_count, v_total_daily_amount;
  RAISE NOTICE 'Contract Salary settlement_groups: %', v_contract_salary_count;
  RAISE NOTICE 'Advance settlement_groups: %', v_advance_count;
  RAISE NOTICE 'Paid attendance with settlement_group: % / %', v_attendance_covered, v_attendance_total;

  IF v_attendance_covered < v_attendance_total THEN
    RAISE WARNING 'Some attendance records still missing settlement_group!';
  ELSE
    RAISE NOTICE 'SUCCESS: All paid attendance linked to settlement_groups!';
  END IF;
END $$;
