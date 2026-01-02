-- Migration: Fix missing payment_reference values in labor_payments
-- The previous migration created labor_payments records but didn't generate payment_reference values

DO $$
DECLARE
  payment_rec RECORD;
  new_ref TEXT;
  updated_count INTEGER := 0;
BEGIN
  -- Find all labor_payments without a payment_reference
  FOR payment_rec IN
    SELECT id, site_id
    FROM labor_payments
    WHERE payment_reference IS NULL
      AND is_under_contract = true
      AND payment_type = 'salary'
  LOOP
    -- Generate a new payment reference
    new_ref := generate_payment_reference(payment_rec.site_id);

    -- Update the record
    UPDATE labor_payments
    SET payment_reference = new_ref
    WHERE id = payment_rec.id;

    updated_count := updated_count + 1;
    RAISE NOTICE 'Updated payment % with reference %', payment_rec.id, new_ref;
  END LOOP;

  RAISE NOTICE 'Total payments updated with references: %', updated_count;
END $$;
