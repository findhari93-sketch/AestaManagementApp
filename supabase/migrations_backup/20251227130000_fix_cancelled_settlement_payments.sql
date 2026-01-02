-- Migration: Fix cancelled settlement labor payments and non-rounded amounts
-- Purpose:
-- 1. Delete labor_payments linked to cancelled settlement_groups
-- 2. Round all labor_payments.amount to nearest 100

-- ============================================================================
-- 1. Show what will be deleted (for audit)
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
  v_total NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(lp.amount), 0)
  INTO v_count, v_total
  FROM labor_payments lp
  JOIN settlement_groups sg ON lp.settlement_group_id = sg.id
  WHERE sg.is_cancelled = true;

  RAISE NOTICE 'Labor payments linked to cancelled settlements: % (total: Rs.%)', v_count, v_total;
END $$;

-- ============================================================================
-- 2. Delete labor_payments linked to cancelled settlement_groups
-- ============================================================================
DELETE FROM labor_payments
WHERE settlement_group_id IN (
  SELECT id FROM settlement_groups WHERE is_cancelled = true
);

-- ============================================================================
-- 3. Also delete any payment_week_allocations for those payments
-- ============================================================================
DELETE FROM payment_week_allocations
WHERE labor_payment_id NOT IN (SELECT id FROM labor_payments);

-- ============================================================================
-- 4. Round labor_payments amounts to nearest 100
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count non-rounded payments
  SELECT COUNT(*) INTO v_count
  FROM labor_payments
  WHERE amount % 100 != 0;

  RAISE NOTICE 'Non-rounded labor_payments before fix: %', v_count;
END $$;

-- Round to nearest 100
UPDATE labor_payments
SET amount = ROUND(amount / 100) * 100
WHERE amount % 100 != 0;

-- ============================================================================
-- 5. Update settlement_groups total_amount to match rounded labor_payments
-- ============================================================================
WITH payment_sums AS (
  SELECT
    settlement_group_id,
    SUM(amount) as new_total
  FROM labor_payments
  WHERE settlement_group_id IS NOT NULL
  GROUP BY settlement_group_id
)
UPDATE settlement_groups sg
SET total_amount = ps.new_total
FROM payment_sums ps
WHERE sg.id = ps.settlement_group_id
  AND sg.total_amount != ps.new_total;

-- ============================================================================
-- 6. Verify the fix
-- ============================================================================
DO $$
DECLARE
  v_cancelled_payments INTEGER;
  v_non_rounded INTEGER;
  v_mismatched INTEGER;
BEGIN
  -- Check for payments linked to cancelled settlements
  SELECT COUNT(*) INTO v_cancelled_payments
  FROM labor_payments lp
  JOIN settlement_groups sg ON lp.settlement_group_id = sg.id
  WHERE sg.is_cancelled = true;

  -- Check for non-rounded amounts
  SELECT COUNT(*) INTO v_non_rounded
  FROM labor_payments
  WHERE amount % 100 != 0;

  -- Check for mismatched totals
  SELECT COUNT(*) INTO v_mismatched
  FROM settlement_groups sg
  WHERE sg.is_cancelled = false
    AND EXISTS (
      SELECT 1 FROM labor_payments lp
      WHERE lp.settlement_group_id = sg.id
      GROUP BY lp.settlement_group_id
      HAVING ABS(SUM(lp.amount) - sg.total_amount) > 1
    );

  RAISE NOTICE '=== After Fix ===';
  RAISE NOTICE 'Payments linked to cancelled settlements: %', v_cancelled_payments;
  RAISE NOTICE 'Non-rounded payment amounts: %', v_non_rounded;
  RAISE NOTICE 'Settlement groups with mismatched totals: %', v_mismatched;
END $$;
