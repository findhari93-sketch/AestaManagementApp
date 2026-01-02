-- Complete rebuild of tea shop waterfall allocations
-- This fixes incorrect allocations by recalculating from scratch

-- Step 1: Delete all existing allocations (they were calculated incorrectly)
DELETE FROM tea_shop_settlement_allocations;

-- Step 2: Reset all entries to unpaid
UPDATE tea_shop_entries
SET amount_paid = 0, is_fully_paid = false;

-- Step 3: Recalculate allocations using proper waterfall method
-- This function properly allocates settlement amounts to entries (oldest first)
DO $$
DECLARE
  settlement_rec RECORD;
  entry_rec RECORD;
  remaining_amount NUMERIC;
  entry_remaining NUMERIC;
  to_allocate NUMERIC;
BEGIN
  -- Process each settlement in chronological order
  FOR settlement_rec IN
    SELECT id, tea_shop_id, amount_paid
    FROM tea_shop_settlements
    ORDER BY payment_date ASC, created_at ASC
  LOOP
    remaining_amount := settlement_rec.amount_paid;

    -- Allocate to entries (oldest first) that still have remaining balance
    FOR entry_rec IN
      SELECT id, total_amount, amount_paid
      FROM tea_shop_entries
      WHERE tea_shop_id = settlement_rec.tea_shop_id
        AND (COALESCE(amount_paid, 0) < COALESCE(total_amount, 0))
      ORDER BY date ASC
    LOOP
      EXIT WHEN remaining_amount <= 0;

      entry_remaining := COALESCE(entry_rec.total_amount, 0) - COALESCE(entry_rec.amount_paid, 0);

      IF entry_remaining > 0 THEN
        to_allocate := LEAST(remaining_amount, entry_remaining);

        -- Insert allocation record
        INSERT INTO tea_shop_settlement_allocations (settlement_id, entry_id, allocated_amount)
        VALUES (settlement_rec.id, entry_rec.id, to_allocate);

        -- Update entry payment
        UPDATE tea_shop_entries
        SET amount_paid = COALESCE(amount_paid, 0) + to_allocate,
            is_fully_paid = (COALESCE(amount_paid, 0) + to_allocate >= COALESCE(total_amount, 0))
        WHERE id = entry_rec.id;

        remaining_amount := remaining_amount - to_allocate;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Verify final state
-- SELECT date, total_amount, amount_paid, is_fully_paid FROM tea_shop_entries ORDER BY tea_shop_id, date;
