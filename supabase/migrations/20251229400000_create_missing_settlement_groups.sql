-- Migration: Create Missing Settlement Groups
-- Purpose: Fix data integrity issue where paid attendance records don't have settlement_groups
--          causing them to not appear in the expenses page
--
-- Problem:
--   - Payments page shows 24 paid date settlements
--   - Expenses page only shows 4 "Daily Salary" records
--   - Gap: 20 settlements have attendance records marked is_paid=true but no settlement_group

-- ============================================================================
-- STEP 1: Audit - Count records before fix
-- ============================================================================
DO $$
DECLARE
  v_daily_paid_no_group INT;
  v_market_paid_no_group INT;
  v_existing_groups INT;
BEGIN
  -- Count daily attendance records that are paid but have no settlement_group_id
  SELECT COUNT(*) INTO v_daily_paid_no_group
  FROM daily_attendance
  WHERE is_paid = true
    AND settlement_group_id IS NULL;

  -- Count market attendance records that are paid but have no settlement_group_id
  SELECT COUNT(*) INTO v_market_paid_no_group
  FROM market_laborer_attendance
  WHERE is_paid = true
    AND settlement_group_id IS NULL;

  -- Count existing non-cancelled settlement_groups
  SELECT COUNT(*) INTO v_existing_groups
  FROM settlement_groups
  WHERE is_cancelled = false;

  RAISE NOTICE '=== AUDIT BEFORE FIX ===';
  RAISE NOTICE 'Daily attendance records paid but missing settlement_group: %', v_daily_paid_no_group;
  RAISE NOTICE 'Market attendance records paid but missing settlement_group: %', v_market_paid_no_group;
  RAISE NOTICE 'Existing active settlement_groups: %', v_existing_groups;
END $$;

-- ============================================================================
-- STEP 2: Create settlement_groups for paid daily attendance without groups
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_settlement_group_id UUID;
  v_settlement_ref TEXT;
  v_date_code TEXT;
  v_next_seq INT;
  v_created_count INT := 0;
  v_linked_daily INT := 0;
  v_linked_market INT := 0;
BEGIN
  RAISE NOTICE 'Creating missing settlement_groups for paid attendance...';

  -- Find unique date + site combinations with paid attendance but no settlement_group
  FOR rec IN
    SELECT
      da.site_id,
      da.date as settlement_date,
      da.paid_via as payment_channel,
      da.payment_mode,
      da.payer_source,
      da.payer_name,
      da.payment_date,
      da.engineer_transaction_id,
      da.subcontract_id,
      COUNT(*) as laborer_count,
      SUM(COALESCE(da.daily_earnings, 0)) as total_amount,
      MIN(da.created_at) as first_created_at
    FROM daily_attendance da
    JOIN laborers l ON da.laborer_id = l.id
    WHERE da.is_paid = true
      AND da.settlement_group_id IS NULL
      AND l.laborer_type != 'contract'  -- Only daily/market laborers, not contract
    GROUP BY
      da.site_id,
      da.date,
      da.paid_via,
      da.payment_mode,
      da.payer_source,
      da.payer_name,
      da.payment_date,
      da.engineer_transaction_id,
      da.subcontract_id
    ORDER BY da.date ASC
  LOOP
    -- Generate settlement reference using the settlement_date
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

    -- Create the settlement_group
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
      rec.payer_name,
      rec.subcontract_id,
      rec.engineer_transaction_id,
      false,
      'salary',
      'date_wise',
      COALESCE(rec.payment_date, rec.settlement_date),
      COALESCE(rec.first_created_at, NOW()),
      NOW()
    )
    RETURNING id INTO v_settlement_group_id;

    -- Link the daily attendance records to this settlement_group
    UPDATE daily_attendance
    SET settlement_group_id = v_settlement_group_id
    WHERE site_id = rec.site_id
      AND date = rec.settlement_date
      AND is_paid = true
      AND settlement_group_id IS NULL
      AND paid_via IS NOT DISTINCT FROM rec.payment_channel
      AND payment_mode IS NOT DISTINCT FROM rec.payment_mode
      AND payer_source IS NOT DISTINCT FROM rec.payer_source
      AND payer_name IS NOT DISTINCT FROM rec.payer_name
      AND payment_date IS NOT DISTINCT FROM rec.payment_date
      AND engineer_transaction_id IS NOT DISTINCT FROM rec.engineer_transaction_id
      AND subcontract_id IS NOT DISTINCT FROM rec.subcontract_id
      AND laborer_id IN (SELECT id FROM laborers WHERE laborer_type != 'contract');

    v_linked_daily := v_linked_daily + (SELECT COUNT(*) FROM daily_attendance WHERE settlement_group_id = v_settlement_group_id);
    v_created_count := v_created_count + 1;

    RAISE NOTICE 'Created settlement_group % for date % with % laborers, Rs.%',
      v_settlement_ref, rec.settlement_date, rec.laborer_count, rec.total_amount;
  END LOOP;

  RAISE NOTICE 'Created % settlement_groups for daily attendance', v_created_count;
  RAISE NOTICE 'Linked % daily attendance records', v_linked_daily;
END $$;

-- ============================================================================
-- STEP 3: Create settlement_groups for paid market attendance without groups
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_settlement_group_id UUID;
  v_settlement_ref TEXT;
  v_date_code TEXT;
  v_next_seq INT;
  v_created_count INT := 0;
  v_linked_market INT := 0;
