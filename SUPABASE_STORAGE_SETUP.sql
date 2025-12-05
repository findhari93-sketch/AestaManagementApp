-- ==============================================
-- Create Storage Bucket for Contract Documents (idempotent)
-- ==============================================

-- 1. Create the storage bucket only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'contract-documents'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'contract-documents',
      'contract-documents',
      true,
      52428800,  -- 50MB limit
      ARRAY['application/pdf']
    );
  END IF;
END;
$$;

-- ==============================================
-- Storage Policies for the bucket (idempotent)
-- ==============================================

-- 2. Allow authenticated users to upload files (INSERT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated uploads'
  ) THEN
    CREATE POLICY "Allow authenticated uploads"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'contract-documents');
  END IF;
END;
$$;

-- 3. Allow authenticated users to update their uploads (UPDATE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated updates'
  ) THEN
    CREATE POLICY "Allow authenticated updates"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'contract-documents');
  END IF;
END;
$$;

-- 4. Allow public read access to contract documents (SELECT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'contract-documents');
  END IF;
END;
$$;

-- 5. Allow authenticated users to delete files (DELETE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated deletes'
  ) THEN
    CREATE POLICY "Allow authenticated deletes"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'contract-documents');
  END IF;
END;
$$;
