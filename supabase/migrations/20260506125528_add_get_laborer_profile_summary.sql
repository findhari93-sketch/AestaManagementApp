-- Migration: Add get_laborer_profile_summary RPC
--
-- Purpose: Single round-trip read powering the new LaborerProfileDrawer on
--          /company/laborers. Returns one laborer's identity-flag + monthly
--          aggregates + per-site rollup + trailing 14-day attendance strip.
--
-- Pattern: Mirrors the InspectPane RPC shape (see 20260426120000_add_inspect_pane_rpcs.sql)
--          - LANGUAGE sql STABLE, SECURITY INVOKER, search_path = public
--          - returns jsonb so the React hook can do snake_case -> camelCase mapping
--          - GRANT EXECUTE to authenticated + service_role
--
-- Paid / outstanding semantics:
--   - For laborer_type <> 'contract' (regular daily-wage / specialist): paid is
--     summed from daily_attendance.is_paid = true rows in scope. This mirrors
--     get_payment_summary's daily-market bucketing -- the daily settlement
--     dialog flips is_paid=true on the underlying attendance rows.
--   - For laborer_type = 'contract': contract laborers are paid via the
--     mesthri's subcontract / labor_payments stream, NOT directly on their own
--     attendance.is_paid. So paid_total / outstanding are emitted as 0 here
--     and the UI shows a "Paid via mesthri team" hint instead. Attributing a
--     pro-rata share of mesthri settlements is out of scope for v1.
--
-- 14-day strip:
--   - Always (CURRENT_DATE - 13) through CURRENT_DATE inclusive (14 dates).
--   - Status values:
--       'before_joining' - date < laborer.joining_date
--       'no_record'      - no daily_attendance row exists for that date
--       'half'           - work_days = 0.5
--       'contract'       - work_days >= 1 AND laborer_type = 'contract'
--       'present'        - work_days >= 1 (default for non-contract)
--   - Note: daily_attendance.work_days is constrained to {0.5, 1, 1.5, 2}, so
--     absent days have NO row; they surface as 'no_record' in the strip.

CREATE OR REPLACE FUNCTION public.get_laborer_profile_summary(
  p_laborer_id uuid,
  p_month_start date
) RETURNS jsonb
  LANGUAGE sql STABLE
  SECURITY INVOKER
  SET search_path = public
AS $$
  WITH
  laborer AS (
    SELECT id, laborer_type, joining_date
    FROM public.laborers
    WHERE id = p_laborer_id
  ),
  month_bounds AS (
    SELECT
      p_month_start AS m_start,
      (p_month_start + INTERVAL '1 month')::date AS m_end
  ),
  month_attendance AS (
    SELECT d.work_days, d.daily_earnings, d.is_paid, d.site_id
    FROM public.daily_attendance d
    CROSS JOIN month_bounds mb
    WHERE d.laborer_id = p_laborer_id
      AND d.is_deleted = false
      AND d.date >= mb.m_start
      AND d.date < mb.m_end
  ),
  month_totals AS (
    SELECT
      COALESCE(SUM(work_days), 0)::numeric                              AS days_worked,
      COALESCE(SUM(daily_earnings), 0)::numeric                         AS earnings_total,
      COALESCE(SUM(daily_earnings) FILTER (WHERE is_paid = true), 0)::numeric
                                                                        AS paid_via_attendance
    FROM month_attendance
  ),
  by_site AS (
    SELECT
      d.site_id,
      s.name AS site_name,
      COALESCE(SUM(d.work_days), 0)::numeric    AS days,
      COALESCE(SUM(d.daily_earnings), 0)::numeric AS earnings
    FROM public.daily_attendance d
    JOIN public.sites s ON s.id = d.site_id
    CROSS JOIN month_bounds mb
    WHERE d.laborer_id = p_laborer_id
      AND d.is_deleted = false
      AND d.date >= mb.m_start
      AND d.date < mb.m_end
    GROUP BY d.site_id, s.name
    ORDER BY days DESC, s.name
  ),
  date_range AS (
    SELECT generate_series(
      (CURRENT_DATE - INTERVAL '13 days')::date,
      CURRENT_DATE,
      '1 day'::interval
    )::date AS d
  ),
  recent AS (
    SELECT
      dr.d         AS date,
      da.work_days,
      da.daily_earnings,
      da.site_id,
      s.name       AS site_name
    FROM date_range dr
    LEFT JOIN public.daily_attendance da
      ON da.laborer_id = p_laborer_id
     AND da.date = dr.d
     AND da.is_deleted = false
    LEFT JOIN public.sites s ON s.id = da.site_id
  ),
  l_one AS (SELECT * FROM laborer LIMIT 1)
  SELECT jsonb_build_object(
    'laborer_type',   (SELECT laborer_type FROM l_one),
    'days_worked',    mt.days_worked,
    'earnings_total', mt.earnings_total,
    'paid_total',
      CASE
        WHEN (SELECT laborer_type FROM l_one) = 'contract' THEN 0
        ELSE mt.paid_via_attendance
      END,
    'outstanding',
      CASE
        WHEN (SELECT laborer_type FROM l_one) = 'contract' THEN 0
        ELSE GREATEST(0, mt.earnings_total - mt.paid_via_attendance)
      END,
    'sites', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'site_id',   site_id,
          'site_name', site_name,
          'days',      days,
          'earnings',  earnings
        )) FROM by_site),
      '[]'::jsonb
    ),
    'recent_14_days', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'date',      date,
          'status',
            CASE
              WHEN (SELECT joining_date FROM l_one) IS NOT NULL
               AND date < (SELECT joining_date FROM l_one) THEN 'before_joining'
              WHEN work_days IS NULL                       THEN 'no_record'
              WHEN work_days = 0.5                         THEN 'half'
              WHEN (SELECT laborer_type FROM l_one) = 'contract' THEN 'contract'
              ELSE 'present'
            END,
          'site_id',   site_id,
          'site_name', site_name,
          'earnings',  daily_earnings
        ) ORDER BY date
      ) FROM recent),
      '[]'::jsonb
    )
  )
  FROM month_totals mt;
$$;

COMMENT ON FUNCTION public.get_laborer_profile_summary(uuid, date) IS
'Per-laborer profile summary for the LaborerProfileDrawer on /company/laborers. Returns laborer_type, month aggregates (days_worked, earnings_total, paid_total, outstanding), per-site rollup, and the trailing 14-day attendance strip. For contract laborers paid_total/outstanding are 0 by design (they settle via mesthri/subcontract flows, not attendance.is_paid).';

GRANT EXECUTE ON FUNCTION public.get_laborer_profile_summary(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_laborer_profile_summary(uuid, date) TO service_role;
