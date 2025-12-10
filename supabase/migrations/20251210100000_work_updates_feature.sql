-- Work Updates Feature Migration
-- Adds work_updates JSONB column for morning/evening photo documentation
-- Creates work-updates storage bucket for site photos

-- Add work_updates JSONB column to daily_work_summary
ALTER TABLE daily_work_summary
ADD COLUMN IF NOT EXISTS work_updates JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN daily_work_summary.work_updates IS 'JSON structure for morning/evening work updates with photos. Structure: { photoCount: number, morning: { description, photos[], timestamp }, evening: { completionPercent, summary, photos[], timestamp } }';

-- Create work-updates storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'work-updates',
  'work-updates',
  true,  -- Public for simpler access (auth required for uploads)
  10485760, -- 10MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "work_updates_insert" ON storage.objects;
DROP POLICY IF EXISTS "work_updates_select" ON storage.objects;
DROP POLICY IF EXISTS "work_updates_update" ON storage.objects;
DROP POLICY IF EXISTS "work_updates_delete" ON storage.objects;

-- Allow authenticated users to upload to work-updates bucket
CREATE POLICY "work_updates_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'work-updates');

-- Allow authenticated users to read from work-updates bucket
CREATE POLICY "work_updates_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'work-updates');

-- Allow authenticated users to update their uploads
CREATE POLICY "work_updates_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'work-updates');

-- Allow authenticated users to delete from work-updates bucket
CREATE POLICY "work_updates_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'work-updates');
