-- Add image_url column to material_brands for per-brand product images
ALTER TABLE "public"."material_brands"
  ADD COLUMN IF NOT EXISTS "image_url" TEXT NULL;
