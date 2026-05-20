-- Reclassify 7 settlements on Srinivasan site (created 2026-05-04 by Shanthi
-- Manoharan via manual Studio entry) that incorrectly include contract-typed
-- laborer daily_attendance without a matching labor_payment. They appear as
-- Daily+Market in /site/payments but semantically are contract-laborer cash
-- recaps that should live in the Contract bucket.
--
-- Fix strategy: INSERT a labor_payment row (is_under_contract=true) per
-- contract-typed daily_attendance currently linked to one of these settlements.
-- This triggers the existing classification rule (paid_dm requires NOT EXISTS
-- contract labor_payments) so they exit Daily+Market and appear in Contract
-- Settlement instead.
--
-- The data fix is rule-based (not hardcoded IDs) so it's idempotent and self-
-- healing: any contract daily_attendance currently linked to ANY settlement
-- without a matching contract labor_payment will be backfilled. If applied
-- twice, the NOT EXISTS clause makes the second run a no-op.
--
-- Original investigation: 7 settlements, ₹18,200, all on Srinivasan, all
-- contract attendance had subcontract_id set (they belonged to subcontract
-- 1f5fae1d-5327-4865-9605-0714d8202aa7 — should have settled via waterfall).

INSERT INTO public.labor_payments (
  id,
  laborer_id,
  site_id,
  subcontract_id,
  amount,
  payment_date,
  payment_for_date,
  payment_mode,
  payment_channel,
  paid_by,
  paid_by_user_id,
  is_under_contract,
  attendance_id,
  recorded_by,
  recorded_by_user_id,
  notes,
  settlement_group_id,
  payment_type,
  actual_payment_date,
  is_advance_deduction,
  is_archived,
  created_at
)
SELECT
  gen_random_uuid()                           AS id,
  da.laborer_id                               AS laborer_id,
  sg.site_id                                  AS site_id,
  da.subcontract_id                           AS subcontract_id,
  da.daily_earnings                           AS amount,
  COALESCE(sg.actual_payment_date, sg.settlement_date) AS payment_date,
  da.date                                     AS payment_for_date,
  COALESCE(sg.payment_mode, 'cash')           AS payment_mode,
  COALESCE(sg.payment_channel, 'direct')      AS payment_channel,
  COALESCE(sg.created_by_name, 'Reclassification 2026-05-20') AS paid_by,
  sg.created_by                               AS paid_by_user_id,
  TRUE                                        AS is_under_contract,
  da.id                                       AS attendance_id,
  'Reclassification 2026-05-20'               AS recorded_by,
  NULL::uuid                                  AS recorded_by_user_id,
  ('Backfilled by migration 20260520140000. '
   || 'Source: contract-typed daily_attendance for ' || da.date::text
   || ' linked to settlement ' || sg.settlement_reference
   || ' (created ' || sg.created_at::date::text
   || ' by ' || COALESCE(sg.created_by_name, 'unknown')
   || ') without a contract labor_payment. '
   || 'Reclassifies the settlement from Daily+Market to Contract.')
                                               AS notes,
  da.settlement_group_id                      AS settlement_group_id,
  'salary'                                    AS payment_type,
  COALESCE(sg.actual_payment_date, sg.settlement_date) AS actual_payment_date,
  FALSE                                       AS is_advance_deduction,
  FALSE                                       AS is_archived,
  NOW()                                       AS created_at
FROM public.daily_attendance da
JOIN public.laborers l         ON l.id = da.laborer_id
JOIN public.settlement_groups sg ON sg.id = da.settlement_group_id
WHERE l.laborer_type = 'contract'
  AND da.is_archived = false
  AND sg.is_cancelled = false
  AND sg.is_archived  = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.labor_payments lp
    WHERE lp.settlement_group_id = da.settlement_group_id
      AND lp.laborer_id = da.laborer_id
      AND lp.is_under_contract = true
      AND lp.is_archived = false
  );

-- Sanity check: emit how many rows we just backfilled (visible in apply_migration response)
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.labor_payments
  WHERE notes LIKE 'Backfilled by migration 20260520140000.%';
  RAISE NOTICE 'Reclassified % contract daily_attendance rows into labor_payments', v_count;
END $$;
