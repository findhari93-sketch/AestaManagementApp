-- Migration: Add weight and length fields to materials for TMT and similar materials
-- This enables weight-per-unit tracking and automatic weight calculations

-- Add weight and length fields to materials table
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS weight_per_unit DECIMAL(10,6) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS length_per_piece DECIMAL(10,4) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS length_unit TEXT DEFAULT 'm';

-- Add comments for documentation
COMMENT ON COLUMN materials.weight_per_unit IS 'Weight per unit piece (e.g., 0.395 kg for 8mm TMT)';
COMMENT ON COLUMN materials.weight_unit IS 'Unit for weight measurement (kg, g, ton)';
COMMENT ON COLUMN materials.length_per_piece IS 'Standard length per piece (e.g., 12m for TMT bars)';
COMMENT ON COLUMN materials.length_unit IS 'Unit for length measurement (m, ft, mm)';

-- Create index for materials with weight defined (for quick filtering)
CREATE INDEX IF NOT EXISTS idx_materials_weight ON materials(weight_per_unit)
WHERE weight_per_unit IS NOT NULL;

-- Function to calculate total weight from quantity
CREATE OR REPLACE FUNCTION calculate_material_weight(
  p_material_id UUID,
  p_quantity DECIMAL
)
RETURNS TABLE (
  total_weight DECIMAL,
  weight_unit TEXT,
  weight_per_unit DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN m.weight_per_unit IS NOT NULL
         THEN p_quantity * m.weight_per_unit
         ELSE NULL
    END as total_weight,
    m.weight_unit,
    m.weight_per_unit
  FROM materials m
  WHERE m.id = p_material_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_material_weight(UUID, DECIMAL) TO authenticated;
