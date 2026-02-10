-- Backfill batch_code for existing stock_inventory from group stock deliveries
-- This links inventory items to their source batch for proper inter-site settlement tracking

-- First, let's update stock_inventory records that came from group stock deliveries
-- The link path is: delivery_items -> deliveries -> purchase_orders -> material_purchase_expenses

-- Update stock_inventory with batch_code from material_purchase_expenses
-- We need to match on material_id, site_id, and brand_id to find the correct inventory records
UPDATE stock_inventory si
SET batch_code = mpe.ref_code
FROM delivery_items di
JOIN deliveries d ON d.id = di.delivery_id
JOIN purchase_orders po ON po.id = d.po_id
JOIN material_purchase_expenses mpe ON mpe.purchase_order_id = po.id
WHERE di.material_id = si.material_id
  AND d.site_id = si.site_id
  AND (
    (di.brand_id IS NOT NULL AND di.brand_id = si.brand_id)
    OR (di.brand_id IS NULL AND si.brand_id IS NULL)
  )
  AND mpe.purchase_type = 'group_stock'
  AND si.batch_code IS NULL
  AND d.verification_status = 'verified';

-- Log the count of updated records for verification
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % stock_inventory records with batch_code', updated_count;
END $$;
