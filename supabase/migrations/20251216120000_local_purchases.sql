-- ============================================
-- LOCAL PURCHASES
-- Track purchases made by site engineers at local shops
-- Created: 2024-12-16
-- ============================================

-- Local Purchases (main table for engineer purchases)
CREATE TABLE local_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number TEXT UNIQUE,

  -- Site and engineer
  site_id UUID NOT NULL REFERENCES sites(id),
  site_group_id UUID REFERENCES site_groups(id), -- If belongs to a group
  engineer_id UUID NOT NULL REFERENCES users(id),

  -- Vendor info (may or may not be in system)
  vendor_id UUID REFERENCES vendors(id), -- NULL if new/unknown vendor
  vendor_name TEXT NOT NULL,
  vendor_phone TEXT,
  vendor_address TEXT,
  is_new_vendor BOOLEAN DEFAULT FALSE, -- True if vendor should be added to system

  -- Purchase details
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT, -- Photo of bill/receipt
  total_amount DECIMAL(12,2) NOT NULL,

  -- Payment tracking
  payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'upi', 'engineer_own')),
  payment_reference TEXT, -- UPI transaction ID, etc.

  -- For group stock: track payment source
  payment_source TEXT CHECK (payment_source IN ('company', 'site_cash', 'engineer_own')),

  description TEXT,

  -- Status (engineers are trusted, so no approval needed)
  status TEXT DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled')),

  -- Reimbursement tracking (if engineer used own money)
  needs_reimbursement BOOLEAN DEFAULT FALSE,
  reimbursement_amount DECIMAL(12,2),
  reimbursement_status TEXT DEFAULT 'pending' CHECK (reimbursement_status IN ('pending', 'processed', 'completed')),
  reimbursement_transaction_id UUID REFERENCES site_engineer_transactions(id),
  reimbursed_at TIMESTAMPTZ,

  -- Stock integration
  add_to_stock BOOLEAN DEFAULT TRUE,
  stock_added BOOLEAN DEFAULT FALSE,
  is_group_stock BOOLEAN DEFAULT FALSE, -- True if adding to group common stock

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_local_purchases_site ON local_purchases(site_id);
CREATE INDEX idx_local_purchases_group ON local_purchases(site_group_id);
CREATE INDEX idx_local_purchases_engineer ON local_purchases(engineer_id);
CREATE INDEX idx_local_purchases_vendor ON local_purchases(vendor_id);
CREATE INDEX idx_local_purchases_date ON local_purchases(purchase_date DESC);
CREATE INDEX idx_local_purchases_status ON local_purchases(status);
CREATE INDEX idx_local_purchases_reimbursement ON local_purchases(needs_reimbursement, reimbursement_status)
  WHERE needs_reimbursement = TRUE;

-- Local Purchase Items
CREATE TABLE local_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_purchase_id UUID NOT NULL REFERENCES local_purchases(id) ON DELETE CASCADE,

  material_id UUID REFERENCES materials(id), -- NULL if custom material
  custom_material_name TEXT,
  brand_id UUID REFERENCES material_brands(id),

  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,

  -- For price tracking
  save_to_vendor_inventory BOOLEAN DEFAULT TRUE,
  save_to_price_history BOOLEAN DEFAULT TRUE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure either material_id or custom_material_name is set
  CONSTRAINT local_purchase_items_material_check CHECK (
    material_id IS NOT NULL OR custom_material_name IS NOT NULL
  )
);

CREATE INDEX idx_local_purchase_items_purchase ON local_purchase_items(local_purchase_id);
CREATE INDEX idx_local_purchase_items_material ON local_purchase_items(material_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Generate local purchase number (format: LP-YYMM-0001)
CREATE OR REPLACE FUNCTION generate_local_purchase_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM 9) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM local_purchases
  WHERE purchase_number LIKE 'LP-' || year_month || '-%';

  new_number := 'LP-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate purchase number
CREATE OR REPLACE FUNCTION set_local_purchase_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.purchase_number IS NULL THEN
    NEW.purchase_number := generate_local_purchase_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_local_purchase_number
  BEFORE INSERT ON local_purchases
  FOR EACH ROW
  EXECUTE FUNCTION set_local_purchase_number();

