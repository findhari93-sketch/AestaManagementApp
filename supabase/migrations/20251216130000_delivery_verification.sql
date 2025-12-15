-- ============================================
-- DELIVERY VERIFICATION WORKFLOW
-- Site engineer must verify delivery with photos before stock update
-- Created: 2024-12-16
-- ============================================

-- Add verification status enum if not exists
DO $$ BEGIN
  CREATE TYPE delivery_verification_status AS ENUM ('pending', 'verified', 'disputed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enhance deliveries table with verification fields
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'
  CHECK (verification_status IN ('pending', 'verified', 'disputed', 'rejected'));
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS verification_photos TEXT[]; -- Array of photo URLs
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS discrepancies JSONB;
  -- Structure: [{item_id, expected_qty, received_qty, issue: 'damaged|missing|wrong_spec|short', notes}]
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS engineer_verified_by UUID REFERENCES users(id);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS engineer_verified_at TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS requires_verification BOOLEAN DEFAULT TRUE;
  -- If false, auto-add to stock on delivery creation

-- Update existing deliveries to be verified (for backwards compatibility)
UPDATE deliveries
SET verification_status = 'verified',
    engineer_verified_at = created_at,
    requires_verification = FALSE
WHERE verification_status IS NULL OR verification_status = 'pending';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_verification_status ON deliveries(verification_status);
CREATE INDEX IF NOT EXISTS idx_deliveries_verification_pending ON deliveries(site_id, verification_status)
  WHERE verification_status = 'pending';

-- ============================================
-- MODIFY STOCK UPDATE TRIGGER
-- Stock should only be updated after verification
-- ============================================

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trg_update_stock_on_delivery ON delivery_items;

-- Create new trigger function that checks verification status
CREATE OR REPLACE FUNCTION update_stock_on_verified_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_site_id UUID;
  v_location_id UUID;
  v_delivery_date DATE;
  v_verification_status TEXT;
  v_requires_verification BOOLEAN;
  v_inv_id UUID;
BEGIN
  -- Get delivery details
  SELECT d.site_id, d.location_id, d.delivery_date, d.verification_status, d.requires_verification
  INTO v_site_id, v_location_id, v_delivery_date, v_verification_status, v_requires_verification
  FROM deliveries d
  WHERE d.id = NEW.delivery_id;

  -- Only update stock if verified OR doesn't require verification
  IF v_verification_status != 'verified' AND v_requires_verification = TRUE THEN
    RETURN NEW;
  END IF;

  -- Find or create stock inventory record
  SELECT id INTO v_inv_id
  FROM stock_inventory
  WHERE site_id = v_site_id
    AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL));

  IF v_inv_id IS NULL THEN
    -- Create new inventory record
    INSERT INTO stock_inventory (
      site_id, location_id, material_id, brand_id,
      current_qty, avg_unit_cost, last_received_date
    ) VALUES (
      v_site_id, v_location_id, NEW.material_id, NEW.brand_id,
      COALESCE(NEW.accepted_qty, NEW.received_qty),
      COALESCE(NEW.unit_price, 0),
      v_delivery_date
    )
    RETURNING id INTO v_inv_id;
  ELSE
    -- Update existing inventory with weighted average cost
    UPDATE stock_inventory
    SET
      current_qty = current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty),
      avg_unit_cost = CASE
        WHEN current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty) > 0 THEN
          ((current_qty * COALESCE(avg_unit_cost, 0)) +
           (COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0)))
          / (current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty))
        ELSE 0
      END,
      last_received_date = v_delivery_date,
      updated_at = NOW()
    WHERE id = v_inv_id;
  END IF;

  -- Create stock transaction
  INSERT INTO stock_transactions (
    site_id, inventory_id, transaction_type, transaction_date,
    quantity, unit_cost, total_cost, reference_type, reference_id
  ) VALUES (
    v_site_id, v_inv_id, 'purchase', v_delivery_date,
    COALESCE(NEW.accepted_qty, NEW.received_qty),
    NEW.unit_price,
    COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0),
    'delivery', NEW.delivery_id
  );

  -- Update PO item received quantity if linked
  IF NEW.po_item_id IS NOT NULL THEN
    UPDATE purchase_order_items
    SET received_qty = received_qty + COALESCE(NEW.accepted_qty, NEW.received_qty)
    WHERE id = NEW.po_item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for delivery items (only fires for verified deliveries)
CREATE TRIGGER trg_update_stock_on_delivery
  AFTER INSERT ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_verified_delivery();

-- ============================================
-- FUNCTION: Verify Delivery
-- Called when engineer completes verification
-- ============================================

