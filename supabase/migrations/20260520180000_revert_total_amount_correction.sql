-- Reverts migration 20260520170000_correct_total_amount_on_shanthi_anomalous_settlements.
--
-- That migration recomputed settlement_groups.total_amount as
-- (non-contract daily + market) for 7 Shanthi-typed settlements, so the
-- /site/payments → Daily+Market row total would match the drawer (₹2,850).
--
-- BUT: the Contract Settlement → By Settlement view also reads
-- settlement_groups.total_amount (via useSettlementsList), and that view was
-- showing the original "mestri payment" amount Shanthi typed (₹3,300 for
-- 27 Apr — the contract laborers' wages). After 20260520170000 it switched
-- to the market portion, breaking that view.
--
-- User confirmed Contract Settlement view should keep the original mestri-
-- payment amounts. Reverting to those values means Daily+Market table goes
-- back to showing the wrong total for these 7 dates (the contract sum
-- instead of the market sum) — but the drawer remains correct, and the
-- chip's hover tooltip surfaces the breakdown.
--
-- The underlying tension (same total_amount field used by two views with
-- different semantic expectations) can only be fully resolved by splitting
-- each anomalous settlement into a Contract + Daily+Market pair. That's a
-- deferred follow-up.

UPDATE public.settlement_groups
SET total_amount = CASE settlement_reference
  WHEN 'SET-260427-003' THEN 3300.00
  WHEN 'SET-260428-002' THEN 2250.00
  WHEN 'SET-260425-001' THEN 3700.00
  WHEN 'SET-260424-003' THEN 5800.00
  WHEN 'SET-260220-002' THEN 900.00
  WHEN 'SET-260217-002' THEN 450.00
  WHEN 'SET-260113-002' THEN 1800.00
END
WHERE settlement_reference IN (
  'SET-260427-003','SET-260428-002','SET-260425-001','SET-260424-003',
  'SET-260220-002','SET-260217-002','SET-260113-002'
);
