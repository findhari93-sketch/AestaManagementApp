-- Ensure work-updates bucket exists with public access for product photos
-- The work-updates bucket is used for attendance work photos and product-photos folder
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'work-updates',
  'work-updates',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- Add public anonymous read policy so public URLs work without authentication
DROP POLICY IF EXISTS "work_updates_public_select" ON storage.objects;
CREATE POLICY "work_updates_public_select"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'work-updates');

-- Ensure authenticated users can upload
DROP POLICY IF EXISTS "work_updates_authenticated_insert" ON storage.objects;
CREATE POLICY "work_updates_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'work-updates');

-- Ensure authenticated users can update
DROP POLICY IF EXISTS "work_updates_authenticated_update" ON storage.objects;
CREATE POLICY "work_updates_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'work-updates');

-- Ensure authenticated users can delete
DROP POLICY IF EXISTS "work_updates_authenticated_delete" ON storage.objects;
CREATE POLICY "work_updates_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'work-updates');
