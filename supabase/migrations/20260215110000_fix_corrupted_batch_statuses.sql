-- Migration: Fix corrupted batch statuses and quantities
--
-- After applying the trigger fix (20260215100000), this migration recalculates
-- all group_stock batch quantities from actual batch_usage_records and cleans up
-- orphaned self-use expenses from incorrectly completed batches.

-- Step 1: Delete orphaned auto-created self-use batch_usage_records
-- These were created by batch completion but the real usage was later deleted.
-- We identify them by checking if the batch has remaining_qty that doesn't match
-- actual non-self-use usage (i.e., self-use was created as part of completion).
-- We delete self-use records for batches where total non-self usage = 0 but batch shows completed.
DELETE FROM batch_usage_records
WHERE id IN (
  SELECT bur.id
  FROM batch_usage_records bur
  JOIN material_purchase_expenses mpe ON mpe.ref_code = bur.batch_ref_code
  WHERE mpe.purchase_type = 'group_stock'
    AND mpe.status = 'completed'
    AND bur.is_self_use = true
    AND bur.work_description = 'Self-use (batch completion)'
    -- Only for batches where there's no real non-self usage
    AND NOT EXISTS (
      SELECT 1 FROM batch_usage_records other
      WHERE other.batch_ref_code = bur.batch_ref_code
        AND other.is_self_use = false
    )
);

-- The DELETE trigger from the previous migration will fire and recalculate
-- batch quantities and status automatically. But since triggers fire per-row
-- and we need to ensure final consistency, also do an explicit recalculation:

-- Step 2: Recalculate ALL group_stock batch quantities from actual batch_usage_records
WITH batch_actuals AS (
  SELECT
    mpe.ref_code,
    COALESCE(mpe.original_qty,
      (SELECT SUM(quantity) FROM material_purchase_expense_items
       WHERE purchase_expense_id = mpe.id)
    ) AS original_qty,
    COALESCE(usage.total_used, 0) AS actual_used,
    COALESCE(usage.self_used_qty, 0) AS actual_self_used_qty,
    COALESCE(usage.self_used_amount, 0) AS actual_self_used_amount
  FROM material_purchase_expenses mpe
  LEFT JOIN (
    SELECT
      batch_ref_code,
      SUM(quantity) AS total_used,
      SUM(CASE WHEN is_self_use THEN quantity ELSE 0 END) AS self_used_qty,
      SUM(CASE WHEN is_self_use THEN total_cost ELSE 0 END) AS self_used_amount
    FROM batch_usage_records
    GROUP BY batch_ref_code
  ) usage ON usage.batch_ref_code = mpe.ref_code
  WHERE mpe.purchase_type = 'group_stock'
)
UPDATE material_purchase_expenses mpe
SET
  used_qty = ba.actual_used,
  remaining_qty = GREATEST(ba.original_qty - ba.actual_used, 0),
  self_used_qty = ba.actual_self_used_qty,
  self_used_amount = ba.actual_self_used_amount,
  status = CASE
    WHEN ba.actual_used <= 0 THEN 'recorded'
    WHEN (ba.original_qty - ba.actual_used) > 0 THEN 'partial_used'
    ELSE 'completed'
  END,
  updated_at = NOW()
FROM batch_actuals ba
WHERE mpe.ref_code = ba.ref_code
  AND mpe.purchase_type = 'group_stock';

-- Step 3: Clean up orphaned self-use expenses whose parent batch is no longer completed
-- Delete expense items first (FK constraint)
DELETE FROM material_purchase_expense_items
WHERE purchase_expense_id IN (
  SELECT se.id
  FROM material_purchase_expenses se
  JOIN material_purchase_expenses batch ON batch.ref_code = se.original_batch_code
  WHERE se.settlement_reference = 'SELF-USE'
    AND batch.purchase_type = 'group_stock'
    AND batch.status != 'completed'
);

-- Then delete the self-use expenses themselves
DELETE FROM material_purchase_expenses se
USING material_purchase_expenses batch
WHERE se.original_batch_code = batch.ref_code
  AND se.settlement_reference = 'SELF-USE'
  AND batch.purchase_type = 'group_stock'
  AND batch.status != 'completed';
