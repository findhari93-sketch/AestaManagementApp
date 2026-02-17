-- Migration: Backfill missing debtor-side material expenses for completed inter-site settlements
-- Also adds vendor_paid tracking to batch_usage_records view

-- ============================================================
-- STEP 1: Backfill missing debtor expenses
-- Find all settled inter_site_material_settlements that don't have
-- a corresponding material_purchase_expenses record for the debtor site
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  new_expense_id UUID;
  new_ref_code TEXT;
  item_rec RECORD;
BEGIN
  RAISE NOTICE 'Starting backfill of missing debtor expenses for settled inter-site settlements...';

  FOR rec IN
    SELECT
      iss.id AS settlement_id,
      iss.settlement_code,
      iss.site_group_id,
      iss.from_site_id,  -- creditor
      iss.to_site_id,    -- debtor
      iss.total_amount,
      iss.settled_at,
      -- Get payment info from the latest payment
      (
        SELECT isp.payment_date
        FROM inter_site_settlement_payments isp
        WHERE isp.settlement_id = iss.id
        ORDER BY isp.payment_date DESC
        LIMIT 1
      ) AS payment_date,
      (
        SELECT isp.payment_mode
        FROM inter_site_settlement_payments isp
        WHERE isp.settlement_id = iss.id
        ORDER BY isp.payment_date DESC
        LIMIT 1
      ) AS payment_mode,
      (
        SELECT isp.reference_number
        FROM inter_site_settlement_payments isp
        WHERE isp.settlement_id = iss.id
        ORDER BY isp.payment_date DESC
        LIMIT 1
      ) AS payment_reference
    FROM inter_site_material_settlements iss
    WHERE iss.status = 'settled'
      -- Only settlements that DON'T already have a debtor expense
      AND NOT EXISTS (
        SELECT 1
        FROM material_purchase_expenses mpe
        WHERE mpe.site_id = iss.to_site_id
          AND mpe.settlement_reference = iss.settlement_code
          AND mpe.original_batch_code IS NOT NULL
      )
  LOOP
    -- Generate a unique ref code
    new_ref_code := 'ISET-BF-' || substr(md5(random()::text), 1, 8);

    RAISE NOTICE 'Creating debtor expense for settlement % (debtor site: %, amount: %)',
      rec.settlement_code, rec.to_site_id, rec.total_amount;

    -- Create the material_purchase_expense for the debtor site
    INSERT INTO material_purchase_expenses (
      site_id,
      ref_code,
      purchase_type,
      purchase_date,
      total_amount,
      transport_cost,
      status,
      is_paid,
      paid_date,
      payment_mode,
      payment_reference,
      original_batch_code,
      settlement_reference,
      settlement_date,
      settlement_payer_source,
      site_group_id,
      notes
    ) VALUES (
      rec.to_site_id,
      new_ref_code,
      'own_site',
      COALESCE(rec.payment_date, rec.settled_at::date, CURRENT_DATE),
      rec.total_amount,
      0,
      'completed',
      true,
      COALESCE(rec.payment_date, rec.settled_at::date, CURRENT_DATE),
      COALESCE(rec.payment_mode, 'cash'),
      rec.payment_reference,
      rec.settlement_code,
      rec.settlement_code,
      COALESCE(rec.payment_date, rec.settled_at::date, CURRENT_DATE),
      'own',
      rec.site_group_id,
      'Backfilled: Inter-site settlement payment. Settlement: ' || rec.settlement_code
    )
    RETURNING id INTO new_expense_id;

    -- Create expense items from settlement items
    FOR item_rec IN
      SELECT material_id, brand_id, quantity_used, unit_cost
      FROM inter_site_settlement_items
      WHERE settlement_id = rec.settlement_id
    LOOP
      INSERT INTO material_purchase_expense_items (
        purchase_expense_id,
        material_id,
        brand_id,
        quantity,
        unit_price,
        notes
      ) VALUES (
        new_expense_id,
        item_rec.material_id,
        item_rec.brand_id,
        item_rec.quantity_used,
        item_rec.unit_cost,
        'Backfilled from settlement ' || rec.settlement_code
      );
    END LOOP;

    RAISE NOTICE 'Created expense % for settlement %', new_ref_code, rec.settlement_code;
  END LOOP;

  RAISE NOTICE 'Backfill complete.';
END;
$$;
