-- Migration: Fix unique constraint on material_brands
-- The old constraint may have a different name, so we need to find and drop it dynamically

-- Drop ALL existing unique constraints on material_brands that involve (material_id, brand_name)
-- This handles cases where the constraint name differs from expected
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find all unique constraints on material_brands table
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'material_brands'::regclass
        AND contype = 'u'  -- unique constraint
    LOOP
        -- Drop each unique constraint
        EXECUTE format('ALTER TABLE material_brands DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
        RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
    END LOOP;
END $$;

-- Now create the new unique constraint that includes variant_name
-- Using COALESCE to handle NULL variant_name (treating NULL as empty string for uniqueness)
-- This ensures (material_id, brand_name, NULL) and (material_id, brand_name, 'DSP') are different
ALTER TABLE material_brands
ADD CONSTRAINT material_brands_unique_brand_variant
UNIQUE NULLS NOT DISTINCT (material_id, brand_name, variant_name);

-- Note: NULLS NOT DISTINCT means:
-- (material_id=1, brand_name='Dalmia', variant_name=NULL) can only exist ONCE
-- (material_id=1, brand_name='Dalmia', variant_name='DSP') can exist alongside the NULL one
