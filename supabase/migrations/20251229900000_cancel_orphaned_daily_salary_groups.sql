-- Migration: Cancel orphaned Daily Salary settlement_groups
-- Purpose: Fix discrepancy where expenses shows 20 Daily Salary but payments shows 18
--
-- Root cause: Some settlement_groups exist without any attendance records linked to them
-- These orphaned groups appear in v_all_expenses but not in the payments page

-- Step 1: Audit - find orphaned Daily Salary settlement_groups
DO $$
DECLARE
  v_site_id UUID;
  rec RECORD;
  v_orphaned_count INT := 0;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  RAISE NOTICE '=== ORPHANED DAILY SALARY SETTLEMENT_GROUPS ===';
  RAISE NOTICE 'These groups have no attendance records linked to them:';

  FOR rec IN
    SELECT
      sg.id,
      sg.settlement_reference,
      sg.settlement_date,
      sg.total_amount,
      sg.laborer_count,
      sg.created_at,
      sg.payer_source
    FROM settlement_groups sg
    WHERE sg.site_id = v_site_id
      AND sg.is_cancelled = false
      AND COALESCE(sg.payment_type, 'salary') != 'advance'
      -- Not Contract Salary
      AND NOT EXISTS (
        SELECT 1 FROM labor_payments lp
        WHERE lp.settlement_group_id = sg.id
        AND lp.is_under_contract = true
      )
      -- No daily_attendance linked
      AND NOT EXISTS (
        SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = sg.id
      )
      -- No market_laborer_attendance linked
      AND NOT EXISTS (
        SELECT 1 FROM market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id
      )
    ORDER BY sg.settlement_date DESC
  LOOP
    v_orphaned_count := v_orphaned_count + 1;
    RAISE NOTICE 'ORPHANED: % | Date: % | Amount: Rs.% | Laborers: % | Payer: %',
      rec.settlement_reference, rec.settlement_date, rec.total_amount, rec.laborer_count, rec.payer_source;
  END LOOP;

  RAISE NOTICE 'Total orphaned Daily Salary groups: %', v_orphaned_count;
END $$;

-- Step 2: Cancel the orphaned settlement_groups
UPDATE settlement_groups
SET
  is_cancelled = true,
  cancelled_at = NOW(),
  cancellation_reason = 'Migration cleanup: orphaned group with no attendance records linked'
WHERE is_cancelled = false
  AND COALESCE(payment_type, 'salary') != 'advance'
  -- Not Contract Salary
  AND NOT EXISTS (
    SELECT 1 FROM labor_payments lp
    WHERE lp.settlement_group_id = settlement_groups.id
    AND lp.is_under_contract = true
  )
  -- No daily_attendance linked
  AND NOT EXISTS (
    SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = settlement_groups.id
  )
  -- No market_laborer_attendance linked
  AND NOT EXISTS (
    SELECT 1 FROM market_laborer_attendance ma WHERE ma.settlement_group_id = settlement_groups.id
  );

-- Step 3: Verify final counts
DO $$
DECLARE
  v_site_id UUID;
  v_daily_salary_count INT;
  v_contract_salary_count INT;
  v_advance_count INT;
  v_total INT;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  -- Count Daily Salary in v_all_expenses
  SELECT COUNT(*) INTO v_daily_salary_count
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND expense_type = 'Daily Salary'
    AND is_deleted = false;

  -- Count Contract Salary
  SELECT COUNT(*) INTO v_contract_salary_count
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND expense_type = 'Contract Salary'
    AND is_deleted = false;

  -- Count Advance
  SELECT COUNT(*) INTO v_advance_count
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND expense_type = 'Advance'
    AND is_deleted = false;

  -- Total
  SELECT COUNT(*) INTO v_total
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND source_type = 'settlement'
    AND is_deleted = false;

  RAISE NOTICE '=== FINAL COUNTS AFTER CLEANUP ===';
  RAISE NOTICE 'Daily Salary: %', v_daily_salary_count;
  RAISE NOTICE 'Contract Salary: %', v_contract_salary_count;
  RAISE NOTICE 'Advance: %', v_advance_count;
  RAISE NOTICE 'Total Labor Settlements: %', v_total;
  RAISE NOTICE 'Expected: 18 Daily + 32 Contract + 1 Advance = 51';
END $$;
