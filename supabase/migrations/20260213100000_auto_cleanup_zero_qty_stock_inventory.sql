-- Migration: Auto-cleanup zero-quantity stock_inventory records
-- Purpose: Enhance reverse_stock_on_delivery_item_delete trigger to auto-delete
-- stock_inventory records when current_qty reaches 0 after reversal.
-- This prevents orphan zero-qty records from appearing in v_low_stock_alerts.

CREATE OR REPLACE FUNCTION reverse_stock_on_delivery_item_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_site_id UUID;
  v_location_id UUID;
  v_delivery_date DATE;
  v_verification_status TEXT;
  v_requires_verification BOOLEAN;
  v_qty_to_remove DECIMAL;
BEGIN
  -- Get delivery details
  SELECT d.site_id, d.location_id, d.delivery_date, d.verification_status, d.requires_verification
  INTO v_site_id, v_location_id, v_delivery_date, v_verification_status, v_requires_verification
  FROM deliveries d
  WHERE d.id = OLD.delivery_id;

  -- Only reverse stock if this delivery had verified stock (or didn't require verification)
  IF v_verification_status = 'verified' OR v_requires_verification = FALSE THEN
    -- Calculate quantity that was added to stock
    v_qty_to_remove := COALESCE(OLD.accepted_qty, OLD.received_qty);

    -- Update stock inventory (subtract the quantity)
    UPDATE stock_inventory
    SET
      current_qty = GREATEST(0, current_qty - v_qty_to_remove),
      updated_at = NOW()
    WHERE site_id = v_site_id
      AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
      AND material_id = OLD.material_id
      AND (brand_id = OLD.brand_id OR (brand_id IS NULL AND OLD.brand_id IS NULL));

    -- Auto-cleanup: delete stock_inventory records that reached zero quantity
    DELETE FROM stock_inventory
    WHERE site_id = v_site_id
      AND material_id = OLD.material_id
      AND (brand_id = OLD.brand_id OR (brand_id IS NULL AND OLD.brand_id IS NULL))
      AND current_qty <= 0;

    -- Log for debugging
    RAISE NOTICE 'Reversed stock: site=%, material=%, brand=%, qty=%',
      v_site_id, OLD.material_id, OLD.brand_id, v_qty_to_remove;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Also clean up any existing orphan zero-qty records
DELETE FROM stock_transactions
WHERE inventory_id IN (
  SELECT id FROM stock_inventory WHERE current_qty <= 0
);

DELETE FROM stock_inventory WHERE current_qty <= 0;
