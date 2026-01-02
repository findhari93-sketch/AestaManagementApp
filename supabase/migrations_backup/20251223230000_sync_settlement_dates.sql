-- Migration: Sync settlement_date with actual_payment_date
-- Purpose: Fix records where settlement_date and actual_payment_date are out of sync
-- This happens when users edited payment dates before the fix was deployed

-- Update settlement_date to match actual_payment_date where they differ
UPDATE settlement_groups
SET settlement_date = actual_payment_date
WHERE actual_payment_date IS NOT NULL
  AND settlement_date != actual_payment_date;

-- Add a comment explaining the sync
COMMENT ON COLUMN settlement_groups.settlement_date IS 'The date of the settlement. Should always match actual_payment_date. This is used by v_all_expenses view for display.';
COMMENT ON COLUMN settlement_groups.actual_payment_date IS 'The actual date when payment was made. Should always match settlement_date.';
