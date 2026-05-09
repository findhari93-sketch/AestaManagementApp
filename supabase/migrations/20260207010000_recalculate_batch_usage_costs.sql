-- Recalculate unit_cost and total_cost for existing batch_usage_records
-- Now that original_qty is backfilled, we can calculate correct batch_unit_cost
--
-- 2026-05-09 PATCH: a later migration converted total_cost into a generated column
-- (computed as quantity * unit_cost). Detect that case at replay time and only update
-- unit_cost when the column is generated; otherwise keep the original behaviour.
DO $$
DECLARE
  v_total_cost_generated boolean;
  v_updated_count integer;
BEGIN
  SELECT (a.attgenerated <> '')
    INTO v_total_cost_generated
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
   WHERE c.relname = 'batch_usage_records'
     AND a.attname = 'total_cost'
     AND a.attnum > 0;

  IF v_total_cost_generated THEN
    UPDATE batch_usage_records bur
       SET unit_cost = (mpe.total_amount / mpe.original_qty)
      FROM material_purchase_expenses mpe
     WHERE bur.batch_ref_code = mpe.ref_code
       AND mpe.original_qty IS NOT NULL
       AND mpe.original_qty > 0
       AND mpe.total_amount IS NOT NULL;
  ELSE
    UPDATE batch_usage_records bur
       SET unit_cost  = (mpe.total_amount / mpe.original_qty),
           total_cost = bur.quantity * (mpe.total_amount / mpe.original_qty)
      FROM material_purchase_expenses mpe
     WHERE bur.batch_ref_code = mpe.ref_code
       AND mpe.original_qty IS NOT NULL
       AND mpe.original_qty > 0
       AND mpe.total_amount IS NOT NULL;
  END IF;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % batch usage records with correct batch_unit_cost', v_updated_count;
END $$;
