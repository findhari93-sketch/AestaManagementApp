-- Cross-site Settlement Report — per (site, subcontract, week) paid + calculated wages
-- Mirrors the get_company_daily_peek pattern: SECURITY DEFINER, RETURNS JSONB,
-- single CTE pipeline. Used by /company/reports/ → Settlements tab.
--
-- For each site in p_site_ids, for each contract subcontract on that site whose
-- category matches p_category_id (or any if NULL), for each ISO week (Sun-Sat)
-- intersecting [p_date_from, p_date_to]:
--   - paid_amount = SUM(labor_payments.amount) where the payment is linked to
--                   this subcontract and its payment_for_date falls in the week
--   - calc_amount = SUM(daily_attendance.daily_earnings) for contract laborers
--                   on this subcontract in the week (covers detailed/headcount/
--                   mesthri_only modes) PLUS SUM(subcontract_mid_entries.
--                   day_total_amount) for mid-mode subcontracts (no double-count
--                   because mid-mode subcontracts don't have daily_attendance
--                   rows tied to them).
--   - settlement_count, notes_concat for export
--
-- Trade is derived: contract_type='mesthri' → teams.category_id ;
--                   contract_type='specialist' → laborers.category_id.

CREATE OR REPLACE FUNCTION public.get_multi_site_settlement_report(
  p_site_ids UUID[],
  p_date_from DATE,
  p_date_to DATE,
  p_category_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_site_ids IS NULL OR cardinality(p_site_ids) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH scope_subs AS (
    SELECT
      sc.id              AS subcontract_id,
      sc.site_id,
      sc.title           AS subcontract_title,
      sc.contract_type::text AS contract_type,
      COALESCE(
        CASE WHEN sc.contract_type = 'mesthri'    THEN t.category_id END,
        CASE WHEN sc.contract_type = 'specialist' THEN l.category_id END
      ) AS category_id
    FROM public.subcontracts sc
    LEFT JOIN public.teams t     ON t.id = sc.team_id
    LEFT JOIN public.laborers l  ON l.id = sc.laborer_id
    WHERE sc.site_id = ANY(p_site_ids)
      AND sc.contract_type IN ('mesthri'::contract_type, 'specialist'::contract_type)
  ),
  scope_filtered AS (
    SELECT s.*
    FROM scope_subs s
    WHERE p_category_id IS NULL OR s.category_id = p_category_id
  ),
  -- All ISO weeks (Sun-Sat) overlapping [date_from, date_to].
  -- date_trunc('week', d) returns the Monday — we shift to Sunday by -1 day.
  week_series AS (
    SELECT
      (date_trunc('week', g)::date - INTERVAL '1 day')::date AS week_start,
      (date_trunc('week', g)::date + INTERVAL '5 days')::date AS week_end
    FROM generate_series(
           date_trunc('week', p_date_from::timestamp)::date - INTERVAL '1 day',
           p_date_to::date,
           INTERVAL '7 days'
         ) g
  ),
  paid AS (
    SELECT
      sf.subcontract_id,
      sf.site_id,
      ws.week_start,
      ws.week_end,
      COALESCE(SUM(lp.amount), 0)::numeric(14,2) AS paid_amount,
      COUNT(DISTINCT lp.settlement_group_id) FILTER (WHERE lp.settlement_group_id IS NOT NULL) AS settlement_count
    FROM scope_filtered sf
    CROSS JOIN week_series ws
    LEFT JOIN public.labor_payments lp
      ON lp.subcontract_id = sf.subcontract_id
     AND lp.payment_for_date BETWEEN ws.week_start AND ws.week_end
     AND lp.is_under_contract = true
    GROUP BY sf.subcontract_id, sf.site_id, ws.week_start, ws.week_end
  ),
  calc_attendance AS (
    -- Per-laborer daily_earnings for detailed/headcount/mesthri_only modes.
    -- Mirrors get_salary_waterfall's source of truth.
    SELECT
      sf.subcontract_id,
      sf.site_id,
      ws.week_start,
      ws.week_end,
      COALESCE(SUM(da.daily_earnings), 0)::numeric(14,2) AS amt
    FROM scope_filtered sf
    CROSS JOIN week_series ws
    LEFT JOIN public.daily_attendance da
      ON da.subcontract_id = sf.subcontract_id
     AND da.site_id = sf.site_id
     AND da.date BETWEEN ws.week_start AND ws.week_end
     AND da.is_deleted = false
     AND da.is_archived = false
    GROUP BY sf.subcontract_id, sf.site_id, ws.week_start, ws.week_end
  ),
  calc_mid AS (
    -- Crew-day totals for mid mode. Mutually exclusive with daily_attendance
    -- for the same subcontract by design.
    SELECT
      sf.subcontract_id,
      sf.site_id,
      ws.week_start,
      ws.week_end,
      COALESCE(SUM(sme.day_total_amount), 0)::numeric(14,2) AS amt
    FROM scope_filtered sf
    CROSS JOIN week_series ws
    LEFT JOIN public.subcontract_mid_entries sme
      ON sme.subcontract_id = sf.subcontract_id
     AND sme.attendance_date BETWEEN ws.week_start AND ws.week_end
    GROUP BY sf.subcontract_id, sf.site_id, ws.week_start, ws.week_end
  ),
  calc AS (
    SELECT
      a.subcontract_id,
      a.site_id,
      a.week_start,
      a.week_end,
      (a.amt + COALESCE(m.amt, 0))::numeric(14,2) AS calc_amount
    FROM calc_attendance a
    LEFT JOIN calc_mid m
      ON m.subcontract_id = a.subcontract_id
     AND m.site_id = a.site_id
     AND m.week_start = a.week_start
  ),
  notes AS (
    SELECT
      sg.subcontract_id,
      sg.site_id,
      ws.week_start,
      ws.week_end,
      string_agg(NULLIF(sg.notes, ''), ' | ' ORDER BY sg.settlement_date) AS notes_concat
    FROM public.settlement_groups sg
    CROSS JOIN week_series ws
    WHERE sg.is_cancelled = false
      AND sg.settlement_date BETWEEN ws.week_start AND ws.week_end
      AND sg.subcontract_id IS NOT NULL
      AND sg.site_id = ANY(p_site_ids)
    GROUP BY sg.subcontract_id, sg.site_id, ws.week_start, ws.week_end
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'site_id',           sf.site_id,
      'site_name',         si.name,
      'subcontract_id',    sf.subcontract_id,
      'subcontract_title', sf.subcontract_title,
      'contract_type',     sf.contract_type,
      'category_id',       sf.category_id,
      'category_name',     lc.name,
      'week_start',        p.week_start,
      'week_end',          p.week_end,
      'paid_amount',       p.paid_amount,
      'calc_amount',       c.calc_amount,
      'settlement_count',  p.settlement_count,
      'notes_concat',      n.notes_concat
    )
    ORDER BY si.name, sf.subcontract_title, p.week_start
  )
  INTO v_result
  FROM scope_filtered sf
  JOIN paid p
    ON p.subcontract_id = sf.subcontract_id
   AND p.site_id = sf.site_id
  LEFT JOIN calc c
    ON c.subcontract_id = sf.subcontract_id
   AND c.site_id = sf.site_id
   AND c.week_start = p.week_start
  LEFT JOIN notes n
    ON n.subcontract_id = sf.subcontract_id
   AND n.site_id = sf.site_id
   AND n.week_start = p.week_start
  LEFT JOIN public.sites si        ON si.id = sf.site_id
  LEFT JOIN public.labor_categories lc ON lc.id = sf.category_id
  -- Drop rows with no paid AND no calc (subcontract didn't touch this week)
  WHERE (p.paid_amount > 0 OR c.calc_amount > 0);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_multi_site_settlement_report(UUID[], DATE, DATE, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_multi_site_settlement_report IS
  'Returns one JSON row per (site, subcontract, week) for contract settlements across the given sites and date range. Weeks are Sun-Sat. paid_amount comes from labor_payments; calc_amount = daily_attendance.daily_earnings + subcontract_mid_entries.day_total_amount. Used by /company/reports/ Settlements tab.';