BEGIN
  RAISE NOTICE 'Creating missing settlement_groups for paid market attendance...';

  -- Find unique date + site combinations for market attendance
  FOR rec IN
    SELECT
      ma.site_id,
      ma.date as settlement_date,
      ma.paid_via as payment_channel,
      ma.payment_mode,
      ma.payer_source,
      ma.payer_name,
      ma.payment_date,
      ma.engineer_transaction_id,
      ma.subcontract_id,
      COUNT(*) as record_count,
      SUM(ma.count) as laborer_count,
      SUM(COALESCE(ma.total_cost, 0)) as total_amount,
      MIN(ma.created_at) as first_created_at
    FROM market_laborer_attendance ma
    WHERE ma.is_paid = true
      AND ma.settlement_group_id IS NULL
    GROUP BY
      ma.site_id,
      ma.date,
      ma.paid_via,
      ma.payment_mode,
      ma.payer_source,
      ma.payer_name,
      ma.payment_date,
      ma.engineer_transaction_id,
      ma.subcontract_id
    ORDER BY ma.date ASC
  LOOP
    -- Check if we can merge with an existing settlement_group for same date/site
    SELECT id INTO v_settlement_group_id
    FROM settlement_groups
    WHERE site_id = rec.site_id
      AND settlement_date = rec.settlement_date
      AND payment_channel = COALESCE(rec.payment_channel, 'direct')
      AND is_cancelled = false
      AND engineer_transaction_id IS NOT DISTINCT FROM rec.engineer_transaction_id
      AND subcontract_id IS NOT DISTINCT FROM rec.subcontract_id
    LIMIT 1;

    IF v_settlement_group_id IS NOT NULL THEN
      -- Merge into existing settlement_group
      UPDATE settlement_groups
      SET
        total_amount = total_amount + rec.total_amount,
        laborer_count = laborer_count + rec.laborer_count,
        updated_at = NOW()
      WHERE id = v_settlement_group_id;

      RAISE NOTICE 'Merged market attendance (% laborers, Rs.%) into existing settlement_group for date %',
        rec.laborer_count, rec.total_amount, rec.settlement_date;
    ELSE
      -- Create new settlement_group
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
        rec.payer_name,
        rec.subcontract_id,
        rec.engineer_transaction_id,
        false,
        'salary',
        'date_wise',
        COALESCE(rec.payment_date, rec.settlement_date),
        COALESCE(rec.first_created_at, NOW()),
        NOW()
      )
      RETURNING id INTO v_settlement_group_id;

      v_created_count := v_created_count + 1;

      RAISE NOTICE 'Created settlement_group % for market date % with % laborers, Rs.%',
        v_settlement_ref, rec.settlement_date, rec.laborer_count, rec.total_amount;
    END IF;

    -- Link the market attendance records to this settlement_group
    UPDATE market_laborer_attendance
    SET settlement_group_id = v_settlement_group_id
    WHERE site_id = rec.site_id
      AND date = rec.settlement_date
      AND is_paid = true
      AND settlement_group_id IS NULL
      AND paid_via IS NOT DISTINCT FROM rec.payment_channel
      AND payment_mode IS NOT DISTINCT FROM rec.payment_mode
      AND payer_source IS NOT DISTINCT FROM rec.payer_source
      AND payer_name IS NOT DISTINCT FROM rec.payer_name
      AND payment_date IS NOT DISTINCT FROM rec.payment_date
      AND engineer_transaction_id IS NOT DISTINCT FROM rec.engineer_transaction_id
      AND subcontract_id IS NOT DISTINCT FROM rec.subcontract_id;

    v_linked_market := v_linked_market + (
      SELECT COUNT(*) FROM market_laborer_attendance
      WHERE settlement_group_id = v_settlement_group_id
    );
  END LOOP;

  RAISE NOTICE 'Created % new settlement_groups for market attendance', v_created_count;
  RAISE NOTICE 'Linked market attendance records to settlement_groups';
END $$;

-- ============================================================================
-- STEP 4: Verification - Count records after fix
-- ============================================================================
DO $$
DECLARE
  v_daily_paid_no_group INT;
  v_market_paid_no_group INT;
  v_existing_groups INT;
  v_daily_salary_in_expenses INT;
BEGIN
  -- Count remaining daily attendance records without settlement_group_id
  SELECT COUNT(*) INTO v_daily_paid_no_group
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.is_paid = true
    AND da.settlement_group_id IS NULL
    AND l.laborer_type != 'contract';

  -- Count remaining market attendance records without settlement_group_id
  SELECT COUNT(*) INTO v_market_paid_no_group
  FROM market_laborer_attendance
  WHERE is_paid = true
    AND settlement_group_id IS NULL;

  -- Count total non-cancelled settlement_groups
  SELECT COUNT(*) INTO v_existing_groups
  FROM settlement_groups
  WHERE is_cancelled = false;

  -- Count "Daily Salary" records in v_all_expenses
  SELECT COUNT(*) INTO v_daily_salary_in_expenses
  FROM v_all_expenses
  WHERE expense_type = 'Daily Salary'
    AND is_deleted = false;

  RAISE NOTICE '=== VERIFICATION AFTER FIX ===';
  RAISE NOTICE 'Daily attendance records still missing settlement_group: %', v_daily_paid_no_group;
  RAISE NOTICE 'Market attendance records still missing settlement_group: %', v_market_paid_no_group;
  RAISE NOTICE 'Total active settlement_groups: %', v_existing_groups;
  RAISE NOTICE 'Daily Salary records in v_all_expenses: %', v_daily_salary_in_expenses;

  IF v_daily_paid_no_group > 0 OR v_market_paid_no_group > 0 THEN
    RAISE WARNING 'Some paid attendance records still dont have settlement_groups!';
  ELSE
    RAISE NOTICE 'SUCCESS: All paid attendance records now have settlement_groups!';
  END IF;
END $$;
