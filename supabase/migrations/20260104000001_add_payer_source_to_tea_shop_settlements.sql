-- Migration: Add payer_source column to tea_shop_settlements
-- This column stores the payment source type (own_money, client_money, custom, other_site_money)

ALTER TABLE tea_shop_settlements ADD COLUMN IF NOT EXISTS payer_source TEXT;

COMMENT ON COLUMN tea_shop_settlements.payer_source IS 'Payment source type: own_money, client_money, custom, other_site_money';
