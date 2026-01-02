-- Migration: Aggregate Daily Salary by date in v_all_expenses view
-- Purpose: Show one expense record per date for Daily Salary instead of per settlement_group
-- Expected outcome: 18 Daily Salary + 1 Advance + 32 Contract = 51 labor records

DROP VIEW IF EXISTS v_all_expenses;

CREATE VIEW v_all_expenses AS

-- Part 1: Regular expenses (excluding ALL labor - labor only comes from settlement_groups)
SELECT
  e.id,
  e.site_id,
  e.date,
  e.date as recorded_date,
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

-- Part 2a: Daily Salary - AGGREGATED BY DATE (one row per site + date)
SELECT
  -- Use first settlement_group id as the record id
  (ARRAY_AGG(sg.id ORDER BY sg.created_at))[1] as id,
  sg.site_id,
  sg.settlement_date as date,
  MAX(COALESCE(sg.actual_payment_date, sg.created_at::DATE)) as recorded_date,
  SUM(sg.total_amount) as amount,
  'Salary settlement (' || SUM(sg.laborer_count) || ' laborers)' as description,
  (SELECT id FROM expense_categories WHERE name = 'Salary Settlement' LIMIT 1) as category_id,
  'Salary Settlement' as category_name,
  'labor'::TEXT as module,
  'Daily Salary'::TEXT as expense_type,
  -- Cleared if all groups in this date are cleared
  BOOL_AND(
    CASE
      WHEN sg.payment_channel = 'direct' THEN true
      WHEN sg.engineer_transaction_id IS NOT NULL THEN
        COALESCE(
          (SELECT is_settled FROM site_engineer_transactions WHERE id = sg.engineer_transaction_id),
          false
        )
      ELSE false
    END
  ) as is_cleared,
  -- Use latest cleared date
  MAX(
    CASE
      WHEN sg.payment_channel = 'direct' THEN sg.settlement_date
      WHEN sg.engineer_transaction_id IS NOT NULL THEN
        (SELECT confirmed_at::DATE FROM site_engineer_transactions WHERE id = sg.engineer_transaction_id AND is_settled = true)
      ELSE NULL
    END
  ) as cleared_date,
  -- subcontract_id: use first non-null if exists
  (ARRAY_AGG(sg.subcontract_id ORDER BY sg.created_at) FILTER (WHERE sg.subcontract_id IS NOT NULL))[1] as contract_id,
  (ARRAY_AGG(sc.title ORDER BY sg.created_at) FILTER (WHERE sc.title IS NOT NULL))[1] as subcontract_title,
  NULL::UUID as site_payer_id,
  -- Aggregate payer sources
  CASE
    WHEN COUNT(DISTINCT sg.payer_source) = 1 THEN
      CASE
        WHEN MAX(sg.payer_source) IS NULL THEN 'Own Money'
        WHEN MAX(sg.payer_source) = 'own_money' THEN 'Own Money'
        WHEN MAX(sg.payer_source) = 'amma_money' THEN 'Amma Money'
        WHEN MAX(sg.payer_source) = 'client_money' THEN 'Client Money'
        WHEN MAX(sg.payer_source) = 'other_site_money' THEN COALESCE(MAX(sg.payer_name), 'Other Site')
        WHEN MAX(sg.payer_source) = 'custom' THEN COALESCE(MAX(sg.payer_name), 'Other')
        ELSE COALESCE(MAX(sg.payer_name), 'Own Money')
      END
    ELSE 'Multiple Sources'
  END as payer_name,
  -- Use first payment_mode
  (ARRAY_AGG(sg.payment_mode ORDER BY sg.created_at))[1] as payment_mode,
  NULL::TEXT as vendor_name,
  (ARRAY_AGG(sg.proof_url ORDER BY sg.created_at) FILTER (WHERE sg.proof_url IS NOT NULL))[1] as receipt_url,
  (ARRAY_AGG(sg.created_by ORDER BY sg.created_at))[1] as paid_by,
  (ARRAY_AGG(sg.created_by_name ORDER BY sg.created_at))[1] as entered_by,
  (ARRAY_AGG(sg.created_by ORDER BY sg.created_at))[1] as entered_by_user_id,
  -- Create aggregated reference: use first reference
  (ARRAY_AGG(sg.settlement_reference ORDER BY sg.created_at))[1] as settlement_reference,
  -- Use first settlement_group_id for linking
  (ARRAY_AGG(sg.id ORDER BY sg.created_at))[1] as settlement_group_id,
  'settlement'::TEXT as source_type,
  (ARRAY_AGG(sg.id ORDER BY sg.created_at))[1] as source_id,
  MIN(sg.created_at) as created_at,
  false as is_deleted
FROM settlement_groups sg
LEFT JOIN subcontracts sc ON sg.subcontract_id = sc.id
WHERE sg.is_cancelled = false
  AND COALESCE(sg.payment_type, 'salary') != 'advance'
  -- Exclude Contract Salary (has labor_payments with is_under_contract=true)
  AND NOT EXISTS (
    SELECT 1 FROM labor_payments lp
    WHERE lp.settlement_group_id = sg.id
    AND lp.is_under_contract = true
  )
GROUP BY sg.site_id, sg.settlement_date

UNION ALL

