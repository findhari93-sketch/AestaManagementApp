-- supabase/migrations/20260513100000_material_brand_variant_links.sql

-- ── 1. Create join table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_brand_variant_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   uuid NOT NULL REFERENCES material_brands(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES materials(id)       ON DELETE CASCADE,
  is_active  boolean NOT NULL DEFAULT true,
  image_url  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, variant_id)
);

CREATE INDEX IF NOT EXISTS material_brand_variant_links_brand_id_idx
  ON material_brand_variant_links(brand_id);

CREATE INDEX IF NOT EXISTS material_brand_variant_links_variant_id_idx
  ON material_brand_variant_links(variant_id);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE material_brand_variant_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_authenticated_read_mbvl"
  ON material_brand_variant_links FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "allow_authenticated_write_mbvl"
  ON material_brand_variant_links FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

-- ── 3. Seed: generic brand rows → all active child variants ───────────────────
-- For every brand with variant_name IS NULL, link it to every active child
-- variant (materials with parent_id = the brand's material_id).
INSERT INTO material_brand_variant_links (brand_id, variant_id, is_active)
SELECT
  mb.id    AS brand_id,
  cv.id    AS variant_id,
  true     AS is_active
FROM material_brands mb
JOIN materials cv ON cv.parent_id = mb.material_id
WHERE mb.variant_name IS NULL
  AND mb.is_active = true
  AND cv.is_active = true
ON CONFLICT (brand_id, variant_id) DO NOTHING;

-- ── 4. Sub-variant rows: best-effort match, then flag remaining ───────────────
-- Review query (run BEFORE applying migration to production):
--   SELECT mb.id, mb.brand_name, mb.variant_name, m.name AS matched_variant
--   FROM material_brands mb
--   JOIN materials cv ON cv.parent_id = mb.material_id
--      AND lower(cv.name) LIKE '%' || lower(mb.variant_name) || '%'
--   WHERE mb.variant_name IS NOT NULL AND mb.is_active = true;
--
-- Auto-seed where a confident unambiguous match exists:
INSERT INTO material_brand_variant_links (brand_id, variant_id, is_active, image_url)
SELECT
  mb.id          AS brand_id,
  cv.id          AS variant_id,
  true           AS is_active,
  mb.image_url   AS image_url
FROM material_brands mb
JOIN materials cv ON cv.parent_id = mb.material_id
  AND lower(cv.name) LIKE '%' || lower(mb.variant_name) || '%'
WHERE mb.variant_name IS NOT NULL
  AND mb.is_active = true
  AND cv.is_active = true
ON CONFLICT (brand_id, variant_id) DO NOTHING;
