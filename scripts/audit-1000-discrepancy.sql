-- Audit: Find the Rs.1,000 discrepancy
-- Expected: Rs.1,16,300 (22,100 daily + 94,200 contract)
-- Actual in expenses: Rs.1,17,300
-- Difference: Rs.1,000

-- Step 1: Total from v_all_expenses (labor settlements only)
SELECT
  'v_all_expenses Total' as source,
  expense_type,
  COUNT(*) as record_count,
  SUM(amount) as total_amount
FROM v_all_expenses
WHERE site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND source_type = 'settlement'
  AND is_deleted = false
GROUP BY expense_type
ORDER BY expense_type;

-- Step 2: Show all Daily Salary records with amounts
SELECT
  'Daily Salary Detail' as check_type,
  settlement_reference,
  date as settlement_date,
  amount,
  payer_name
FROM v_all_expenses
WHERE site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND expense_type = 'Daily Salary'
  AND is_deleted = false
ORDER BY date DESC;

-- Step 3: Verify Daily Salary total from raw attendance
SELECT
  'Raw Attendance Total' as source,
  SUM(da.daily_earnings) as daily_total,
  COUNT(DISTINCT da.date) as unique_dates
FROM daily_attendance da
JOIN laborers l ON da.laborer_id = l.id
WHERE da.site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND da.is_paid = true
  AND l.laborer_type != 'contract';

-- Step 4: Verify Contract Salary total
SELECT
  'Contract Salary Total' as source,
  SUM(sg.total_amount) as contract_total,
  COUNT(*) as record_count
FROM settlement_groups sg
WHERE sg.site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND sg.is_cancelled = false
  AND EXISTS (
    SELECT 1 FROM labor_payments lp
    WHERE lp.settlement_group_id = sg.id
    AND lp.is_under_contract = true
  );

-- Step 5: Check for Advance payments
SELECT
  'Advance Total' as source,
  SUM(sg.total_amount) as advance_total,
  COUNT(*) as record_count
FROM settlement_groups sg
WHERE sg.site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND sg.is_cancelled = false
  AND sg.payment_type = 'advance';

-- Step 6: Find any records with Rs.1000 amount that might be duplicated
SELECT
  'Records with Rs.1000' as check_type,
  settlement_reference,
  date,
  expense_type,
  amount,
  source_type
FROM v_all_expenses
WHERE site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND amount = 1000
  AND is_deleted = false
ORDER BY date DESC;

-- Step 7: Compare settlement_groups totals with v_all_expenses totals
SELECT
  'Settlement Groups Raw Total' as source,
  SUM(total_amount) as raw_total,
  COUNT(*) as group_count
FROM settlement_groups
WHERE site_id = (SELECT id FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1)
  AND is_cancelled = false;
