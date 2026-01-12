-- Migration: Fix rental order creation issues
-- Purpose: 1. Add missing GRANT EXECUTE permissions for rental RPC functions
--          2. Fix trigger that references non-existent created_by column

-- ============================================================================
-- PART 1: Grant execute permissions on RPC functions
-- ============================================================================

-- Generate rental order number function
GRANT EXECUTE ON FUNCTION public.generate_rental_order_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rental_order_number(uuid) TO service_role;

-- Generate rental settlement reference function
GRANT EXECUTE ON FUNCTION public.generate_rental_settlement_reference(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rental_settlement_reference(uuid) TO service_role;

-- Calculate rental cost function
GRANT EXECUTE ON FUNCTION public.calculate_rental_cost(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_rental_cost(uuid, date) TO service_role;

-- ============================================================================
-- PART 2: Fix record_rental_price_history trigger function
-- The original function references NEW.created_by which doesn't exist in rental_order_items
-- ============================================================================

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
