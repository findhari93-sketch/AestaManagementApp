-- Migration: Reconcile batch usage data and fix record_batch_usage function
-- Purpose: Ensure material_purchase_expenses matches batch_usage_records
-- Date: 2026-02-05

-- =====================================================
-- 1. Recalculate quantities in material_purchase_expenses
--    based on actual batch_usage_records
-- =====================================================

WITH batch_usage_totals AS (
  SELECT
    batch_ref_code,
    SUM(quantity) AS total_used,
    SUM(CASE WHEN is_self_use THEN quantity ELSE 0 END) AS self_used,
    SUM(CASE WHEN is_self_use THEN quantity * unit_cost ELSE 0 END) AS self_used_amount
  FROM batch_usage_records
  GROUP BY batch_ref_code
),
original_qtys AS (
  SELECT
    mpe.ref_code,
    COALESCE(SUM(mpei.quantity), mpe.original_qty, 0) AS original_qty
  FROM material_purchase_expenses mpe
  LEFT JOIN material_purchase_expense_items mpei ON mpei.purchase_expense_id = mpe.id
  WHERE mpe.purchase_type = 'group_stock'
  GROUP BY mpe.ref_code, mpe.original_qty
)
UPDATE material_purchase_expenses mpe
SET
  original_qty = c.original_qty,
  used_qty = c.total_used,
  remaining_qty = c.original_qty - c.total_used,
  self_used_qty = c.self_used,
  self_used_amount = c.self_used_amount,
  updated_at = now()
FROM (
  SELECT
    oq.ref_code,
    oq.original_qty,
    COALESCE(but.total_used, 0) AS total_used,
    COALESCE(but.self_used, 0) AS self_used,
    COALESCE(but.self_used_amount, 0) AS self_used_amount
  FROM original_qtys oq
  LEFT JOIN batch_usage_totals but ON but.batch_ref_code = oq.ref_code
) c
WHERE mpe.ref_code = c.ref_code
  AND mpe.purchase_type = 'group_stock';

-- =====================================================
-- 2. Fix the record_batch_usage function
--    The old version had a bug in remaining_qty calculation
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

  -- Update batch quantities
  -- FIXED: remaining_qty = original_qty - new_used_qty (was incorrectly double-counting)
  UPDATE material_purchase_expenses
  SET
    used_qty = COALESCE(used_qty, 0) + p_quantity,
    remaining_qty = COALESCE(original_qty, (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = id)) - (COALESCE(used_qty, 0) + p_quantity),
    self_used_qty = CASE WHEN v_is_self_use THEN COALESCE(self_used_qty, 0) + p_quantity ELSE self_used_qty END,
    self_used_amount = CASE WHEN v_is_self_use THEN COALESCE(self_used_amount, 0) + (p_quantity * v_unit_cost) ELSE self_used_amount END,
    status = CASE
      WHEN COALESCE(original_qty, (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = id)) - (COALESCE(used_qty, 0) + p_quantity) <= 0 THEN 'partial_used'
      ELSE status
    END,
    updated_at = now()
  WHERE ref_code = p_batch_ref_code;

  RETURN v_usage_id;
END;
$function$;

-- =====================================================
-- 3. Add index for lookups by group_stock_transaction_id
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_batch_usage_records_gst_id
  ON batch_usage_records(group_stock_transaction_id)
  WHERE group_stock_transaction_id IS NOT NULL;

-- =====================================================
-- Documentation
-- =====================================================

COMMENT ON INDEX idx_batch_usage_records_gst_id IS
'Index for looking up batch_usage_records by their source group_stock_transaction';
