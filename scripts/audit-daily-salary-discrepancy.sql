-- Audit: Find the 2 extra Daily Salary settlements in v_all_expenses
-- Expenses page shows 20, Payments page shows 18

-- Step 1: List all Daily Salary from v_all_expenses
SELECT
  settlement_reference,
  date as settlement_date,
  recorded_date,
  amount,
  payer_name,
  settlement_group_id
FROM v_all_expenses
WHERE site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND expense_type = 'Daily Salary'
  AND is_deleted = false
ORDER BY date DESC;

-- Step 2: Count unique settlement dates from daily_attendance (non-contract)
SELECT
  da.date as settlement_date,
  COUNT(DISTINCT da.laborer_id) as laborer_count,
  SUM(da.daily_earnings) as total_amount
FROM daily_attendance da
JOIN laborers l ON da.laborer_id = l.id
WHERE da.site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND da.is_paid = true
  AND l.laborer_type != 'contract'
GROUP BY da.date
ORDER BY da.date DESC;

-- Step 3: Count unique dates from market_laborer_attendance
SELECT
  ma.date as settlement_date,
  SUM(ma.count) as laborer_count,
  SUM(ma.total_cost) as total_amount
FROM market_laborer_attendance ma
WHERE ma.site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND ma.is_paid = true
GROUP BY ma.date
ORDER BY ma.date DESC;

-- Step 4: Find Daily Salary settlement_groups that don't have corresponding attendance
SELECT
  sg.id,
  sg.settlement_reference,
  sg.settlement_date,
  sg.total_amount,
  sg.laborer_count,
  sg.created_at
FROM settlement_groups sg
WHERE sg.site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND sg.is_cancelled = false
  AND COALESCE(sg.payment_type, 'salary') != 'advance'
  AND NOT EXISTS (
    SELECT 1 FROM labor_payments lp
    WHERE lp.settlement_group_id = sg.id
    AND lp.is_under_contract = true
  )
  -- Check if NO attendance links to this group
  AND NOT EXISTS (
    SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = sg.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id
  )
ORDER BY sg.settlement_date DESC;
