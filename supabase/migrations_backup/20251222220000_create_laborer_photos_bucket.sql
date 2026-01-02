-- Laborer Photos Storage Bucket Migration
-- Creates laborer-photos bucket for laborer profile photos with crop/zoom support

-- Create laborer-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'laborer-photos',
  'laborer-photos',
  true,  -- Public for simpler access (auth required for uploads)
  5242880, -- 5MB max per file (photos are compressed before upload)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "laborer_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "laborer_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "laborer_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "laborer_photos_delete" ON storage.objects;

-- Allow authenticated users to upload to laborer-photos bucket
CREATE POLICY "laborer_photos_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'laborer-photos');

-- Allow public read access (photos displayed in table for all authenticated users)
CREATE POLICY "laborer_photos_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'laborer-photos');

-- Allow authenticated users to update their uploads
CREATE POLICY "laborer_photos_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'laborer-photos');

-- Allow authenticated users to delete from laborer-photos bucket
CREATE POLICY "laborer_photos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'laborer-photos');
