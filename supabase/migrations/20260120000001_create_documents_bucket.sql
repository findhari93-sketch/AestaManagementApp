-- Migration: Create storage bucket for documents (bills, payment proofs, etc.)
-- Purpose: Store vendor bills and payment proofs for material settlements

-- Create the documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,  -- Not public, requires authentication
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can upload document files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view document files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update document files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete document files" ON storage.objects;

-- Create RLS policies for the documents bucket

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload document files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to view their uploaded files
CREATE POLICY "Authenticated users can view document files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow authenticated users to update their files
CREATE POLICY "Authenticated users can update document files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete document files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
