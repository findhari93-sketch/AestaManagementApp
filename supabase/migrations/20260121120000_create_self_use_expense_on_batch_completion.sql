-- Migration: Create Self-Use Expense on Batch Completion
-- Purpose: When all inter-site settlements for a group stock batch are complete,
-- create a self-use expense record for the paying site so it shows in Material Expenses

-- =====================================================
-- Update process_batch_settlement function to create self-use expense
-- =====================================================

DROP FUNCTION IF EXISTS process_batch_settlement(TEXT, UUID, TEXT, DATE, TEXT, NUMERIC, UUID);

CREATE OR REPLACE FUNCTION process_batch_settlement(
  p_batch_ref_code TEXT,
  p_debtor_site_id UUID,
  p_payment_mode TEXT,
  p_payment_date DATE,
  p_payment_reference TEXT DEFAULT NULL,
  p_settlement_amount NUMERIC DEFAULT NULL,  -- optional amount override for bargaining
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  settlement_id UUID,
  debtor_expense_id UUID,
  settlement_code TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch RECORD;
  v_creditor_site_id UUID;
  v_creditor_site_name TEXT;
  v_debtor_site_name TEXT;
  v_total_qty NUMERIC;
  v_total_amount NUMERIC;
  v_original_amount NUMERIC;
  v_final_amount NUMERIC;
  v_unit_cost NUMERIC;
  v_settlement_id UUID;
  v_settlement_code TEXT;
  v_debtor_expense_id UUID;
  v_debtor_expense_ref TEXT;
  v_usage_record RECORD;
  v_batch_completed BOOLEAN;
  v_all_settled BOOLEAN;
  v_bill_url TEXT;
  v_self_use_expense_id UUID;
  v_self_use_expense_ref TEXT;
  v_self_use_material RECORD;
BEGIN
  -- Get batch details
  SELECT
    mpe.id,
    mpe.ref_code,
    mpe.site_id AS batch_site_id,
    mpe.paying_site_id,
    mpe.total_amount,
    mpe.original_qty,
    mpe.remaining_qty,
    mpe.used_qty,
    mpe.self_used_qty,
    mpe.self_used_amount,
    mpe.status,
    mpe.bill_url,
    mpe.purchase_date,
    s.name AS paying_site_name
  INTO v_batch
  FROM material_purchase_expenses mpe
  JOIN sites s ON s.id = COALESCE(mpe.paying_site_id, mpe.site_id)
  WHERE mpe.ref_code = p_batch_ref_code
    AND mpe.purchase_type = 'group_stock';

  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'Batch not found or not a group stock batch: %', p_batch_ref_code;
  END IF;

  -- Set creditor info
  v_creditor_site_id := COALESCE(v_batch.paying_site_id, v_batch.batch_site_id);
  v_creditor_site_name := v_batch.paying_site_name;
  v_bill_url := v_batch.bill_url;

  -- Get debtor site name
  SELECT name INTO v_debtor_site_name FROM sites WHERE id = p_debtor_site_id;

  -- Calculate totals from pending usage records for this debtor
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(total_cost), 0)
  INTO v_total_qty, v_total_amount
  FROM batch_usage_records
  WHERE batch_ref_code = p_batch_ref_code
    AND usage_site_id = p_debtor_site_id
    AND settlement_status = 'pending';

  IF v_total_qty = 0 THEN
    RAISE EXCEPTION 'No pending usage records found for site %', v_debtor_site_name;
  END IF;

  -- Store original calculated amount
  v_original_amount := v_total_amount;

  -- Use settlement_amount if provided (bargaining), otherwise use calculated amount
  IF p_settlement_amount IS NOT NULL AND p_settlement_amount > 0 THEN
    v_final_amount := p_settlement_amount;
  ELSE
    v_final_amount := v_total_amount;
  END IF;

  -- Calculate unit cost for the expense items
  v_unit_cost := v_final_amount / NULLIF(v_total_qty, 0);

  -- Generate settlement code
  v_settlement_code := 'BSET-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 4));

  -- Create inter_site_material_settlements record
  INSERT INTO inter_site_material_settlements (
    settlement_code,
    creditor_site_id,
    debtor_site_id,
    batch_ref_code,
    total_amount,
    payment_mode,
    payment_date,
    payment_reference,
    status,
    original_calculated_amount,
    final_settlement_amount,
    bill_url,
    created_by
  ) VALUES (
    v_settlement_code,
    v_creditor_site_id,
    p_debtor_site_id,
    p_batch_ref_code,
    v_final_amount,
    p_payment_mode,
    p_payment_date,
    p_payment_reference,
    'completed',
    v_original_amount,
    v_final_amount,
    v_bill_url,
    p_created_by
  )
  RETURNING id INTO v_settlement_id;

  -- Generate debtor expense reference
  v_debtor_expense_ref := 'BEXP-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 4));

  -- Create material_purchase_expense for debtor site
  INSERT INTO material_purchase_expenses (
    site_id,
    ref_code,
    purchase_type,
    vendor_name,
    purchase_date,
    total_amount,
    status,
    is_paid,
    paid_date,
    settlement_reference,
    settlement_date,
    original_batch_code,
    created_by,
    notes,
    bill_url
  ) VALUES (
    p_debtor_site_id,
    v_debtor_expense_ref,
    'own_site',  -- Convert to own_site so it appears in site's expenses
    v_creditor_site_name || ' (Group Settlement)',
    p_payment_date,
    v_final_amount,
    'recorded',
    true,
    p_payment_date,
    v_settlement_code,
    p_payment_date,
    p_batch_ref_code,  -- Link to original batch
    p_created_by,
    'Settled from batch ' || p_batch_ref_code || ' - ' || v_total_qty::text || ' units @ ' || v_unit_cost::text || '/unit' ||
    CASE
      WHEN v_original_amount <> v_final_amount THEN
        ' (Original: ' || v_original_amount::text || ', Negotiated: ' || v_final_amount::text || ')'
      ELSE ''
    END,
    v_bill_url  -- Copy bill URL for debtor's access
  )
  RETURNING id INTO v_debtor_expense_id;

  -- Create expense items for the debtor expense from usage records
  FOR v_usage_record IN
    SELECT * FROM batch_usage_records
    WHERE batch_ref_code = p_batch_ref_code
      AND usage_site_id = p_debtor_site_id
      AND settlement_status = 'pending'
  LOOP
    INSERT INTO material_purchase_expense_items (
      expense_id,
      material_id,
      brand_id,
      quantity,
      unit_price
    ) VALUES (
      v_debtor_expense_id,
      v_usage_record.material_id,
      v_usage_record.brand_id,
      v_usage_record.quantity,
      v_unit_cost  -- Use the adjusted unit cost
    );
  END LOOP;

  -- Update batch_usage_records as settled
  UPDATE batch_usage_records
  SET
    settlement_status = 'settled',
    settlement_id = v_settlement_id,
    updated_at = NOW()
  WHERE batch_ref_code = p_batch_ref_code
    AND usage_site_id = p_debtor_site_id
    AND settlement_status = 'pending';

  -- Create settlement_expense_allocations record
  INSERT INTO settlement_expense_allocations (
    settlement_id,
    batch_ref_code,
    creditor_site_id,
    creditor_expense_id,
    creditor_original_amount,
    creditor_self_use_amount,
    debtor_site_id,
    debtor_expense_id,
    debtor_settled_amount
  ) VALUES (
    v_settlement_id,
    p_batch_ref_code,
    v_creditor_site_id,
    v_batch.id,
    v_batch.total_amount,
    v_batch.self_used_amount,
    p_debtor_site_id,
    v_debtor_expense_id,
    v_final_amount
  );

  -- Check if batch is fully used and all settlements done
  SELECT
    remaining_qty <= 0,
    NOT EXISTS (
      SELECT 1 FROM batch_usage_records
      WHERE batch_ref_code = p_batch_ref_code
        AND settlement_status = 'pending'
    )
  INTO v_batch_completed, v_all_settled
  FROM material_purchase_expenses
  WHERE ref_code = p_batch_ref_code;

  -- Auto-complete batch if fully used AND all settlements done
  IF v_batch_completed AND v_all_settled THEN
    -- Update batch to completed status
    UPDATE material_purchase_expenses
    SET
      status = 'completed',
      updated_at = NOW()
    WHERE ref_code = p_batch_ref_code;

    -- Create self-use expense for the paying site if there's self-use
    IF COALESCE(v_batch.self_used_qty, 0) > 0 AND COALESCE(v_batch.self_used_amount, 0) > 0 THEN
      -- Generate self-use expense reference
      v_self_use_expense_ref := 'SELF-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 4));

      -- Create the self-use expense record
      INSERT INTO material_purchase_expenses (
        site_id,
        ref_code,
        purchase_type,
        vendor_name,
        purchase_date,
        total_amount,
        status,
        is_paid,
        paid_date,
        settlement_reference,
        settlement_date,
        original_batch_code,
        created_by,
        notes,
        bill_url
      ) VALUES (
        v_creditor_site_id,
        v_self_use_expense_ref,
        'own_site',  -- Convert to own_site so it appears in site's expenses
        'Self-Use from Group Stock',
        COALESCE(v_batch.purchase_date, CURRENT_DATE),
        v_batch.self_used_amount,
        'recorded',
        true,  -- Already paid (by this site originally)
        COALESCE(v_batch.purchase_date, CURRENT_DATE),
        'SELF-USE',  -- Special marker for self-use expenses
        CURRENT_DATE,
        p_batch_ref_code,  -- Link to original batch
        p_created_by,
        'Self-use from batch ' || p_batch_ref_code || ' - ' || COALESCE(v_batch.self_used_qty, 0)::text || ' units',
        v_bill_url
      )
      RETURNING id INTO v_self_use_expense_id;

      -- Create expense items for self-use from self-use usage records
      FOR v_self_use_material IN
        SELECT
          material_id,
          brand_id,
          SUM(quantity) as total_qty,
          AVG(unit_cost) as avg_unit_cost
        FROM batch_usage_records
        WHERE batch_ref_code = p_batch_ref_code
          AND usage_site_id = v_creditor_site_id
          AND is_self_use = true
        GROUP BY material_id, brand_id
      LOOP
        INSERT INTO material_purchase_expense_items (
          expense_id,
          material_id,
          brand_id,
          quantity,
          unit_price
        ) VALUES (
          v_self_use_expense_id,
          v_self_use_material.material_id,
          v_self_use_material.brand_id,
          v_self_use_material.total_qty,
          v_self_use_material.avg_unit_cost
        );
      END LOOP;
    END IF;
  END IF;

  RETURN QUERY SELECT v_settlement_id, v_debtor_expense_id, v_settlement_code;
END;
$$;

COMMENT ON FUNCTION process_batch_settlement(TEXT, UUID, TEXT, DATE, TEXT, NUMERIC, UUID) IS
'Processes settlement when a debtor site pays for their usage.
Creates settlement record, marks usage as settled, creates debtor expense record,
and auto-completes batch if fully settled.
NEW: When batch is fully settled, creates a self-use expense record for the paying site
with settlement_reference = "SELF-USE" so it appears in Material Expenses.';

GRANT EXECUTE ON FUNCTION process_batch_settlement(TEXT, UUID, TEXT, DATE, TEXT, NUMERIC, UUID) TO authenticated;
