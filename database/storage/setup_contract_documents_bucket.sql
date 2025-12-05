-- Supabase Storage Setup for Contract Documents
-- Run this in Supabase SQL Editor or use Supabase Dashboard Storage UI

-- Note: Storage buckets are typically created via Supabase Dashboard
-- This file documents the required configuration

/*
MANUAL STEPS IN SUPABASE DASHBOARD:

1. Go to Storage > Create new bucket
   - Name: contract-documents
   - Public bucket: NO (keep private for security)
   - File size limit: 50 MB (adjust as needed)
   - Allowed MIME types: application/pdf, image/jpeg, image/png

2. Set up Storage Policies (RLS):
*/

-- Policy: Allow authenticated users to upload contract documents
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contract-documents');

-- Policy: Allow authenticated users to read contract documents
CREATE POLICY "Allow authenticated reads" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'contract-documents');

-- Policy: Allow admins to delete contract documents
CREATE POLICY "Allow admin deletes" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'contract-documents' 
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Policy: Allow admins to update contract documents
CREATE POLICY "Allow admin updates" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'contract-documents' 
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

/*
RECOMMENDED FOLDER STRUCTURE IN BUCKET:
contract-documents/
  ├── site_{site_id}/
  │   ├── client-contract.pdf
  │   ├── amendments/
  │   │   └── amendment_1.pdf
  │   └── supporting-docs/
  │       └── approval_letter.pdf

FILE NAMING CONVENTION:
Format: {site_id}_{document_type}_{timestamp}.pdf
Example: 550e8400-e29b-41d4-a716-446655440000_client_contract_1733404800000.pdf
*/
