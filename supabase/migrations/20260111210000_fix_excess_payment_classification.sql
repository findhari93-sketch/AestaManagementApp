-- Migration: Fix incorrect excess payment classification
-- Purpose: Revert daily salary settlements that were incorrectly marked as 'excess'
--
-- The previous migration incorrectly converted ALL settlements without labor_payments to 'excess',
-- but daily salary settlements also don't have labor_payments (only contract settlements do).
--
-- A settlement is only an "excess" (contract overpayment) if:
-- 1. It has NO labor_payments (no contract payment allocations)
-- 2. It has NO daily_attendance records linked (not a daily salary settlement)
-- 3. It has NO market_laborer_attendance records linked (not a market labor settlement)

-- Step 1: Revert daily salary settlements back to 'salary'
-- These are settlements that have linked daily_attendance records
UPDATE "public"."settlement_groups" sg
SET "payment_type" = 'salary'
WHERE sg."payment_type" = 'excess'
  AND sg."is_cancelled" = false
  AND EXISTS (
    SELECT 1 FROM "public"."daily_attendance" da
    WHERE da.settlement_group_id = sg.id
  );

-- Step 2: Revert market labor settlements back to 'salary'
-- These are settlements that have linked market_laborer_attendance records
UPDATE "public"."settlement_groups" sg
SET "payment_type" = 'salary'
WHERE sg."payment_type" = 'excess'
  AND sg."is_cancelled" = false
  AND EXISTS (
    SELECT 1 FROM "public"."market_laborer_attendance" mla
    WHERE mla.settlement_group_id = sg.id
  );

-- After this migration, only true contract overpayments remain as 'excess':
-- Settlements with payment_type='excess' that have:
-- - No labor_payments (contract payment records)
-- - No daily_attendance (daily labor)
-- - No market_laborer_attendance (market labor)
-- These are genuinely contract overpayments recorded when all contract dues were settled.
