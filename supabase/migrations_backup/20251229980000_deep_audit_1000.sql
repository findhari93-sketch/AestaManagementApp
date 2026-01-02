-- Deep audit: Find why raw attendance is Rs.1,000 less than settlement_groups

DO $$
DECLARE
  v_site_id UUID;
  rec RECORD;
  v_sum_all_daily NUMERIC;
  v_sum_noncontract NUMERIC;
  v_sum_contract NUMERIC;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  -- Check attendance by laborer_type
  RAISE NOTICE '=== DAILY ATTENDANCE BY LABORER TYPE ===';

  SELECT COALESCE(SUM(da.daily_earnings), 0) INTO v_sum_all_daily
  FROM daily_attendance da
  WHERE da.site_id = v_site_id AND da.is_paid = true;

  RAISE NOTICE 'ALL paid daily attendance: Rs.%', v_sum_all_daily;

  SELECT COALESCE(SUM(da.daily_earnings), 0) INTO v_sum_noncontract
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.site_id = v_site_id AND da.is_paid = true AND l.laborer_type != 'contract';

  RAISE NOTICE 'Non-contract laborers: Rs.%', v_sum_noncontract;

  SELECT COALESCE(SUM(da.daily_earnings), 0) INTO v_sum_contract
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.site_id = v_site_id AND da.is_paid = true AND l.laborer_type = 'contract';

  RAISE NOTICE 'Contract laborers: Rs.%', v_sum_contract;
  RAISE NOTICE 'Non-contract + Contract = Rs.%', v_sum_noncontract + v_sum_contract;

  -- Check if there's attendance with laborer_id that doesn't exist in laborers table
  SELECT COALESCE(SUM(da.daily_earnings), 0)
  INTO v_sum_all_daily
  FROM daily_attendance da
  WHERE da.site_id = v_site_id
    AND da.is_paid = true
    AND NOT EXISTS (SELECT 1 FROM laborers l WHERE l.id = da.laborer_id);

  RAISE NOTICE 'Attendance with missing laborer: Rs.%', v_sum_all_daily;

  -- Check market labor
  RAISE NOTICE '';
  RAISE NOTICE '=== MARKET LABOR ===';

  SELECT COALESCE(SUM(ma.total_cost), 0)
  INTO v_sum_all_daily
  FROM market_laborer_attendance ma
  WHERE ma.site_id = v_site_id AND ma.is_paid = true;

  RAISE NOTICE 'Market labor total: Rs.%', v_sum_all_daily;

  -- Check each settlement_group's attendance detail
  RAISE NOTICE '';
  RAISE NOTICE '=== CHECKING EACH SETTLEMENT GROUP vs LINKED ATTENDANCE ===';

  FOR rec IN
    SELECT
      sg.settlement_reference,
      sg.settlement_date,
      sg.total_amount,
      (
        SELECT string_agg(
          l.name || ' (' || l.laborer_type || '): Rs.' || da.daily_earnings::TEXT,
          ', '
        )
        FROM daily_attendance da
        JOIN laborers l ON da.laborer_id = l.id
        WHERE da.settlement_group_id = sg.id
      ) as attendance_detail,
      (
        SELECT COALESCE(SUM(da.daily_earnings), 0)
        FROM daily_attendance da
        WHERE da.settlement_group_id = sg.id
      ) as linked_total,
      (
        SELECT COUNT(*)
        FROM daily_attendance da
        JOIN laborers l ON da.laborer_id = l.id
        WHERE da.settlement_group_id = sg.id AND l.laborer_type = 'contract'
      ) as contract_in_group
    FROM settlement_groups sg
    WHERE sg.site_id = v_site_id
      AND sg.is_cancelled = false
      AND COALESCE(sg.payment_type, 'salary') != 'advance'
      AND NOT EXISTS (
        SELECT 1 FROM labor_payments lp
        WHERE lp.settlement_group_id = sg.id AND lp.is_under_contract = true
      )
    ORDER BY sg.settlement_date DESC
  LOOP
    IF rec.contract_in_group > 0 THEN
      RAISE NOTICE 'HAS CONTRACT: % | % | Group: Rs.% | Linked: Rs.% | Contract laborers in group: %',
        rec.settlement_reference, rec.settlement_date, rec.total_amount, rec.linked_total, rec.contract_in_group;
      RAISE NOTICE '  Detail: %', rec.attendance_detail;
    END IF;
  END LOOP;

  -- Summary
  RAISE NOTICE '';
  RAISE NOTICE '=== SUMMARY ===';
  RAISE NOTICE 'The Rs.1,000 likely comes from attendance records linked to Daily Salary groups';
  RAISE NOTICE 'but the laborer is marked as contract type (excluded from raw query)';
END $$;
