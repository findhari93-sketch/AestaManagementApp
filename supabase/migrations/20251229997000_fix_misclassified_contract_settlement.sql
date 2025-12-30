-- Migration: Fix misclassified contract settlement
-- SET-251117-002 has a contract laborer but is missing labor_payments record
-- This causes it to show as "Daily Salary" instead of "Contract Salary"

DO $$
DECLARE
  v_sg_id UUID;
  v_site_id UUID;
  v_laborer_id UUID;
  v_amount NUMERIC;
  v_payment_date DATE;
  v_paid_by UUID;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  -- Find the misclassified settlement_group
  SELECT sg.id, sg.settlement_date, sg.created_by INTO v_sg_id, v_payment_date, v_paid_by
  FROM settlement_groups sg
  WHERE sg.settlement_reference = 'SET-251117-002'
    AND sg.site_id = v_site_id;

  -- Get a fallback user if created_by is NULL
  IF v_paid_by IS NULL THEN
    SELECT id INTO v_paid_by FROM users WHERE role = 'admin' LIMIT 1;
  END IF;

  IF v_sg_id IS NULL THEN
    RAISE NOTICE 'Settlement group SET-251117-002 not found';
    RETURN;
  END IF;

  RAISE NOTICE 'Found settlement_group: %', v_sg_id;

  -- Check if labor_payment already exists
  IF EXISTS (SELECT 1 FROM labor_payments WHERE settlement_group_id = v_sg_id AND is_under_contract = true) THEN
    RAISE NOTICE 'labor_payment already exists for this group';
    RETURN;
  END IF;

  -- Get the contract laborer details from attendance
  SELECT da.laborer_id, da.daily_earnings
  INTO v_laborer_id, v_amount
  FROM daily_attendance da
  JOIN laborers l ON da.laborer_id = l.id
  WHERE da.settlement_group_id = v_sg_id
    AND l.laborer_type = 'contract'
  LIMIT 1;

  IF v_laborer_id IS NULL THEN
    RAISE NOTICE 'No contract laborer found in this settlement group';
    RETURN;
  END IF;

  RAISE NOTICE 'Creating labor_payment for laborer % with amount Rs.%', v_laborer_id, v_amount;

  -- Create the labor_payment record to properly classify as Contract Salary
  INSERT INTO labor_payments (
    id,
    site_id,
    settlement_group_id,
    laborer_id,
    amount,
    is_under_contract,
    payment_for_date,
    payment_mode,
    payment_channel,
    payment_date,
    paid_by,
    recorded_by,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_site_id,
    v_sg_id,
    v_laborer_id,
    v_amount,
    true,
    v_payment_date,
    'cash',
    'direct',
    v_payment_date,
    v_paid_by,
    v_paid_by,  -- recorded_by same as paid_by
    NOW()
  );

  RAISE NOTICE 'Successfully added labor_payment record';
END $$;

-- Verify the fix
DO $$
DECLARE
  v_site_id UUID;
  v_view_daily NUMERIC;
  v_view_contract NUMERIC;
  v_view_advance NUMERIC;
  v_expected_daily NUMERIC := 22100;
  v_expected_contract NUMERIC := 85200; -- 84200 + 1000
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

  RAISE NOTICE '=== FINAL TOTALS AFTER FIX ===';
  RAISE NOTICE 'Daily Salary: Rs.% (expected: Rs.%)', v_view_daily, v_expected_daily;
  RAISE NOTICE 'Contract Salary: Rs.% (expected: Rs.%)', v_view_contract, v_expected_contract;
  RAISE NOTICE 'Advance: Rs.%', v_view_advance;
  RAISE NOTICE 'TOTAL: Rs.%', v_view_daily + v_view_contract + v_view_advance;
  RAISE NOTICE 'Expected Total: Rs.% (22100 + 94200 = daily + contract + advance)', 116300;

  IF v_view_daily = v_expected_daily THEN
    RAISE NOTICE 'SUCCESS: Daily Salary now correct!';
  ELSE
    RAISE WARNING 'Daily Salary mismatch: got % expected %', v_view_daily, v_expected_daily;
  END IF;
END $$;
