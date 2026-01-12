-- Create rental-items storage bucket for rental item photos
-- This bucket stores item photos uploaded from the rental items catalog

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rental-items',
  'rental-items',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated uploads
CREATE POLICY "rental_items_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rental-items');

-- Policy: Allow public reads (for displaying images)
CREATE POLICY "rental_items_public_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'rental-items');

-- Policy: Allow authenticated updates
CREATE POLICY "rental_items_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'rental-items');

-- Policy: Allow authenticated deletes
CREATE POLICY "rental_items_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rental-items');
