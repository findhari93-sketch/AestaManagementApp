-- Audit script to find discrepancy between labor_payments and settlement_groups
-- Run this in Supabase SQL Editor

-- Replace with your site_id (or remove the WHERE clause to check all sites)
-- You can find your site_id from the sites table or from the URL when viewing the site

-- ============================================================================
-- 1. Compare total amounts from labor_payments vs settlement_groups
-- ============================================================================
WITH
labor_payments_total AS (
  SELECT
    site_id,
    SUM(amount) as total_from_labor_payments,
    COUNT(*) as labor_payment_count,
    SUM(CASE WHEN settlement_group_id IS NULL THEN amount ELSE 0 END) as orphan_amount,
    COUNT(CASE WHEN settlement_group_id IS NULL THEN 1 END) as orphan_count
  FROM labor_payments
  WHERE is_under_contract = true
  GROUP BY site_id
),
settlement_groups_total AS (
  SELECT
    site_id,
    SUM(CASE WHEN payment_type != 'advance' THEN total_amount ELSE 0 END) as total_from_settlements_salary,
    SUM(CASE WHEN payment_type = 'advance' THEN total_amount ELSE 0 END) as total_from_settlements_advance,
    SUM(total_amount) as total_from_settlements_all,
    COUNT(CASE WHEN payment_type != 'advance' THEN 1 END) as salary_settlement_count,
    COUNT(CASE WHEN payment_type = 'advance' THEN 1 END) as advance_settlement_count
  FROM settlement_groups
  WHERE is_cancelled = false
    AND id IN (SELECT DISTINCT settlement_group_id FROM labor_payments WHERE is_under_contract = true AND settlement_group_id IS NOT NULL)
  GROUP BY site_id
)
SELECT
  s.title as site_name,
  lp.total_from_labor_payments,
  lp.labor_payment_count,
  sg.total_from_settlements_salary,
  sg.salary_settlement_count,
  sg.total_from_settlements_advance,
  sg.advance_settlement_count,
  (lp.total_from_labor_payments - sg.total_from_settlements_all) as discrepancy,
  lp.orphan_amount as labor_payments_without_settlement_group,
  lp.orphan_count as orphan_count
FROM labor_payments_total lp
LEFT JOIN settlement_groups_total sg ON lp.site_id = sg.site_id
LEFT JOIN sites s ON lp.site_id = s.id
ORDER BY discrepancy DESC;

-- ============================================================================
-- 2. Find labor_payments without settlement_group_id (orphans)
-- ============================================================================
SELECT
  lp.payment_reference,
  lp.actual_payment_date,
  lp.amount,
  l.name as laborer_name
FROM labor_payments lp
LEFT JOIN laborers l ON lp.laborer_id = l.id
WHERE lp.is_under_contract = true
  AND lp.settlement_group_id IS NULL
ORDER BY lp.actual_payment_date DESC;

-- ============================================================================
-- 3. Find settlement_groups where labor_payments sum doesn't match
-- ============================================================================
WITH payment_sums AS (
  SELECT
    settlement_group_id,
    SUM(amount) as payments_sum,
    COUNT(*) as payment_count
  FROM labor_payments
  WHERE settlement_group_id IS NOT NULL
    AND is_under_contract = true
  GROUP BY settlement_group_id
)
SELECT
  sg.settlement_reference,
  sg.settlement_date,
  sg.total_amount as settlement_total,
  ps.payments_sum as labor_payments_sum,
  ps.payment_count,
  (sg.total_amount - ps.payments_sum) as mismatch
FROM settlement_groups sg
JOIN payment_sums ps ON sg.id = ps.settlement_group_id
WHERE sg.is_cancelled = false
  AND ABS(sg.total_amount - ps.payments_sum) > 0.01
ORDER BY ABS(sg.total_amount - ps.payments_sum) DESC;

-- ============================================================================
-- 4. Find non-rounded amounts (amounts not divisible by 100)
-- ============================================================================
SELECT
  lp.payment_reference,
  lp.actual_payment_date,
  lp.amount,
  l.name as laborer_name,
  sg.settlement_reference
FROM labor_payments lp
LEFT JOIN laborers l ON lp.laborer_id = l.id
LEFT JOIN settlement_groups sg ON lp.settlement_group_id = sg.id
WHERE lp.is_under_contract = true
  AND lp.amount % 100 != 0
ORDER BY lp.actual_payment_date DESC;

-- ============================================================================
-- 5. Summary: What the UI should show
-- ============================================================================
SELECT
  'Summary Card should show:' as description,
  SUM(CASE WHEN payment_type != 'advance' THEN total_amount ELSE 0 END) as salary_settlements,
  SUM(CASE WHEN payment_type = 'advance' THEN total_amount ELSE 0 END) as advances,
  SUM(total_amount) as total_paid
FROM settlement_groups
WHERE is_cancelled = false
  AND id IN (SELECT DISTINCT settlement_group_id FROM labor_payments WHERE is_under_contract = true AND settlement_group_id IS NOT NULL);
