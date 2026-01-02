-- ============================================
-- SITE GROUPS & COMMON STOCK MANAGEMENT
-- For sharing materials between nearby sites
-- Created: 2024-12-16
-- ============================================

-- Site Groups (group nearby sites that share materials)
CREATE TABLE site_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_site_groups_active ON site_groups(is_active) WHERE is_active = TRUE;

-- Link sites to groups (a site can belong to one group)
ALTER TABLE sites ADD COLUMN site_group_id UUID REFERENCES site_groups(id);
CREATE INDEX idx_sites_group ON sites(site_group_id);

-- Group-level stock inventory (common stock shared between grouped sites)
CREATE TABLE group_stock_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_group_id UUID NOT NULL REFERENCES site_groups(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),
  location_id UUID REFERENCES stock_locations(id),

  current_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
  reserved_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
  available_qty DECIMAL(12,3) GENERATED ALWAYS AS (current_qty - reserved_qty) STORED,

  -- Weighted average cost
  avg_unit_cost DECIMAL(12,2) DEFAULT 0,

  -- Computed total value
  total_value DECIMAL(14,2) GENERATED ALWAYS AS (current_qty * avg_unit_cost) STORED,

  -- Dates
  last_received_date DATE,
  last_used_date DATE,

  -- Reorder settings
  reorder_level DECIMAL(10,3),
  reorder_qty DECIMAL(10,3),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(site_group_id, material_id, brand_id, location_id)
);

CREATE INDEX idx_group_stock_inventory_group ON group_stock_inventory(site_group_id);
CREATE INDEX idx_group_stock_inventory_material ON group_stock_inventory(material_id);
CREATE INDEX idx_group_stock_inventory_low_stock ON group_stock_inventory(site_group_id, material_id)
  WHERE current_qty > 0;

-- Group stock transactions (all movements for group stock)
CREATE TABLE group_stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_group_id UUID NOT NULL REFERENCES site_groups(id),
  inventory_id UUID NOT NULL REFERENCES group_stock_inventory(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),

  transaction_type stock_transaction_type NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

  quantity DECIMAL(12,3) NOT NULL, -- positive for in, negative for out
  unit_cost DECIMAL(12,2),
  total_cost DECIMAL(12,2),

  -- For purchases: track payment source
  payment_source TEXT CHECK (payment_source IN ('company', 'site_cash', 'engineer_own')),
  payment_source_site_id UUID REFERENCES sites(id),

  -- For usage: track which site used it
  usage_site_id UUID REFERENCES sites(id),
  work_description TEXT,

  -- Reference to source documents
  reference_type TEXT, -- 'purchase_order', 'local_purchase', 'delivery', 'manual', 'usage'
  reference_id UUID,

  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_stock_transactions_group ON group_stock_transactions(site_group_id);
CREATE INDEX idx_group_stock_transactions_inventory ON group_stock_transactions(inventory_id);
CREATE INDEX idx_group_stock_transactions_date ON group_stock_transactions(transaction_date DESC);
CREATE INDEX idx_group_stock_transactions_type ON group_stock_transactions(transaction_type);
CREATE INDEX idx_group_stock_transactions_usage_site ON group_stock_transactions(usage_site_id);
CREATE INDEX idx_group_stock_transactions_ref ON group_stock_transactions(reference_type, reference_id);

-- Add group stock support to daily_material_usage
ALTER TABLE daily_material_usage ADD COLUMN site_group_id UUID REFERENCES site_groups(id);
ALTER TABLE daily_material_usage ADD COLUMN is_group_stock BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_daily_material_usage_group ON daily_material_usage(site_group_id);

-- ============================================
-- VIEWS
-- ============================================

-- Group stock summary view
CREATE OR REPLACE VIEW v_group_stock_summary AS
SELECT
  gsi.site_group_id,
  sg.name as group_name,
  m.id as material_id,
  m.name as material_name,
  m.code as material_code,
  mc.name as category_name,
  m.unit,
  mb.brand_name,
  COALESCE(gsi.current_qty, 0) as total_qty,
  COALESCE(gsi.reserved_qty, 0) as total_reserved,
  COALESCE(gsi.available_qty, 0) as total_available,
  COALESCE(gsi.avg_unit_cost, 0) as avg_cost,
  COALESCE(gsi.total_value, 0) as total_value,
  gsi.last_received_date,
  gsi.last_used_date
