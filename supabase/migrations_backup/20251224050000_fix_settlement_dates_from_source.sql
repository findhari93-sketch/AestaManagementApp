-- Migration: Fix settlement dates from correct source tables
-- Problem: settlement_groups.actual_payment_date has wrong values (all showing Dec 22)
-- Solution: Pull correct dates from the actual source tables:
--   - Contract settlements: labor_payments.actual_payment_date
--   - Daily settlements: daily_attendance.date
--   - Market settlements: market_laborer_attendance.date

-- ============================================================================
-- 1. Fix settlement_date for CONTRACT settlements (from labor_payments)
-- ============================================================================
UPDATE settlement_groups sg
SET
  settlement_date = lp_dates.payment_date,
  actual_payment_date = lp_dates.payment_date
FROM (
  SELECT
    settlement_group_id,
    MIN(COALESCE(actual_payment_date, payment_date)) as payment_date
  FROM labor_payments
  WHERE settlement_group_id IS NOT NULL
  GROUP BY settlement_group_id
) lp_dates
WHERE sg.id = lp_dates.settlement_group_id
  AND lp_dates.payment_date IS NOT NULL;

-- ============================================================================
-- 2. Fix settlement_date for DAILY settlements (from daily_attendance)
-- ============================================================================
UPDATE settlement_groups sg
SET
  settlement_date = da_dates.attendance_date,
  actual_payment_date = da_dates.attendance_date
FROM (
  SELECT
    settlement_group_id,
    MIN(date) as attendance_date
  FROM daily_attendance
  WHERE settlement_group_id IS NOT NULL
  GROUP BY settlement_group_id
) da_dates
WHERE sg.id = da_dates.settlement_group_id
  AND NOT EXISTS (
    SELECT 1 FROM labor_payments lp WHERE lp.settlement_group_id = sg.id
  );

-- ============================================================================
-- 3. Fix settlement_date for MARKET settlements (from market_laborer_attendance)
-- ============================================================================
UPDATE settlement_groups sg
SET
  settlement_date = mla_dates.attendance_date,
  actual_payment_date = mla_dates.attendance_date
FROM (
  SELECT
    settlement_group_id,
    MIN(date) as attendance_date
  FROM market_laborer_attendance
  WHERE settlement_group_id IS NOT NULL
  GROUP BY settlement_group_id
) mla_dates
WHERE sg.id = mla_dates.settlement_group_id
  AND NOT EXISTS (
    SELECT 1 FROM labor_payments lp WHERE lp.settlement_group_id = sg.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = sg.id
  );

-- ============================================================================
-- 4. Recreate view with correct date logic
-- ============================================================================
DROP VIEW IF EXISTS v_all_expenses;

CREATE VIEW v_all_expenses AS

-- Part 1: Regular expenses
SELECT
  e.id,
  e.site_id,
  e.date,
  e.created_at::DATE as recorded_date,
  e.amount,
  e.description,
  e.category_id,
  ec.name as category_name,
  e.module::TEXT as module,
  CASE e.module
    WHEN 'material' THEN 'Material'
    WHEN 'machinery' THEN 'Machinery'
    WHEN 'general' THEN 'General'
    ELSE COALESCE(ec.name, 'Other')
  END::TEXT as expense_type,
  e.is_cleared,
  e.cleared_date,
  e.contract_id,
  sc.title as subcontract_title,
  e.site_payer_id,
  sp.name as payer_name,
  e.payment_mode::TEXT as payment_mode,
  e.vendor_name,
  e.receipt_url,
  e.paid_by,
  e.entered_by,
  e.entered_by_user_id,
  NULL::TEXT as settlement_reference,
  NULL::UUID as settlement_group_id,
  'expense'::TEXT as source_type,
  e.id as source_id,
  e.created_at,
  e.is_deleted
FROM expenses e
LEFT JOIN expense_categories ec ON e.category_id = ec.id
LEFT JOIN subcontracts sc ON e.contract_id = sc.id
LEFT JOIN site_payers sp ON e.site_payer_id = sp.id
WHERE e.is_deleted = false
  AND e.module != 'labor'

UNION ALL

-- Part 2: Settlement expenses - use settlement_date (now fixed from source tables)
SELECT
  sg.id,
  sg.site_id,
  sg.settlement_date as date,
  sg.created_at::DATE as recorded_date,
  sg.total_amount as amount,
  CASE
    WHEN sg.notes IS NOT NULL AND sg.notes != '' THEN
      'Salary settlement (' || sg.laborer_count || ' laborers) - ' || sg.notes
    ELSE
      'Salary settlement (' || sg.laborer_count || ' laborers)'
  END as description,
  (SELECT id FROM expense_categories WHERE name = 'Salary Settlement' LIMIT 1) as category_id,
  'Salary Settlement' as category_name,
  'labor'::TEXT as module,
  CASE
    WHEN sg.payment_type = 'advance' THEN 'Advance'
    WHEN EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    ) THEN 'Contract Salary'
    ELSE 'Daily Salary'
  END::TEXT as expense_type,
  CASE
    WHEN sg.payment_channel = 'direct' THEN true
    WHEN sg.engineer_transaction_id IS NOT NULL THEN
      COALESCE(
        (SELECT is_settled FROM site_engineer_transactions WHERE id = sg.engineer_transaction_id),
        false
      )
    ELSE false
  END as is_cleared,
  CASE
    WHEN sg.payment_channel = 'direct' THEN sg.settlement_date
    WHEN sg.engineer_transaction_id IS NOT NULL THEN
      (SELECT confirmed_at::DATE FROM site_engineer_transactions WHERE id = sg.engineer_transaction_id AND is_settled = true)
    ELSE NULL
  END as cleared_date,
  sg.subcontract_id as contract_id,
  sc.title as subcontract_title,
  NULL::UUID as site_payer_id,
  CASE sg.payer_source
    WHEN 'own_money' THEN 'Own Money'
    WHEN 'amma_money' THEN 'Amma Money'
    WHEN 'client_money' THEN 'Client Money'
    WHEN 'other_site_money' THEN COALESCE(sg.payer_name, 'Other Site')
    WHEN 'custom' THEN COALESCE(sg.payer_name, 'Other')
    ELSE sg.payer_name
  END as payer_name,
  sg.payment_mode,
  NULL::TEXT as vendor_name,
  sg.proof_url as receipt_url,
  sg.created_by as paid_by,
  sg.created_by_name as entered_by,
  sg.created_by as entered_by_user_id,
  sg.settlement_reference,
  sg.id as settlement_group_id,
  'settlement'::TEXT as source_type,
  sg.id as source_id,
  sg.created_at,
  sg.is_cancelled as is_deleted
FROM settlement_groups sg
LEFT JOIN subcontracts sc ON sg.subcontract_id = sc.id
WHERE sg.is_cancelled = false;

COMMENT ON VIEW v_all_expenses IS 'Unified expenses view. Settlement Date = when money was given (from source tables). Recorded Date = when entered in app.';

GRANT SELECT ON v_all_expenses TO authenticated;
GRANT SELECT ON v_all_expenses TO anon;
