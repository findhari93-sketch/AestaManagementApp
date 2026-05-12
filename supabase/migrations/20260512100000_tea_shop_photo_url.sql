-- Add photo_url column to tea_shop_accounts for shop identity in the mobile header
ALTER TABLE tea_shop_accounts ADD COLUMN IF NOT EXISTS photo_url TEXT;