CREATE OR REPLACE FUNCTION verify_delivery(
  p_delivery_id UUID,
  p_user_id UUID,
  p_verification_photos TEXT[],
  p_verification_notes TEXT,
  p_discrepancies JSONB DEFAULT NULL,
  p_verification_status TEXT DEFAULT 'verified'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_delivery RECORD;
  v_item RECORD;
BEGIN
  -- Get delivery details
  SELECT * INTO v_delivery FROM deliveries WHERE id = p_delivery_id;

  IF v_delivery IS NULL THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;

  IF v_delivery.verification_status = 'verified' THEN
    RAISE EXCEPTION 'Delivery already verified';
  END IF;

  -- Update delivery with verification details
  UPDATE deliveries
  SET
    verification_status = p_verification_status,
    verification_photos = p_verification_photos,
    verification_notes = p_verification_notes,
    discrepancies = p_discrepancies,
    engineer_verified_by = p_user_id,
    engineer_verified_at = NOW(),
    delivery_status = CASE
      WHEN p_verification_status = 'verified' THEN 'delivered'::delivery_status
      WHEN p_verification_status = 'rejected' THEN 'rejected'::delivery_status
      ELSE delivery_status
    END,
    updated_at = NOW()
  WHERE id = p_delivery_id;

  -- If verified, process stock updates
  IF p_verification_status = 'verified' THEN
    -- Process each delivery item
    FOR v_item IN SELECT * FROM delivery_items WHERE delivery_id = p_delivery_id
    LOOP
      -- Update accepted_qty based on discrepancies
      IF p_discrepancies IS NOT NULL THEN
        -- Check if this item has a discrepancy
        UPDATE delivery_items
        SET accepted_qty = COALESCE(
          (SELECT (d->>'received_qty')::DECIMAL
           FROM jsonb_array_elements(p_discrepancies) d
           WHERE (d->>'item_id')::UUID = v_item.id),
          v_item.received_qty
        )
        WHERE id = v_item.id;
      ELSE
        -- No discrepancies, accept all
        UPDATE delivery_items
        SET accepted_qty = received_qty
        WHERE id = v_item.id;
      END IF;
    END LOOP;

    -- Now trigger stock updates by re-inserting items (triggers will process them)
    -- Actually, we need a different approach since items are already inserted
    -- Let's manually process the stock updates

    FOR v_item IN SELECT * FROM delivery_items WHERE delivery_id = p_delivery_id
    LOOP
      DECLARE
        v_site_id UUID;
        v_location_id UUID;
        v_inv_id UUID;
      BEGIN
        -- Get delivery details
        SELECT d.site_id, d.location_id
        INTO v_site_id, v_location_id
        FROM deliveries d
        WHERE d.id = p_delivery_id;

        -- Find or create stock inventory record
        SELECT id INTO v_inv_id
        FROM stock_inventory
        WHERE site_id = v_site_id
          AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
          AND material_id = v_item.material_id
          AND (brand_id = v_item.brand_id OR (brand_id IS NULL AND v_item.brand_id IS NULL));

        IF v_inv_id IS NULL THEN
          INSERT INTO stock_inventory (
            site_id, location_id, material_id, brand_id,
            current_qty, avg_unit_cost, last_received_date
          ) VALUES (
            v_site_id, v_location_id, v_item.material_id, v_item.brand_id,
            COALESCE(v_item.accepted_qty, v_item.received_qty),
            COALESCE(v_item.unit_price, 0),
            v_delivery.delivery_date
          )
          RETURNING id INTO v_inv_id;
        ELSE
          UPDATE stock_inventory
          SET
            current_qty = current_qty + COALESCE(v_item.accepted_qty, v_item.received_qty),
            avg_unit_cost = CASE
              WHEN current_qty + COALESCE(v_item.accepted_qty, v_item.received_qty) > 0 THEN
                ((current_qty * COALESCE(avg_unit_cost, 0)) +
                 (COALESCE(v_item.accepted_qty, v_item.received_qty) * COALESCE(v_item.unit_price, 0)))
                / (current_qty + COALESCE(v_item.accepted_qty, v_item.received_qty))
              ELSE 0
            END,
            last_received_date = v_delivery.delivery_date,
            updated_at = NOW()
          WHERE id = v_inv_id;
        END IF;

        -- Create stock transaction
        INSERT INTO stock_transactions (
          site_id, inventory_id, transaction_type, transaction_date,
          quantity, unit_cost, total_cost, reference_type, reference_id, created_by
        ) VALUES (
          v_site_id, v_inv_id, 'purchase', v_delivery.delivery_date,
          COALESCE(v_item.accepted_qty, v_item.received_qty),
          v_item.unit_price,
          COALESCE(v_item.accepted_qty, v_item.received_qty) * COALESCE(v_item.unit_price, 0),
          'delivery', p_delivery_id, p_user_id
        );

        -- Update PO item received quantity if linked
        IF v_item.po_item_id IS NOT NULL THEN
          UPDATE purchase_order_items
          SET received_qty = received_qty + COALESCE(v_item.accepted_qty, v_item.received_qty)
          WHERE id = v_item.po_item_id;
        END IF;
      END;
    END LOOP;

    -- Record prices in price history
    FOR v_item IN
      SELECT di.*, d.vendor_id, po.po_number, po.transport_cost, po.subtotal
      FROM delivery_items di
      JOIN deliveries d ON d.id = di.delivery_id
      LEFT JOIN purchase_orders po ON po.id = d.po_id
      WHERE di.delivery_id = p_delivery_id
    LOOP
      IF v_item.vendor_id IS NOT NULL AND v_item.material_id IS NOT NULL THEN
        DECLARE
          v_transport_share DECIMAL := 0;
        BEGIN
          -- Calculate transport share if PO exists
          IF v_item.subtotal > 0 AND v_item.transport_cost > 0 THEN
            v_transport_share := (v_item.accepted_qty * v_item.unit_price / v_item.subtotal) * v_item.transport_cost / v_item.accepted_qty;
          END IF;

          PERFORM record_price_entry(
            v_item.vendor_id,
            v_item.material_id,
            v_item.brand_id,
            v_item.unit_price,
            FALSE,
            NULL,
            v_transport_share,
            NULL,
            NULL,
            'purchase',
            v_item.po_number,
            v_item.accepted_qty,
            NULL,
            p_user_id,
            NULL
          );
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- View for pending verifications
CREATE OR REPLACE VIEW v_pending_delivery_verifications AS
SELECT
  d.id,
  d.grn_number,
  d.site_id,
  s.name as site_name,
  d.vendor_id,
  v.name as vendor_name,
  d.po_id,
  po.po_number,
  d.delivery_date,
  d.challan_number,
  d.vehicle_number,
  d.driver_name,
  d.driver_phone,
  d.delivery_status,
  d.verification_status,
  d.created_at,
  -- Item summary
  (SELECT COUNT(*) FROM delivery_items WHERE delivery_id = d.id) as item_count,
  (SELECT SUM(received_qty * COALESCE(unit_price, 0)) FROM delivery_items WHERE delivery_id = d.id) as total_value
FROM deliveries d
JOIN sites s ON s.id = d.site_id
JOIN vendors v ON v.id = d.vendor_id
LEFT JOIN purchase_orders po ON po.id = d.po_id
WHERE d.verification_status = 'pending'
  AND d.requires_verification = TRUE
ORDER BY d.delivery_date DESC, d.created_at DESC;

-- View for delivery verification details
CREATE OR REPLACE VIEW v_delivery_verification_details AS
SELECT
  d.id,
  d.grn_number,
  d.site_id,
  s.name as site_name,
  d.vendor_id,
  v.name as vendor_name,
  v.phone as vendor_phone,
  d.po_id,
  po.po_number,
  d.delivery_date,
  d.challan_number,
  d.challan_url,
  d.vehicle_number,
  d.driver_name,
  d.driver_phone,
  d.delivery_status,
  d.verification_status,
  d.verification_photos,
  d.verification_notes,
  d.discrepancies,
  d.engineer_verified_by,
  u.name as verified_by_name,
  d.engineer_verified_at,
  d.requires_verification,
  d.created_at
FROM deliveries d
JOIN sites s ON s.id = d.site_id
JOIN vendors v ON v.id = d.vendor_id
LEFT JOIN purchase_orders po ON po.id = d.po_id
LEFT JOIN users u ON u.id = d.engineer_verified_by;

-- ============================================
-- NOTIFICATION TRIGGER
-- Notify engineer when delivery arrives
-- ============================================

CREATE OR REPLACE FUNCTION notify_engineer_delivery_pending()
RETURNS TRIGGER AS $$
DECLARE
  v_site_name TEXT;
  v_vendor_name TEXT;
  v_engineer RECORD;
BEGIN
  -- Only notify for new pending deliveries
  IF NEW.verification_status != 'pending' OR NEW.requires_verification = FALSE THEN
    RETURN NEW;
  END IF;

  -- Get site and vendor names
  SELECT name INTO v_site_name FROM sites WHERE id = NEW.site_id;
  SELECT name INTO v_vendor_name FROM vendors WHERE id = NEW.vendor_id;

  -- Notify engineers assigned to this site
  FOR v_engineer IN
    SELECT u.id
    FROM users u
    WHERE u.role = 'site_engineer'
      AND u.status = 'active'
      AND NEW.site_id = ANY(u.assigned_sites)
  LOOP
    INSERT INTO notifications (
      user_id, title, message, notification_type,
      related_id, related_table, action_url, site_id
    ) VALUES (
      v_engineer.id,
      'Delivery Pending Verification',
      'Delivery from ' || v_vendor_name || ' at ' || v_site_name || ' needs verification',
      'delivery_pending',
      NEW.id,
      'deliveries',
      '/site/delivery-verification/' || NEW.id,
      NEW.site_id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_delivery_pending
  AFTER INSERT ON deliveries
  FOR EACH ROW
  WHEN (NEW.verification_status = 'pending' AND NEW.requires_verification = TRUE)
  EXECUTE FUNCTION notify_engineer_delivery_pending();

-- ============================================
-- END OF MIGRATION
-- ============================================
