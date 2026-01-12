-- Migration: Fix record_rental_price_history trigger function
-- Purpose: Fix error "record 'new' has no field 'created_by'" when creating rental orders
-- The original function references NEW.created_by which doesn't exist in rental_order_items table

CREATE OR REPLACE FUNCTION "public"."record_rental_price_history"()
RETURNS TRIGGER
LANGUAGE "plpgsql"
AS $$
BEGIN
  -- Record price from rental order items
  INSERT INTO rental_price_history (
    vendor_id,
    rental_item_id,
    daily_rate,
    recorded_date,
    source,
    source_reference,
    recorded_by
  )
  SELECT
    (SELECT vendor_id FROM rental_orders WHERE id = NEW.rental_order_id),
    NEW.rental_item_id,
    NEW.daily_rate_actual,
    CURRENT_DATE,
    'rental',
    (SELECT rental_order_number FROM rental_orders WHERE id = NEW.rental_order_id),
    auth.uid()  -- Use auth.uid() instead of NEW.created_by which doesn't exist
  ON CONFLICT DO NOTHING;

  -- Update vendor inventory price if exists
  UPDATE rental_store_inventory
  SET daily_rate = NEW.daily_rate_actual,
      last_price_update = NOW()
  WHERE vendor_id = (SELECT vendor_id FROM rental_orders WHERE id = NEW.rental_order_id)
    AND rental_item_id = NEW.rental_item_id;

  RETURN NEW;
END;
$$;
