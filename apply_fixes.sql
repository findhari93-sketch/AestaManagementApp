-- Apply all fixes in one transaction
BEGIN;

-- Fix 1: Backfill original_qty for batch cost calculation
UPDATE material_purchase_expenses mpe
SET original_qty = (
  SELECT COALESCE(SUM(quantity), 0)
  FROM material_purchase_expense_items
  WHERE expense_id = mpe.id
)
WHERE original_qty IS NULL
AND EXISTS (
  SELECT 1
  FROM material_purchase_expense_items
  WHERE expense_id = mpe.id
);

-- Fix 2: Reconcile batch stock quantities
WITH correct_quantities AS (
  SELECT
    si.id as stock_id,
    si.batch_code,
    si.current_qty as current_qty_wrong,
    mpe.original_qty as purchased,
    COALESCE(SUM(bur.quantity), 0) as total_used,
    mpe.original_qty - COALESCE(SUM(bur.quantity), 0) as correct_qty
  FROM stock_inventory si
  JOIN material_purchase_expenses mpe ON mpe.ref_code = si.batch_code
  LEFT JOIN batch_usage_records bur ON bur.batch_ref_code = si.batch_code
  WHERE si.batch_code IS NOT NULL
  AND mpe.original_qty IS NOT NULL
  GROUP BY si.id, si.batch_code, si.current_qty, mpe.original_qty
)
UPDATE stock_inventory si
SET current_qty = cq.correct_qty
FROM correct_quantities cq
WHERE si.id = cq.stock_id
AND si.current_qty != cq.correct_qty;

-- Show what was fixed
SELECT 
  'Fixed TMT 16mm Stock' as result,
  si.batch_code,
  si.current_qty as new_quantity,
  m.name as material
FROM stock_inventory si
JOIN materials m ON m.id = si.material_id
WHERE m.name ILIKE '%TMT%16%'
AND si.batch_code IS NOT NULL;

COMMIT;
