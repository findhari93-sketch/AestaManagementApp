-- Migration: Fix orphaned settlement_groups visibility
-- Problem: Some settlement_groups show in Daily Expenses but not in Settlement tabs
-- Reason: The tabs query child tables (attendance/payments) which may have mismatched dates

-- ============================================================================
-- 1. For settlements that have labor_payments but wrong date in settlement_groups,
--    update settlement_date to match the labor_payments date
-- ============================================================================

-- This ensures Contract Weekly tab can find them
UPDATE settlement_groups sg
SET settlement_date = lp.payment_date
FROM (
  SELECT settlement_group_id, MIN(COALESCE(actual_payment_date, payment_date)) as payment_date
  FROM labor_payments
  WHERE settlement_group_id IS NOT NULL
  GROUP BY settlement_group_id
) lp
WHERE sg.id = lp.settlement_group_id
  AND sg.is_cancelled = false
  AND lp.payment_date IS NOT NULL
  AND sg.settlement_date != lp.payment_date;

-- ============================================================================
-- 2. For settlements with daily_attendance, ensure settlement_date matches
-- ============================================================================
UPDATE settlement_groups sg
SET settlement_date = da.att_date
FROM (
  SELECT settlement_group_id, MIN(date) as att_date
  FROM daily_attendance
  WHERE settlement_group_id IS NOT NULL
  GROUP BY settlement_group_id
) da
WHERE sg.id = da.settlement_group_id
  AND sg.is_cancelled = false
  AND da.att_date IS NOT NULL
  AND sg.settlement_date != da.att_date
  AND NOT EXISTS (SELECT 1 FROM labor_payments lp WHERE lp.settlement_group_id = sg.id);

-- ============================================================================
-- 3. For settlements with market_laborer_attendance, ensure settlement_date matches
-- ============================================================================
UPDATE settlement_groups sg
SET settlement_date = mla.att_date
FROM (
  SELECT settlement_group_id, MIN(date) as att_date
  FROM market_laborer_attendance
  WHERE settlement_group_id IS NOT NULL
  GROUP BY settlement_group_id
) mla
WHERE sg.id = mla.settlement_group_id
  AND sg.is_cancelled = false
  AND mla.att_date IS NOT NULL
  AND sg.settlement_date != mla.att_date
  AND NOT EXISTS (SELECT 1 FROM labor_payments lp WHERE lp.settlement_group_id = sg.id)
  AND NOT EXISTS (SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = sg.id);

-- ============================================================================
-- 4. Cancel truly orphaned settlements (no linked records anywhere)
-- These cannot be shown in any settlement tab
-- ============================================================================
UPDATE settlement_groups sg
SET
  is_cancelled = true,
  cancellation_reason = 'Orphaned - no linked attendance or payment records',
  cancelled_at = NOW()
WHERE sg.is_cancelled = false
  AND NOT EXISTS (SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = sg.id)
  AND NOT EXISTS (SELECT 1 FROM market_laborer_attendance mla WHERE mla.settlement_group_id = sg.id)
  AND NOT EXISTS (SELECT 1 FROM labor_payments lp WHERE lp.settlement_group_id = sg.id);
