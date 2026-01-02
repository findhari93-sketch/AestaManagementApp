-- Tea Shop Settlement Trigger for Waterfall Recalculation
-- When a settlement is created, updated, or deleted, automatically rebuild waterfall allocations

-- Trigger function for settlement changes
CREATE OR REPLACE FUNCTION trigger_tea_shop_settlement_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Settlement deleted - rebuild to mark entries as unpaid
    PERFORM rebuild_tea_shop_waterfall(OLD.tea_shop_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Rebuild if amount changed
    IF OLD.amount_paid IS DISTINCT FROM NEW.amount_paid THEN
      PERFORM rebuild_tea_shop_waterfall(NEW.tea_shop_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    -- For new settlements, rebuild to ensure allocations are correct
    PERFORM rebuild_tea_shop_waterfall(NEW.tea_shop_id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tea_shop_settlements
DROP TRIGGER IF EXISTS trg_tea_shop_settlement_waterfall ON tea_shop_settlements;
CREATE TRIGGER trg_tea_shop_settlement_waterfall
  AFTER INSERT OR UPDATE OR DELETE ON tea_shop_settlements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_tea_shop_settlement_change();

-- Add comment for documentation
COMMENT ON FUNCTION trigger_tea_shop_settlement_change() IS
  'Trigger function that calls rebuild_tea_shop_waterfall when settlements are created, updated, or deleted.';
