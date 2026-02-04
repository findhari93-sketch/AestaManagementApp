-- Add pricing_mode and total_weight columns to stock_inventory
-- This enables correct value calculation for per-kg priced materials (like TMT steel)

-- Add pricing_mode column - default to 'per_piece' for backward compatibility
ALTER TABLE stock_inventory
ADD COLUMN IF NOT EXISTS pricing_mode text DEFAULT 'per_piece' CHECK (pricing_mode IN ('per_piece', 'per_kg'));

-- Add total_weight column to track cumulative weight for per-kg priced items
-- This is the sum of actual_weight (or calculated_weight) from all PO deliveries
ALTER TABLE stock_inventory
ADD COLUMN IF NOT EXISTS total_weight numeric(12,3);

-- Add comment explaining the columns
COMMENT ON COLUMN stock_inventory.pricing_mode IS 'Pricing mode: per_piece (price per item) or per_kg (price per kilogram). Determines how value is calculated.';
COMMENT ON COLUMN stock_inventory.total_weight IS 'Total weight in kg for per_kg priced items. Used to calculate inventory value.';

-- Create index for filtering by pricing mode
CREATE INDEX IF NOT EXISTS idx_stock_inventory_pricing_mode
ON stock_inventory (pricing_mode)
WHERE pricing_mode = 'per_kg';

-- Update the trigger function to handle pricing_mode and total_weight
CREATE OR REPLACE FUNCTION public.update_stock_on_verified_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_site_id UUID;
  v_location_id UUID;
  v_delivery_date DATE;
  v_verification_status TEXT;
  v_requires_verification BOOLEAN;
  v_inv_id UUID;
  v_pricing_mode TEXT;
  v_item_weight NUMERIC;
  v_existing_pricing_mode TEXT;
  v_existing_weight NUMERIC;
BEGIN
  -- Get delivery details
  SELECT d.site_id, d.location_id, d.delivery_date, d.verification_status, d.requires_verification
  INTO v_site_id, v_location_id, v_delivery_date, v_verification_status, v_requires_verification
  FROM deliveries d
  WHERE d.id = NEW.delivery_id;

  -- Only update stock if verified OR doesn't require verification
  IF v_verification_status != 'verified' AND v_requires_verification = TRUE THEN
    RETURN NEW;
  END IF;

  -- Get pricing_mode and weight from PO item if available
  IF NEW.po_item_id IS NOT NULL THEN
    SELECT
      COALESCE(poi.pricing_mode, 'per_piece'),
      COALESCE(poi.actual_weight, poi.calculated_weight)
    INTO v_pricing_mode, v_item_weight
    FROM purchase_order_items poi
    WHERE poi.id = NEW.po_item_id;
  ELSE
    v_pricing_mode := 'per_piece';
    v_item_weight := NULL;
  END IF;

  -- Find or create stock inventory record
  SELECT id, pricing_mode, total_weight
  INTO v_inv_id, v_existing_pricing_mode, v_existing_weight
  FROM stock_inventory
  WHERE site_id = v_site_id
    AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL));

  IF v_inv_id IS NULL THEN
    -- Create new inventory record with pricing fields
    INSERT INTO stock_inventory (
      site_id, location_id, material_id, brand_id,
      current_qty, avg_unit_cost, last_received_date,
      pricing_mode, total_weight
    ) VALUES (
      v_site_id, v_location_id, NEW.material_id, NEW.brand_id,
      COALESCE(NEW.accepted_qty, NEW.received_qty),
      COALESCE(NEW.unit_price, 0),
      v_delivery_date,
      v_pricing_mode,
      v_item_weight
    )
    RETURNING id INTO v_inv_id;
  ELSE
    -- Update existing inventory with weighted average cost
    -- Also update pricing_mode (prefer per_kg if any item is per_kg) and accumulate weight
    UPDATE stock_inventory
    SET
      current_qty = current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty),
      avg_unit_cost = CASE
        WHEN current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty) > 0 THEN
          ((current_qty * COALESCE(avg_unit_cost, 0)) +
           (COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0)))
          / (current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty))
        ELSE 0
      END,
      last_received_date = v_delivery_date,
      updated_at = NOW(),
      -- Set pricing_mode to per_kg if this item is per_kg (or keep existing if already per_kg)
      pricing_mode = CASE
        WHEN v_pricing_mode = 'per_kg' OR v_existing_pricing_mode = 'per_kg' THEN 'per_kg'
        ELSE 'per_piece'
      END,
      -- Accumulate total weight for per_kg items
      total_weight = CASE
        WHEN v_pricing_mode = 'per_kg' OR v_existing_pricing_mode = 'per_kg' THEN
          COALESCE(v_existing_weight, 0) + COALESCE(v_item_weight, 0)
        ELSE NULL
      END
    WHERE id = v_inv_id;
  END IF;

  -- Create stock transaction
  INSERT INTO stock_transactions (
    site_id, inventory_id, transaction_type, transaction_date,
    quantity, unit_cost, total_cost, reference_type, reference_id
  ) VALUES (
    v_site_id, v_inv_id, 'received', v_delivery_date,
    COALESCE(NEW.accepted_qty, NEW.received_qty),
    COALESCE(NEW.unit_price, 0),
    COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0),
    'delivery_item', NEW.id
  );

  RETURN NEW;
END;
$function$;
