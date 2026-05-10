-- Price intelligence RPC for the AI ingest Preview step.
-- Standalone file (no GRANT, no second CREATE) so the supabase CLI's SQL
-- splitter doesn't fold this into a prepared statement with anything else.
-- Companion: 20260510100130_ai_ingest_v2_grants.sql carries the GRANT.

CREATE OR REPLACE FUNCTION public.get_purchase_price_context(
  p_material_ids UUID[],
  p_vendor_id    UUID
)
RETURNS TABLE (
  material_id              UUID,
  last_same_vendor_price   NUMERIC,
  last_same_vendor_date    DATE,
  last_any_vendor_price    NUMERIC,
  last_any_vendor_id       UUID,
  last_any_vendor_name     TEXT,
  last_any_vendor_date     DATE
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $body$
  WITH latest_same AS (
    SELECT DISTINCT ON (ph.material_id)
      ph.material_id,
      ph.price       AS last_same_vendor_price,
      ph.recorded_date AS last_same_vendor_date
    FROM price_history ph
    WHERE ph.material_id = ANY(p_material_ids)
      AND p_vendor_id IS NOT NULL
      AND ph.vendor_id = p_vendor_id
    ORDER BY ph.material_id, ph.recorded_date DESC, ph.created_at DESC
  ),
  latest_any AS (
    SELECT DISTINCT ON (ph.material_id)
      ph.material_id,
      ph.price       AS last_any_vendor_price,
      ph.vendor_id   AS last_any_vendor_id,
      v.name         AS last_any_vendor_name,
      ph.recorded_date AS last_any_vendor_date
    FROM price_history ph
    LEFT JOIN vendors v ON v.id = ph.vendor_id
    WHERE ph.material_id = ANY(p_material_ids)
    ORDER BY ph.material_id, ph.recorded_date DESC, ph.created_at DESC
  )
  SELECT
    w.material_id,
    s.last_same_vendor_price,
    s.last_same_vendor_date,
    a.last_any_vendor_price,
    a.last_any_vendor_id,
    a.last_any_vendor_name,
    a.last_any_vendor_date
  FROM unnest(p_material_ids) AS w(material_id)
  LEFT JOIN latest_same s ON s.material_id = w.material_id
  LEFT JOIN latest_any  a ON a.material_id = w.material_id;
$body$;
