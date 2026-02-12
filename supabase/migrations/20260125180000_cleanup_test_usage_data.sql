-- Cleanup test usage data that was created before stock reduction fix
-- These usage records were created without reducing stock, causing data inconsistency

-- First, let's identify usage records that don't have corresponding stock transactions
-- This indicates they were created before the fix was implemented

-- Delete daily_material_usage records that don't have corresponding stock transactions
-- (These are orphan records from before the fix)
DELETE FROM daily_material_usage
WHERE id IN (
  SELECT dmu.id
  FROM daily_material_usage dmu
  LEFT JOIN stock_transactions st ON
    st.site_id = dmu.site_id AND
    st.transaction_type = 'usage' AND
    DATE(st.transaction_date) = dmu.usage_date AND
    st.quantity = -dmu.quantity -- Usage transactions are negative
  WHERE st.id IS NULL
);

-- Note: We don't need to restore stock because these records never reduced stock in the first place
