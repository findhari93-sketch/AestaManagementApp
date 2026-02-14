-- Migration: Prevent batch usage from exceeding original quantity
-- Purpose: Database-level trigger to reject any batch_usage_records INSERT
--          where total usage would exceed the batch's original_qty.
--          This catches ALL code paths (RPC, direct insert, etc.)
-- Date: 2026-02-14

-- =====================================================
-- Create validation trigger function
-- =====================================================

CREATE OR REPLACE FUNCTION validate_batch_usage_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_original_qty NUMERIC;
  v_current_total_usage NUMERIC;
  v_batch_status TEXT;
BEGIN
  -- Get batch original quantity and status
  SELECT
    COALESCE(mpe.original_qty,
      (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id)
    ),
    mpe.status
  INTO v_original_qty, v_batch_status
  FROM material_purchase_expenses mpe
  WHERE mpe.ref_code = NEW.batch_ref_code
    AND mpe.purchase_type = 'group_stock';

  -- If batch not found, allow insert (might be non-group-stock usage)
  IF v_original_qty IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reject if batch is already completed (except for self-use records during auto-completion)
  IF v_batch_status = 'completed' AND NEW.is_self_use = false THEN
    RAISE EXCEPTION 'Cannot add usage to completed batch: %', NEW.batch_ref_code;
  END IF;

  -- Calculate current total usage for this batch (excluding self-use completion records)
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_current_total_usage
  FROM batch_usage_records
  WHERE batch_ref_code = NEW.batch_ref_code;

  -- Check if new usage would exceed original quantity
  -- Allow up to 5% tolerance for rounding (e.g., 30.00 vs 30.01)
  IF (v_current_total_usage + NEW.quantity) > (v_original_qty * 1.05) THEN
    RAISE EXCEPTION 'Usage overflow: adding % would make total % exceed batch original qty % for batch %',
      NEW.quantity,
      v_current_total_usage + NEW.quantity,
      v_original_qty,
      NEW.batch_ref_code;
  END IF;

  -- Auto-calculate total_cost if not set
  IF NEW.total_cost IS NULL AND NEW.unit_cost IS NOT NULL THEN
    NEW.total_cost := NEW.quantity * NEW.unit_cost;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- Create the trigger
-- =====================================================

DROP TRIGGER IF EXISTS trg_validate_batch_usage_quantity ON batch_usage_records;

CREATE TRIGGER trg_validate_batch_usage_quantity
  BEFORE INSERT ON batch_usage_records
  FOR EACH ROW
  EXECUTE FUNCTION validate_batch_usage_quantity();

-- =====================================================
-- Also add a trigger to keep batch remaining_qty in sync
-- after any direct insert to batch_usage_records
-- =====================================================

CREATE OR REPLACE FUNCTION sync_batch_remaining_qty_after_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_usage NUMERIC;
  v_original_qty NUMERIC;
BEGIN
  -- Get batch original qty
  SELECT COALESCE(mpe.original_qty,
    (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id)
  )
  INTO v_original_qty
  FROM material_purchase_expenses mpe
  WHERE mpe.ref_code = NEW.batch_ref_code
    AND mpe.purchase_type = 'group_stock';

  IF v_original_qty IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate new total usage
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total_usage
  FROM batch_usage_records
  WHERE batch_ref_code = NEW.batch_ref_code;

  -- Sync the batch record
  UPDATE material_purchase_expenses
  SET
    used_qty = v_total_usage,
    remaining_qty = GREATEST(v_original_qty - v_total_usage, 0),
    self_used_qty = (
      SELECT COALESCE(SUM(quantity), 0) FROM batch_usage_records
      WHERE batch_ref_code = NEW.batch_ref_code AND is_self_use = true
    ),
    self_used_amount = (
      SELECT COALESCE(SUM(total_cost), 0) FROM batch_usage_records
      WHERE batch_ref_code = NEW.batch_ref_code AND is_self_use = true
    ),
    status = CASE
      WHEN v_total_usage >= v_original_qty THEN 'completed'
      WHEN v_total_usage > 0 THEN 'partial_used'
      ELSE status
    END,
    updated_at = now()
  WHERE ref_code = NEW.batch_ref_code
    AND purchase_type = 'group_stock';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_batch_remaining_after_usage ON batch_usage_records;

CREATE TRIGGER trg_sync_batch_remaining_after_usage
  AFTER INSERT ON batch_usage_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_batch_remaining_qty_after_usage();

COMMENT ON FUNCTION validate_batch_usage_quantity() IS
'BEFORE INSERT trigger on batch_usage_records.
Prevents total usage from exceeding the batch original_qty (with 5% tolerance for rounding).
Catches ALL code paths: RPC calls, direct inserts, etc.';

COMMENT ON FUNCTION sync_batch_remaining_qty_after_usage() IS
'AFTER INSERT trigger on batch_usage_records.
Keeps batch remaining_qty, used_qty, and status in sync after any direct insert.
Ensures data consistency regardless of which code path created the usage record.';
