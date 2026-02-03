-- =============================================
-- EQUIPMENT PHOTOS STORAGE BUCKET
-- =============================================

-- Create equipment-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'equipment-photos',
    'equipment-photos',
    true,
    5242880,  -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for equipment-photos bucket
CREATE POLICY "equipment_photos_authenticated_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'equipment-photos');

CREATE POLICY "equipment_photos_public_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'equipment-photos');

CREATE POLICY "equipment_photos_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'equipment-photos');

CREATE POLICY "equipment_photos_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'equipment-photos');
