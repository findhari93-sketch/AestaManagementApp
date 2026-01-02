-- ============================================
-- VENDOR ENHANCEMENTS
-- Add vendor types, shop inventory, and enhanced fields
-- Created: 2024-12-16
-- ============================================

-- Vendor types enum
CREATE TYPE vendor_type AS ENUM ('shop', 'dealer', 'manufacturer', 'individual');

-- Enhance vendors table with new fields
ALTER TABLE vendors ADD COLUMN vendor_type vendor_type DEFAULT 'dealer';
ALTER TABLE vendors ADD COLUMN shop_name TEXT; -- Display name like "Sri Lakshmi Hardware"
ALTER TABLE vendors ADD COLUMN has_physical_store BOOLEAN DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN store_address TEXT;
ALTER TABLE vendors ADD COLUMN store_city TEXT;
ALTER TABLE vendors ADD COLUMN store_pincode TEXT;
ALTER TABLE vendors ADD COLUMN latitude DECIMAL(10,8);
ALTER TABLE vendors ADD COLUMN longitude DECIMAL(11,8);
ALTER TABLE vendors ADD COLUMN provides_transport BOOLEAN DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN provides_loading BOOLEAN DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN provides_unloading BOOLEAN DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN min_order_amount DECIMAL(12,2);
ALTER TABLE vendors ADD COLUMN delivery_radius_km INTEGER;
ALTER TABLE vendors ADD COLUMN specializations TEXT[]; -- Array of specializations like ['cement', 'steel', 'sand']
ALTER TABLE vendors ADD COLUMN accepts_upi BOOLEAN DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN accepts_cash BOOLEAN DEFAULT TRUE;
ALTER TABLE vendors ADD COLUMN accepts_credit BOOLEAN DEFAULT FALSE;
ALTER TABLE vendors ADD COLUMN credit_days INTEGER;

-- Indexes for new vendor fields
CREATE INDEX idx_vendors_type ON vendors(vendor_type);
CREATE INDEX idx_vendors_city ON vendors(store_city);
CREATE INDEX idx_vendors_transport ON vendors(provides_transport) WHERE provides_transport = TRUE;

-- Vendor inventory (shop's full catalog of materials)
-- This stores ALL materials a vendor sells, with their current prices
CREATE TABLE vendor_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id), -- NULL if custom material not in catalog
  custom_material_name TEXT, -- For materials not in our catalog
  brand_id UUID REFERENCES material_brands(id),

  -- Pricing
  current_price DECIMAL(12,2),
  price_includes_gst BOOLEAN DEFAULT FALSE,
  gst_rate DECIMAL(5,2),
  price_includes_transport BOOLEAN DEFAULT FALSE,
  transport_cost DECIMAL(10,2),
  loading_cost DECIMAL(10,2),
  unloading_cost DECIMAL(10,2),

  -- Availability
  is_available BOOLEAN DEFAULT TRUE,
  min_order_qty DECIMAL(12,3),
  unit TEXT,
  lead_time_days INTEGER,

  -- Tracking
  last_price_update TIMESTAMPTZ,
  price_source TEXT CHECK (price_source IN ('purchase', 'enquiry', 'quotation', 'manual', 'bill')),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure either material_id or custom_material_name is set
  CONSTRAINT vendor_inventory_material_check CHECK (
    material_id IS NOT NULL OR custom_material_name IS NOT NULL
  ),
  -- Unique constraint for vendor + material + brand combination
  UNIQUE(vendor_id, material_id, brand_id)
);

CREATE INDEX idx_vendor_inventory_vendor ON vendor_inventory(vendor_id);
CREATE INDEX idx_vendor_inventory_material ON vendor_inventory(material_id);
CREATE INDEX idx_vendor_inventory_available ON vendor_inventory(vendor_id, is_available) WHERE is_available = TRUE;
CREATE INDEX idx_vendor_inventory_price_update ON vendor_inventory(last_price_update DESC);

