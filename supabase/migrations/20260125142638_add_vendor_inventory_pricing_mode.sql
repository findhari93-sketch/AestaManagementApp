-- Add pricing mode to vendor_inventory for weight-based materials (like TMT rods)
-- This allows vendors to quote prices per kg instead of per piece

ALTER TABLE vendor_inventory
ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'per_piece' CHECK (pricing_mode IN ('per_piece', 'per_kg'));

COMMENT ON COLUMN vendor_inventory.pricing_mode IS 'per_piece: current_price is per piece; per_kg: current_price is per kg';
