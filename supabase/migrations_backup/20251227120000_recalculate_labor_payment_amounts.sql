-- Recalculate labor_payments amounts to match settlement_groups.total_amount
-- This fixes the discrepancy where individual payments don't sum to the settlement total

-- Step 1: Create a function to redistribute payment amounts proportionally
CREATE OR REPLACE FUNCTION recalculate_settlement_payments(p_settlement_group_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_amount NUMERIC;
  v_current_sum NUMERIC;
  v_payment RECORD;
  v_proportion NUMERIC;
  v_new_amount NUMERIC;
  v_allocated NUMERIC := 0;
  v_count INTEGER := 0;
  v_total_count INTEGER;
BEGIN
  -- Get the settlement group's total amount
  SELECT total_amount INTO v_total_amount
  FROM settlement_groups
  WHERE id = p_settlement_group_id;

  IF v_total_amount IS NULL OR v_total_amount <= 0 THEN
    RETURN;
  END IF;

  -- Get current sum of payments
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_current_sum, v_total_count
  FROM labor_payments
  WHERE settlement_group_id = p_settlement_group_id;

  IF v_current_sum <= 0 OR v_total_count = 0 THEN
    RETURN;
  END IF;

  -- Redistribute proportionally
  FOR v_payment IN
    SELECT id, amount
    FROM labor_payments
    WHERE settlement_group_id = p_settlement_group_id
    ORDER BY amount DESC
  LOOP
    v_count := v_count + 1;

    IF v_count = v_total_count THEN
      -- Last payment gets the remainder to ensure exact match
      v_new_amount := v_total_amount - v_allocated;
    ELSE
      -- Calculate proportional amount and round
      v_proportion := v_payment.amount / v_current_sum;
      v_new_amount := ROUND(v_total_amount * v_proportion);
    END IF;

    -- Ensure non-negative
    v_new_amount := GREATEST(0, v_new_amount);

    -- Update the payment
    UPDATE labor_payments
    SET amount = v_new_amount
    WHERE id = v_payment.id;

    v_allocated := v_allocated + v_new_amount;
  END LOOP;
END;
$$;

-- Step 2: Apply to all settlement_groups
DO $$
DECLARE
  v_sg RECORD;
  v_fixed_count INTEGER := 0;
BEGIN
  FOR v_sg IN
    SELECT DISTINCT sg.id
    FROM settlement_groups sg
    INNER JOIN labor_payments lp ON lp.settlement_group_id = sg.id
    WHERE sg.is_cancelled = false
  LOOP
    PERFORM recalculate_settlement_payments(v_sg.id);
    v_fixed_count := v_fixed_count + 1;
  END LOOP;

  RAISE NOTICE 'Recalculated payments for % settlement groups', v_fixed_count;
END $$;

-- Step 3: Verify the fix - count any remaining mismatches
DO $$
DECLARE
  v_mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_mismatch_count
  FROM settlement_groups sg
  WHERE sg.is_cancelled = false
    AND EXISTS (
      SELECT 1
      FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      GROUP BY lp.settlement_group_id
      HAVING ABS(SUM(lp.amount) - sg.total_amount) > 1
    );

  RAISE NOTICE 'Settlement groups with payment sum mismatch: %', v_mismatch_count;
END $$;

-- Step 4: Clean up the function (optional - comment out if you want to keep it)
DROP FUNCTION IF EXISTS recalculate_settlement_payments(UUID);
