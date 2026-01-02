-- Migration: Fix payer_name display in v_all_expenses view
-- Purpose: Convert payer_source to human-readable labels for settlement-derived expenses

-- Drop and recreate the view with proper payer_name logic
CREATE OR REPLACE VIEW v_all_expenses AS

-- Part 1: Regular expenses (non-salary OR salary without settlement_group link)
SELECT
  e.id,
  e.site_id,
  e.date,
  e.amount,
  e.description,
  e.category_id,
  ec.name as category_name,
  e.module::TEXT as module,
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
  -- Exclude labor expenses that have engineer_transaction_id (these are derived from settlements)
  AND (e.module != 'labor' OR e.engineer_transaction_id IS NULL)

UNION ALL

-- Part 2: Derived salary expenses from settlement_groups
SELECT
  sg.id,
  sg.site_id,
  sg.settlement_date as date,
  sg.total_amount as amount,
  CASE
    WHEN sg.notes IS NOT NULL AND sg.notes != '' THEN
      'Salary settlement (' || sg.laborer_count || ' laborers) - ' || sg.notes
    ELSE
      'Salary settlement (' || sg.laborer_count || ' laborers)'
  END as description,
  -- Get "Salary Settlement" category ID
  (SELECT id FROM expense_categories WHERE name = 'Salary Settlement' LIMIT 1) as category_id,
  'Salary Settlement' as category_name,
  'labor'::TEXT as module,
  -- Determine cleared status based on payment channel and engineer settlement
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
  -- Convert payer_source to human-readable label
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

-- Add comment
COMMENT ON VIEW v_all_expenses IS 'Unified view combining regular expenses with derived salary expenses from settlement_groups. Payer names are human-readable labels.';

-- Grant permissions
GRANT SELECT ON v_all_expenses TO authenticated;
GRANT SELECT ON v_all_expenses TO anon;
