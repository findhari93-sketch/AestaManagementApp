-- Migration: Add entered_by_user_id column to tea_shop_entries
-- This column was used in the code but missing from the database

-- Add entered_by_user_id column to tea_shop_entries
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS entered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_tea_shop_entries_entered_by_user_id
ON tea_shop_entries(entered_by_user_id)
WHERE entered_by_user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tea_shop_entries.entered_by_user_id IS 'User ID of the person who created this entry';