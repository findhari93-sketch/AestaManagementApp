-- Audit Migration: Find the Rs.1,000 discrepancy
-- Expected: Rs.1,16,300 (22,100 daily + 94,200 contract)
-- Actual in expenses: Rs.1,17,300
-- Difference: Rs.1,000

DO $$
DECLARE
  v_site_id UUID;
  v_daily_salary_total NUMERIC;
  v_contract_salary_total NUMERIC;
  v_advance_total NUMERIC;
  v_view_daily_total NUMERIC;
  v_view_contract_total NUMERIC;
  v_view_advance_total NUMERIC;
  v_raw_attendance_total NUMERIC;
  v_raw_contract_total NUMERIC;
  rec RECORD;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  RAISE NOTICE '=== AUDIT: Rs.1,000 DISCREPANCY ===';
  RAISE NOTICE 'Site ID: %', v_site_id;

  -- 1. v_all_expenses totals by type
  RAISE NOTICE '';
  RAISE NOTICE '--- v_all_expenses Totals ---';

  SELECT COALESCE(SUM(amount), 0) INTO v_view_daily_total
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND expense_type = 'Daily Salary'
    AND is_deleted = false;

  SELECT COALESCE(SUM(amount), 0) INTO v_view_contract_total
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND expense_type = 'Contract Salary'
    AND is_deleted = false;

  SELECT COALESCE(SUM(amount), 0) INTO v_view_advance_total
  FROM v_all_expenses
  WHERE site_id = v_site_id
    AND expense_type = 'Advance'
    AND is_deleted = false;

  RAISE NOTICE 'Daily Salary from view: Rs.%', v_view_daily_total;
  RAISE NOTICE 'Contract Salary from view: Rs.%', v_view_contract_total;
  RAISE NOTICE 'Advance from view: Rs.%', v_view_advance_total;
  RAISE NOTICE 'TOTAL from view: Rs.%', v_view_daily_total + v_view_contract_total + v_view_advance_total;

  -- 2. Raw attendance totals
  RAISE NOTICE '';
  RAISE NOTICE '--- Raw Data Totals ---';

  SELECT COALESCE(SUM(da.daily_earnings), 0) INTO v_raw_attendance_total
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.site_id = v_site_id
    AND da.is_paid = true
    AND l.laborer_type != 'contract';

  -- Add market labor
  SELECT v_raw_attendance_total + COALESCE(SUM(ma.total_cost), 0) INTO v_raw_attendance_total
  FROM market_laborer_attendance ma
  WHERE ma.site_id = v_site_id
    AND ma.is_paid = true;

  RAISE NOTICE 'Daily + Market from raw attendance: Rs.%', v_raw_attendance_total;

  SELECT COALESCE(SUM(sg.total_amount), 0) INTO v_raw_contract_total
  FROM settlement_groups sg
  WHERE sg.site_id = v_site_id
    AND sg.is_cancelled = false
    AND EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    );

  RAISE NOTICE 'Contract from settlement_groups: Rs.%', v_raw_contract_total;

  -- 3. Check if Daily Salary aggregation is adding extra
  RAISE NOTICE '';
  RAISE NOTICE '--- Daily Salary Settlement Groups (before aggregation) ---';

  SELECT COALESCE(SUM(sg.total_amount), 0) INTO v_daily_salary_total
  FROM settlement_groups sg
  WHERE sg.site_id = v_site_id
    AND sg.is_cancelled = false
    AND COALESCE(sg.payment_type, 'salary') != 'advance'
    AND NOT EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    );

  RAISE NOTICE 'Daily Salary settlement_groups total (before aggregation): Rs.%', v_daily_salary_total;

  -- 4. List all Daily Salary settlement_groups
  RAISE NOTICE '';
  RAISE NOTICE '--- Daily Salary Settlement Groups Detail ---';

  FOR rec IN
    SELECT
      sg.settlement_reference,
      sg.settlement_date,
      sg.total_amount,
      sg.laborer_count
    FROM settlement_groups sg
    WHERE sg.site_id = v_site_id
      AND sg.is_cancelled = false
      AND COALESCE(sg.payment_type, 'salary') != 'advance'
      AND NOT EXISTS (
        SELECT 1 FROM labor_payments lp
        WHERE lp.settlement_group_id = sg.id
        AND lp.is_under_contract = true
      )
    ORDER BY sg.settlement_date DESC
  LOOP
    RAISE NOTICE '% | % | Rs.% | % laborers',
      rec.settlement_reference, rec.settlement_date, rec.total_amount, rec.laborer_count;
  END LOOP;

  -- 5. Check for duplicate dates in aggregation
  RAISE NOTICE '';
  RAISE NOTICE '--- Dates with Multiple Settlement Groups (potential over-counting) ---';

  FOR rec IN
    SELECT
      sg.settlement_date,
      COUNT(*) as group_count,
      SUM(sg.total_amount) as date_total
    FROM settlement_groups sg
    WHERE sg.site_id = v_site_id
      AND sg.is_cancelled = false
      AND COALESCE(sg.payment_type, 'salary') != 'advance'
      AND NOT EXISTS (
        SELECT 1 FROM labor_payments lp
        WHERE lp.settlement_group_id = sg.id
        AND lp.is_under_contract = true
      )
    GROUP BY sg.settlement_date
    HAVING COUNT(*) > 1
    ORDER BY sg.settlement_date DESC
  LOOP
    RAISE NOTICE 'Date: % | Groups: % | Total: Rs.%',
      rec.settlement_date, rec.group_count, rec.date_total;
  END LOOP;

  -- 6. Discrepancy analysis
  RAISE NOTICE '';
  RAISE NOTICE '=== DISCREPANCY ANALYSIS ===';
  RAISE NOTICE 'View Daily Salary: Rs.%', v_view_daily_total;
  RAISE NOTICE 'Raw attendance total: Rs.%', v_raw_attendance_total;
  RAISE NOTICE 'Difference: Rs.%', v_view_daily_total - v_raw_attendance_total;

  IF v_view_daily_total > v_raw_attendance_total THEN
    RAISE NOTICE 'ISSUE: View shows MORE than raw attendance by Rs.%', v_view_daily_total - v_raw_attendance_total;
  ELSIF v_view_daily_total < v_raw_attendance_total THEN
    RAISE NOTICE 'ISSUE: View shows LESS than raw attendance by Rs.%', v_raw_attendance_total - v_view_daily_total;
  ELSE
    RAISE NOTICE 'OK: View matches raw attendance';
  END IF;

END $$;
