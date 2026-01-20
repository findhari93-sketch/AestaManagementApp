-- Migration: Create storage bucket for settlement documents
-- Purpose: Store vendor bills and payment proofs for material settlements

-- Create the settlements bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'settlements',
  'settlements',
  false,  -- Not public, requires authentication
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the settlements bucket

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload settlement files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'settlements');

-- Allow authenticated users to view their uploaded files
CREATE POLICY "Authenticated users can view settlement files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'settlements');

-- Allow authenticated users to update their files
CREATE POLICY "Authenticated users can update settlement files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'settlements');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete settlement files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'settlements');
