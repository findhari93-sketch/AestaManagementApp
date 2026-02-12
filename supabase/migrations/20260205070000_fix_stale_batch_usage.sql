-- Fix stale batch_usage_records that have no corresponding data
-- and recalculate remaining_qty for all group stock batches

-- Step 1: Find and delete orphaned batch_usage_records for MPE-ML7V37XP-LJ1
-- (records that have no related usage transaction or settlement)
DELETE FROM batch_usage_records
WHERE batch_ref_code = 'MPE-ML7V37XP-LJ1'
  AND is_self_use = false
  AND settlement_status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM group_stock_transactions gst
    WHERE gst.batch_ref_code = batch_usage_records.batch_ref_code
      AND gst.transaction_type = 'usage'
      AND gst.usage_site_id = batch_usage_records.usage_site_id
  );

-- Step 2: Recalculate remaining_qty and used_qty for all group_stock batches
-- based on actual batch_usage_records
WITH batch_usage_totals AS (
  SELECT
    batch_ref_code,
    COALESCE(SUM(quantity), 0) as total_used
  FROM batch_usage_records
  WHERE is_self_use = false
  GROUP BY batch_ref_code
),
batch_original_qty AS (
  SELECT
    mpe.ref_code,
    COALESCE(SUM(mpei.quantity), 0) as original_qty
  FROM material_purchase_expenses mpe
  LEFT JOIN material_purchase_expense_items mpei ON mpe.id = mpei.purchase_expense_id
  WHERE mpe.purchase_type = 'group_stock'
  GROUP BY mpe.ref_code
)
UPDATE material_purchase_expenses mpe
SET
  used_qty = COALESCE(but.total_used, 0),
  remaining_qty = boq.original_qty - COALESCE(but.total_used, 0),
  updated_at = now()
FROM batch_original_qty boq
LEFT JOIN batch_usage_totals but ON boq.ref_code = but.batch_ref_code
WHERE mpe.ref_code = boq.ref_code
  AND mpe.purchase_type = 'group_stock'
  AND (
    mpe.used_qty IS DISTINCT FROM COALESCE(but.total_used, 0)
    OR mpe.remaining_qty IS DISTINCT FROM (boq.original_qty - COALESCE(but.total_used, 0))
  );

-- Step 3: Specifically fix MPE-ML7V37XP-LJ1 to have correct values
-- Set remaining_qty = original_qty (3 cft) since no valid usage exists
UPDATE material_purchase_expenses
SET
  remaining_qty = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM material_purchase_expense_items
    WHERE purchase_expense_id = material_purchase_expenses.id
  ),
  used_qty = 0,
  updated_at = now()
WHERE ref_code = 'MPE-ML7V37XP-LJ1'
  AND NOT EXISTS (
    SELECT 1 FROM batch_usage_records
    WHERE batch_ref_code = 'MPE-ML7V37XP-LJ1'
      AND is_self_use = false
  );