-- Function to process local purchase and add to stock
CREATE OR REPLACE FUNCTION process_local_purchase_stock(p_purchase_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_purchase RECORD;
  v_item RECORD;
  v_inv_id UUID;
BEGIN
  -- Get purchase details
  SELECT * INTO v_purchase FROM local_purchases WHERE id = p_purchase_id;

  IF v_purchase IS NULL OR v_purchase.stock_added = TRUE THEN
    RETURN FALSE;
  END IF;

  -- Process each item
  FOR v_item IN SELECT * FROM local_purchase_items WHERE local_purchase_id = p_purchase_id
  LOOP
    -- Skip items without material_id (custom materials don't go to stock)
    IF v_item.material_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_purchase.is_group_stock AND v_purchase.site_group_id IS NOT NULL THEN
      -- Add to group stock
      PERFORM update_group_stock_on_purchase(
        v_purchase.site_group_id,
        v_item.material_id,
        v_item.brand_id,
        v_item.quantity,
        v_item.unit_price,
        v_purchase.payment_source,
        v_purchase.site_id,
        'local_purchase',
        v_purchase.id,
        v_purchase.engineer_id
      );
    ELSE
      -- Add to site stock
      -- Find or create inventory record
      SELECT id INTO v_inv_id
      FROM stock_inventory
      WHERE site_id = v_purchase.site_id
        AND material_id = v_item.material_id
        AND (brand_id = v_item.brand_id OR (brand_id IS NULL AND v_item.brand_id IS NULL))
      LIMIT 1;

      IF v_inv_id IS NULL THEN
        INSERT INTO stock_inventory (
          site_id, material_id, brand_id,
          current_qty, avg_unit_cost, last_received_date
        ) VALUES (
          v_purchase.site_id, v_item.material_id, v_item.brand_id,
          v_item.quantity, v_item.unit_price, v_purchase.purchase_date
        )
        RETURNING id INTO v_inv_id;
      ELSE
        UPDATE stock_inventory
        SET
          current_qty = current_qty + v_item.quantity,
          avg_unit_cost = CASE
            WHEN current_qty + v_item.quantity > 0 THEN
              ((current_qty * COALESCE(avg_unit_cost, 0)) + (v_item.quantity * v_item.unit_price))
              / (current_qty + v_item.quantity)
            ELSE 0
          END,
          last_received_date = v_purchase.purchase_date,
          updated_at = NOW()
        WHERE id = v_inv_id;
      END IF;

      -- Create stock transaction
      INSERT INTO stock_transactions (
        site_id, inventory_id, transaction_type, transaction_date,
        quantity, unit_cost, total_cost, reference_type, reference_id, created_by
      ) VALUES (
        v_purchase.site_id, v_inv_id, 'purchase', v_purchase.purchase_date,
        v_item.quantity, v_item.unit_price, v_item.total_price,
        'local_purchase', v_purchase.id, v_purchase.engineer_id
      );
    END IF;

    -- Record price history if vendor is known
    IF v_purchase.vendor_id IS NOT NULL AND v_item.save_to_price_history THEN
      PERFORM record_price_entry(
        v_purchase.vendor_id,
        v_item.material_id,
        v_item.brand_id,
        v_item.unit_price,
        FALSE, -- price_includes_gst
        NULL,  -- gst_rate
        NULL,  -- transport_cost
        NULL,  -- loading_cost
        NULL,  -- unloading_cost
        'purchase',
        v_purchase.purchase_number,
        v_item.quantity,
        v_item.unit,
        v_purchase.engineer_id,
        'Local purchase by engineer'
      );
    END IF;
  END LOOP;

  -- Mark as stock added
  UPDATE local_purchases SET stock_added = TRUE, updated_at = NOW() WHERE id = p_purchase_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process stock when purchase is completed
CREATE OR REPLACE FUNCTION trigger_process_local_purchase_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.add_to_stock = TRUE AND NEW.stock_added = FALSE THEN
    PERFORM process_local_purchase_stock(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_process_local_purchase_stock
  AFTER INSERT OR UPDATE OF status ON local_purchases
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.add_to_stock = TRUE AND NEW.stock_added = FALSE)
  EXECUTE FUNCTION trigger_process_local_purchase_stock();

-- Function to create reimbursement for engineer
CREATE OR REPLACE FUNCTION create_local_purchase_reimbursement(
  p_purchase_id UUID,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_purchase RECORD;
  v_transaction_id UUID;
BEGIN
  SELECT * INTO v_purchase FROM local_purchases WHERE id = p_purchase_id;

  IF v_purchase IS NULL OR NOT v_purchase.needs_reimbursement THEN
    RETURN NULL;
  END IF;

  IF v_purchase.reimbursement_transaction_id IS NOT NULL THEN
    RETURN v_purchase.reimbursement_transaction_id;
  END IF;

  -- Create reimbursement transaction in engineer wallet
  INSERT INTO site_engineer_transactions (
    site_id, engineer_id, transaction_type, amount,
    description, related_expense_type, status, created_by
  ) VALUES (
    v_purchase.site_id,
    v_purchase.engineer_id,
    'reimbursement',
    v_purchase.total_amount,
    'Reimbursement for local purchase ' || v_purchase.purchase_number,
    'materials',
    'pending',
    p_user_id
  )
  RETURNING id INTO v_transaction_id;

  -- Update local purchase with transaction reference
  UPDATE local_purchases
  SET
    reimbursement_transaction_id = v_transaction_id,
    reimbursement_status = 'processed',
    updated_at = NOW()
  WHERE id = p_purchase_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- View for local purchases with details
CREATE OR REPLACE VIEW v_local_purchases_details AS
SELECT
  lp.id,
  lp.purchase_number,
  lp.site_id,
  s.name as site_name,
  lp.site_group_id,
  sg.name as group_name,
  lp.engineer_id,
  u.name as engineer_name,
  lp.vendor_id,
  lp.vendor_name,
  v.vendor_type,
  lp.vendor_phone,
  lp.purchase_date,
  lp.receipt_url,
  lp.total_amount,
  lp.payment_mode,
  lp.payment_source,
  lp.description,
  lp.status,
  lp.needs_reimbursement,
  lp.reimbursement_status,
  lp.reimbursement_transaction_id,
  lp.add_to_stock,
  lp.stock_added,
  lp.is_group_stock,
  lp.created_at,
  -- Item count
  (SELECT COUNT(*) FROM local_purchase_items WHERE local_purchase_id = lp.id) as item_count
FROM local_purchases lp
JOIN sites s ON s.id = lp.site_id
LEFT JOIN site_groups sg ON sg.id = lp.site_group_id
JOIN users u ON u.id = lp.engineer_id
LEFT JOIN vendors v ON v.id = lp.vendor_id
ORDER BY lp.purchase_date DESC, lp.created_at DESC;

-- View for pending reimbursements
CREATE OR REPLACE VIEW v_pending_reimbursements AS
SELECT
  lp.id,
  lp.purchase_number,
  lp.site_id,
  s.name as site_name,
  lp.engineer_id,
  u.name as engineer_name,
  lp.vendor_name,
  lp.purchase_date,
  lp.total_amount as reimbursement_amount,
  lp.receipt_url,
  lp.reimbursement_status,
  lp.created_at
FROM local_purchases lp
JOIN sites s ON s.id = lp.site_id
JOIN users u ON u.id = lp.engineer_id
WHERE lp.needs_reimbursement = TRUE
  AND lp.reimbursement_status IN ('pending', 'processed')
ORDER BY lp.purchase_date ASC;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE local_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_purchase_items ENABLE ROW LEVEL SECURITY;

-- Local purchases: All authenticated users can view, engineers and above can create
CREATE POLICY "allow_select_local_purchases" ON local_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert_local_purchases" ON local_purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_update_local_purchases" ON local_purchases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Local purchase items: All authenticated users can view and manage
CREATE POLICY "allow_select_local_purchase_items" ON local_purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_local_purchase_items" ON local_purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- END OF MIGRATION
-- ============================================
