-- Mode C reconcile: zero opening balance + per-mesthri summary card.
--
-- Companion to 20260504120000 Mode B (per-laborer carry-forward). Mode C is
-- the right shape for these projects because the user pays the mesthri for
-- the whole crew — per-laborer carry-forward is noise. Mode C:
--   1. Aggregates pre-cutoff totals at the mesthri (subcontract.laborer_id)
--      level into site_legacy_mesthri_summary (informational only)
--   2. Soft-archives all the granular pre-cutoff rows (same set as Mode B)
--   3. Does NOT seed laborer_opening_balances — the live waterfall starts
--      from zero on data_started_at
--   4. Flips sites.legacy_status to 'reconciled'
--
-- Reverse path: the existing reopen_audit_after_opening_balance_reconcile
-- handles Mode C cleanly, with the small augmentation at the bottom of this
-- file (it deletes mesthri summary rows in addition to opening balances).

BEGIN;

-- ─── 1. Table for the per-mesthri summary card ────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_legacy_mesthri_summary (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  mesthri_laborer_id  uuid REFERENCES public.laborers(id),  -- nullable: "Unassigned crew"
  mesthri_name        text NOT NULL,                        -- denormalised; survives rename/delete
  cutoff_date         date NOT NULL,
  total_wages_owed    numeric NOT NULL DEFAULT 0 CHECK (total_wages_owed >= 0),
  total_paid          numeric NOT NULL DEFAULT 0 CHECK (total_paid       >= 0),
  laborer_count       integer NOT NULL DEFAULT 0 CHECK (laborer_count    >= 0),
  weeks_covered       integer NOT NULL DEFAULT 0 CHECK (weeks_covered    >= 0),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Unique-per-site partial indexes: one row per real mesthri + at most one
-- "unassigned" row per site (NULL mesthri_laborer_id). Plain UNIQUE on a
-- nullable column does not collapse multiple NULLs, hence the partial index.
CREATE UNIQUE INDEX IF NOT EXISTS site_legacy_mesthri_summary_unique_mesthri
  ON public.site_legacy_mesthri_summary (site_id, mesthri_laborer_id)
  WHERE mesthri_laborer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS site_legacy_mesthri_summary_unique_unassigned
  ON public.site_legacy_mesthri_summary (site_id)
  WHERE mesthri_laborer_id IS NULL;

COMMENT ON TABLE public.site_legacy_mesthri_summary IS
  'Per-(site, mesthri) summary of pre-cutoff totals, written by the Mode C reconcile. Purely informational — read by MesthriLegacySummaryCard. No live calculation depends on it. Drop the table and the waterfall is unchanged.';

ALTER TABLE public.site_legacy_mesthri_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_anon_select_site_legacy_mesthri_summary           ON public.site_legacy_mesthri_summary;
DROP POLICY IF EXISTS allow_authenticated_select_site_legacy_mesthri_summary  ON public.site_legacy_mesthri_summary;
DROP POLICY IF EXISTS allow_anon_insert_site_legacy_mesthri_summary           ON public.site_legacy_mesthri_summary;
DROP POLICY IF EXISTS allow_authenticated_insert_site_legacy_mesthri_summary  ON public.site_legacy_mesthri_summary;
DROP POLICY IF EXISTS allow_anon_update_site_legacy_mesthri_summary           ON public.site_legacy_mesthri_summary;
DROP POLICY IF EXISTS allow_authenticated_update_site_legacy_mesthri_summary  ON public.site_legacy_mesthri_summary;
DROP POLICY IF EXISTS allow_anon_delete_site_legacy_mesthri_summary           ON public.site_legacy_mesthri_summary;
DROP POLICY IF EXISTS allow_authenticated_delete_site_legacy_mesthri_summary  ON public.site_legacy_mesthri_summary;

CREATE POLICY allow_anon_select_site_legacy_mesthri_summary           ON public.site_legacy_mesthri_summary FOR SELECT TO anon          USING (true);
CREATE POLICY allow_authenticated_select_site_legacy_mesthri_summary  ON public.site_legacy_mesthri_summary FOR SELECT TO authenticated USING (true);
CREATE POLICY allow_anon_insert_site_legacy_mesthri_summary           ON public.site_legacy_mesthri_summary FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY allow_authenticated_insert_site_legacy_mesthri_summary  ON public.site_legacy_mesthri_summary FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY allow_anon_update_site_legacy_mesthri_summary           ON public.site_legacy_mesthri_summary FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY allow_authenticated_update_site_legacy_mesthri_summary  ON public.site_legacy_mesthri_summary FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_anon_delete_site_legacy_mesthri_summary           ON public.site_legacy_mesthri_summary FOR DELETE TO anon          USING (true);
CREATE POLICY allow_authenticated_delete_site_legacy_mesthri_summary  ON public.site_legacy_mesthri_summary FOR DELETE TO authenticated USING (true);

-- ─── 2. Mode C reconcile RPC ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconcile_site_zero_balance(
  p_site_id uuid
) RETURNS jsonb
  LANGUAGE plpgsql VOLATILE
  SECURITY INVOKER
  SET search_path = public
AS $$
DECLARE
  v_legacy_status         text;
  v_data_started_at       date;
  v_summaries_inserted    integer := 0;
  v_attendance_archived   integer := 0;
  v_settlements_archived  integer := 0;
  v_payments_archived     integer := 0;
  v_allocations_archived  integer := 0;
BEGIN
  -- 0. Validate state
  SELECT s.legacy_status, s.data_started_at
    INTO v_legacy_status, v_data_started_at
    FROM public.sites s
   WHERE s.id = p_site_id;

  IF v_legacy_status IS NULL THEN
    RAISE EXCEPTION 'reconcile_site_zero_balance: site % not found', p_site_id;
  END IF;
  IF v_legacy_status <> 'auditing' THEN
    RAISE EXCEPTION 'reconcile_site_zero_balance: site % is not in auditing state (current: %)',
      p_site_id, v_legacy_status;
  END IF;
  IF v_data_started_at IS NULL THEN
    RAISE EXCEPTION 'reconcile_site_zero_balance: site % has no data_started_at set', p_site_id;
  END IF;

  -- 1. Aggregate pre-cutoff wages by mesthri
  --    Walk daily_attendance for contract laborers, resolve mesthri via the
  --    laborer's subcontract on that row. Rows without a subcontract or whose
  --    subcontract has no laborer_id (an unassigned head) collapse into a
  --    single "Unassigned crew" group with mesthri_laborer_id = NULL.
  WITH per_mesthri_wages AS (
    SELECT
      sc.laborer_id                          AS mesthri_laborer_id,
      COALESCE(SUM(d.daily_earnings), 0)::numeric AS wages,
      COUNT(DISTINCT d.laborer_id)           AS laborer_count,
      COUNT(DISTINCT date_trunc('week', d.date)) AS weeks_covered
    FROM public.daily_attendance d
    JOIN public.laborers l ON l.id = d.laborer_id
    LEFT JOIN public.subcontracts sc ON sc.id = d.subcontract_id
    WHERE d.site_id     = p_site_id
      AND d.is_deleted  = false
      AND d.is_archived = false
      AND l.laborer_type = 'contract'
      AND d.date < v_data_started_at
    GROUP BY sc.laborer_id
  ),
  per_mesthri_paid AS (
    SELECT
      sc.laborer_id                          AS mesthri_laborer_id,
      COALESCE(SUM(lp.amount), 0)::numeric   AS paid
    FROM public.labor_payments lp
    JOIN public.settlement_groups sg ON sg.id = lp.settlement_group_id
    LEFT JOIN public.subcontracts sc ON sc.id = sg.subcontract_id
    WHERE sg.site_id          = p_site_id
      AND sg.is_cancelled     = false
      AND sg.is_archived      = false
      AND lp.is_archived      = false
      AND lp.is_under_contract = true
      AND sg.settlement_date < v_data_started_at
    GROUP BY sc.laborer_id
  ),
  combined AS (
    SELECT
      COALESCE(w.mesthri_laborer_id, p.mesthri_laborer_id) AS mesthri_laborer_id,
      COALESCE(w.wages, 0)         AS wages,
      COALESCE(p.paid,  0)         AS paid,
      COALESCE(w.laborer_count, 0) AS laborer_count,
      COALESCE(w.weeks_covered, 0) AS weeks_covered
    FROM per_mesthri_wages w
    FULL OUTER JOIN per_mesthri_paid p ON p.mesthri_laborer_id IS NOT DISTINCT FROM w.mesthri_laborer_id
  ),
  inserted AS (
    INSERT INTO public.site_legacy_mesthri_summary
      (site_id, mesthri_laborer_id, mesthri_name, cutoff_date,
       total_wages_owed, total_paid, laborer_count, weeks_covered)
    SELECT
      p_site_id,
      c.mesthri_laborer_id,
      COALESCE((SELECT name FROM public.laborers WHERE id = c.mesthri_laborer_id), 'Unassigned crew'),
      v_data_started_at,
      GREATEST(0, c.wages - c.paid),
      c.paid,
      c.laborer_count,
      c.weeks_covered
    FROM combined c
    WHERE c.wages > 0 OR c.paid > 0
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) FROM inserted INTO v_summaries_inserted;

  -- 2. Archive legacy daily_attendance for this site
  UPDATE public.daily_attendance
     SET is_archived = true
   WHERE site_id     = p_site_id
     AND is_deleted  = false
     AND is_archived = false
     AND date < v_data_started_at;
  GET DIAGNOSTICS v_attendance_archived = ROW_COUNT;

  -- 3. Archive legacy settlement_groups for this site
  UPDATE public.settlement_groups
     SET is_archived = true
   WHERE site_id      = p_site_id
     AND is_cancelled = false
     AND is_archived  = false
     AND settlement_date < v_data_started_at;
  GET DIAGNOSTICS v_settlements_archived = ROW_COUNT;

  -- 4. Archive labor_payments tied to those archived settlements
  UPDATE public.labor_payments lp
     SET is_archived = true
    FROM public.settlement_groups sg
   WHERE lp.settlement_group_id = sg.id
     AND sg.site_id     = p_site_id
     AND sg.is_archived = true
     AND lp.is_archived = false
     AND sg.settlement_date < v_data_started_at;
  GET DIAGNOSTICS v_payments_archived = ROW_COUNT;

  -- 5. Archive payment_week_allocations for this site whose week_start < cutoff
  UPDATE public.payment_week_allocations
     SET is_archived = true
   WHERE site_id     = p_site_id
     AND is_archived = false
     AND week_start  < v_data_started_at;
  GET DIAGNOSTICS v_allocations_archived = ROW_COUNT;

  -- 6. Flip site state. NB: laborer_opening_balances stays empty for Mode C.
  UPDATE public.sites
     SET legacy_status = 'reconciled'
   WHERE id = p_site_id;

  RETURN jsonb_build_object(
    'site_id',                          p_site_id,
    'data_started_at',                  v_data_started_at,
    'summaries_inserted',               v_summaries_inserted,
    'attendance_archived',              v_attendance_archived,
    'settlements_archived',             v_settlements_archived,
    'labor_payments_archived',          v_payments_archived,
    'payment_week_allocations_archived', v_allocations_archived
  );
END;
$$;

COMMENT ON FUNCTION public.reconcile_site_zero_balance(uuid) IS
'Mode C reconcile: aggregates pre-cutoff totals at the mesthri level into site_legacy_mesthri_summary, soft-archives the granular rows, leaves laborer_opening_balances empty so the live waterfall starts from zero. Atomic. Validates site is in auditing state. Returns counts.';

GRANT EXECUTE ON FUNCTION public.reconcile_site_zero_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_site_zero_balance(uuid) TO service_role;

-- ─── 3. Extend reopen RPC to clean Mode C summaries too ───────────────────
-- The original reopen_audit_after_opening_balance_reconcile only deleted
-- laborer_opening_balances. Add a DELETE on site_legacy_mesthri_summary so
-- a Mode C reconcile can be re-opened cleanly. The function still un-
-- archives all the rows + flips status back to 'auditing'. The name keeps
-- its history; renaming would break ad-hoc SQL the user has saved.

CREATE OR REPLACE FUNCTION public.reopen_audit_after_opening_balance_reconcile(
  p_site_id uuid
) RETURNS jsonb
  LANGUAGE plpgsql VOLATILE
  SECURITY INVOKER
  SET search_path = public
AS $$
DECLARE
  v_legacy_status      text;
  v_data_started_at    date;
  v_balances_deleted   integer := 0;
  v_summaries_deleted  integer := 0;
  v_attendance_unarchived  integer := 0;
  v_settlements_unarchived integer := 0;
  v_payments_unarchived    integer := 0;
  v_allocations_unarchived integer := 0;
BEGIN
  SELECT s.legacy_status, s.data_started_at
    INTO v_legacy_status, v_data_started_at
    FROM public.sites s
   WHERE s.id = p_site_id;

  IF v_legacy_status IS NULL THEN
    RAISE EXCEPTION 'reopen_audit: site % not found', p_site_id;
  END IF;
  IF v_legacy_status <> 'reconciled' THEN
    RAISE EXCEPTION 'reopen_audit: site % is not in reconciled state (current: %)',
      p_site_id, v_legacy_status;
  END IF;
  IF v_data_started_at IS NULL THEN
    RAISE EXCEPTION 'reopen_audit: site % has no data_started_at set', p_site_id;
  END IF;

  DELETE FROM public.laborer_opening_balances WHERE site_id = p_site_id;
  GET DIAGNOSTICS v_balances_deleted = ROW_COUNT;

  DELETE FROM public.site_legacy_mesthri_summary WHERE site_id = p_site_id;
  GET DIAGNOSTICS v_summaries_deleted = ROW_COUNT;

  UPDATE public.daily_attendance
     SET is_archived = false
   WHERE site_id     = p_site_id
     AND is_archived = true
     AND date < v_data_started_at;
  GET DIAGNOSTICS v_attendance_unarchived = ROW_COUNT;

  UPDATE public.settlement_groups
     SET is_archived = false
   WHERE site_id     = p_site_id
     AND is_archived = true
     AND settlement_date < v_data_started_at;
  GET DIAGNOSTICS v_settlements_unarchived = ROW_COUNT;

  UPDATE public.labor_payments lp
     SET is_archived = false
    FROM public.settlement_groups sg
   WHERE lp.settlement_group_id = sg.id
     AND sg.site_id     = p_site_id
     AND lp.is_archived = true
     AND sg.settlement_date < v_data_started_at;
  GET DIAGNOSTICS v_payments_unarchived = ROW_COUNT;

  UPDATE public.payment_week_allocations
     SET is_archived = false
   WHERE site_id     = p_site_id
     AND is_archived = true
     AND week_start  < v_data_started_at;
  GET DIAGNOSTICS v_allocations_unarchived = ROW_COUNT;

  UPDATE public.sites
     SET legacy_status = 'auditing'
   WHERE id = p_site_id;

  RETURN jsonb_build_object(
    'site_id',                            p_site_id,
    'balances_deleted',                   v_balances_deleted,
    'summaries_deleted',                  v_summaries_deleted,
    'attendance_unarchived',              v_attendance_unarchived,
    'settlements_unarchived',             v_settlements_unarchived,
    'labor_payments_unarchived',          v_payments_unarchived,
    'payment_week_allocations_unarchived', v_allocations_unarchived
  );
END;
$$;

COMMENT ON FUNCTION public.reopen_audit_after_opening_balance_reconcile(uuid) IS
'Reverse of both reconcile_site_with_opening_balance (Mode B) and reconcile_site_zero_balance (Mode C). Un-archives soft-deleted rows, deletes laborer_opening_balances + site_legacy_mesthri_summary, flips site back to auditing. Wired to the kebab "Re-open audit" action on MesthriLegacySummaryCard.';

GRANT EXECUTE ON FUNCTION public.reopen_audit_after_opening_balance_reconcile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_audit_after_opening_balance_reconcile(uuid) TO service_role;

COMMIT;
