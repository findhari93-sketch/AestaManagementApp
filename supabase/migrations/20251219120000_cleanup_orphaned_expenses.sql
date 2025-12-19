-- Cleanup orphaned labor expenses
-- These expenses exist but have no corresponding paid attendance

-- First delete the sync records that reference the orphaned expenses
DELETE FROM attendance_expense_sync
WHERE expense_id IN (
  SELECT e.id FROM expenses e
  WHERE e.module = 'labor'
  AND NOT EXISTS (
    SELECT 1 FROM daily_attendance da
    WHERE da.site_id = e.site_id
    AND da.date = e.date
    AND da.is_paid = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM market_laborer_attendance ma
    WHERE ma.site_id = e.site_id
    AND ma.date = e.date
    AND ma.is_paid = true
  )
);

-- Then delete the orphaned expenses
DELETE FROM expenses
WHERE id IN (
  SELECT e.id FROM expenses e
  WHERE e.module = 'labor'
  AND NOT EXISTS (
    SELECT 1 FROM daily_attendance da
    WHERE da.site_id = e.site_id
    AND da.date = e.date
    AND da.is_paid = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM market_laborer_attendance ma
    WHERE ma.site_id = e.site_id
    AND ma.date = e.date
    AND ma.is_paid = true
  )
);
