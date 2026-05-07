-- Migration: Fix get_laborer_profile_summary 14-day strip duplicates
--
-- Bug: The original recent CTE (added in 20260506125528) LEFT JOINs
--      daily_attendance directly per date. When a laborer has multiple
--      attendance rows on the same date (e.g. worked at 2 sites the same
--      day, or has separate overtime entries), the strip emitted multiple
--      rows for that date -- the UI rendered 15+ dots instead of exactly 14.
--
-- Fix: Aggregate daily_attendance per date first (recent_agg CTE), then
--      LEFT JOIN that aggregated set to date_range. Result: exactly one
--      row per date, regardless of split-day attendance.
--
--      For the strip's tooltip, the site shown is the one with the most
--      work_days for that date; tie-broken deterministically by id so
--      output is stable.
--
-- Verified after deploy: jsonb_array_length(recent_14_days) = 14 for
-- Jithin (a multi-site contract laborer with split days).

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
  -- Aggregate per date so split-day attendance (laborer working 2 sites on
  -- the same date, or two entries for overtime) collapses to one strip dot.
  -- Site shown in the tooltip is the site with the most work_days for that
  -- day; tie-broken deterministically by id.
  recent_agg AS (
    SELECT
      da.date,
      SUM(da.work_days)::numeric                         AS work_days,
      SUM(da.daily_earnings)::numeric                    AS daily_earnings,
      (array_agg(da.site_id ORDER BY da.work_days DESC, da.id))[1] AS site_id
    FROM public.daily_attendance da
    WHERE da.laborer_id = p_laborer_id
      AND da.is_deleted = false
      AND da.date >= (CURRENT_DATE - INTERVAL '13 days')::date
      AND da.date <= CURRENT_DATE
    GROUP BY da.date
  ),
  recent AS (
    SELECT
      dr.d        AS date,
      ra.work_days,
      ra.daily_earnings,
      ra.site_id,
      s.name      AS site_name
    FROM date_range dr
    LEFT JOIN recent_agg ra ON ra.date = dr.d
    LEFT JOIN public.sites s ON s.id = ra.site_id
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
