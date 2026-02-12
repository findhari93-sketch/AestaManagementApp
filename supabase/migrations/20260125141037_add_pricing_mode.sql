-- Add pricing mode and weight tracking columns to purchase_order_items
-- This supports dual pricing (per kg OR per piece) for weight-based materials like TMT rods

ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'per_piece' CHECK (pricing_mode IN ('per_piece', 'per_kg')),
ADD COLUMN IF NOT EXISTS calculated_weight DECIMAL(12,3),
ADD COLUMN IF NOT EXISTS actual_weight DECIMAL(12,3),
ADD COLUMN IF NOT EXISTS actual_weight_per_piece DECIMAL(10,4);

COMMENT ON COLUMN purchase_order_items.pricing_mode IS 'per_piece: unit_price is per piece; per_kg: unit_price is per kg';
COMMENT ON COLUMN purchase_order_items.calculated_weight IS 'Standard weight = qty × piece_weight (for reference)';
COMMENT ON COLUMN purchase_order_items.actual_weight IS 'Actual delivered weight (may differ from calculated)';
COMMENT ON COLUMN purchase_order_items.actual_weight_per_piece IS 'Derived: actual_weight / quantity - used for brand-specific weight learning';