-- Part 2b: Contract Salary - ONE ROW PER SETTLEMENT_GROUP (not aggregated)
SELECT
  sg.id,
  sg.site_id,
  sg.settlement_date as date,
  COALESCE(sg.actual_payment_date, sg.created_at::DATE) as recorded_date,
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
  'Contract Salary'::TEXT as expense_type,
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
  CASE
    WHEN sg.payer_source IS NULL THEN 'Own Money'
    WHEN sg.payer_source = 'own_money' THEN 'Own Money'
    WHEN sg.payer_source = 'amma_money' THEN 'Amma Money'
    WHEN sg.payer_source = 'client_money' THEN 'Client Money'
    WHEN sg.payer_source = 'other_site_money' THEN COALESCE(sg.payer_name, 'Other Site')
    WHEN sg.payer_source = 'custom' THEN COALESCE(sg.payer_name, 'Other')
    ELSE COALESCE(sg.payer_name, 'Own Money')
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
WHERE sg.is_cancelled = false
  -- Contract Salary: has labor_payments with is_under_contract=true
  AND EXISTS (
    SELECT 1 FROM labor_payments lp
    WHERE lp.settlement_group_id = sg.id
    AND lp.is_under_contract = true
  )

UNION ALL

-- Part 2c: Advance - ONE ROW PER SETTLEMENT_GROUP (not aggregated)
SELECT
  sg.id,
  sg.site_id,
  sg.settlement_date as date,
  COALESCE(sg.actual_payment_date, sg.created_at::DATE) as recorded_date,
  sg.total_amount as amount,
  CASE
    WHEN sg.notes IS NOT NULL AND sg.notes != '' THEN
      'Advance payment (' || sg.laborer_count || ' laborers) - ' || sg.notes
    ELSE
      'Advance payment (' || sg.laborer_count || ' laborers)'
  END as description,
  (SELECT id FROM expense_categories WHERE name = 'Salary Settlement' LIMIT 1) as category_id,
  'Salary Settlement' as category_name,
  'labor'::TEXT as module,
  'Advance'::TEXT as expense_type,
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
  CASE
    WHEN sg.payer_source IS NULL THEN 'Own Money'
    WHEN sg.payer_source = 'own_money' THEN 'Own Money'
    WHEN sg.payer_source = 'amma_money' THEN 'Amma Money'
    WHEN sg.payer_source = 'client_money' THEN 'Client Money'
    WHEN sg.payer_source = 'other_site_money' THEN COALESCE(sg.payer_name, 'Other Site')
    WHEN sg.payer_source = 'custom' THEN COALESCE(sg.payer_name, 'Other')
    ELSE COALESCE(sg.payer_name, 'Own Money')
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
WHERE sg.is_cancelled = false
  AND sg.payment_type = 'advance'

UNION ALL

-- Part 3: Tea Shop Settlements
SELECT
  ts.id,
  tsa.site_id,
  ts.payment_date as date,
  ts.payment_date as recorded_date,
  ts.amount_paid as amount,
  CASE
    WHEN ts.notes IS NOT NULL AND ts.notes != '' THEN
      'Tea Shop - ' || tsa.shop_name || ' - ' || ts.notes
    ELSE
      'Tea Shop - ' || tsa.shop_name
  END as description,
  (SELECT id FROM expense_categories WHERE name = 'Tea & Snacks' LIMIT 1) as category_id,
  'Tea & Snacks' as category_name,
  'general'::TEXT as module,
  'Tea & Snacks'::TEXT as expense_type,
  CASE
    WHEN ts.payer_type = 'company_direct' THEN true
    WHEN ts.site_engineer_transaction_id IS NOT NULL THEN
      COALESCE(
        (SELECT is_settled FROM site_engineer_transactions WHERE id = ts.site_engineer_transaction_id),
        false
      )
    ELSE true
  END as is_cleared,
  CASE
    WHEN ts.payer_type = 'company_direct' THEN ts.payment_date
    WHEN ts.site_engineer_transaction_id IS NOT NULL THEN
      (SELECT confirmed_at::DATE FROM site_engineer_transactions WHERE id = ts.site_engineer_transaction_id AND is_settled = true)
    ELSE ts.payment_date
  END as cleared_date,
  ts.subcontract_id as contract_id,
  sc.title as subcontract_title,
  NULL::UUID as site_payer_id,
  CASE ts.payer_type
    WHEN 'company_direct' THEN 'Company Direct'
    WHEN 'site_engineer' THEN COALESCE(
      (SELECT name FROM users WHERE id = ts.site_engineer_id),
      'Site Engineer'
    )
    ELSE ts.payer_type
  END as payer_name,
  ts.payment_mode,
  tsa.shop_name as vendor_name,
  NULL::TEXT as receipt_url,
  ts.recorded_by_user_id as paid_by,
  ts.recorded_by as entered_by,
  ts.recorded_by_user_id as entered_by_user_id,
  ts.settlement_reference,
  NULL::UUID as settlement_group_id,
  'tea_shop_settlement'::TEXT as source_type,
  ts.id as source_id,
  ts.created_at,
  COALESCE(ts.is_cancelled, false) as is_deleted
FROM tea_shop_settlements ts
JOIN tea_shop_accounts tsa ON ts.tea_shop_id = tsa.id
LEFT JOIN subcontracts sc ON ts.subcontract_id = sc.id
WHERE COALESCE(ts.is_cancelled, false) = false;

-- Add comment
COMMENT ON VIEW v_all_expenses IS 'Unified view combining regular expenses, derived salary expenses from settlement_groups (Daily Salary aggregated by date), and tea shop settlements.';

-- Grant permissions
GRANT SELECT ON v_all_expenses TO authenticated;
GRANT SELECT ON v_all_expenses TO anon;
