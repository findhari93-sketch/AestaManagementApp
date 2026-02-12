-- Fix: update_stock_on_usage() trigger should reduce total_weight proportionally
-- for per_kg priced stock items when usage is recorded.
-- Previously, only current_qty was reduced but total_weight stayed at the original value,
-- causing the inventory value to be overstated after usage.

CREATE OR REPLACE FUNCTION "public"."update_stock_on_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_inv_id UUID;
  v_avg_cost DECIMAL(12,2);
  v_pricing_mode TEXT;
  v_total_weight DECIMAL(12,3);
  v_current_qty DECIMAL(12,3);
BEGIN
  -- Find the inventory record (include pricing_mode, total_weight, current_qty)
  SELECT id, avg_unit_cost, pricing_mode, total_weight, current_qty
  INTO v_inv_id, v_avg_cost, v_pricing_mode, v_total_weight, v_current_qty
  FROM stock_inventory
  WHERE site_id = NEW.site_id
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL))
  LIMIT 1;

  IF v_inv_id IS NOT NULL THEN
    -- Update inventory (deduct quantity and proportionally reduce total_weight for per_kg items)
    UPDATE stock_inventory
    SET
      current_qty = current_qty - NEW.quantity,
      total_weight = CASE
        WHEN v_pricing_mode = 'per_kg' AND v_total_weight IS NOT NULL AND v_current_qty > 0
        THEN ROUND(v_total_weight - (NEW.quantity * (v_total_weight / v_current_qty)), 3)
        ELSE total_weight
      END,
      last_issued_date = NEW.usage_date,
      updated_at = NOW()
    WHERE id = v_inv_id;

    -- Update usage record with cost if not set
    IF NEW.unit_cost IS NULL THEN
      NEW.unit_cost := v_avg_cost;
      NEW.total_cost := NEW.quantity * v_avg_cost;
    END IF;

    -- Create stock transaction
    INSERT INTO stock_transactions (
      site_id, inventory_id, transaction_type, transaction_date,
      quantity, unit_cost, total_cost, reference_type, reference_id,
      section_id, created_by
    ) VALUES (
      NEW.site_id, v_inv_id, 'usage', NEW.usage_date,
      -NEW.quantity, NEW.unit_cost, NEW.total_cost,
      'daily_material_usage', NEW.id,
      NEW.section_id, NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: Fix stale total_weight for per_kg stock items that have had usage recorded.
-- For these items, total_weight should equal current_qty * weight_per_piece.
-- weight_per_piece is derived from the original delivery data or batch_original_qty.
-- Since we don't have batch_original_qty in stock_inventory, we use the material's
-- weight_per_unit from the materials table as the canonical weight per piece.
UPDATE stock_inventory si
SET total_weight = ROUND(si.current_qty * m.weight_per_unit, 3)
FROM materials m
WHERE si.material_id = m.id
  AND si.pricing_mode = 'per_kg'
  AND si.total_weight IS NOT NULL
  AND m.weight_per_unit IS NOT NULL
  AND m.weight_per_unit > 0
  AND si.current_qty > 0
  -- Only fix items where total_weight is clearly stale (weight per piece too high)
  AND (si.total_weight / si.current_qty) > (m.weight_per_unit * 1.5);
