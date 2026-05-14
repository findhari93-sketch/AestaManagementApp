-- Allow rental_order_items to exist without a catalog entry (for historical records)
-- rental_item_id becomes nullable; item_name_override holds the free-text name

ALTER TABLE "public"."rental_order_items"
  ALTER COLUMN "rental_item_id" DROP NOT NULL;

ALTER TABLE "public"."rental_order_items"
  ADD COLUMN IF NOT EXISTS "item_name_override" TEXT;
