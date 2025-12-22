-- Migration: Backfill settlement_groups for existing labor_payments without settlement_group_id
-- Purpose: Ensure all historical contract payments appear in v_all_expenses view

-- Create settlement_groups for labor_payments that don't have one
-- Group by site_id, payment_date, and payment_type to create batch settlements

DO $$
DECLARE
  payment_record RECORD;
  new_settlement_group_id UUID;
  settlement_ref TEXT;
BEGIN
  -- Loop through labor_payments without settlement_group_id
  FOR payment_record IN
    SELECT
      lp.id,
      lp.site_id,
      lp.payment_date,
      lp.actual_payment_date,
      lp.amount,
      lp.payment_type,
      lp.payment_mode,
      lp.payment_channel,
      lp.is_under_contract,
      lp.subcontract_id,
      lp.proof_url,
      lp.notes,
      lp.paid_by,
      lp.paid_by_user_id,
      lp.created_at
    FROM labor_payments lp
    WHERE lp.settlement_group_id IS NULL
    ORDER BY lp.payment_date, lp.created_at
  LOOP
    -- Generate a settlement reference
    SELECT generate_settlement_reference(payment_record.site_id) INTO settlement_ref;

    -- Create a settlement_group for this payment
    INSERT INTO settlement_groups (
      id,
      site_id,
      settlement_date,
      total_amount,
      laborer_count,
      payment_channel,
      payment_mode,
      payment_type,
      actual_payment_date,
      settlement_reference,
      payer_source,
      subcontract_id,
      proof_url,
      notes,
      created_by,
      created_by_name,
      is_cancelled,
      created_at
    ) VALUES (
      gen_random_uuid(),
      payment_record.site_id,
      COALESCE(payment_record.actual_payment_date, payment_record.payment_date),
      payment_record.amount,
      1, -- Single laborer per historical payment
      COALESCE(payment_record.payment_channel, 'direct'),
      payment_record.payment_mode,
      COALESCE(payment_record.payment_type, 'salary'),
      payment_record.actual_payment_date,
      settlement_ref,
      'own_money', -- Default payer source for historical records
      payment_record.subcontract_id,
      payment_record.proof_url,
      payment_record.notes,
      payment_record.paid_by_user_id,
      payment_record.paid_by,
      false,
      payment_record.created_at
    )
    RETURNING id INTO new_settlement_group_id;

    -- Link the labor_payment to the new settlement_group
    UPDATE labor_payments
    SET settlement_group_id = new_settlement_group_id
    WHERE id = payment_record.id;

  END LOOP;
END $$;

-- Add comment
COMMENT ON TABLE settlement_groups IS 'Stores settlement batch information for salary payments. Backfilled for historical labor_payments on Dec 23, 2025.';
