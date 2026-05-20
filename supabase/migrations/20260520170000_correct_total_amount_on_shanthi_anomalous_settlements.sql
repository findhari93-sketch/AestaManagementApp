-- Fix the 7 Shanthi-typed settlements where total_amount was set to the
-- contract laborers' wages (which by convention settle via the Contract
-- waterfall, not via Daily+Market) instead of the actual non-contract daily
-- + market sum.
--
-- Standard convention (set by processSettlement in settlementService.ts):
--   settlement_groups.total_amount = SUM(non-contract daily_earnings)
--                                  + SUM(market_laborer_attendance.total_cost)
--   Tea is NOT included (it has its own flow via tea_shop_attendance).
--
-- These 7 settlements were entered manually via Supabase Studio on
-- 2026-05-04 by Shanthi Manoharan with the contract amount typed in the
-- total. Drawer (via get_attendance_for_date, which correctly excludes
-- contract from DAILY tile) shows the right number; row total on
-- /site/payments → Daily+Market was wrong (showed contract amount).
--
-- Recovery is idempotent: re-running with the same linked attendance
-- produces the same total.

UPDATE public.settlement_groups sg
SET total_amount = (
  SELECT COALESCE(SUM(da.daily_earnings), 0)
  FROM public.daily_attendance da
  JOIN public.laborers l ON l.id = da.laborer_id
  WHERE da.settlement_group_id = sg.id
    AND da.is_archived = false
    AND COALESCE(l.laborer_type, 'daily') <> 'contract'
) + (
  SELECT COALESCE(SUM(ma.total_cost), 0)
  FROM public.market_laborer_attendance ma
  WHERE ma.settlement_group_id = sg.id
)
WHERE sg.settlement_reference IN (
  'SET-260427-003','SET-260428-002','SET-260425-001','SET-260424-003',
  'SET-260220-002','SET-260217-002','SET-260113-002'
);

DO $$
DECLARE
  v_drift integer;
BEGIN
  SELECT COUNT(*) INTO v_drift
  FROM public.settlement_groups sg
  WHERE sg.settlement_reference IN (
    'SET-260427-003','SET-260428-002','SET-260425-001','SET-260424-003',
    'SET-260220-002','SET-260217-002','SET-260113-002'
  )
  AND sg.total_amount <> (
    (SELECT COALESCE(SUM(da.daily_earnings), 0)
     FROM public.daily_attendance da
     JOIN public.laborers l ON l.id = da.laborer_id
     WHERE da.settlement_group_id = sg.id
       AND da.is_archived = false
       AND COALESCE(l.laborer_type, 'daily') <> 'contract')
    +
    (SELECT COALESCE(SUM(ma.total_cost), 0)
     FROM public.market_laborer_attendance ma
     WHERE ma.settlement_group_id = sg.id)
  );
  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'Total correction incomplete: % rows still drift', v_drift;
  END IF;
  RAISE NOTICE 'All 7 settlement totals corrected to non-contract daily + market sum';
END $$;
