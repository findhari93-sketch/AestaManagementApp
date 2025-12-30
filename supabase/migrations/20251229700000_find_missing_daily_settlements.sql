-- Migration: Find the 2 missing Daily Salary settlements
-- User expects 24 Daily Salary but only 22 exist in active settlement_groups

-- ============================================================================
-- STEP 1: Check cancelled Daily Salary settlement_groups
-- ============================================================================
DO $$
DECLARE
  v_site_id UUID;
  rec RECORD;
  v_cancelled_daily INT := 0;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  RAISE NOTICE '=== CANCELLED DAILY SALARY SETTLEMENTS ===';

  FOR rec IN
    SELECT
      sg.id,
      sg.settlement_reference,
      sg.settlement_date,
      sg.total_amount,
      sg.laborer_count,
      sg.cancelled_at,
      sg.cancellation_reason
    FROM settlement_groups sg
    WHERE sg.site_id = v_site_id
      AND sg.is_cancelled = true
      AND COALESCE(sg.payment_type, 'salary') != 'advance'
      AND NOT EXISTS (
        SELECT 1 FROM labor_payments lp
        WHERE lp.settlement_group_id = sg.id
        AND lp.is_under_contract = true
      )
    ORDER BY sg.cancelled_at DESC
    LIMIT 20
  LOOP
    v_cancelled_daily := v_cancelled_daily + 1;
    RAISE NOTICE 'CANCELLED: % | Date: % | Amount: Rs.% | Laborers: % | Reason: %',
      rec.settlement_reference, rec.settlement_date, rec.total_amount, rec.laborer_count, rec.cancellation_reason;
  END LOOP;

  RAISE NOTICE 'Total cancelled Daily Salary groups: %', v_cancelled_daily;
END $$;

-- ============================================================================
-- STEP 2: Compare Payments page count vs settlement_groups
-- Count unique paid attendance batches and compare to settlement_groups
-- ============================================================================
DO $$
DECLARE
  v_site_id UUID;
  v_unique_payment_batches INT;
  v_settlement_groups_daily INT;
  v_paid_attendance_without_group INT;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  -- Count unique payment batches from attendance
  -- (each unique combination of date + payer_source should be a settlement)
  SELECT COUNT(DISTINCT (date::text || '-' || COALESCE(payer_source, 'default') || '-' || COALESCE(payer_name, '')))
  INTO v_unique_payment_batches
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.site_id = v_site_id
    AND da.is_paid = true
    AND l.laborer_type != 'contract';

  -- Count active Daily Salary settlement_groups
  SELECT COUNT(*) INTO v_settlement_groups_daily
  FROM settlement_groups sg
  WHERE sg.site_id = v_site_id
    AND sg.is_cancelled = false
    AND COALESCE(sg.payment_type, 'salary') != 'advance'
    AND NOT EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    );

  -- Count paid attendance without settlement_group
  SELECT COUNT(*) INTO v_paid_attendance_without_group
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.site_id = v_site_id
    AND da.is_paid = true
    AND da.settlement_group_id IS NULL
    AND l.laborer_type != 'contract';

  RAISE NOTICE '=== PAYMENT BATCH ANALYSIS ===';
  RAISE NOTICE 'Unique payment batches from attendance: %', v_unique_payment_batches;
  RAISE NOTICE 'Active Daily Salary settlement_groups: %', v_settlement_groups_daily;
  RAISE NOTICE 'Paid attendance without settlement_group: %', v_paid_attendance_without_group;

  IF v_unique_payment_batches > v_settlement_groups_daily THEN
    RAISE NOTICE 'DISCREPANCY: % payment batches but only % settlement_groups',
      v_unique_payment_batches, v_settlement_groups_daily;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: List batches that should exist but might be missing
-- ============================================================================
DO $$
DECLARE
  v_site_id UUID;
  rec RECORD;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  RAISE NOTICE '=== PAYMENT BATCHES FROM ATTENDANCE ===';

  -- Show all unique payment batches from attendance
  FOR rec IN
    SELECT
      da.date as settlement_date,
      COALESCE(da.payer_source, 'own_money') as payer_source,
      COUNT(DISTINCT da.laborer_id) as laborer_count,
      SUM(da.daily_earnings) as total_amount,
      BOOL_AND(da.settlement_group_id IS NOT NULL) as all_have_group,
      COUNT(DISTINCT da.settlement_group_id) as unique_groups
    FROM daily_attendance da
    JOIN laborers l ON da.laborer_id = l.id
    WHERE da.site_id = v_site_id
      AND da.is_paid = true
      AND l.laborer_type != 'contract'
    GROUP BY da.date, COALESCE(da.payer_source, 'own_money')
    ORDER BY da.date DESC
  LOOP
    IF NOT rec.all_have_group OR rec.unique_groups = 0 THEN
      RAISE NOTICE 'ISSUE: Date % | Payer: % | Laborers: % | Rs.% | Has Group: % | Groups: %',
        rec.settlement_date, rec.payer_source, rec.laborer_count, rec.total_amount,
        rec.all_have_group, rec.unique_groups;
    ELSE
      RAISE NOTICE 'OK: Date % | Payer: % | Laborers: % | Rs.% | Groups: %',
        rec.settlement_date, rec.payer_source, rec.laborer_count, rec.total_amount, rec.unique_groups;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Check market labor attendance
-- ============================================================================
DO $$
DECLARE
  v_site_id UUID;
  v_market_batches INT;
  v_market_without_group INT;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  SELECT COUNT(DISTINCT (date::text || '-' || COALESCE(payer_source, 'default')))
  INTO v_market_batches
  FROM market_laborer_attendance
  WHERE site_id = v_site_id
    AND is_paid = true;

  SELECT COUNT(*) INTO v_market_without_group
  FROM market_laborer_attendance
  WHERE site_id = v_site_id
    AND is_paid = true
    AND settlement_group_id IS NULL;

  RAISE NOTICE '=== MARKET LABOR ===';
  RAISE NOTICE 'Unique market payment batches: %', v_market_batches;
  RAISE NOTICE 'Market records without settlement_group: %', v_market_without_group;
END $$;
