-- Migration: Add payer_name column to tea_shop_settlements
-- This column stores custom payer name when payer_source is 'custom' or 'other_site_money'

ALTER TABLE tea_shop_settlements ADD COLUMN IF NOT EXISTS payer_name TEXT;

COMMENT ON COLUMN tea_shop_settlements.payer_name IS 'Custom payer name when payer_source is custom or other_site_money';
