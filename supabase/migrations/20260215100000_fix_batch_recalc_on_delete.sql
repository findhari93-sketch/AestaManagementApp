-- Migration: Fix batch recalculation on DELETE/UPDATE of batch_usage_records
--
-- ROOT CAUSE: The old trigger function update_batch_quantities_on_usage_change()
-- (from 20260121200000) only recalculated used_qty and remaining_qty on DELETE,
-- but NOT self_used_qty, self_used_amount, or status.
-- The comprehensive function sync_batch_remaining_qty_after_usage() (from 20260214110000)
-- only fired on INSERT.
-- Result: when batch_usage_records were deleted, batch status stayed "completed".
--
-- FIX: Replace the function with a comprehensive version that recalculates ALL fields
-- on INSERT, UPDATE, and DELETE. Drop the INSERT-only trigger to avoid duplication.

-- Replace the trigger function with comprehensive recalculation
CREATE OR REPLACE FUNCTION update_batch_quantities_on_usage_change()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_ref TEXT;
  v_original_qty NUMERIC;
  v_total_used NUMERIC;
  v_self_used_qty NUMERIC;
  v_self_used_amount NUMERIC;
  v_new_remaining NUMERIC;
  v_new_status TEXT;
  v_batch_exists BOOLEAN;
BEGIN
  -- Get the batch ref code (works for INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    v_batch_ref := OLD.batch_ref_code;
  ELSE
    v_batch_ref := NEW.batch_ref_code;
  END IF;

  -- Check batch exists and is group_stock
  SELECT EXISTS(
    SELECT 1 FROM material_purchase_expenses
    WHERE ref_code = v_batch_ref AND purchase_type = 'group_stock'
  ) INTO v_batch_exists;

  IF NOT v_batch_exists THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get original qty (from column or sum of items as fallback)
  SELECT COALESCE(mpe.original_qty,
    (SELECT SUM(quantity) FROM material_purchase_expense_items
     WHERE purchase_expense_id = mpe.id)
  )
  INTO v_original_qty
  FROM material_purchase_expenses mpe
  WHERE mpe.ref_code = v_batch_ref AND mpe.purchase_type = 'group_stock';

  -- Calculate total usage from remaining batch_usage_records
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_used
  FROM batch_usage_records
  WHERE batch_ref_code = v_batch_ref;

  -- Calculate self-use quantities
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(total_cost), 0)
  INTO v_self_used_qty, v_self_used_amount
  FROM batch_usage_records
  WHERE batch_ref_code = v_batch_ref AND is_self_use = true;

  -- Calculate remaining
  v_new_remaining := GREATEST(COALESCE(v_original_qty, 0) - v_total_used, 0);

  -- Determine new status
  IF v_total_used <= 0 THEN
    v_new_status := 'recorded';
  ELSIF v_new_remaining > 0 THEN
    v_new_status := 'partial_used';
  ELSE
    v_new_status := 'completed';
  END IF;

  -- Update the batch record with all 5 fields
  UPDATE material_purchase_expenses
  SET
    used_qty = v_total_used,
    remaining_qty = v_new_remaining,
    self_used_qty = v_self_used_qty,
    self_used_amount = v_self_used_amount,
    status = v_new_status,
    updated_at = NOW()
  WHERE ref_code = v_batch_ref
    AND purchase_type = 'group_stock';

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop the INSERT-only trigger since the unified function now handles all operations
-- (the old triggers trigger_update_batch_on_usage_insert/update/delete still exist
--  and already call update_batch_quantities_on_usage_change, so they will use our new function)
DROP TRIGGER IF EXISTS trg_sync_batch_remaining_after_usage ON batch_usage_records;

-- Also add a reopen_batch RPC function for manual correction
CREATE OR REPLACE FUNCTION reopen_batch(p_batch_ref_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_creditor_site_id UUID;
BEGIN
  -- Get paying site
  SELECT COALESCE(paying_site_id, site_id)
  INTO v_creditor_site_id
  FROM material_purchase_expenses
  WHERE ref_code = p_batch_ref_code AND purchase_type = 'group_stock';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_ref_code;
  END IF;

  -- Delete auto-created self-use batch_usage_records
  -- (the DELETE trigger will fire and recalculate batch quantities and status)
  DELETE FROM batch_usage_records
  WHERE batch_ref_code = p_batch_ref_code
    AND is_self_use = true
    AND work_description = 'Self-use (batch completion)';

  -- Delete self-use expense items first (FK constraint)
  DELETE FROM material_purchase_expense_items
  WHERE purchase_expense_id IN (
    SELECT id FROM material_purchase_expenses
    WHERE original_batch_code = p_batch_ref_code
      AND settlement_reference = 'SELF-USE'
      AND site_id = v_creditor_site_id
  );

  -- Delete self-use expenses
  DELETE FROM material_purchase_expenses
  WHERE original_batch_code = p_batch_ref_code
    AND settlement_reference = 'SELF-USE'
    AND site_id = v_creditor_site_id;
END;
$$;
