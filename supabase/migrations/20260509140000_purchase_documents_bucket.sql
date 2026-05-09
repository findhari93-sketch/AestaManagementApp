-- Create purchase-documents storage bucket for AI ingestion bill / quotation
-- screenshots / warranty card uploads.
--
-- AddHistoricalPurchaseDialog.tsx and the new ai-ingestion ContextPicker both
-- target this bucket name; it was assumed to exist but never actually created.
-- Result: every upload through either dialog hit "Bucket not found".
--
-- Policies mirror the contract-documents pattern: public read (so generated
-- public URLs in bill_url columns are accessible without signed URLs),
-- authenticated insert/update/delete.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-documents',
  'purchase-documents',
  true,
  15728640,  -- 15 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "purchase_documents_public_read" ON storage.objects;
CREATE POLICY "purchase_documents_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'purchase-documents');

DROP POLICY IF EXISTS "purchase_documents_authenticated_insert" ON storage.objects;
CREATE POLICY "purchase_documents_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'purchase-documents');

DROP POLICY IF EXISTS "purchase_documents_authenticated_update" ON storage.objects;
CREATE POLICY "purchase_documents_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'purchase-documents');

DROP POLICY IF EXISTS "purchase_documents_authenticated_delete" ON storage.objects;
CREATE POLICY "purchase_documents_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'purchase-documents');