-- ============================================
-- PRICE HISTORY TABLE
-- Track all price changes over time
-- ============================================

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),

  -- Pricing details
  price DECIMAL(12,2) NOT NULL,
  price_includes_gst BOOLEAN DEFAULT FALSE,
  gst_rate DECIMAL(5,2),
  transport_cost DECIMAL(10,2),
  loading_cost DECIMAL(10,2),
  unloading_cost DECIMAL(10,2),
  total_landed_cost DECIMAL(12,2), -- price + transport + loading + unloading

  -- Recording details
  recorded_date DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('purchase', 'enquiry', 'quotation', 'bill', 'manual')),
  source_reference TEXT, -- PO number, bill number, quotation number, etc.

  quantity DECIMAL(12,3), -- Quantity purchased at this price (for context)
  unit TEXT,

  recorded_by UUID REFERENCES users(id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast price lookups
CREATE INDEX idx_price_history_material_vendor ON price_history(material_id, vendor_id, recorded_date DESC);
CREATE INDEX idx_price_history_vendor ON price_history(vendor_id, recorded_date DESC);
CREATE INDEX idx_price_history_material ON price_history(material_id, recorded_date DESC);
CREATE INDEX idx_price_history_date ON price_history(recorded_date DESC);
CREATE INDEX idx_price_history_source ON price_history(source);

-- ============================================
-- VIEWS
-- ============================================

-- View for vendor inventory with material details
CREATE OR REPLACE VIEW v_vendor_inventory_details AS
SELECT
  vi.id,
  vi.vendor_id,
  v.name as vendor_name,
  v.vendor_type,
  v.shop_name,
  v.store_city,
  v.provides_transport,
  v.provides_loading,
  vi.material_id,
  COALESCE(m.name, vi.custom_material_name) as material_name,
  m.code as material_code,
  mc.name as category_name,
  vi.brand_id,
  mb.brand_name,
  vi.current_price,
  vi.price_includes_gst,
  vi.gst_rate,
  vi.price_includes_transport,
  vi.transport_cost,
  vi.loading_cost,
  vi.unloading_cost,
  -- Calculate total landed cost
  COALESCE(vi.current_price, 0) +
  CASE WHEN NOT vi.price_includes_transport THEN COALESCE(vi.transport_cost, 0) ELSE 0 END +
  COALESCE(vi.loading_cost, 0) +
  COALESCE(vi.unloading_cost, 0) as total_landed_cost,
  vi.is_available,
  vi.min_order_qty,
  vi.unit,
  vi.lead_time_days,
  vi.last_price_update,
  vi.price_source
FROM vendor_inventory vi
JOIN vendors v ON v.id = vi.vendor_id
LEFT JOIN materials m ON m.id = vi.material_id
LEFT JOIN material_categories mc ON mc.id = m.category_id
LEFT JOIN material_brands mb ON mb.id = vi.brand_id
WHERE v.is_active = TRUE;

-- View for material price comparison across vendors
CREATE OR REPLACE VIEW v_material_vendor_prices AS
SELECT
  vi.material_id,
  m.name as material_name,
  m.code as material_code,
  mc.name as category_name,
  m.unit,
  vi.brand_id,
  mb.brand_name,
  vi.vendor_id,
  v.name as vendor_name,
  v.vendor_type,
  v.shop_name,
  v.store_city,
  v.provides_transport,
  v.provides_loading,
  v.min_order_amount,
  vi.current_price,
  vi.price_includes_gst,
  vi.transport_cost,
  vi.loading_cost,
  vi.unloading_cost,
  -- Calculate total landed cost
  COALESCE(vi.current_price, 0) +
  CASE WHEN NOT vi.price_includes_transport THEN COALESCE(vi.transport_cost, 0) ELSE 0 END +
  COALESCE(vi.loading_cost, 0) +
  COALESCE(vi.unloading_cost, 0) as total_landed_cost,
  vi.min_order_qty,
  vi.lead_time_days,
  vi.last_price_update,
  vi.is_available,
  -- Get latest price history for trend
  (
    SELECT ph.price
    FROM price_history ph
    WHERE ph.vendor_id = vi.vendor_id
      AND ph.material_id = vi.material_id
      AND (ph.brand_id = vi.brand_id OR (ph.brand_id IS NULL AND vi.brand_id IS NULL))
    ORDER BY ph.recorded_date DESC
    LIMIT 1 OFFSET 1
  ) as previous_price
FROM vendor_inventory vi
JOIN vendors v ON v.id = vi.vendor_id AND v.is_active = TRUE
JOIN materials m ON m.id = vi.material_id
LEFT JOIN material_categories mc ON mc.id = m.category_id
LEFT JOIN material_brands mb ON mb.id = vi.brand_id
WHERE vi.is_available = TRUE
ORDER BY total_landed_cost ASC;

-- View for price history with details
CREATE OR REPLACE VIEW v_price_history_details AS
SELECT
  ph.id,
  ph.vendor_id,
  v.name as vendor_name,
  v.vendor_type,
  v.shop_name,
  ph.material_id,
  m.name as material_name,
  m.code as material_code,
  mc.name as category_name,
  ph.brand_id,
  mb.brand_name,
  ph.price,
  ph.price_includes_gst,
  ph.gst_rate,
  ph.transport_cost,
  ph.loading_cost,
  ph.unloading_cost,
  ph.total_landed_cost,
  ph.recorded_date,
  ph.source,
  ph.source_reference,
  ph.quantity,
  ph.unit,
  ph.notes,
  u.name as recorded_by_name,
  ph.created_at
FROM price_history ph
JOIN vendors v ON v.id = ph.vendor_id
JOIN materials m ON m.id = ph.material_id
LEFT JOIN material_categories mc ON mc.id = m.category_id
LEFT JOIN material_brands mb ON mb.id = ph.brand_id
LEFT JOIN users u ON u.id = ph.recorded_by
ORDER BY ph.recorded_date DESC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to record a price entry and update vendor inventory
CREATE OR REPLACE FUNCTION record_price_entry(
  p_vendor_id UUID,
  p_material_id UUID,
  p_brand_id UUID,
  p_price DECIMAL,
  p_price_includes_gst BOOLEAN,
  p_gst_rate DECIMAL,
  p_transport_cost DECIMAL,
  p_loading_cost DECIMAL,
  p_unloading_cost DECIMAL,
  p_source TEXT,
  p_source_reference TEXT,
  p_quantity DECIMAL,
  p_unit TEXT,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_price_id UUID;
  v_total_cost DECIMAL;
BEGIN
  -- Calculate total landed cost
  v_total_cost := COALESCE(p_price, 0) +
    COALESCE(p_transport_cost, 0) +
    COALESCE(p_loading_cost, 0) +
    COALESCE(p_unloading_cost, 0);

  -- Insert price history record
  INSERT INTO price_history (
    vendor_id, material_id, brand_id,
    price, price_includes_gst, gst_rate,
    transport_cost, loading_cost, unloading_cost, total_landed_cost,
    recorded_date, source, source_reference,
    quantity, unit, recorded_by, notes
  ) VALUES (
    p_vendor_id, p_material_id, p_brand_id,
    p_price, p_price_includes_gst, p_gst_rate,
    p_transport_cost, p_loading_cost, p_unloading_cost, v_total_cost,
    CURRENT_DATE, p_source, p_source_reference,
    p_quantity, p_unit, p_user_id, p_notes
  )
  RETURNING id INTO v_price_id;

  -- Update or insert vendor inventory
  INSERT INTO vendor_inventory (
    vendor_id, material_id, brand_id,
    current_price, price_includes_gst, gst_rate,
    transport_cost, loading_cost, unloading_cost,
    unit, last_price_update, price_source
  ) VALUES (
    p_vendor_id, p_material_id, p_brand_id,
    p_price, p_price_includes_gst, p_gst_rate,
    p_transport_cost, p_loading_cost, p_unloading_cost,
    p_unit, NOW(), p_source
  )
  ON CONFLICT (vendor_id, material_id, brand_id)
  DO UPDATE SET
    current_price = EXCLUDED.current_price,
    price_includes_gst = EXCLUDED.price_includes_gst,
    gst_rate = EXCLUDED.gst_rate,
    transport_cost = EXCLUDED.transport_cost,
    loading_cost = EXCLUDED.loading_cost,
    unloading_cost = EXCLUDED.unloading_cost,
    unit = COALESCE(EXCLUDED.unit, vendor_inventory.unit),
    last_price_update = NOW(),
    price_source = EXCLUDED.price_source,
    updated_at = NOW();

  RETURN v_price_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get vendor count for a material
CREATE OR REPLACE FUNCTION get_vendor_count_for_material(p_material_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT vendor_id)
    FROM vendor_inventory
    WHERE material_id = p_material_id
      AND is_available = TRUE
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get material count for a vendor (shop inventory size)
CREATE OR REPLACE FUNCTION get_material_count_for_vendor(p_vendor_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM vendor_inventory
    WHERE vendor_id = p_vendor_id
      AND is_available = TRUE
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-record price history from PO
-- ============================================

CREATE OR REPLACE FUNCTION record_price_from_po_item()
RETURNS TRIGGER AS $$
DECLARE
  v_vendor_id UUID;
  v_transport_share DECIMAL;
  v_po_total DECIMAL;
  v_transport_cost DECIMAL;
BEGIN
  -- Get vendor_id and transport cost from PO
  SELECT
    po.vendor_id,
    po.subtotal,
    po.transport_cost
  INTO v_vendor_id, v_po_total, v_transport_cost
  FROM purchase_orders po
  WHERE po.id = NEW.po_id;

  -- Calculate transport share for this item
  IF v_po_total > 0 AND v_transport_cost > 0 THEN
    v_transport_share := (NEW.total_amount / v_po_total) * v_transport_cost / NEW.quantity;
  ELSE
    v_transport_share := 0;
  END IF;

  -- Record price history
  PERFORM record_price_entry(
    v_vendor_id,
    NEW.material_id,
    NEW.brand_id,
    NEW.unit_price,
    FALSE, -- price_includes_gst
    NEW.tax_rate,
    v_transport_share,
    0, -- loading_cost
    0, -- unloading_cost
    'purchase',
    (SELECT po_number FROM purchase_orders WHERE id = NEW.po_id),
    NEW.quantity,
    (SELECT unit::TEXT FROM materials WHERE id = NEW.material_id),
    (SELECT created_by FROM purchase_orders WHERE id = NEW.po_id),
    NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for PO items
CREATE TRIGGER trg_record_price_from_po
  AFTER INSERT ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION record_price_from_po_item();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE vendor_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Vendor inventory: All authenticated users can view, admin/office can manage
CREATE POLICY "allow_select_vendor_inventory" ON vendor_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_vendor_inventory" ON vendor_inventory FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

-- Price history: All authenticated users can view and insert
CREATE POLICY "allow_select_price_history" ON price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert_price_history" ON price_history FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- END OF MIGRATION
-- ============================================
