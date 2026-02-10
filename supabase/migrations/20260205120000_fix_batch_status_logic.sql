-- Migration: Fix batch status logic
-- Purpose: Fix incorrect status values for group stock batches
-- The status should reflect actual usage, not be set to 'partial_used' when remaining <= 0
-- Date: 2026-02-05

-- =====================================================
-- 1. Fix existing incorrect status values
--    Status should be 'recorded' if no usage yet (remaining = original)
--    Status should be 'partial_used' only if some usage but not completed
-- =====================================================

UPDATE material_purchase_expenses
SET status = 'recorded'
WHERE purchase_type = 'group_stock'
  AND status = 'partial_used'
  AND COALESCE(remaining_qty, original_qty) = COALESCE(original_qty, (
    SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = material_purchase_expenses.id
  ));

-- =====================================================
-- 2. Fix the record_batch_usage function
--    The status logic was inverted - it set 'partial_used' when remaining <= 0
--    Correct logic: 'partial_used' when some usage but still remaining
-- =====================================================

CREATE OR REPLACE FUNCTION public.record_batch_usage(
  p_batch_ref_code text,
  p_usage_site_id uuid,
  p_quantity numeric,
  p_usage_date date,
  p_work_description text DEFAULT NULL::text,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_batch RECORD;
  v_material RECORD;
  v_is_self_use BOOLEAN;
  v_settlement_status TEXT;
  v_usage_id UUID;
  v_unit_cost NUMERIC;
  v_new_remaining NUMERIC;
  v_new_used NUMERIC;
BEGIN
  -- Get batch details
  SELECT mpe.*,
         (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id) as total_qty,
         (SELECT SUM(total_price) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id) as items_total
  INTO v_batch
  FROM material_purchase_expenses mpe
  WHERE mpe.ref_code = p_batch_ref_code
    AND mpe.purchase_type = 'group_stock';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_ref_code;
  END IF;

  IF v_batch.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot add usage to completed batch: %', p_batch_ref_code;
  END IF;

  -- Check remaining quantity
  IF COALESCE(v_batch.remaining_qty, v_batch.original_qty, v_batch.total_qty) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient quantity in batch. Available: %, Requested: %',
      COALESCE(v_batch.remaining_qty, v_batch.original_qty, v_batch.total_qty), p_quantity;
  END IF;

  -- Get material details for unit
  SELECT m.* INTO v_material
  FROM materials m
  JOIN material_purchase_expense_items mpei ON mpei.material_id = m.id
  WHERE mpei.purchase_expense_id = v_batch.id
  LIMIT 1;

  -- Calculate unit cost
  v_unit_cost := COALESCE(v_batch.items_total, v_batch.total_amount) / NULLIF(COALESCE(v_batch.original_qty, v_batch.total_qty), 0);

  -- Determine if this is self-use
  v_is_self_use := (p_usage_site_id = v_batch.paying_site_id);
  v_settlement_status := CASE WHEN v_is_self_use THEN 'self_use' ELSE 'pending' END;

  -- Insert usage record
  INSERT INTO batch_usage_records (
    batch_ref_code,
    site_group_id,
    usage_site_id,
    material_id,
    brand_id,
    quantity,
    unit,
    unit_cost,
    usage_date,
    work_description,
    is_self_use,
    settlement_status,
    created_by
  )
  SELECT
    p_batch_ref_code,
    v_batch.site_group_id,
    p_usage_site_id,
    mpei.material_id,
    mpei.brand_id,
    p_quantity,
    COALESCE(v_material.unit, 'nos'),
    v_unit_cost,
    p_usage_date,
    p_work_description,
    v_is_self_use,
    v_settlement_status,
    p_created_by
  FROM material_purchase_expense_items mpei
  WHERE mpei.purchase_expense_id = v_batch.id
  LIMIT 1
  RETURNING id INTO v_usage_id;

  -- Calculate new quantities
  v_new_used := COALESCE(v_batch.used_qty, 0) + p_quantity;
  v_new_remaining := COALESCE(v_batch.original_qty, v_batch.total_qty, 0) - v_new_used;

  -- Update batch quantities with corrected status logic
  -- Status should be:
  --   'recorded' - initial state (no change needed, already set at creation)
  --   'partial_used' - when there is some usage (used_qty > 0) but batch not completed
  --   'completed' - when batch is fully settled (set by process_batch_settlement)
  UPDATE material_purchase_expenses
  SET
    used_qty = v_new_used,
    remaining_qty = v_new_remaining,
    self_used_qty = CASE WHEN v_is_self_use THEN COALESCE(self_used_qty, 0) + p_quantity ELSE self_used_qty END,
    self_used_amount = CASE WHEN v_is_self_use THEN COALESCE(self_used_amount, 0) + (p_quantity * v_unit_cost) ELSE self_used_amount END,
    status = CASE
      -- Only change status to partial_used if there's actual usage
      WHEN v_new_used > 0 AND v_new_remaining > 0 THEN 'partial_used'
      -- Keep current status for other cases (completed is set by settlement process)
      ELSE status
    END,
    updated_at = now()
  WHERE ref_code = p_batch_ref_code;

  RETURN v_usage_id;
END;
$function$;

-- =====================================================
-- Documentation
-- =====================================================

COMMENT ON FUNCTION public.record_batch_usage(TEXT, UUID, NUMERIC, DATE, TEXT, UUID) IS
'Records usage from a specific site against a group stock batch.
Automatically determines if it is self-use (usage_site = paying_site).
Updates batch quantities and status accordingly.

Status logic:
- recorded: Initial state when batch is created (no usage yet)
- partial_used: When there is some usage but remaining qty > 0
- completed: Set by process_batch_settlement when batch is fully settled';
