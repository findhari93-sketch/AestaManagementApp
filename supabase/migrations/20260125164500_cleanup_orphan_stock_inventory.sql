-- Cleanup orphaned stock_inventory records
-- These are records that no longer have corresponding deliveries (PO was deleted but stock wasn't cleaned up)

-- Step 1: Delete stock_transactions for orphaned stock_inventory records
-- An orphaned stock record is one where:
-- 1. current_qty is 0, OR
-- 2. No delivery_items exist for this material/brand combination in this site
DELETE FROM stock_transactions
WHERE inventory_id IN (
  SELECT si.id
  FROM stock_inventory si
  WHERE NOT EXISTS (
    SELECT 1
    FROM delivery_items di
    JOIN deliveries d ON d.id = di.delivery_id
    WHERE d.site_id = si.site_id
    AND di.material_id = si.material_id
    AND (
      (di.brand_id IS NULL AND si.brand_id IS NULL) OR
      di.brand_id = si.brand_id
    )
  )
);

-- Step 2: Delete the orphaned stock_inventory records
DELETE FROM stock_inventory
WHERE NOT EXISTS (
  SELECT 1
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.site_id = stock_inventory.site_id
  AND di.material_id = stock_inventory.material_id
  AND (
    (di.brand_id IS NULL AND stock_inventory.brand_id IS NULL) OR
    di.brand_id = stock_inventory.brand_id
  )
);

-- Also clean up any stock records with 0 quantity that have no recent transactions
DELETE FROM stock_inventory
WHERE current_qty = 0
AND id NOT IN (
  SELECT DISTINCT inventory_id
  FROM stock_transactions
  WHERE transaction_date > CURRENT_DATE - INTERVAL '30 days'
  AND inventory_id IS NOT NULL
);
