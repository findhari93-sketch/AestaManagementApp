-- Recalculate unit_cost and total_cost for existing batch_usage_records
-- Now that original_qty is backfilled, we can calculate correct batch_unit_cost

-- Update batch_usage_records to use correct batch_unit_cost from material_purchase_expenses
UPDATE batch_usage_records bur
SET
  unit_cost = (mpe.total_amount / mpe.original_qty),
  total_cost = bur.quantity * (mpe.total_amount / mpe.original_qty)
FROM material_purchase_expenses mpe
WHERE bur.batch_ref_code = mpe.ref_code
  AND mpe.original_qty IS NOT NULL
  AND mpe.original_qty > 0
  AND mpe.total_amount IS NOT NULL;

-- Log the update for tracking
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % batch usage records with correct batch_unit_cost', updated_count;
END $$;
