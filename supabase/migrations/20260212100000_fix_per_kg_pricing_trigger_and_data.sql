-- Fix: Update delivery trigger to handle per-kg pricing mode and total_weight
-- Root cause: The trigger was never updated when pricing_mode/total_weight columns were added
-- This caused TMT rod stock to have incorrect avg_unit_cost, pricing_mode, and total_weight

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
    v_site_id, v_inv_id, 'purchase', v_delivery_date,
    COALESCE(NEW.accepted_qty, NEW.received_qty),
    NEW.unit_price,
    COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0),
    'delivery', NEW.delivery_id
  );

  -- Update PO item received quantity if linked
  IF NEW.po_item_id IS NOT NULL THEN
    UPDATE purchase_order_items
    SET received_qty = received_qty + COALESCE(NEW.accepted_qty, NEW.received_qty)
    WHERE id = NEW.po_item_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: Fix existing per-kg stock records at Srinivasan House & Shop
-- These records had incorrect avg_unit_cost, pricing_mode, and total_weight
-- because the trigger didn't handle per-kg pricing

-- TMT Rods 12mm: 56 pcs, weighted avg per-kg = (44*52.12 + 12*58.39)/56 = 53.46
-- total_weight = 484.6 + 129.918 = 614.518
UPDATE stock_inventory
SET pricing_mode = 'per_kg',
    total_weight = 614.518,
    avg_unit_cost = 53.46,
    updated_at = NOW()
WHERE id = '7f21b09c-a356-47ca-9039-1271381226f3';

-- TMT Rods 16mm: 5 pcs, avg per-kg = 52.12
-- total_weight = 95.5
UPDATE stock_inventory
SET pricing_mode = 'per_kg',
    total_weight = 95.5,
    avg_unit_cost = 52.12,
    updated_at = NOW()
WHERE id = '49587172-df5d-4773-b11f-f2a8f4b0b5b1';

-- TMT Rods 8mm: 20 pcs, weighted avg per-kg = (10*53.26 + 10*59.24)/20 = 56.25
-- total_weight = 48.1 + 48.158 = 96.258
UPDATE stock_inventory
SET pricing_mode = 'per_kg',
    total_weight = 96.258,
    avg_unit_cost = 56.25,
    updated_at = NOW()
WHERE id = '41e4ba5c-39ce-444c-bd19-7915c5717e40';
