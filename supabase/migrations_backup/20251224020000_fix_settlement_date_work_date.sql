-- Migration: Fix settlement_date to be work date (not payment date)
-- Purpose: settlement_date should be the WORK/ATTENDANCE date, not when payment was processed
--
-- The previous sync migration incorrectly changed settlement_date to match actual_payment_date.
-- This caused settlements to appear under wrong dates in Daily Expenses.
--
-- Correct behavior:
-- - settlement_date = The work/attendance date (what appears in v_all_expenses)
-- - actual_payment_date = When the payment was actually processed (for tracking)

-- ============================================================================
-- 1. For daily/market settlements: Fix settlement_date using attendance record dates
-- ============================================================================

-- Fix from daily_attendance records
UPDATE settlement_groups sg
SET settlement_date = (
  SELECT MIN(da.date)
  FROM daily_attendance da
  WHERE da.settlement_group_id = sg.id
)
WHERE EXISTS (
  SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = sg.id
)
AND sg.settlement_date != (
  SELECT MIN(da.date)
  FROM daily_attendance da
  WHERE da.settlement_group_id = sg.id
);

-- Fix from market_laborer_attendance records
UPDATE settlement_groups sg
SET settlement_date = (
  SELECT MIN(mla.date)
  FROM market_laborer_attendance mla
  WHERE mla.settlement_group_id = sg.id
)
WHERE EXISTS (
  SELECT 1 FROM market_laborer_attendance mla WHERE mla.settlement_group_id = sg.id
)
AND NOT EXISTS (
  SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = sg.id
)
AND sg.settlement_date != (
  SELECT MIN(mla.date)
  FROM market_laborer_attendance mla
  WHERE mla.settlement_group_id = sg.id
);

-- ============================================================================
-- 2. For contract labor settlements: Fix settlement_date using labor_payments.payment_for_date
-- ============================================================================
UPDATE settlement_groups sg
SET settlement_date = (
  SELECT MIN(lp.payment_for_date)
  FROM labor_payments lp
  WHERE lp.settlement_group_id = sg.id
  AND lp.payment_for_date IS NOT NULL
)
WHERE EXISTS (
  SELECT 1 FROM labor_payments lp
  WHERE lp.settlement_group_id = sg.id
  AND lp.payment_for_date IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM daily_attendance da WHERE da.settlement_group_id = sg.id
)
AND NOT EXISTS (
  SELECT 1 FROM market_laborer_attendance mla WHERE mla.settlement_group_id = sg.id
)
AND sg.settlement_date != (
  SELECT MIN(lp.payment_for_date)
  FROM labor_payments lp
  WHERE lp.settlement_group_id = sg.id
  AND lp.payment_for_date IS NOT NULL
);

-- ============================================================================
-- 3. Update column comments to reflect correct usage
-- ============================================================================
COMMENT ON COLUMN settlement_groups.settlement_date IS 'The work/attendance date for this settlement. This is the date displayed in v_all_expenses and Daily Expenses page.';
COMMENT ON COLUMN settlement_groups.actual_payment_date IS 'The date when payment was actually processed. May differ from settlement_date if payment was made later than the work date.';
