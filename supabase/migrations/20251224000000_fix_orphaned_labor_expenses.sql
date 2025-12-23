-- Migration: Fix orphaned labor expenses in v_all_expenses view
-- Purpose: Ensure ALL labor transactions have ref codes by excluding labor from Part 1
-- Background: Old labor expenses in expenses table were showing without settlement_reference
-- because they weren't linked to settlement_groups

-- ============================================================================
-- 1. Drop and recreate the unified expenses view to exclude ALL labor from Part 1
-- ============================================================================
DROP VIEW IF EXISTS v_all_expenses;

CREATE VIEW v_all_expenses AS

-- Part 1: Regular expenses (excluding ALL labor - labor only comes from settlement_groups)
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
  -- Exclude ALL labor expenses - they should only come from settlement_groups (Part 2)
  -- This ensures all labor transactions have a settlement_reference
  AND e.module != 'labor'

UNION ALL

-- Part 2: Derived salary expenses from settlement_groups (all have settlement_reference)
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
  sg.payer_name,
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

-- ============================================================================
-- 2. Soft-delete orphaned labor expenses from expenses table
-- These are old labor expenses that are NOT linked to settlement_groups
-- They were creating duplicate/orphaned entries in v_all_expenses
-- ============================================================================
UPDATE expenses
SET is_deleted = true
WHERE module = 'labor'
  AND is_deleted = false;

-- Add comment explaining the change
COMMENT ON VIEW v_all_expenses IS 'Unified view combining regular expenses with derived salary expenses from settlement_groups. Labor expenses are ONLY from settlement_groups to ensure all have settlement_reference. Use this instead of querying expenses table directly.';
