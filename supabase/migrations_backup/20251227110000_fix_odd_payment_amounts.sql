-- Fix odd payment amounts in labor_payments and settlement_groups
-- The amounts should be whole numbers as payments are made in round figures

-- Step 1: Round all labor_payments amounts to nearest whole number
UPDATE labor_payments
SET amount = ROUND(amount)
WHERE amount != ROUND(amount);

-- Step 2: Update settlement_groups total_amount to match the sum of labor_payments
-- This ensures consistency between the group total and individual payments
WITH settlement_totals AS (
  SELECT
    settlement_group_id,
    SUM(amount) as calculated_total
  FROM labor_payments
  WHERE settlement_group_id IS NOT NULL
  GROUP BY settlement_group_id
)
UPDATE settlement_groups sg
SET total_amount = st.calculated_total
FROM settlement_totals st
WHERE sg.id = st.settlement_group_id
  AND sg.total_amount != st.calculated_total;

-- Step 3: Log how many records were affected (for verification)
DO $$
DECLARE
  labor_payments_fixed INTEGER;
  settlement_groups_fixed INTEGER;
BEGIN
  -- Count labor_payments with decimal amounts (should be 0 after fix)
  SELECT COUNT(*) INTO labor_payments_fixed
  FROM labor_payments
  WHERE amount != ROUND(amount);

  -- Count settlement_groups where total doesn't match sum of payments
  SELECT COUNT(*) INTO settlement_groups_fixed
  FROM settlement_groups sg
  WHERE EXISTS (
    SELECT 1
    FROM labor_payments lp
    WHERE lp.settlement_group_id = sg.id
    GROUP BY lp.settlement_group_id
    HAVING sg.total_amount != SUM(lp.amount)
  );

  RAISE NOTICE 'Labor payments with remaining decimals: %', labor_payments_fixed;
  RAISE NOTICE 'Settlement groups with mismatched totals: %', settlement_groups_fixed;
END $$;
