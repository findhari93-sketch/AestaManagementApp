-- ============================================
-- MATERIAL VARIANTS FEATURE
-- Group material variants under parent materials
-- e.g., "TMT Bar" -> 8mm, 10mm, 12mm, 16mm, 20mm
-- Created: 2024-12-30
-- ============================================

-- ============================================
-- ADD parent_id TO MATERIALS TABLE
-- ============================================

ALTER TABLE materials ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES materials(id);

-- Create index for efficient parent lookups
CREATE INDEX IF NOT EXISTS idx_materials_parent ON materials(parent_id);

-- ============================================
-- CONSTRAINT: Only one level of nesting
-- A variant cannot have variants (parent cannot have a parent)
-- ============================================

CREATE OR REPLACE FUNCTION check_material_parent_level()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a parent_id, ensure the parent is not itself a variant
  IF NEW.parent_id IS NOT NULL THEN
    -- Check if the proposed parent has a parent (is a variant)
    IF EXISTS (
      SELECT 1 FROM materials
      WHERE id = NEW.parent_id AND parent_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot create nested variants. A variant cannot have sub-variants.';
    END IF;
  END IF;

  -- If this material has variants, it cannot become a variant
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM materials WHERE parent_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot make this material a variant because it already has variants.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_material_parent_level ON materials;
CREATE TRIGGER trg_check_material_parent_level
  BEFORE INSERT OR UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION check_material_parent_level();

-- ============================================
-- VIEW FOR MATERIALS WITH VARIANT INFO
-- ============================================

DROP VIEW IF EXISTS v_materials_with_variants;
CREATE OR REPLACE VIEW v_materials_with_variants AS
SELECT
  m.*,
  mc.name as category_name,
  mc.code as category_code,
  parent.name as parent_name,
  parent.code as parent_code,
  -- Count variants if this is a parent material
  COALESCE(
    (SELECT COUNT(*) FROM materials v WHERE v.parent_id = m.id AND v.is_active = true),
    0
  ) as variant_count,
  -- Flag to indicate if this material is a variant
  CASE WHEN m.parent_id IS NOT NULL THEN true ELSE false END as is_variant
FROM materials m
LEFT JOIN material_categories mc ON mc.id = m.category_id
LEFT JOIN materials parent ON parent.id = m.parent_id;

-- ============================================
-- FUNCTION: Get all materials grouped by parent
-- Returns parent materials with their variants nested
-- ============================================

CREATE OR REPLACE FUNCTION get_materials_with_variants(
  p_category_id UUID DEFAULT NULL,
  p_include_inactive BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  unit TEXT,
  parent_id UUID,
  parent_name TEXT,
  category_id UUID,
  category_name TEXT,
  is_active BOOLEAN,
  variant_count BIGINT,
  is_variant BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.name,
    m.code,
    m.unit::TEXT,
    m.parent_id,
    parent.name as parent_name,
    m.category_id,
    mc.name as category_name,
    m.is_active,
    (SELECT COUNT(*) FROM materials v WHERE v.parent_id = m.id AND (p_include_inactive OR v.is_active = true)) as variant_count,
    m.parent_id IS NOT NULL as is_variant
  FROM materials m
  LEFT JOIN material_categories mc ON mc.id = m.category_id
  LEFT JOIN materials parent ON parent.id = m.parent_id
  WHERE (p_include_inactive OR m.is_active = true)
    AND (p_category_id IS NULL OR m.category_id = p_category_id)
  ORDER BY
    -- Order parents first, then variants grouped under their parent
    COALESCE(parent.name, m.name),
    m.parent_id NULLS FIRST,
    m.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- END OF MATERIAL VARIANTS MIGRATION
-- ============================================
