-- Cleanup orphan group_stock_transactions
-- These are records where the associated batch (material_purchase_expenses) no longer exists

-- First, delete settlement items that reference orphan transactions
DELETE FROM inter_site_settlement_items
WHERE transaction_id IN (
  SELECT gst.id
  FROM group_stock_transactions gst
  LEFT JOIN material_purchase_expenses mpe ON gst.batch_ref_code = mpe.ref_code
  LEFT JOIN group_stock_inventory gsi ON gst.inventory_id = gsi.id
  WHERE gst.batch_ref_code IS NOT NULL
    AND mpe.id IS NULL
    AND (gsi.id IS NULL OR gsi.batch_code NOT IN (SELECT ref_code FROM material_purchase_expenses))
);

-- Delete orphan transactions where batch no longer exists
DELETE FROM group_stock_transactions gst
WHERE gst.batch_ref_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM material_purchase_expenses mpe
    WHERE mpe.ref_code = gst.batch_ref_code
  );

-- Also delete transactions linked to orphan inventory records
DELETE FROM group_stock_transactions gst
WHERE gst.inventory_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM group_stock_inventory gsi
    WHERE gsi.id = gst.inventory_id
  );

-- Delete orphan inventory records (where batch no longer exists)
DELETE FROM group_stock_inventory gsi
WHERE gsi.batch_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM material_purchase_expenses mpe
    WHERE mpe.ref_code = gsi.batch_code
  );

-- Delete orphan batch_usage_records
DELETE FROM batch_usage_records bur
WHERE bur.batch_ref_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM material_purchase_expenses mpe
    WHERE mpe.ref_code = bur.batch_ref_code
  );

-- Delete orphan inter_site_material_settlements
DELETE FROM inter_site_material_settlements ism
WHERE ism.batch_ref_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM material_purchase_expenses mpe
    WHERE mpe.ref_code = ism.batch_ref_code
  );
