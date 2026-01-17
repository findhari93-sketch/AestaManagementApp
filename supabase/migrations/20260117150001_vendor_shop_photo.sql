-- Add shop_photo_url column to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS shop_photo_url TEXT;
COMMENT ON COLUMN vendors.shop_photo_url IS 'URL to vendor shop/store photo';
