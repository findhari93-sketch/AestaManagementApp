-- Migration: Fix backfilled settlement_groups dates
-- Purpose: Correct settlement_date for records that were backfilled with wrong dates
-- The backfill migration used the migration run date (Dec 22) instead of the original payment date

-- Update settlement_groups.settlement_date from the linked labor_payments
-- Use the actual payment date from labor_payments, falling back to payment_date or created_at
UPDATE settlement_groups sg
SET
  settlement_date = COALESCE(lp.actual_payment_date, lp.payment_date, lp.created_at::DATE),
  actual_payment_date = COALESCE(lp.actual_payment_date, sg.actual_payment_date)
FROM labor_payments lp
WHERE lp.settlement_group_id = sg.id
  AND (
    -- Only fix records where settlement_date is significantly different from the payment date
    sg.settlement_date > COALESCE(lp.actual_payment_date, lp.payment_date, lp.created_at::DATE)
    OR sg.settlement_date IS NULL
  );

-- Add comment
COMMENT ON TABLE settlement_groups IS 'Settlement groups table with corrected dates for backfilled records (Dec 23, 2025)';
