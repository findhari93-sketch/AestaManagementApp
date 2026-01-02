-- Migration: Audit and Fix Missing Expense Records
-- Purpose: Find and fix the 2 missing records (57 expected - 55 actual = 2 missing)
--
-- Expected breakdown:
--   - 24 Daily Salary settlements
--   - 32 Contract Salary settlements
--   - 1 Advance settlement
--   - Total: 57 records
-- Actual: 55 records in expenses page

-- ============================================================================
-- STEP 1: Audit settlement_groups by type for current site
-- ============================================================================
DO $$
DECLARE
  v_site_id UUID;
  v_daily_count INT;
  v_contract_count INT;
  v_advance_count INT;
  v_cancelled_count INT;
  v_total_active INT;
BEGIN
  -- Get the site ID for "Srinivasan House & Shop"
  SELECT id INTO v_site_id
  FROM sites
  WHERE name ILIKE '%Srinivasan%'
  LIMIT 1;

  IF v_site_id IS NULL THEN
    RAISE NOTICE 'Site not found!';
    RETURN;
  END IF;

  RAISE NOTICE 'Site ID: %', v_site_id;

  -- Count Daily Salary (no labor_payments with is_under_contract=true, not advance)
  SELECT COUNT(*) INTO v_daily_count
  FROM settlement_groups sg
  WHERE sg.site_id = v_site_id
    AND sg.is_cancelled = false
    AND COALESCE(sg.payment_type, 'salary') != 'advance'
    AND NOT EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    );

  -- Count Contract Salary (has labor_payments with is_under_contract=true)
  SELECT COUNT(*) INTO v_contract_count
  FROM settlement_groups sg
  WHERE sg.site_id = v_site_id
    AND sg.is_cancelled = false
    AND EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    );

  -- Count Advance
  SELECT COUNT(*) INTO v_advance_count
  FROM settlement_groups sg
  WHERE sg.site_id = v_site_id
    AND sg.is_cancelled = false
    AND sg.payment_type = 'advance';

  -- Count cancelled
  SELECT COUNT(*) INTO v_cancelled_count
  FROM settlement_groups sg
  WHERE sg.site_id = v_site_id
    AND sg.is_cancelled = true;

  -- Total active
  SELECT COUNT(*) INTO v_total_active
  FROM settlement_groups sg
  WHERE sg.site_id = v_site_id
    AND sg.is_cancelled = false;

  RAISE NOTICE '=== SETTLEMENT_GROUPS FOR SITE ===';
  RAISE NOTICE 'Daily Salary groups: %', v_daily_count;
  RAISE NOTICE 'Contract Salary groups: %', v_contract_count;
  RAISE NOTICE 'Advance groups: %', v_advance_count;
  RAISE NOTICE 'Total active: %', v_total_active;
  RAISE NOTICE 'Cancelled groups: %', v_cancelled_count;
  RAISE NOTICE 'Expected total: % (Daily) + % (Contract) + % (Advance) = %',
    v_daily_count, v_contract_count, v_advance_count,
    v_daily_count + v_contract_count + v_advance_count;
END $$;

-- ============================================================================
-- STEP 2: Check v_all_expenses count for this site
-- ============================================================================
DO $$
DECLARE
  v_site_id UUID;
  v_expense_count INT;
  v_daily_salary_count INT;
  v_contract_salary_count INT;
  v_advance_count INT;
  v_other_count INT;
