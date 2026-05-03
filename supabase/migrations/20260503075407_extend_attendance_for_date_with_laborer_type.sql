-- Migration: Extend get_attendance_for_date with laborer_type
--
-- Purpose:
--   The InspectPane's per-date drawer (Daily + Market salary settlement
--   redesign) needs to surface contract-laborer attendance as
--   informational context alongside daily and market entries. Today
--   get_attendance_for_date returns a flat 'daily_laborers' array that
--   commingles laborer_type='daily' and laborer_type='contract' rows
--   with no way for the client to tell them apart.
--
--   This migration re-creates the function with one additional field
--   per laborer (laborer_type) so the client can bucket them.
--
-- Compatibility:
--   - Pure additive change: existing callers that read 'amount', 'name',
--     'role', 'full_day' continue to work; they simply ignore the new
--     'laborer_type' field.
--   - Function signature unchanged (same args, same RETURNS jsonb).
--   - SECURITY INVOKER, search_path, GRANTs all preserved.

CREATE OR REPLACE FUNCTION public.get_attendance_for_date(
  p_site_id uuid,
  p_date date
) RETURNS jsonb
  LANGUAGE sql STABLE
  SECURITY INVOKER
  SET search_path = public
AS $$
  WITH
  daily_lab AS (
    SELECT
      d.id,
      l.name AS lab_name,
      COALESCE(lr.name, 'Unknown') AS role,
      (d.work_days >= 1) AS full_day,
      d.daily_earnings AS amount,
      l.laborer_type AS laborer_type
    FROM public.daily_attendance d
    JOIN public.laborers l ON l.id = d.laborer_id
    LEFT JOIN public.labor_roles lr ON lr.id = l.role_id
    WHERE d.site_id = p_site_id
      AND d.date = p_date
      AND d.is_deleted = false
    ORDER BY l.name
  ),
  market_lab AS (
    SELECT
      m.id,
      COALESCE(lr.name, 'Worker') AS role,
      m.count,
      m.total_cost AS amount
    FROM public.market_laborer_attendance m
    LEFT JOIN public.labor_roles lr ON lr.id = m.role_id
    WHERE m.site_id = p_site_id
      AND m.date = p_date
    ORDER BY lr.name
  ),
  -- Tea-shop math mirrors get_attendance_summary.own_tea / alloc_tea
  -- so the pane's Tea tile matches the page's KPI for the same date.
  own_tea AS (
    SELECT COALESCE(SUM(t.total_amount), 0)::numeric AS amount
    FROM public.tea_shop_entries t
    WHERE t.site_id = p_site_id
      AND t.date = p_date
      AND NOT (
        t.is_group_entry = true
        AND EXISTS (
          SELECT 1 FROM public.tea_shop_entry_allocations a
          WHERE a.entry_id = t.id
            AND a.site_id = p_site_id
        )
      )
  ),
  alloc_tea AS (
    SELECT COALESCE(SUM(
      CASE
        WHEN a.allocation_percentage IS NOT NULL AND e.total_amount IS NOT NULL
          THEN ROUND((a.allocation_percentage / 100.0) * e.total_amount)
        ELSE COALESCE(a.allocated_amount, 0)
      END
    ), 0)::numeric AS amount
    FROM public.tea_shop_entry_allocations a
    JOIN public.tea_shop_entries e ON e.id = a.entry_id
    WHERE a.site_id = p_site_id
      AND e.date = p_date
  )
  SELECT jsonb_build_object(
    'daily_total',     COALESCE((SELECT SUM(amount) FROM daily_lab), 0),
    'market_total',    COALESCE((SELECT SUM(amount) FROM market_lab), 0),
    'tea_shop_total',  ((SELECT amount FROM own_tea) + (SELECT amount FROM alloc_tea)),
    'daily_laborers',
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'id',           dl.id,
          'name',         dl.lab_name,
          'role',         dl.role,
          'full_day',     dl.full_day,
          'amount',       dl.amount,
          'laborer_type', dl.laborer_type
        )) FROM daily_lab dl),
        '[]'::jsonb
      ),
    'market_laborers',
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'id',     ml.id,
          'role',   ml.role,
          'count',  ml.count,
          'amount', ml.amount
        )) FROM market_lab ml),
        '[]'::jsonb
      )
  );
$$;

COMMENT ON FUNCTION public.get_attendance_for_date(uuid, date) IS
'InspectPane daily-shape data: per-date totals (daily / market / tea) plus laborer + market-laborer detail rows for one site + one date. daily_laborers entries include laborer_type so the client can bucket daily vs contract for the salary-settlement redesign. Tea-shop math mirrors get_attendance_summary.';

GRANT EXECUTE ON FUNCTION public.get_attendance_for_date(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_for_date(uuid, date) TO service_role;
