-- Migration: Fix Stock Inventory Cascade Delete
-- Purpose: Ensure stock_inventory records are properly cleaned up when PO/deliveries are deleted
-- Issue: Deleting a PO leaves orphan stock_inventory records

-- =====================================================
-- Step 1: Create trigger to REVERSE stock updates when delivery_items are deleted
-- =====================================================

-- This trigger will SUBTRACT from stock_inventory when a delivery_item is deleted
CREATE OR REPLACE FUNCTION reverse_stock_on_delivery_item_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_site_id UUID;
  v_location_id UUID;
  v_delivery_date DATE;
  v_verification_status TEXT;
  v_requires_verification BOOLEAN;
  v_qty_to_remove DECIMAL;
BEGIN
  -- Get delivery details
  SELECT d.site_id, d.location_id, d.delivery_date, d.verification_status, d.requires_verification
  INTO v_site_id, v_location_id, v_delivery_date, v_verification_status, v_requires_verification
  FROM deliveries d
  WHERE d.id = OLD.delivery_id;

  -- Only reverse stock if this delivery had verified stock (or didn't require verification)
  IF v_verification_status = 'verified' OR v_requires_verification = FALSE THEN
    -- Calculate quantity that was added to stock
    v_qty_to_remove := COALESCE(OLD.accepted_qty, OLD.received_qty);

    -- Update stock inventory (subtract the quantity)
    UPDATE stock_inventory
    SET
      current_qty = GREATEST(0, current_qty - v_qty_to_remove),
      updated_at = NOW()
    WHERE site_id = v_site_id
      AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
      AND material_id = OLD.material_id
      AND (brand_id = OLD.brand_id OR (brand_id IS NULL AND OLD.brand_id IS NULL));

    -- Log for debugging
    RAISE NOTICE 'Reversed stock: site=%, material=%, brand=%, qty=%',
      v_site_id, OLD.material_id, OLD.brand_id, v_qty_to_remove;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists and recreate the trigger
DROP TRIGGER IF EXISTS trg_reverse_stock_on_delivery_item_delete ON delivery_items;

CREATE TRIGGER trg_reverse_stock_on_delivery_item_delete
BEFORE DELETE ON delivery_items
FOR EACH ROW
EXECUTE FUNCTION reverse_stock_on_delivery_item_delete();

COMMENT ON TRIGGER trg_reverse_stock_on_delivery_item_delete ON delivery_items IS
'Automatically reverses stock_inventory changes when a delivery_item is deleted';

-- =====================================================
-- Step 2: Update deliveries.po_id FK to CASCADE delete
-- =====================================================

-- Drop the existing FK constraint
ALTER TABLE deliveries
DROP CONSTRAINT IF EXISTS deliveries_po_id_fkey;

-- Recreate with ON DELETE CASCADE
-- Note: This means deleting a PO will cascade to delete its deliveries
-- and the delivery_items trigger above will reverse the stock
ALTER TABLE deliveries
ADD CONSTRAINT deliveries_po_id_fkey
FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
ON DELETE CASCADE;

COMMENT ON CONSTRAINT deliveries_po_id_fkey ON deliveries IS
'Cascade deletes deliveries when purchase order is deleted';

-- =====================================================
-- Step 3: Clean up zero-quantity stock records
-- =====================================================

-- Delete stock records with zero quantity (they serve no purpose)
DELETE FROM stock_inventory
WHERE current_qty <= 0;

-- =====================================================
-- Step 4: Clean up orphan stock records (no matching delivery_items)
-- =====================================================

-- First, identify orphan stock_inventory records
-- An orphan is a stock record where no delivery_items exist for that material/brand/site combination
-- from any delivery that is still in the database

-- Delete stock_transactions for orphan inventory first (FK constraint)
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

-- Delete daily_material_usage for orphan inventory
DELETE FROM daily_material_usage
WHERE id IN (
  SELECT dmu.id
  FROM daily_material_usage dmu
  WHERE NOT EXISTS (
    SELECT 1
    FROM delivery_items di
    JOIN deliveries d ON d.id = di.delivery_id
    WHERE d.site_id = dmu.site_id
      AND di.material_id = dmu.material_id
  )
  -- Don't delete usage records for group stock batches (they have different flow)
  AND is_group_stock = FALSE
);

-- Delete the orphan stock_inventory records
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

-- =====================================================
-- Step 5: Recalculate stock quantities from actual delivery_items
-- =====================================================

-- This ensures stock_inventory matches actual delivered quantities
-- For each stock_inventory record, recalculate current_qty from delivery_items

UPDATE stock_inventory si
SET current_qty = (
  SELECT COALESCE(SUM(COALESCE(di.accepted_qty, di.received_qty)), 0)
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.site_id = si.site_id
    AND (d.location_id = si.location_id OR (d.location_id IS NULL AND si.location_id IS NULL))
    AND di.material_id = si.material_id
    AND (
      (di.brand_id IS NULL AND si.brand_id IS NULL) OR
      di.brand_id = si.brand_id
    )
    -- Only count verified deliveries (or those that don't require verification)
    AND (d.verification_status = 'verified' OR d.requires_verification = FALSE OR d.requires_verification IS NULL)
) - COALESCE((
  -- Subtract material usage
  SELECT COALESCE(SUM(dmu.quantity), 0)
  FROM daily_material_usage dmu
  WHERE dmu.site_id = si.site_id
    AND dmu.material_id = si.material_id
    AND (
      (dmu.brand_id IS NULL AND si.brand_id IS NULL) OR
      dmu.brand_id = si.brand_id
    )
    AND dmu.is_group_stock = FALSE
), 0),
updated_at = NOW();

-- =====================================================
-- Step 6: Log results for debugging
-- =====================================================

DO $$
DECLARE
  orphan_count INT;
  recalc_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM stock_inventory
  WHERE current_qty <= 0;

  RAISE NOTICE 'Migration complete: % records with zero or negative quantity', orphan_count;

  -- Clean up any remaining zero-quantity records
  DELETE FROM stock_inventory WHERE current_qty <= 0;

  GET DIAGNOSTICS recalc_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % zero-quantity records', recalc_count;
END $$;

-- =====================================================
-- Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION reverse_stock_on_delivery_item_delete() TO authenticated;