FROM group_stock_inventory gsi
JOIN site_groups sg ON sg.id = gsi.site_group_id
JOIN materials m ON m.id = gsi.material_id
LEFT JOIN material_categories mc ON mc.id = m.category_id
LEFT JOIN material_brands mb ON mb.id = gsi.brand_id
WHERE sg.is_active = TRUE;

-- Group usage by site view (for expense allocation)
CREATE OR REPLACE VIEW v_group_usage_by_site AS
SELECT
  gst.site_group_id,
  sg.name as group_name,
  gst.usage_site_id,
  s.name as site_name,
  gst.material_id,
  m.name as material_name,
  m.unit,
  DATE_TRUNC('month', gst.transaction_date) as usage_month,
  SUM(ABS(gst.quantity)) as total_quantity,
  SUM(ABS(gst.total_cost)) as total_cost
FROM group_stock_transactions gst
JOIN site_groups sg ON sg.id = gst.site_group_id
JOIN sites s ON s.id = gst.usage_site_id
JOIN materials m ON m.id = gst.material_id
WHERE gst.transaction_type = 'usage'
  AND gst.usage_site_id IS NOT NULL
GROUP BY
  gst.site_group_id, sg.name,
  gst.usage_site_id, s.name,
  gst.material_id, m.name, m.unit,
  DATE_TRUNC('month', gst.transaction_date);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update group stock on purchase (used by triggers/application)
