-- Create product-photos storage bucket for store catalog images
-- This bucket stores product/material photos uploaded from the store catalog view

-- Note: Storage bucket creation is typically done via Supabase Dashboard or CLI
-- This migration documents the required bucket configuration

-- Bucket: product-photos
-- Public: true (for displaying images)
-- File size limit: 5MB (compressed images)
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Storage policies to be created:
-- 1. Allow authenticated users to upload: INSERT for authenticated
-- 2. Allow public reads: SELECT for public
-- 3. Allow authenticated users to update/delete their uploads: UPDATE, DELETE for authenticated

-- Run these commands in Supabase Dashboard SQL Editor if bucket doesn't exist:

/*
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-photos',
  'product-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-photos');

-- Policy: Allow public reads
CREATE POLICY "Allow public reads" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-photos');

-- Policy: Allow authenticated updates
CREATE POLICY "Allow authenticated updates" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-photos');

-- Policy: Allow authenticated deletes
CREATE POLICY "Allow authenticated deletes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-photos');
*/

-- For now, we'll use the existing work-updates bucket with a product-photos/ folder prefix
-- This avoids the need to create a new bucket while still organizing product photos properly
-- Path pattern: work-updates/product-photos/{materialId}/{filename}

SELECT 'Product photos will use work-updates bucket with product-photos/ folder prefix' AS info;
