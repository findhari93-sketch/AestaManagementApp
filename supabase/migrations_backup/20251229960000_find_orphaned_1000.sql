-- Migration: Find the orphaned Rs.1,000 settlement_group
-- One of the Daily Salary settlement_groups has no attendance linked

DO $$
DECLARE
  v_site_id UUID;
  rec RECORD;
  v_orphaned_total NUMERIC := 0;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  RAISE NOTICE '=== FINDING ORPHANED DAILY SALARY SETTLEMENT_GROUPS ===';

  FOR rec IN
    SELECT
      sg.id,
      sg.settlement_reference,
      sg.settlement_date,
      sg.total_amount,
      sg.laborer_count,
      sg.payer_source,
      (SELECT COUNT(*) FROM daily_attendance da WHERE da.settlement_group_id = sg.id) as daily_count,
      (SELECT COALESCE(SUM(da.daily_earnings), 0) FROM daily_attendance da WHERE da.settlement_group_id = sg.id) as daily_total,
      (SELECT COUNT(*) FROM market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id) as market_count,
      (SELECT COALESCE(SUM(ma.total_cost), 0) FROM market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id) as market_total
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
    IF rec.daily_count = 0 AND rec.market_count = 0 THEN
      RAISE NOTICE 'ORPHANED: % | % | Rs.% | No attendance linked!',
        rec.settlement_reference, rec.settlement_date, rec.total_amount;
      v_orphaned_total := v_orphaned_total + rec.total_amount;
    ELSIF (rec.daily_total + rec.market_total) != rec.total_amount THEN
      RAISE NOTICE 'MISMATCH: % | % | Group: Rs.% vs Attendance: Rs.%',
        rec.settlement_reference, rec.settlement_date, rec.total_amount, (rec.daily_total + rec.market_total);
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Total orphaned amount: Rs.%', v_orphaned_total;
END $$;

-- Cancel the orphaned settlement_group(s)
UPDATE settlement_groups
SET
  is_cancelled = true,
  cancelled_at = NOW(),
  cancellation_reason = 'Migration cleanup: orphaned group - no attendance records linked (discrepancy fix)'
WHERE is_cancelled = false
  AND COALESCE(payment_type, 'salary') != 'advance'
  AND NOT EXISTS (
    SELECT 1 FROM labor_payments lp
    WHERE lp.settlement_group_id = settlement_groups.id
    AND lp.is_under_contract = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = settlement_groups.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM market_laborer_attendance ma WHERE ma.settlement_group_id = settlement_groups.id
  );

-- Verify final totals
DO $$
DECLARE
  v_site_id UUID;
  v_view_daily NUMERIC;
  v_view_contract NUMERIC;
  v_view_advance NUMERIC;
  v_raw_daily NUMERIC;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  SELECT COALESCE(SUM(amount), 0) INTO v_view_daily
  FROM v_all_expenses
  WHERE site_id = v_site_id AND expense_type = 'Daily Salary' AND is_deleted = false;

  SELECT COALESCE(SUM(amount), 0) INTO v_view_contract
  FROM v_all_expenses
  WHERE site_id = v_site_id AND expense_type = 'Contract Salary' AND is_deleted = false;

  SELECT COALESCE(SUM(amount), 0) INTO v_view_advance
  FROM v_all_expenses
  WHERE site_id = v_site_id AND expense_type = 'Advance' AND is_deleted = false;

  SELECT COALESCE(SUM(da.daily_earnings), 0) + COALESCE(
    (SELECT SUM(ma.total_cost) FROM market_laborer_attendance ma
     WHERE ma.site_id = v_site_id AND ma.is_paid = true), 0)
  INTO v_raw_daily
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.site_id = v_site_id AND da.is_paid = true AND l.laborer_type != 'contract';

  RAISE NOTICE '=== FINAL TOTALS AFTER CLEANUP ===';
  RAISE NOTICE 'Daily Salary (view): Rs.%', v_view_daily;
  RAISE NOTICE 'Contract Salary (view): Rs.%', v_view_contract;
  RAISE NOTICE 'Advance (view): Rs.%', v_view_advance;
  RAISE NOTICE 'Raw attendance: Rs.%', v_raw_daily;
  RAISE NOTICE 'TOTAL (view): Rs.%', v_view_daily + v_view_contract + v_view_advance;
  RAISE NOTICE 'Expected: Rs.% (22100 + 94200)', 22100 + 94200;

  IF v_view_daily = v_raw_daily THEN
    RAISE NOTICE 'SUCCESS: Daily Salary now matches raw attendance!';
  ELSE
    RAISE WARNING 'Still mismatch: view=% vs raw=%', v_view_daily, v_raw_daily;
  END IF;
END $$;
