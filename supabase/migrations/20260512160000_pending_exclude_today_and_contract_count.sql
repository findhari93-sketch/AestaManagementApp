-- Two related fixes:
--   1. get_payments_ledger: exclude TODAY from pending rows (today's work is
--      "in progress", not "ready to settle"). Past-day unpaid rows still
--      surface as pending; current-day unpaid rows are filtered out of the
--      pending_da / pending_ma buckets. Function body otherwise identical to
--      the production definition (paid_dm + paid_wk waterfall structure).
--   2. get_company_daily_peek: count contract laborers properly from BOTH
--      mid_entries.laborer_ids AND daily_attendance.subcontract_id, and
--      expose contract_crews so the Daily Peek modal can show
--      "N contract laborers · M crews" even when today's contract payment
--      is zero (contracts are settled weekly, not daily).

CREATE OR REPLACE FUNCTION public.get_payments_ledger(
  p_site_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_status text DEFAULT 'all'::text,
  p_type text DEFAULT 'all'::text,
  p_period text DEFAULT 'all'::text
)
RETURNS TABLE(
  id text, settlement_ref text, row_type text, subtype text,
  date_or_week_start date, week_end date, for_label text, amount numeric,
  is_paid boolean, is_pending boolean, laborer_id uuid, period text,
  payment_channel text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH
  audit_state AS (
    SELECT s.data_started_at,
           (s.legacy_status = 'auditing' AND s.data_started_at IS NOT NULL) AS legacy_active
    FROM public.sites s WHERE s.id = p_site_id
  ),
  effective_period AS (
    SELECT
      CASE WHEN ast.legacy_active AND p_period IN ('all','legacy','current') THEN p_period ELSE 'all' END AS period,
      ast.data_started_at, ast.legacy_active
    FROM audit_state ast
  ),
  paid_dm AS (
    SELECT sg.id, sg.settlement_reference, sg.settlement_date, sg.total_amount, sg.payment_channel,
      (SELECT COUNT(DISTINCT da.laborer_id) FROM public.daily_attendance da
         WHERE da.settlement_group_id = sg.id AND da.is_archived = false) AS daily_lab,
      (SELECT COUNT(*) FROM public.market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id) AS mkt_cnt
    FROM public.settlement_groups sg
    WHERE sg.site_id = p_site_id AND sg.is_cancelled = false AND sg.is_archived = false
      AND sg.settlement_date IS NOT NULL
      AND (p_date_from IS NULL OR sg.settlement_date >= p_date_from)
      AND (p_date_to   IS NULL OR sg.settlement_date <= p_date_to)
      AND NOT EXISTS (SELECT 1 FROM public.labor_payments lp
                      WHERE lp.settlement_group_id = sg.id AND lp.is_under_contract = true)
      AND (EXISTS (SELECT 1 FROM public.daily_attendance da
                     WHERE da.settlement_group_id = sg.id AND da.is_archived = false)
           OR EXISTS (SELECT 1 FROM public.market_laborer_attendance ma WHERE ma.settlement_group_id = sg.id))
  ),
  paid_dm_rows AS (
    SELECT 'p:'||p.id::text AS id, p.settlement_reference AS settlement_ref,
      'daily-market'::text AS row_type, 'daily-market'::text AS subtype,
      p.settlement_date AS date_or_week_start, NULL::date AS week_end,
      (CASE WHEN p.daily_lab > 0 THEN p.daily_lab::text || ' lab' ELSE '' END
       || CASE WHEN p.daily_lab > 0 AND p.mkt_cnt > 0 THEN ' + ' ELSE '' END
       || CASE WHEN p.mkt_cnt > 0 THEN p.mkt_cnt::text || ' mkt' ELSE '' END) AS for_label,
      p.total_amount AS amount, TRUE AS is_paid, FALSE AS is_pending, NULL::uuid AS laborer_id,
      CASE WHEN ep.legacy_active AND p.settlement_date < ep.data_started_at THEN 'legacy' ELSE 'current' END AS period,
      p.payment_channel AS payment_channel
    FROM paid_dm p CROSS JOIN effective_period ep
  ),
  paid_wk AS (
    SELECT sg.id, sg.settlement_reference, sg.settlement_date, sg.total_amount,
      sg.payment_type, sg.payment_channel,
      EXISTS (SELECT 1 FROM public.labor_payments lp
              WHERE lp.settlement_group_id = sg.id AND lp.is_under_contract = true
                AND lp.is_archived = false) AS has_contract
    FROM public.settlement_groups sg
    WHERE sg.site_id = p_site_id AND sg.is_cancelled = false AND sg.is_archived = false
      AND sg.settlement_date IS NOT NULL
      AND (p_date_from IS NULL OR sg.settlement_date >= p_date_from)
      AND (p_date_to   IS NULL OR sg.settlement_date <= p_date_to)
      AND (EXISTS (SELECT 1 FROM public.labor_payments lp
                   WHERE lp.settlement_group_id = sg.id AND lp.is_under_contract = true)
           OR (NOT EXISTS (SELECT 1 FROM public.daily_attendance da
                          WHERE da.settlement_group_id = sg.id AND da.is_archived = false)
               AND NOT EXISTS (SELECT 1 FROM public.market_laborer_attendance ma
                              WHERE ma.settlement_group_id = sg.id)))
  ),
  paid_wk_with_lab AS (
    SELECT p.*,
      (SELECT lp.laborer_id FROM public.labor_payments lp
         WHERE lp.settlement_group_id = p.id AND lp.is_archived = false LIMIT 1) AS one_laborer_id,
      (SELECT COUNT(DISTINCT lp.laborer_id) FROM public.labor_payments lp
         WHERE lp.settlement_group_id = p.id AND lp.is_archived = false) AS distinct_lab_cnt,
      (SELECT l.name FROM public.laborers l
         JOIN public.labor_payments lp ON lp.laborer_id = l.id
         WHERE lp.settlement_group_id = p.id AND lp.is_archived = false LIMIT 1) AS one_laborer_name
    FROM paid_wk p
  ),
  paid_wk_rows AS (
    SELECT 'p:'||p.id::text AS id, p.settlement_reference AS settlement_ref,
      'weekly'::text AS row_type,
      CASE WHEN p.payment_type = 'salary' AND p.has_contract THEN 'salary-waterfall'
           WHEN p.payment_type = 'advance' THEN 'advance'
           WHEN p.payment_type = 'excess' THEN 'adjustment'
           ELSE 'unclassified' END AS subtype,
      (p.settlement_date - extract(dow FROM p.settlement_date)::int)::date AS date_or_week_start,
      ((p.settlement_date - extract(dow FROM p.settlement_date)::int)::date + 6) AS week_end,
      CASE WHEN p.payment_type = 'excess' THEN COALESCE(p.one_laborer_name || ' · excess return', 'Excess return')
           WHEN p.payment_type = 'advance' THEN COALESCE(p.one_laborer_name || ' · advance', 'Mestri · advance')
           WHEN p.payment_type = 'salary' AND p.has_contract AND p.distinct_lab_cnt = 1 THEN p.one_laborer_name
           WHEN p.payment_type = 'salary' AND p.has_contract AND p.distinct_lab_cnt > 1 THEN 'Group settlement (' || p.distinct_lab_cnt::text || ' laborers)'
           ELSE 'Unclassified settlement' END AS for_label,
      p.total_amount AS amount, TRUE AS is_paid, FALSE AS is_pending,
      CASE WHEN p.distinct_lab_cnt = 1 THEN p.one_laborer_id ELSE NULL END AS laborer_id,
      CASE WHEN ep.legacy_active AND p.settlement_date < ep.data_started_at THEN 'legacy' ELSE 'current' END AS period,
      p.payment_channel AS payment_channel
    FROM paid_wk_with_lab p CROSS JOIN effective_period ep
  ),
  pending_da AS (
    SELECT d.date AS d, SUM(d.daily_earnings)::numeric AS amt, COUNT(DISTINCT d.laborer_id) AS lab_cnt
    FROM public.daily_attendance d
    JOIN public.laborers l ON l.id = d.laborer_id
    WHERE d.site_id = p_site_id AND d.is_deleted = false AND d.is_archived = false
      AND d.is_paid = false AND l.laborer_type <> 'contract'
      AND d.date < CURRENT_DATE                                            -- exclude today
      AND (p_date_from IS NULL OR d.date >= p_date_from)
      AND (p_date_to   IS NULL OR d.date <= p_date_to)
    GROUP BY d.date
  ),
  pending_ma AS (
    SELECT m.date AS d, SUM(m.total_cost)::numeric AS amt, COUNT(*) AS mkt_cnt
    FROM public.market_laborer_attendance m
    WHERE m.site_id = p_site_id AND m.is_paid = false
      AND m.date < CURRENT_DATE                                            -- exclude today
      AND (p_date_from IS NULL OR m.date >= p_date_from)
      AND (p_date_to   IS NULL OR m.date <= p_date_to)
    GROUP BY m.date
  ),
  pending_dm_rows AS (
    SELECT 'pd:' || COALESCE(da.d, ma.d)::text AS id, NULL::text AS settlement_ref,
      'daily-market'::text AS row_type, 'daily-market'::text AS subtype,
      COALESCE(da.d, ma.d) AS date_or_week_start, NULL::date AS week_end,
      (CASE WHEN COALESCE(da.lab_cnt, 0) > 0 THEN da.lab_cnt::text || ' daily lab' ELSE '' END
       || CASE WHEN COALESCE(da.lab_cnt, 0) > 0 AND COALESCE(ma.mkt_cnt, 0) > 0 THEN ' + ' ELSE '' END
       || CASE WHEN COALESCE(ma.mkt_cnt, 0) > 0 THEN ma.mkt_cnt::text || ' mkt' ELSE '' END) AS for_label,
      (COALESCE(da.amt, 0) + COALESCE(ma.amt, 0))::numeric AS amount,
      FALSE AS is_paid, TRUE AS is_pending, NULL::uuid AS laborer_id,
      CASE WHEN ep.legacy_active AND COALESCE(da.d, ma.d) < ep.data_started_at THEN 'legacy' ELSE 'current' END AS period,
      NULL::text AS payment_channel
    FROM pending_da da FULL OUTER JOIN pending_ma ma ON ma.d = da.d
    CROSS JOIN effective_period ep
  ),
  all_rows AS (
    SELECT * FROM paid_dm_rows
    UNION ALL SELECT * FROM paid_wk_rows
    UNION ALL SELECT * FROM pending_dm_rows
  )
  SELECT r.id, r.settlement_ref, r.row_type, r.subtype, r.date_or_week_start, r.week_end,
    r.for_label, r.amount, r.is_paid, r.is_pending, r.laborer_id, r.period, r.payment_channel
  FROM all_rows r CROSS JOIN effective_period ep
  WHERE (p_status = 'all'
         OR (p_status = 'pending' AND r.is_pending)
         OR (p_status = 'completed' AND r.is_paid))
    AND (p_type = 'all'
         OR (p_type = 'daily-market' AND r.row_type = 'daily-market')
         OR (p_type = 'weekly' AND r.row_type = 'weekly'))
    AND (ep.period = 'all' OR r.period = ep.period)
  ORDER BY r.is_pending DESC, r.date_or_week_start DESC
  LIMIT 2000;
$function$;

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
    SELECT
      d.site_id,
      d.work_description,
      d.comments,
      d.work_updates,
      d.entered_by_user_id
    FROM public.daily_work_summary d
    WHERE d.date = p_date
      AND d.site_id IN (SELECT id FROM active_sites)
  ),
  da_agg AS (
    SELECT
      da.site_id,
      COUNT(*) FILTER (WHERE da.subcontract_id IS NULL AND da.is_archived = false) AS daily_count,
      COALESCE(SUM(da.daily_earnings) FILTER (WHERE da.subcontract_id IS NULL AND da.is_archived = false), 0) AS daily_total,
      COUNT(DISTINCT da.laborer_id) FILTER (WHERE da.subcontract_id IS NOT NULL AND da.is_archived = false) AS contract_from_da,
      MIN(da.morning_entry_at) AS first_morning_at,
      MAX(da.confirmed_at) AS last_confirmed_at,
      (ARRAY_AGG(da.recorded_by_user_id ORDER BY da.morning_entry_at DESC NULLS LAST)
        FILTER (WHERE da.recorded_by_user_id IS NOT NULL))[1] AS recorded_by_user_id
    FROM public.daily_attendance da
    WHERE da.date = p_date
      AND da.site_id IN (SELECT id FROM active_sites)
      AND da.is_deleted = false
    GROUP BY da.site_id
  ),
  contract_agg AS (
    SELECT
      sc.site_id,
      COUNT(DISTINCT sme.subcontract_id) AS contract_crews,
      COALESCE(SUM(COALESCE(array_length(sme.laborer_ids, 1), 0)), 0)::int AS contract_from_mid,
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
      'contract_count', GREATEST(
        COALESCE(da_agg.contract_from_da, 0),
        COALESCE(contract_agg.contract_from_mid, 0)
      ),
      'contract_crews', COALESCE(contract_agg.contract_crews, 0),
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

GRANT EXECUTE ON FUNCTION public.get_payments_ledger(uuid, date, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_daily_peek(UUID, DATE) TO authenticated;
