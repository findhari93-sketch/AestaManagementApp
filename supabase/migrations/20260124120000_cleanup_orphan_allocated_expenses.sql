-- Cleanup orphan allocated expenses from material_purchase_expenses
-- These are records with settlement_reference that no longer exist in inter_site_material_settlements

-- First, identify orphan expense items and delete them
DELETE FROM material_purchase_expense_items
WHERE purchase_expense_id IN (
  SELECT mpe.id
  FROM material_purchase_expenses mpe
  WHERE mpe.settlement_reference IS NOT NULL
    AND mpe.settlement_reference != 'SELF-USE'
    AND NOT EXISTS (
      SELECT 1 FROM inter_site_material_settlements ism
      WHERE ism.settlement_code = mpe.settlement_reference
    )
);

-- Then delete the orphan expense records
DELETE FROM material_purchase_expenses mpe
WHERE mpe.settlement_reference IS NOT NULL
  AND mpe.settlement_reference != 'SELF-USE'
  AND NOT EXISTS (
    SELECT 1 FROM inter_site_material_settlements ism
    WHERE ism.settlement_code = mpe.settlement_reference
  );

-- Log how many were deleted (for verification)
DO $$
DECLARE
  deleted_count INT;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % orphan allocated expense records', deleted_count;
END $$;
