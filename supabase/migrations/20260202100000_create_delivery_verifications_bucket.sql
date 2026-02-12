-- Create delivery-verifications storage bucket for delivery photos
-- This bucket stores photos uploaded during the combined Record & Verify Delivery process

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('delivery-verifications', 'delivery-verifications', true, 10485760) -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can upload delivery verification photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'delivery-verifications');

CREATE POLICY "Authenticated users can read delivery verification photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'delivery-verifications');

CREATE POLICY "Authenticated users can update delivery verification photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'delivery-verifications');

CREATE POLICY "Authenticated users can delete delivery verification photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'delivery-verifications');
