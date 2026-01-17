-- Create vendor-qr bucket for payment QR codes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-qr',
  'vendor-qr',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create vendor-photos bucket for shop photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-photos',
  'vendor-photos',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for vendor-qr
CREATE POLICY "Authenticated users can upload vendor QR codes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vendor-qr');

CREATE POLICY "Anyone can view vendor QR codes"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'vendor-qr');

CREATE POLICY "Authenticated users can update vendor QR codes"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'vendor-qr');

CREATE POLICY "Authenticated users can delete vendor QR codes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vendor-qr');

-- Storage policies for vendor-photos
CREATE POLICY "Authenticated users can upload vendor photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vendor-photos');

CREATE POLICY "Anyone can view vendor photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'vendor-photos');

CREATE POLICY "Authenticated users can update vendor photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'vendor-photos');

CREATE POLICY "Authenticated users can delete vendor photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vendor-photos');