CREATE OR REPLACE FUNCTION update_group_stock_on_purchase(
  p_group_id UUID,
  p_material_id UUID,
  p_brand_id UUID,
  p_quantity DECIMAL,
  p_unit_cost DECIMAL,
  p_payment_source TEXT,
  p_payment_site_id UUID,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_inv_id UUID;
  v_trans_id UUID;
BEGIN
  -- Find or create group inventory record
  SELECT id INTO v_inv_id
  FROM group_stock_inventory
  WHERE site_group_id = p_group_id
    AND material_id = p_material_id
    AND (brand_id = p_brand_id OR (brand_id IS NULL AND p_brand_id IS NULL));

  IF v_inv_id IS NULL THEN
    -- Create new inventory record
    INSERT INTO group_stock_inventory (
      site_group_id, material_id, brand_id,
      current_qty, avg_unit_cost, last_received_date
    ) VALUES (
      p_group_id, p_material_id, p_brand_id,
      p_quantity, p_unit_cost, CURRENT_DATE
    )
    RETURNING id INTO v_inv_id;
  ELSE
    -- Update existing inventory with weighted average cost
    UPDATE group_stock_inventory
    SET
      current_qty = current_qty + p_quantity,
      avg_unit_cost = CASE
        WHEN current_qty + p_quantity > 0 THEN
          ((current_qty * COALESCE(avg_unit_cost, 0)) + (p_quantity * p_unit_cost))
          / (current_qty + p_quantity)
        ELSE 0
      END,
      last_received_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE id = v_inv_id;
  END IF;

  -- Create transaction record
  INSERT INTO group_stock_transactions (
    site_group_id, inventory_id, material_id, brand_id,
    transaction_type, transaction_date,
    quantity, unit_cost, total_cost,
    payment_source, payment_source_site_id,
    reference_type, reference_id, created_by
  ) VALUES (
    p_group_id, v_inv_id, p_material_id, p_brand_id,
    'purchase', CURRENT_DATE,
    p_quantity, p_unit_cost, p_quantity * p_unit_cost,
    p_payment_source, p_payment_site_id,
    p_reference_type, p_reference_id, p_user_id
  )
  RETURNING id INTO v_trans_id;

  RETURN v_trans_id;
END;
$$ LANGUAGE plpgsql;

-- Update group stock on usage (deduct and allocate to site)
CREATE OR REPLACE FUNCTION update_group_stock_on_usage(
  p_group_id UUID,
  p_material_id UUID,
  p_brand_id UUID,
  p_quantity DECIMAL,
  p_usage_site_id UUID,
  p_work_description TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_inv_id UUID;
  v_avg_cost DECIMAL;
  v_trans_id UUID;
BEGIN
  -- Find the group inventory record
  SELECT id, avg_unit_cost INTO v_inv_id, v_avg_cost
  FROM group_stock_inventory
  WHERE site_group_id = p_group_id
    AND material_id = p_material_id
    AND (brand_id = p_brand_id OR (brand_id IS NULL AND p_brand_id IS NULL));

  IF v_inv_id IS NULL THEN
    RAISE EXCEPTION 'Material not found in group stock';
  END IF;

  -- Update inventory (deduct quantity)
  UPDATE group_stock_inventory
  SET
    current_qty = current_qty - p_quantity,
    last_used_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = v_inv_id;

  -- Create transaction record
  INSERT INTO group_stock_transactions (
    site_group_id, inventory_id, material_id, brand_id,
    transaction_type, transaction_date,
    quantity, unit_cost, total_cost,
    usage_site_id, work_description,
    reference_type, reference_id, created_by
  ) VALUES (
    p_group_id, v_inv_id, p_material_id, p_brand_id,
    'usage', CURRENT_DATE,
    -p_quantity, v_avg_cost, p_quantity * v_avg_cost,
    p_usage_site_id, p_work_description,
    p_reference_type, p_reference_id, p_user_id
  )
  RETURNING id INTO v_trans_id;

  RETURN v_trans_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Update group stock from daily_material_usage
-- ============================================

CREATE OR REPLACE FUNCTION update_group_stock_on_daily_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_inv_id UUID;
  v_avg_cost DECIMAL(12,2);
BEGIN
  -- Only process if using group stock
  IF NOT NEW.is_group_stock OR NEW.site_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the group inventory record
  SELECT id, avg_unit_cost INTO v_inv_id, v_avg_cost
  FROM group_stock_inventory
  WHERE site_group_id = NEW.site_group_id
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL))
  LIMIT 1;

  IF v_inv_id IS NOT NULL THEN
    -- Update inventory (deduct quantity)
    UPDATE group_stock_inventory
    SET
      current_qty = current_qty - NEW.quantity,
      last_used_date = NEW.usage_date,
      updated_at = NOW()
    WHERE id = v_inv_id;

    -- Set cost on the usage record if not set
    IF NEW.unit_cost IS NULL THEN
      NEW.unit_cost := v_avg_cost;
      NEW.total_cost := NEW.quantity * v_avg_cost;
    END IF;

    -- Create group stock transaction
    INSERT INTO group_stock_transactions (
      site_group_id, inventory_id, material_id, brand_id,
      transaction_type, transaction_date,
      quantity, unit_cost, total_cost,
      usage_site_id, work_description,
      reference_type, reference_id, created_by
    ) VALUES (
      NEW.site_group_id, v_inv_id, NEW.material_id, NEW.brand_id,
      'usage', NEW.usage_date,
      -NEW.quantity, NEW.unit_cost, NEW.total_cost,
      NEW.site_id, NEW.work_description,
      'daily_material_usage', NEW.id, NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for group stock usage
CREATE TRIGGER trg_update_group_stock_on_daily_usage
  BEFORE INSERT ON daily_material_usage
  FOR EACH ROW
  WHEN (NEW.is_group_stock = TRUE AND NEW.site_group_id IS NOT NULL)
  EXECUTE FUNCTION update_group_stock_on_daily_usage();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE site_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_stock_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_stock_transactions ENABLE ROW LEVEL SECURITY;

-- Site groups: All authenticated users can view, admin/office can manage
CREATE POLICY "allow_select_site_groups" ON site_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_site_groups" ON site_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

-- Group stock inventory: All authenticated users can view and manage
CREATE POLICY "allow_select_group_stock_inventory" ON group_stock_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_group_stock_inventory" ON group_stock_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Group stock transactions: All authenticated users can view and insert
CREATE POLICY "allow_select_group_stock_transactions" ON group_stock_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert_group_stock_transactions" ON group_stock_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- END OF MIGRATION
-- ============================================
