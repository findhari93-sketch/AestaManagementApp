-- Migration: Re-run Batch Cost Backfill
-- Purpose: Ensure all existing batches with bargained amounts have adjusted costs
-- This recalculates the correct unit_cost based on amount_paid / total_quantity

DO $$
DECLARE
  r RECORD;
  v_original_unit_cost NUMERIC;
  v_adjusted_unit_cost NUMERIC;
  v_total_quantity NUMERIC;
  v_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting batch cost backfill...';

  FOR r IN
    SELECT
      mpe.ref_code,
      mpe.total_amount,
      mpe.amount_paid,
      mpe.id as expense_id
    FROM material_purchase_expenses mpe
    WHERE mpe.amount_paid IS NOT NULL
      AND mpe.is_paid = TRUE
      AND mpe.amount_paid != mpe.total_amount
      AND mpe.total_amount > 0
  LOOP
    -- Get total quantity from items
    SELECT COALESCE(SUM(quantity), 0), COALESCE(AVG(unit_price), 0)
    INTO v_total_quantity, v_original_unit_cost
    FROM material_purchase_expense_items
    WHERE purchase_expense_id = r.expense_id;

    IF v_total_quantity > 0 THEN
      -- Calculate the adjusted unit cost based on amount_paid
      v_adjusted_unit_cost := r.amount_paid::NUMERIC / v_total_quantity;
      v_count := v_count + 1;

      -- Update batch_usage_records with the correct adjusted unit_cost
      UPDATE batch_usage_records
      SET
        unit_cost = v_adjusted_unit_cost,
        updated_at = NOW()
      WHERE batch_ref_code = r.ref_code;

      -- Update group_stock_transactions for usage records
      UPDATE group_stock_transactions
      SET
        unit_cost = v_adjusted_unit_cost,
        updated_at = NOW()
      WHERE batch_ref_code = r.ref_code
        AND transaction_type = 'usage';

      RAISE NOTICE 'Adjusted batch %: amount_paid=%, quantity=%, new_unit_cost=%',
        r.ref_code, r.amount_paid, v_total_quantity, v_adjusted_unit_cost;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete. Processed % batches.', v_count;
END $$;
