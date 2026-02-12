-- Backfill stock_inventory.batch_code for records from group PO deliveries
-- These records were created by the DB trigger (one-step flow) or createStockFromDeliveryItems
-- (two-step flow partial delivery) without batch_code because the expense didn't exist yet.
--
-- Strategy: Join through delivery_items → deliveries → purchase_orders → material_purchase_expenses
-- to find the ref_code for group stock expenses and set it as batch_code.
--
-- This is idempotent: only updates records where batch_code IS NULL.

UPDATE stock_inventory si
SET batch_code = mpe.ref_code,
    updated_at = NOW()
FROM delivery_items di
JOIN deliveries d ON d.id = di.delivery_id
JOIN purchase_orders po ON po.id = d.po_id
JOIN material_purchase_expenses mpe
  ON mpe.purchase_order_id = po.id
  AND mpe.purchase_type = 'group_stock'
WHERE di.material_id = si.material_id
  AND d.site_id = si.site_id
  AND COALESCE(di.brand_id::text, '') = COALESCE(si.brand_id::text, '')
  AND mpe.ref_code IS NOT NULL
  AND si.batch_code IS NULL
  AND d.verification_status = 'verified';
