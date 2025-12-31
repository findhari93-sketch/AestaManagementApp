-- Tea Shop Waterfall Auto-Recalculation
-- When an entry's total_amount is modified, automatically rebuild waterfall allocations

-- Function to rebuild waterfall allocations for a tea shop
CREATE OR REPLACE FUNCTION rebuild_tea_shop_waterfall(p_tea_shop_id UUID)
RETURNS void AS $$
DECLARE
  settlement_rec RECORD;
  entry_rec RECORD;
  remaining_amount NUMERIC;
  entry_remaining NUMERIC;
  to_allocate NUMERIC;
BEGIN
  -- Step 1: Delete existing allocations for this shop's settlements
  DELETE FROM tea_shop_settlement_allocations
  WHERE settlement_id IN (
    SELECT id FROM tea_shop_settlements WHERE tea_shop_id = p_tea_shop_id
  );

  -- Step 2: Reset all entries for this shop to unpaid
  UPDATE tea_shop_entries
  SET amount_paid = 0, is_fully_paid = false
  WHERE tea_shop_id = p_tea_shop_id;

  -- Step 3: Reprocess each settlement chronologically
  FOR settlement_rec IN
    SELECT id, amount_paid
    FROM tea_shop_settlements
    WHERE tea_shop_id = p_tea_shop_id
    ORDER BY payment_date ASC, created_at ASC
  LOOP
    remaining_amount := settlement_rec.amount_paid;

    -- Allocate to entries (oldest first)
    FOR entry_rec IN
      SELECT id, total_amount, amount_paid
      FROM tea_shop_entries
      WHERE tea_shop_id = p_tea_shop_id
        AND COALESCE(amount_paid, 0) < COALESCE(total_amount, 0)
      ORDER BY date ASC
    LOOP
      EXIT WHEN remaining_amount <= 0;

      entry_remaining := COALESCE(entry_rec.total_amount, 0) - COALESCE(entry_rec.amount_paid, 0);

      IF entry_remaining > 0 THEN
        to_allocate := LEAST(remaining_amount, entry_remaining);

        -- Create allocation record
        INSERT INTO tea_shop_settlement_allocations (settlement_id, entry_id, allocated_amount)
        VALUES (settlement_rec.id, entry_rec.id, to_allocate);

        -- Update entry
        UPDATE tea_shop_entries
        SET amount_paid = COALESCE(amount_paid, 0) + to_allocate,
            is_fully_paid = (COALESCE(amount_paid, 0) + to_allocate >= COALESCE(total_amount, 0))
        WHERE id = entry_rec.id;

        remaining_amount := remaining_amount - to_allocate;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for entry changes
CREATE OR REPLACE FUNCTION trigger_tea_shop_entry_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only rebuild if total_amount changed
  IF TG_OP = 'UPDATE' AND OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    PERFORM rebuild_tea_shop_waterfall(NEW.tea_shop_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM rebuild_tea_shop_waterfall(OLD.tea_shop_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tea_shop_entries (AFTER so the update completes first)
DROP TRIGGER IF EXISTS trg_tea_shop_entry_waterfall ON tea_shop_entries;
CREATE TRIGGER trg_tea_shop_entry_waterfall
  AFTER UPDATE OR DELETE ON tea_shop_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_tea_shop_entry_change();

-- Add comment for documentation
COMMENT ON FUNCTION rebuild_tea_shop_waterfall(UUID) IS
  'Rebuilds waterfall settlement allocations for a tea shop. Called automatically when entry amounts change.';

COMMENT ON FUNCTION trigger_tea_shop_entry_change() IS
  'Trigger function that calls rebuild_tea_shop_waterfall when tea_shop_entries.total_amount changes.';
