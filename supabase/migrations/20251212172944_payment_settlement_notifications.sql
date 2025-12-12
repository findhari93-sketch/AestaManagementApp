-- Payment Settlement Notifications Migration
-- Adds support for payment settlement workflow with notifications

-- Add settlement_reason column for cash payment explanations
ALTER TABLE site_engineer_transactions
ADD COLUMN IF NOT EXISTS settlement_reason TEXT;

-- Create storage bucket for settlement proofs (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('settlement-proofs', 'settlement-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for settlement-proofs bucket
DO $$
BEGIN
    -- Drop existing policies if they exist to avoid conflicts
    DROP POLICY IF EXISTS "Allow authenticated uploads to settlement-proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public read of settlement-proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated updates to settlement-proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated deletes from settlement-proofs" ON storage.objects;
END $$;

CREATE POLICY "Allow authenticated uploads to settlement-proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'settlement-proofs');

CREATE POLICY "Allow public read of settlement-proofs"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'settlement-proofs');

CREATE POLICY "Allow authenticated updates to settlement-proofs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'settlement-proofs');

CREATE POLICY "Allow authenticated deletes from settlement-proofs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'settlement-proofs');

-- Add index for faster notification queries by type and related entity
CREATE INDEX IF NOT EXISTS idx_notifications_type_related
ON notifications (notification_type, related_id);

-- Add index for site_engineer_transactions by settlement_status for quick lookups
CREATE INDEX IF NOT EXISTS idx_set_settlement_status
ON site_engineer_transactions (settlement_status, user_id);

-- Add index for finding pending settlements by user
CREATE INDEX IF NOT EXISTS idx_set_user_pending
ON site_engineer_transactions (user_id, settlement_status)
WHERE settlement_status = 'pending_settlement';
