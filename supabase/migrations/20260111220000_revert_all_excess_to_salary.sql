-- Migration: Revert ALL excess payments back to salary
-- Purpose: Clean up the incorrectly converted settlements
--
-- We cannot reliably distinguish between:
-- 1. True contract overpayments (should be 'excess')
-- 2. Daily salary settlements incorrectly converted to 'excess'
--
-- The safest fix is to revert ALL 'excess' back to 'salary'.
-- Going forward, the updated processWaterfallContractPayment() function
-- will correctly set payment_type='excess' ONLY for new contract overpayments.

-- Revert ALL excess payments back to salary
UPDATE "public"."settlement_groups"
SET "payment_type" = 'salary'
WHERE "payment_type" = 'excess'
  AND "is_cancelled" = false;

-- Note: The check constraint still allows 'excess' for future use.
-- New contract overpayments will be correctly marked as 'excess' by the code.
