-- Add photo upload and tracking fields to deliveries table
-- This allows recording who recorded the delivery, when, and uploading delivery photos

ALTER TABLE deliveries
ADD COLUMN IF NOT EXISTS delivery_photos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN deliveries.delivery_photos IS 'Array of photo URLs documenting the delivered materials';
COMMENT ON COLUMN deliveries.recorded_by IS 'User who recorded this delivery';
COMMENT ON COLUMN deliveries.recorded_at IS 'Timestamp when delivery was recorded';

-- Create index for querying by recorded_by
CREATE INDEX IF NOT EXISTS idx_deliveries_recorded_by ON deliveries(recorded_by);
