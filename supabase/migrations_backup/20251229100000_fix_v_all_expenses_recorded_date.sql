-- Migration: Fix v_all_expenses view - restore recorded_date column and fix payer_name NULL handling
-- Purpose: The 20251228110000 migration that added tea shop support accidentally removed the recorded_date column
-- that was added in 20251224030000. This migration restores it and also fixes NULL payer_source handling.

DROP VIEW IF EXISTS v_all_expenses;

CREATE VIEW v_all_expenses AS

-- Part 1: Regular expenses (excluding ALL labor - labor only comes from settlement_groups)
SELECT
  e.id,
  e.site_id,
  e.date,
  e.date as recorded_date,  -- For regular expenses, both dates are the same
  e.amount,
  e.description,
  e.category_id,
  ec.name as category_name,
  e.module::TEXT as module,
  -- expense_type based on module
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
  -- Exclude ALL labor expenses - they should only come from settlement_groups (Part 2)
  AND e.module != 'labor'

UNION ALL

-- Part 2: Derived salary expenses from settlement_groups (all have settlement_reference)
SELECT
  sg.id,
  sg.site_id,
  sg.settlement_date as date,
  COALESCE(sg.actual_payment_date, sg.created_at::DATE) as recorded_date,  -- When payment was recorded
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
  -- expense_type - distinguish daily vs contract vs advance
  CASE
    WHEN sg.payment_type = 'advance' THEN 'Advance'
    WHEN EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      AND lp.is_under_contract = true
    ) THEN 'Contract Salary'
    ELSE 'Daily Salary'
  END::TEXT as expense_type,
  -- Determine cleared status
  CASE
    WHEN sg.payment_channel = 'direct' THEN true
    WHEN sg.engineer_transaction_id IS NOT NULL THEN
      COALESCE(
        (SELECT is_settled FROM site_engineer_transactions WHERE id = sg.engineer_transaction_id),
        false
      )
    ELSE false
  END as is_cleared,
  -- Cleared date
  CASE
    WHEN sg.payment_channel = 'direct' THEN sg.settlement_date
    WHEN sg.engineer_transaction_id IS NOT NULL THEN
      (SELECT confirmed_at::DATE FROM site_engineer_transactions WHERE id = sg.engineer_transaction_id AND is_settled = true)
    ELSE NULL
  END as cleared_date,
  sg.subcontract_id as contract_id,
  sc.title as subcontract_title,
  NULL::UUID as site_payer_id,
  -- Convert payer_source to human-readable label (FIX: Handle NULL payer_source)
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

UNION ALL

-- Part 3: Tea Shop Settlements
SELECT
  ts.id,
  tsa.site_id,
  ts.payment_date as date,
  ts.payment_date as recorded_date,  -- For tea shop, payment_date is the recorded date
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
  -- Determine cleared status based on payment type
  CASE
    WHEN ts.payer_type = 'company_direct' THEN true
    WHEN ts.site_engineer_transaction_id IS NOT NULL THEN
      COALESCE(
        (SELECT is_settled FROM site_engineer_transactions WHERE id = ts.site_engineer_transaction_id),
        false
      )
    ELSE true
  END as is_cleared,
  -- Cleared date
  CASE
    WHEN ts.payer_type = 'company_direct' THEN ts.payment_date
    WHEN ts.site_engineer_transaction_id IS NOT NULL THEN
      (SELECT confirmed_at::DATE FROM site_engineer_transactions WHERE id = ts.site_engineer_transaction_id AND is_settled = true)
    ELSE ts.payment_date
  END as cleared_date,
  ts.subcontract_id as contract_id,
  sc.title as subcontract_title,
  NULL::UUID as site_payer_id,
  -- Convert payer_type to human-readable label
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
COMMENT ON VIEW v_all_expenses IS 'Unified view combining regular expenses, derived salary expenses from settlement_groups, and tea shop settlements. Includes recorded_date column and proper NULL handling for payer_source.';

-- Grant permissions
GRANT SELECT ON v_all_expenses TO authenticated;
GRANT SELECT ON v_all_expenses TO anon;
