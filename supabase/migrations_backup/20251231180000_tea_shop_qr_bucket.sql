-- Tea Shop QR Code Storage Bucket Migration
-- Creates tea-shop-qr bucket for tea shop payment QR code images

-- Create tea-shop-qr storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tea-shop-qr',
  'tea-shop-qr',
  true,  -- Public for simpler access (auth required for uploads)
  2097152, -- 2MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "tea_shop_qr_insert" ON storage.objects;
DROP POLICY IF EXISTS "tea_shop_qr_select" ON storage.objects;
DROP POLICY IF EXISTS "tea_shop_qr_update" ON storage.objects;
DROP POLICY IF EXISTS "tea_shop_qr_delete" ON storage.objects;

-- Allow authenticated users to upload to tea-shop-qr bucket
CREATE POLICY "tea_shop_qr_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tea-shop-qr');

-- Allow public read access (QR codes displayed for all authenticated users)
CREATE POLICY "tea_shop_qr_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'tea-shop-qr');

-- Allow authenticated users to update their uploads
CREATE POLICY "tea_shop_qr_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tea-shop-qr');

-- Allow authenticated users to delete from tea-shop-qr bucket
CREATE POLICY "tea_shop_qr_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tea-shop-qr');
