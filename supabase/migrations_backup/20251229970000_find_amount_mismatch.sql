-- Migration: Find settlement_groups where total_amount doesn't match attendance
-- The group has attendance linked but the amounts don't add up

DO $$
DECLARE
  v_site_id UUID;
  rec RECORD;
  v_total_mismatch NUMERIC := 0;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  RAISE NOTICE '=== FINDING AMOUNT MISMATCHES IN DAILY SALARY GROUPS ===';

  FOR rec IN
    SELECT
      sg.id,
      sg.settlement_reference,
      sg.settlement_date,
      sg.total_amount as group_amount,
      sg.laborer_count as group_laborers,
      COALESCE((SELECT SUM(da.daily_earnings) FROM daily_attendance da WHERE da.settlement_group_id = sg.id), 0) as daily_amount,
      COALESCE((SELECT COUNT(*) FROM daily_attendance da WHERE da.settlement_group_id = sg.id), 0) as daily_count,
      COALESCE((SELECT SUM(ma.total_cost) FROM market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id), 0) as market_amount,
      COALESCE((SELECT SUM(ma.count) FROM market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id), 0) as market_count
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
    IF rec.group_amount != (rec.daily_amount + rec.market_amount) THEN
      RAISE NOTICE 'MISMATCH: % | % | Group: Rs.% vs Attendance: Rs.% (diff: Rs.%)',
        rec.settlement_reference, rec.settlement_date,
        rec.group_amount, (rec.daily_amount + rec.market_amount),
        rec.group_amount - (rec.daily_amount + rec.market_amount);
      v_total_mismatch := v_total_mismatch + (rec.group_amount - (rec.daily_amount + rec.market_amount));
    ELSE
      RAISE NOTICE 'OK: % | % | Rs.%', rec.settlement_reference, rec.settlement_date, rec.group_amount;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Total mismatch amount: Rs.%', v_total_mismatch;

  IF v_total_mismatch = 1000 THEN
    RAISE NOTICE 'FOUND: The Rs.1,000 discrepancy is from settlement_group amount mismatches';
  END IF;
END $$;

-- Fix the mismatched amounts: update settlement_group total_amount to match attendance
UPDATE settlement_groups sg
SET
  total_amount = (
    COALESCE((SELECT SUM(da.daily_earnings) FROM daily_attendance da WHERE da.settlement_group_id = sg.id), 0) +
    COALESCE((SELECT SUM(ma.total_cost) FROM market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id), 0)
  ),
  laborer_count = (
    COALESCE((SELECT COUNT(*) FROM daily_attendance da WHERE da.settlement_group_id = sg.id), 0) +
    COALESCE((SELECT SUM(ma.count) FROM market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id), 0)
  ),
  updated_at = NOW()
WHERE sg.is_cancelled = false
  AND COALESCE(sg.payment_type, 'salary') != 'advance'
  AND NOT EXISTS (
    SELECT 1 FROM labor_payments lp
    WHERE lp.settlement_group_id = sg.id
    AND lp.is_under_contract = true
  )
  -- Only update if there's a mismatch
  AND sg.total_amount != (
    COALESCE((SELECT SUM(da.daily_earnings) FROM daily_attendance da WHERE da.settlement_group_id = sg.id), 0) +
    COALESCE((SELECT SUM(ma.total_cost) FROM market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id), 0)
  );

-- Verify final totals
DO $$
DECLARE
  v_site_id UUID;
  v_view_daily NUMERIC;
  v_raw_daily NUMERIC;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  SELECT COALESCE(SUM(amount), 0) INTO v_view_daily
  FROM v_all_expenses
  WHERE site_id = v_site_id AND expense_type = 'Daily Salary' AND is_deleted = false;

  SELECT COALESCE(SUM(da.daily_earnings), 0) + COALESCE(
    (SELECT SUM(ma.total_cost) FROM market_laborer_attendance ma
     WHERE ma.site_id = v_site_id AND ma.is_paid = true), 0)
  INTO v_raw_daily
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.site_id = v_site_id AND da.is_paid = true AND l.laborer_type != 'contract';

  RAISE NOTICE '=== FINAL CHECK ===';
  RAISE NOTICE 'Daily Salary (view): Rs.%', v_view_daily;
  RAISE NOTICE 'Raw attendance: Rs.%', v_raw_daily;

  IF v_view_daily = v_raw_daily THEN
    RAISE NOTICE 'SUCCESS: Daily Salary now matches!';
  ELSE
    RAISE WARNING 'Still mismatch: diff=Rs.%', v_view_daily - v_raw_daily;
  END IF;
END $$;
