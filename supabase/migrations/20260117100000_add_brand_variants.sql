-- Migration: Add variant_name to material_brands table
-- Purpose: Support brand sub-variants (e.g., Dalmia DSP, Dalmia Regular, Ramco Grade)

-- Add variant_name column to material_brands table
ALTER TABLE material_brands
ADD COLUMN IF NOT EXISTS variant_name TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN material_brands.variant_name IS
'Brand sub-variant name (e.g., "DSP" for Dalmia DSP, "Grade" for Ramco Grade). NULL means generic/default brand.';

-- Create index for efficient querying by brand and variant
CREATE INDEX IF NOT EXISTS idx_material_brands_variant
ON material_brands(material_id, brand_name, variant_name);

-- Update unique constraint to include variant_name
-- First drop existing unique constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'material_brands_material_id_brand_name_key'
    ) THEN
        ALTER TABLE material_brands
        DROP CONSTRAINT material_brands_material_id_brand_name_key;
    END IF;
END $$;

-- Create new unique constraint that allows same brand with different variants
ALTER TABLE material_brands
ADD CONSTRAINT material_brands_material_brand_variant_unique
UNIQUE (material_id, brand_name, variant_name);

-- Note: This allows:
-- (material_id=1, brand_name='Dalmia', variant_name=NULL) - generic Dalmia
-- (material_id=1, brand_name='Dalmia', variant_name='DSP') - Dalmia DSP
-- (material_id=1, brand_name='Dalmia', variant_name='Regular') - Dalmia Regular
