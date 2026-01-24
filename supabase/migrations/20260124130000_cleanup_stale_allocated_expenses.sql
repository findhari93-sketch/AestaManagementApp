-- Cleanup stale allocated expenses from material_purchase_expenses
-- These are records with settlement_reference where:
-- 1. The settlement no longer exists, OR
-- 2. The settlement exists but is not in 'settled' status (was cancelled back to pending/cancelled)

-- Delete expense items for stale allocated expenses
DELETE FROM material_purchase_expense_items
WHERE purchase_expense_id IN (
  SELECT mpe.id
  FROM material_purchase_expenses mpe
  LEFT JOIN inter_site_material_settlements ism
    ON ism.settlement_code = mpe.settlement_reference
  WHERE mpe.settlement_reference IS NOT NULL
    AND mpe.settlement_reference != 'SELF-USE'
    AND mpe.original_batch_code IS NOT NULL
    AND (
      -- Settlement doesn't exist
      ism.id IS NULL
      -- OR settlement is not in settled status
      OR ism.status != 'settled'
    )
);

-- Delete the stale expense records
DELETE FROM material_purchase_expenses mpe
USING (
  SELECT mpe2.id
  FROM material_purchase_expenses mpe2
  LEFT JOIN inter_site_material_settlements ism
    ON ism.settlement_code = mpe2.settlement_reference
  WHERE mpe2.settlement_reference IS NOT NULL
    AND mpe2.settlement_reference != 'SELF-USE'
    AND mpe2.original_batch_code IS NOT NULL
    AND (
      -- Settlement doesn't exist
      ism.id IS NULL
      -- OR settlement is not in settled status
      OR ism.status != 'settled'
    )
) AS to_delete
WHERE mpe.id = to_delete.id;
