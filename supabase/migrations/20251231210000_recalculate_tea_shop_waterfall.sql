-- Recalculate tea shop entry payment status from scratch
-- This fixes the waterfall calculation by resetting and recalculating based on settlement allocations

-- Step 1: Reset ALL entries to unpaid
UPDATE tea_shop_entries
SET amount_paid = 0, is_fully_paid = false;

-- Step 2: Recalculate amount_paid from settlement allocations
-- This uses the actual allocations stored in tea_shop_settlement_allocations table
UPDATE tea_shop_entries e
SET amount_paid = COALESCE(alloc_sum.total_allocated, 0)
FROM (
  SELECT entry_id, SUM(allocated_amount) as total_allocated
  FROM tea_shop_settlement_allocations
  GROUP BY entry_id
) alloc_sum
WHERE e.id = alloc_sum.entry_id;

-- Step 3: Set is_fully_paid based on amount_paid vs total_amount
UPDATE tea_shop_entries
SET is_fully_paid = CASE
  WHEN COALESCE(amount_paid, 0) >= COALESCE(total_amount, 0) THEN true
  ELSE false
END;

-- Verify: Show entries with their payment status (for debugging)
-- SELECT date, total_amount, amount_paid, is_fully_paid FROM tea_shop_entries ORDER BY date;
