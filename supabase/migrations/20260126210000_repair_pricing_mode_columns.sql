-- Repair migration: Re-add pricing mode columns if they don't exist
-- This is a repair for migration 20260125141037 that may have failed silently

DO $$
BEGIN
    -- Add pricing_mode column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'purchase_order_items' AND column_name = 'pricing_mode') THEN
        ALTER TABLE purchase_order_items
        ADD COLUMN pricing_mode TEXT DEFAULT 'per_piece' CHECK (pricing_mode IN ('per_piece', 'per_kg'));
    END IF;

    -- Add calculated_weight column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'purchase_order_items' AND column_name = 'calculated_weight') THEN
        ALTER TABLE purchase_order_items ADD COLUMN calculated_weight DECIMAL(12,3);
    END IF;

    -- Add actual_weight column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'purchase_order_items' AND column_name = 'actual_weight') THEN
        ALTER TABLE purchase_order_items ADD COLUMN actual_weight DECIMAL(12,3);
    END IF;

    -- Add actual_weight_per_piece column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'purchase_order_items' AND column_name = 'actual_weight_per_piece') THEN
        ALTER TABLE purchase_order_items ADD COLUMN actual_weight_per_piece DECIMAL(10,4);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN purchase_order_items.pricing_mode IS 'per_piece: unit_price is per piece; per_kg: unit_price is per kg';
COMMENT ON COLUMN purchase_order_items.calculated_weight IS 'Standard weight = qty × piece_weight (for reference)';
COMMENT ON COLUMN purchase_order_items.actual_weight IS 'Actual delivered weight (may differ from calculated)';
COMMENT ON COLUMN purchase_order_items.actual_weight_per_piece IS 'Derived: actual_weight / quantity - used for brand-specific weight learning';
