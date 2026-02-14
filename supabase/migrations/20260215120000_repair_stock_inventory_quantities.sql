-- Repair stock_inventory.current_qty values that became corrupted
-- due to a bug where useDeleteMaterialUsage used .maybeSingle() without batch_code filter.
-- When multiple stock_inventory records existed for the same material (different batches),
-- the lookup would error and silently skip quantity restoration.
--
-- This migration recalculates current_qty from:
--   delivered_qty (from stock_transactions type='purchase')
--   minus active_usage (from daily_material_usage + batch_usage_records)

-- Step 1: Recalculate current_qty for ALL stock_inventory records
-- Uses stock_transactions 'purchase' entries as the source of truth for delivered quantities,
-- and checks actual active usage records (daily_material_usage + batch_usage_records)
WITH delivered AS (
  -- Total delivered quantity per stock_inventory (from purchase transactions)
  SELECT
    inventory_id,
    COALESCE(SUM(quantity), 0) AS total_delivered
  FROM stock_transactions
  WHERE transaction_type = 'purchase'
  GROUP BY inventory_id
),
own_usage AS (
  -- Active usage from daily_material_usage (records that still exist = not deleted)
  SELECT
    inventory_id,
    COALESCE(SUM(quantity), 0) AS total_used
  FROM daily_material_usage
  WHERE inventory_id IS NOT NULL
  GROUP BY inventory_id
),
batch_usage AS (
  -- Active usage from batch_usage_records (for shared/group stock)
  -- Maps batch_ref_code back to stock_inventory via batch_code + usage_site_id
  SELECT
    si.id AS inventory_id,
    COALESCE(SUM(bur.quantity), 0) AS total_used
  FROM batch_usage_records bur
  JOIN stock_inventory si
    ON si.batch_code = bur.batch_ref_code
    AND si.site_id = bur.usage_site_id
    AND si.material_id = bur.material_id
  GROUP BY si.id
),
calculated AS (
  SELECT
    si.id,
    si.current_qty AS old_qty,
    COALESCE(d.total_delivered, 0) AS delivered,
    COALESCE(ou.total_used, 0) AS own_used,
    COALESCE(bu.total_used, 0) AS batch_used,
    GREATEST(
      COALESCE(d.total_delivered, 0) - COALESCE(ou.total_used, 0) - COALESCE(bu.total_used, 0),
      0
    ) AS new_qty
  FROM stock_inventory si
  LEFT JOIN delivered d ON d.inventory_id = si.id
  LEFT JOIN own_usage ou ON ou.inventory_id = si.id
  LEFT JOIN batch_usage bu ON bu.inventory_id = si.id
)
UPDATE stock_inventory si
SET
  current_qty = c.new_qty,
  updated_at = NOW()
FROM calculated c
WHERE si.id = c.id
  AND si.current_qty <> c.new_qty;

-- Step 2: Clean up incorrect stock_transactions 'adjustment' entries
-- that were created by the buggy deletion (pointing to wrong inventory records).
-- We keep them for audit trail but add a note.
UPDATE stock_transactions
SET notes = notes || ' [auto-corrected: qty recalculated in migration 20260215120000]'
WHERE transaction_type = 'adjustment'
  AND notes LIKE 'Restored from deleted usage record%';
