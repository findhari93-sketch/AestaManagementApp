-- Daily Site Peek — company-level multi-site daily attendance overview
-- Adds: sites.engineer_phone column + get_company_daily_peek(p_company_id, p_date) RPC

-- 1. Add engineer_phone to sites
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS engineer_phone TEXT;

COMMENT ON COLUMN public.sites.engineer_phone IS
  'WhatsApp-reachable phone (E.164 e.g. +919876543210) for the engineer in charge. Used by the Company Daily Peek nudge action when daily attendance is not yet recorded.';

-- 2. RPC: returns one row per active site for the given company + date
CREATE OR REPLACE FUNCTION public.get_company_daily_peek(
  p_company_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH active_sites AS (
    SELECT s.id, s.name, s.status::text AS status, s.engineer_phone, s.city
    FROM public.sites s
    WHERE s.company_id = p_company_id
      AND s.status = 'active'
  ),
  dws AS (
    -- Daily work summary for the day (morning plan + evening summary + photo JSON)
    SELECT
      d.site_id,
      d.work_description,
      d.comments,
      d.work_updates,
      d.entered_by_user_id,
      COALESCE(d.entered_by_user_id::text, '') AS entered_by_user_text
    FROM public.daily_work_summary d
    WHERE d.date = p_date
      AND d.site_id IN (SELECT id FROM active_sites)
  ),
  da_agg AS (
    -- Daily-laborer aggregates (excludes subcontract rows: subcontract_id IS NULL)
    SELECT
      da.site_id,
      COUNT(*) FILTER (WHERE da.subcontract_id IS NULL AND da.is_archived = false) AS daily_count,
      COALESCE(SUM(da.daily_earnings) FILTER (WHERE da.subcontract_id IS NULL AND da.is_archived = false), 0) AS daily_total,
      MIN(da.morning_entry_at) AS first_morning_at,
      MAX(da.confirmed_at) AS last_confirmed_at,
      -- Most recent recorder id (any laborer row counts)
      (ARRAY_AGG(da.recorded_by_user_id ORDER BY da.morning_entry_at DESC NULLS LAST)
        FILTER (WHERE da.recorded_by_user_id IS NOT NULL))[1] AS recorded_by_user_id
    FROM public.daily_attendance da
    WHERE da.date = p_date
      AND da.site_id IN (SELECT id FROM active_sites)
      AND da.is_deleted = false
    GROUP BY da.site_id
  ),
  contract_agg AS (
    -- Contract day-total amounts from mid entries + headcount, joined back to a site via subcontracts.site_id
    SELECT
      sc.site_id,
      COUNT(DISTINCT sme.subcontract_id) AS contract_count,
      COALESCE(SUM(sme.day_total_amount), 0) AS contract_total
    FROM public.subcontract_mid_entries sme
    JOIN public.subcontracts sc ON sc.id = sme.subcontract_id
    WHERE sme.attendance_date = p_date
      AND sc.site_id IN (SELECT id FROM active_sites)
    GROUP BY sc.site_id
  ),
  recorder_lookup AS (
    SELECT u.id, u.name, u.display_name, u.phone
    FROM public.users u
    WHERE u.id IN (
      SELECT recorded_by_user_id FROM da_agg WHERE recorded_by_user_id IS NOT NULL
      UNION
      SELECT entered_by_user_id FROM dws WHERE entered_by_user_id IS NOT NULL
    )
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'site_id', a.id,
      'site_name', a.name,
      'site_city', a.city,
      'site_status', a.status,
      'engineer_phone', a.engineer_phone,
      'morning_plan_text', COALESCE(dws.work_updates->'morning'->>'description', dws.work_description),
      'evening_summary_text', COALESCE(dws.work_updates->'evening'->>'summary', dws.comments),
      'morning_photos', COALESCE(dws.work_updates->'morning'->'photos', '[]'::jsonb),
      'evening_photos', COALESCE(dws.work_updates->'evening'->'photos', '[]'::jsonb),
      'has_morning', COALESCE(jsonb_typeof(dws.work_updates->'morning') = 'object', false),
      'has_evening', COALESCE(jsonb_typeof(dws.work_updates->'evening') = 'object', false),
      'recorded_at', COALESCE(da_agg.last_confirmed_at, da_agg.first_morning_at),
      'morning_at', da_agg.first_morning_at,
      'evening_at', da_agg.last_confirmed_at,
      'recorded_by_name', rec.display_name,
      'recorded_by_phone', rec.phone,
      'daily_count', COALESCE(da_agg.daily_count, 0),
      'daily_total', COALESCE(da_agg.daily_total, 0),
      'contract_count', COALESCE(contract_agg.contract_count, 0),
      'contract_total', COALESCE(contract_agg.contract_total, 0),
      'recorded_status',
        CASE
          WHEN da_agg.site_id IS NULL AND dws.site_id IS NULL THEN 'waiting'
          WHEN da_agg.last_confirmed_at IS NOT NULL OR jsonb_typeof(dws.work_updates->'evening') = 'object' THEN 'recorded'
          ELSE 'in_progress'
        END
    )
    ORDER BY a.name
  )
  INTO v_result
  FROM active_sites a
  LEFT JOIN dws ON dws.site_id = a.id
  LEFT JOIN da_agg ON da_agg.site_id = a.id
  LEFT JOIN contract_agg ON contract_agg.site_id = a.id
  LEFT JOIN recorder_lookup rec ON rec.id = COALESCE(da_agg.recorded_by_user_id, dws.entered_by_user_id);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_daily_peek(UUID, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_company_daily_peek IS
  'Returns one JSON row per active site for the company on the given date — recording status, photo lists, worker counts, settlement totals, and engineer contact. Powers the Daily Peek section on the Company Dashboard.';
