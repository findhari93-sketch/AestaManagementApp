-- Add inventory_id column to daily_material_usage so FIFO allocation can target specific batches.
-- The trigger update_stock_on_usage currently uses LIMIT 1 on site_id+material_id+brand_id,
-- which deducts from an arbitrary batch when multiple exist. With inventory_id, the trigger
-- can deduct from the exact batch chosen by FIFO allocation.

-- Step 1: Add nullable inventory_id column
ALTER TABLE "public"."daily_material_usage"
  ADD COLUMN IF NOT EXISTS "inventory_id" UUID REFERENCES "public"."stock_inventory"("id") ON DELETE SET NULL;

-- Step 2: Update the trigger to use inventory_id when provided
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
  -- If inventory_id is provided, use it directly (FIFO allocation mode)
  IF NEW.inventory_id IS NOT NULL THEN
    SELECT id, avg_unit_cost, pricing_mode, total_weight, current_qty
    INTO v_inv_id, v_avg_cost, v_pricing_mode, v_total_weight, v_current_qty
    FROM stock_inventory
    WHERE id = NEW.inventory_id;
  ELSE
    -- Legacy fallback: find inventory by site_id + material_id + brand_id
    SELECT id, avg_unit_cost, pricing_mode, total_weight, current_qty
    INTO v_inv_id, v_avg_cost, v_pricing_mode, v_total_weight, v_current_qty
    FROM stock_inventory
    WHERE site_id = NEW.site_id
      AND material_id = NEW.material_id
      AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL))
    LIMIT 1;
  END IF;

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

    -- Ensure the inventory_id is set on the record for audit trail
    NEW.inventory_id := v_inv_id;

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
