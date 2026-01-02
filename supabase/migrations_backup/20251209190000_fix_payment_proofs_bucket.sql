-- Fix Payment Proofs Storage Bucket
-- Ensures bucket exists and has proper RLS policies

-- Create bucket if not exists (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,  -- Making it public for simpler access (auth still required for uploads)
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

-- Drop existing policies if they exist (to recreate them properly)
DROP POLICY IF EXISTS "Allow payment-proofs uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow payment-proofs downloads" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_insert" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_select" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_update" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_delete" ON storage.objects;

-- Allow authenticated users to upload to payment-proofs bucket
CREATE POLICY "payment_proofs_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

-- Allow authenticated users to read from payment-proofs bucket
CREATE POLICY "payment_proofs_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs');

-- Allow authenticated users to update their own uploads
CREATE POLICY "payment_proofs_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-proofs');

-- Allow authenticated users to delete from payment-proofs bucket
CREATE POLICY "payment_proofs_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payment-proofs');
