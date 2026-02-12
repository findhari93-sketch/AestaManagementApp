-- Fix batch stock inventory discrepancies
-- Reconciles stock_inventory.current_qty with actual usage records

-- Step 1: Create a temporary table with correct quantities
CREATE TEMP TABLE correct_batch_quantities AS
SELECT
  si.id as stock_id,
  si.batch_code,
  si.current_qty as current_qty_wrong,
  mpe.original_qty as purchased,
  COALESCE(SUM(bur.quantity), 0) as total_used,
  mpe.original_qty - COALESCE(SUM(bur.quantity), 0) as correct_qty,
  si.current_qty - (mpe.original_qty - COALESCE(SUM(bur.quantity), 0)) as discrepancy
FROM stock_inventory si
JOIN material_purchase_expenses mpe ON mpe.ref_code = si.batch_code
LEFT JOIN batch_usage_records bur ON bur.batch_ref_code = si.batch_code
WHERE si.batch_code IS NOT NULL
AND mpe.original_qty IS NOT NULL
GROUP BY si.id, si.batch_code, si.current_qty, mpe.original_qty;

-- Step 2: Show what will be fixed
DO $$
DECLARE
  fix_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fix_count
  FROM correct_batch_quantities
  WHERE discrepancy != 0;

  RAISE NOTICE 'Found % stock records with discrepancies', fix_count;

  -- Log each discrepancy
  FOR rec IN (
    SELECT batch_code, current_qty_wrong, correct_qty, discrepancy
    FROM correct_batch_quantities
    WHERE discrepancy != 0
  ) LOOP
    RAISE NOTICE 'Batch % : Current=% → Correct=% (Diff=%)',
      rec.batch_code, rec.current_qty_wrong, rec.correct_qty, rec.discrepancy;
  END LOOP;
END $$;

-- Step 3: Fix the stock quantities
UPDATE stock_inventory si
SET current_qty = cbq.correct_qty
FROM correct_batch_quantities cbq
WHERE si.id = cbq.stock_id
AND cbq.discrepancy != 0
RETURNING
  si.batch_code,
  cbq.current_qty_wrong as old_qty,
  si.current_qty as new_qty,
  cbq.discrepancy as fixed_discrepancy;

-- Step 4: Also update material_purchase_expenses.remaining_qty
UPDATE material_purchase_expenses mpe
SET remaining_qty = (
  SELECT correct_qty
  FROM correct_batch_quantities
  WHERE batch_code = mpe.ref_code
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM correct_batch_quantities cbq
  WHERE cbq.batch_code = mpe.ref_code
  AND cbq.discrepancy != 0
)
RETURNING ref_code as batch_code, remaining_qty as fixed_remaining_qty;