BEGIN
  SELECT id INTO v_site_id
  FROM sites
  WHERE name ILIKE '%Srinivasan%'
  LIMIT 1;

  -- Count total in v_all_expenses (settlement source only)
  SELECT COUNT(*) INTO v_expense_count
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND source_type = 'settlement'
    AND is_deleted = false;

  -- Count by expense_type
  SELECT COUNT(*) INTO v_daily_salary_count
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND source_type = 'settlement'
    AND expense_type = 'Daily Salary'
    AND is_deleted = false;

  SELECT COUNT(*) INTO v_contract_salary_count
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND source_type = 'settlement'
    AND expense_type = 'Contract Salary'
    AND is_deleted = false;

  SELECT COUNT(*) INTO v_advance_count
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND source_type = 'settlement'
    AND expense_type = 'Advance'
    AND is_deleted = false;

  SELECT COUNT(*) INTO v_other_count
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND source_type = 'settlement'
    AND expense_type NOT IN ('Daily Salary', 'Contract Salary', 'Advance')
    AND is_deleted = false;

  RAISE NOTICE '=== V_ALL_EXPENSES COUNT ===';
  RAISE NOTICE 'Total settlement records in view: %', v_expense_count;
  RAISE NOTICE 'Daily Salary: %', v_daily_salary_count;
  RAISE NOTICE 'Contract Salary: %', v_contract_salary_count;
  RAISE NOTICE 'Advance: %', v_advance_count;
  RAISE NOTICE 'Other types: %', v_other_count;
END $$;

-- ============================================================================
-- STEP 3: Find settlement_groups not appearing in v_all_expenses
-- ============================================================================
DO $$
DECLARE
  v_site_id UUID;
  rec RECORD;
  v_missing_count INT := 0;
BEGIN
  SELECT id INTO v_site_id
  FROM sites
  WHERE name ILIKE '%Srinivasan%'
  LIMIT 1;

  RAISE NOTICE '=== CHECKING FOR MISSING RECORDS ===';

  -- Find settlement_groups that exist but don't appear in v_all_expenses
  FOR rec IN
    SELECT
      sg.id,
      sg.settlement_reference,
      sg.settlement_date,
      sg.total_amount,
      sg.is_cancelled,
      sg.payment_type,
      CASE
        WHEN EXISTS (SELECT 1 FROM labor_payments lp WHERE lp.settlement_group_id = sg.id AND lp.is_under_contract = true)
        THEN 'Contract Salary'
        WHEN sg.payment_type = 'advance' THEN 'Advance'
        ELSE 'Daily Salary'
      END as expected_type
    FROM settlement_groups sg
    WHERE sg.site_id = v_site_id
      AND sg.is_cancelled = false
      AND NOT EXISTS (
        SELECT 1 FROM v_all_expenses vae
        WHERE vae.settlement_group_id = sg.id
          AND vae.is_deleted = false
      )
  LOOP
    v_missing_count := v_missing_count + 1;
    RAISE NOTICE 'MISSING: % | Date: % | Type: % | Amount: Rs.% | Cancelled: %',
      rec.settlement_reference, rec.settlement_date, rec.expected_type, rec.total_amount, rec.is_cancelled;
  END LOOP;

  IF v_missing_count = 0 THEN
    RAISE NOTICE 'No missing settlement_groups found - all appear in v_all_expenses';
  ELSE
    RAISE NOTICE 'Found % settlement_groups missing from v_all_expenses', v_missing_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Check for duplicate settlement_groups (same ref code)
-- ============================================================================
DO $$
DECLARE
  v_site_id UUID;
  rec RECORD;
BEGIN
  SELECT id INTO v_site_id
  FROM sites
  WHERE name ILIKE '%Srinivasan%'
  LIMIT 1;

  RAISE NOTICE '=== CHECKING FOR DUPLICATES ===';

  FOR rec IN
    SELECT
      settlement_reference,
      COUNT(*) as cnt,
      ARRAY_AGG(id) as ids
    FROM settlement_groups
    WHERE site_id = v_site_id
      AND is_cancelled = false
    GROUP BY settlement_reference
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'DUPLICATE REF: % appears % times', rec.settlement_reference, rec.cnt;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: List all active settlement_groups with their classification
-- ============================================================================
DO $$
DECLARE
  v_site_id UUID;
  v_total INT := 0;
BEGIN
  SELECT id INTO v_site_id
  FROM sites
  WHERE name ILIKE '%Srinivasan%'
  LIMIT 1;

  SELECT COUNT(*) INTO v_total
  FROM settlement_groups
  WHERE site_id = v_site_id
    AND is_cancelled = false;

  RAISE NOTICE '=== TOTAL ACTIVE SETTLEMENT_GROUPS: % ===', v_total;
END $$;
