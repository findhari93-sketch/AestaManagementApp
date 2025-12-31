-- Fix tea shop entries where is_fully_paid doesn't match amount_paid vs total_amount
-- This corrects entries that may have been incorrectly marked as paid

-- Reset is_fully_paid based on actual amount_paid vs total_amount
UPDATE tea_shop_entries
SET is_fully_paid = CASE
  WHEN COALESCE(amount_paid, 0) >= COALESCE(total_amount, 0) THEN true
  ELSE false
END
WHERE is_fully_paid IS DISTINCT FROM (
  CASE
    WHEN COALESCE(amount_paid, 0) >= COALESCE(total_amount, 0) THEN true
    ELSE false
  END
);

-- Ensure amount_paid defaults to 0 for entries that have NULL
UPDATE tea_shop_entries
SET amount_paid = 0
WHERE amount_paid IS NULL;

-- Add comment
COMMENT ON COLUMN tea_shop_entries.amount_paid IS 'Running total of amount paid via settlements (waterfall method)';
COMMENT ON COLUMN tea_shop_entries.is_fully_paid IS 'True when amount_paid >= total_amount';
