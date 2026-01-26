-- Add site_id column to notifications table
-- This column is used by delivery verification triggers

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE SET NULL;

-- Add index for faster lookups by site
CREATE INDEX IF NOT EXISTS idx_notifications_site_id
ON notifications(site_id)
WHERE site_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN notifications.site_id IS 'Site associated with this notification (for site-specific notifications)';
