-- ============================================
-- BATCH TRACKING & DEDICATED/SHARED STOCK
-- Track material batches and allocation between sites
-- Created: 2024-12-30
-- ============================================

-- ============================================
-- GROUP STOCK INVENTORY ENHANCEMENTS
-- Add batch tracking and dedicated/shared logic
-- ============================================

-- Add batch tracking columns to group_stock_inventory
ALTER TABLE group_stock_inventory ADD COLUMN IF NOT EXISTS batch_code TEXT;
ALTER TABLE group_stock_inventory ADD COLUMN IF NOT EXISTS is_dedicated BOOLEAN DEFAULT false;
ALTER TABLE group_stock_inventory ADD COLUMN IF NOT EXISTS dedicated_site_id UUID REFERENCES sites(id);
ALTER TABLE group_stock_inventory ADD COLUMN IF NOT EXISTS can_be_shared BOOLEAN DEFAULT true;

-- Add constraint: dedicated_site_id required if is_dedicated is true
ALTER TABLE group_stock_inventory ADD CONSTRAINT check_dedicated_site
  CHECK (NOT is_dedicated OR dedicated_site_id IS NOT NULL);

-- Add indexes for batch queries
CREATE INDEX IF NOT EXISTS idx_group_stock_inventory_batch ON group_stock_inventory(batch_code);
CREATE INDEX IF NOT EXISTS idx_group_stock_inventory_dedicated ON group_stock_inventory(is_dedicated, dedicated_site_id);

-- Add batch tracking to transactions
ALTER TABLE group_stock_transactions ADD COLUMN IF NOT EXISTS batch_code TEXT;
CREATE INDEX IF NOT EXISTS idx_group_stock_transactions_batch ON group_stock_transactions(batch_code);

-- ============================================
-- REGULAR STOCK INVENTORY ENHANCEMENTS
-- Add batch tracking for site-specific stock too
-- ============================================

ALTER TABLE stock_inventory ADD COLUMN IF NOT EXISTS batch_code TEXT;
CREATE INDEX IF NOT EXISTS idx_stock_inventory_batch ON stock_inventory(batch_code);

ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS batch_code TEXT;
CREATE INDEX IF NOT EXISTS idx_stock_transactions_batch ON stock_transactions(batch_code);

-- ============================================
-- BATCH CODE GENERATION FUNCTION
-- Generate unique batch codes like BATCH-2024-001
-- ============================================

CREATE OR REPLACE FUNCTION generate_batch_code()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  next_seq INT;
  new_code TEXT;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get next sequence for this year
  SELECT COALESCE(MAX(
    CASE
      WHEN batch_code ~ ('^BATCH-' || year_part || '-\d{4}$')
      THEN CAST(SUBSTRING(batch_code FROM 12 FOR 4) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_seq
  FROM group_stock_inventory
  WHERE batch_code LIKE 'BATCH-' || year_part || '-%';

  new_code := 'BATCH-' || year_part || '-' || LPAD(next_seq::TEXT, 4, '0');

  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- View for stock by batch with allocation status
CREATE OR REPLACE VIEW v_stock_by_batch AS
SELECT
  gsi.id,
  gsi.site_group_id,
  sg.name as group_name,
  gsi.batch_code,
  gsi.material_id,
  m.name as material_name,
  m.code as material_code,
  m.unit,
  mc.name as category_name,
  gsi.brand_id,
  mb.brand_name,
  gsi.is_dedicated,
  gsi.dedicated_site_id,
  ds.name as dedicated_site_name,
  gsi.can_be_shared,
  gsi.current_qty,
  gsi.reserved_qty,
  gsi.available_qty,
  gsi.avg_unit_cost,
  gsi.total_value,
  gsi.last_received_date,
  gsi.last_used_date,
  -- Get payment source info from first purchase transaction
  (
    SELECT gst.payment_source_site_id
    FROM group_stock_transactions gst
    WHERE gst.inventory_id = gsi.id
      AND gst.transaction_type = 'purchase'
    ORDER BY gst.created_at ASC
    LIMIT 1
  ) as paid_by_site_id,
  (
    SELECT s.name
    FROM group_stock_transactions gst
    JOIN sites s ON s.id = gst.payment_source_site_id
    WHERE gst.inventory_id = gsi.id
      AND gst.transaction_type = 'purchase'
    ORDER BY gst.created_at ASC
    LIMIT 1
  ) as paid_by_site_name
FROM group_stock_inventory gsi
JOIN site_groups sg ON sg.id = gsi.site_group_id
JOIN materials m ON m.id = gsi.material_id
LEFT JOIN material_categories mc ON mc.id = m.category_id
LEFT JOIN material_brands mb ON mb.id = gsi.brand_id
LEFT JOIN sites ds ON ds.id = gsi.dedicated_site_id
WHERE gsi.current_qty > 0
  AND sg.is_active = TRUE;

-- View for site-eligible batches (what batches a site can use)
CREATE OR REPLACE VIEW v_site_eligible_batches AS
SELECT
  gsi.id as inventory_id,
  gsi.site_group_id,
  sg.name as group_name,
  s.id as site_id,
  s.name as site_name,
  gsi.batch_code,
  gsi.material_id,
  m.name as material_name,
  m.code as material_code,
  m.unit,
  gsi.brand_id,
  mb.brand_name,
  gsi.current_qty as available_qty,
  gsi.avg_unit_cost,
  gsi.is_dedicated,
  gsi.dedicated_site_id,
  CASE
    WHEN gsi.is_dedicated AND gsi.dedicated_site_id = s.id THEN 'dedicated_own'
    WHEN gsi.is_dedicated AND gsi.dedicated_site_id != s.id THEN 'dedicated_other'
    WHEN NOT gsi.is_dedicated THEN 'shared'
  END as allocation_type,
  CASE
    WHEN gsi.is_dedicated AND gsi.dedicated_site_id != s.id THEN false
    ELSE true
  END as can_use
FROM group_stock_inventory gsi
JOIN site_groups sg ON sg.id = gsi.site_group_id
JOIN sites s ON s.site_group_id = sg.id
JOIN materials m ON m.id = gsi.material_id
LEFT JOIN material_brands mb ON mb.id = gsi.brand_id
WHERE gsi.current_qty > 0
  AND sg.is_active = TRUE
  AND s.status = 'active'
ORDER BY gsi.material_id, gsi.batch_code;

-- View for batch allocation summary (for settlement)
CREATE OR REPLACE VIEW v_batch_allocation_summary AS
SELECT
  gst.site_group_id,
  sg.name as group_name,
  gst.batch_code,
  gst.material_id,
  m.name as material_name,
  m.unit,
  -- Payment info
  (
    SELECT ps.id
    FROM group_stock_transactions pt
    JOIN sites ps ON ps.id = pt.payment_source_site_id
    WHERE pt.inventory_id = gst.inventory_id
      AND pt.transaction_type = 'purchase'
    ORDER BY pt.created_at ASC
    LIMIT 1
  ) as paid_by_site_id,
  (
    SELECT ps.name
    FROM group_stock_transactions pt
    JOIN sites ps ON ps.id = pt.payment_source_site_id
    WHERE pt.inventory_id = gst.inventory_id
      AND pt.transaction_type = 'purchase'
    ORDER BY pt.created_at ASC
    LIMIT 1
  ) as paid_by_site_name,
  -- Purchase total
  (
    SELECT SUM(pt.total_cost)
    FROM group_stock_transactions pt
    WHERE pt.inventory_id = gst.inventory_id
      AND pt.transaction_type = 'purchase'
  ) as total_purchase_cost,
  -- Usage by site
  gst.usage_site_id,
  us.name as usage_site_name,
  SUM(ABS(gst.quantity)) as quantity_used,
  SUM(ABS(gst.total_cost)) as cost_used
FROM group_stock_transactions gst
JOIN site_groups sg ON sg.id = gst.site_group_id
JOIN materials m ON m.id = gst.material_id
LEFT JOIN sites us ON us.id = gst.usage_site_id
WHERE gst.transaction_type = 'usage'
  AND gst.usage_site_id IS NOT NULL
GROUP BY
  gst.site_group_id,
  sg.name,
  gst.batch_code,
  gst.material_id,
  m.name,
  m.unit,
  gst.inventory_id,
  gst.usage_site_id,
  us.name
ORDER BY gst.site_group_id, gst.batch_code, gst.usage_site_id;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to check if a site can use a specific batch
CREATE OR REPLACE FUNCTION can_site_use_batch(
  p_site_id UUID,
  p_inventory_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_dedicated BOOLEAN;
  v_dedicated_site_id UUID;
  v_site_group_id UUID;
  v_inventory_group_id UUID;
BEGIN
  -- Get batch details
  SELECT is_dedicated, dedicated_site_id, site_group_id
  INTO v_is_dedicated, v_dedicated_site_id, v_inventory_group_id
  FROM group_stock_inventory
  WHERE id = p_inventory_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get site's group
  SELECT site_group_id INTO v_site_group_id
  FROM sites
  WHERE id = p_site_id;

  -- Site must be in the same group
  IF v_site_group_id IS NULL OR v_site_group_id != v_inventory_group_id THEN
    RETURN false;
  END IF;

  -- If dedicated, only the dedicated site can use it
  IF v_is_dedicated AND v_dedicated_site_id != p_site_id THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to update batch from dedicated to shared
CREATE OR REPLACE FUNCTION unlock_batch_for_sharing(
  p_inventory_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE group_stock_inventory
  SET is_dedicated = false,
      dedicated_site_id = NULL,
      can_be_shared = true,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to dedicate batch to a specific site
CREATE OR REPLACE FUNCTION dedicate_batch_to_site(
  p_inventory_id UUID,
  p_site_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_site_group_id UUID;
  v_inventory_group_id UUID;
BEGIN
  -- Get site's group
  SELECT site_group_id INTO v_site_group_id
  FROM sites
  WHERE id = p_site_id;

  -- Get inventory's group
  SELECT site_group_id INTO v_inventory_group_id
  FROM group_stock_inventory
  WHERE id = p_inventory_id;

  -- Site must be in the same group
  IF v_site_group_id IS NULL OR v_site_group_id != v_inventory_group_id THEN
    RETURN false;
  END IF;

  UPDATE group_stock_inventory
  SET is_dedicated = true,
      dedicated_site_id = p_site_id,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE EXISTING FUNCTIONS
-- ============================================

-- Update the group stock purchase function to include batch code
CREATE OR REPLACE FUNCTION update_group_stock_on_purchase(
  p_site_group_id UUID,
  p_material_id UUID,
  p_brand_id UUID,
  p_location_id UUID,
  p_quantity DECIMAL,
  p_unit_cost DECIMAL,
  p_payment_source TEXT,
  p_payment_source_site_id UUID,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_is_dedicated BOOLEAN DEFAULT false,
  p_dedicated_site_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_inventory_id UUID;
  v_transaction_id UUID;
  v_batch_code TEXT;
  v_existing_qty DECIMAL;
  v_existing_cost DECIMAL;
  v_new_avg_cost DECIMAL;
BEGIN
  -- Generate batch code
  v_batch_code := generate_batch_code();

  -- Find or create inventory record
  SELECT id, current_qty, avg_unit_cost
  INTO v_inventory_id, v_existing_qty, v_existing_cost
  FROM group_stock_inventory
  WHERE site_group_id = p_site_group_id
    AND material_id = p_material_id
    AND COALESCE(brand_id, '00000000-0000-0000-0000-000000000000') = COALESCE(p_brand_id, '00000000-0000-0000-0000-000000000000')
    AND COALESCE(location_id, '00000000-0000-0000-0000-000000000000') = COALESCE(p_location_id, '00000000-0000-0000-0000-000000000000');

  IF v_inventory_id IS NULL THEN
    -- Create new inventory record
    INSERT INTO group_stock_inventory (
      site_group_id, material_id, brand_id, location_id,
      current_qty, avg_unit_cost, last_received_date,
      batch_code, is_dedicated, dedicated_site_id
    ) VALUES (
      p_site_group_id, p_material_id, p_brand_id, p_location_id,
      p_quantity, p_unit_cost, CURRENT_DATE,
      v_batch_code, p_is_dedicated, p_dedicated_site_id
    )
    RETURNING id INTO v_inventory_id;

    v_new_avg_cost := p_unit_cost;
  ELSE
    -- Calculate weighted average cost
    v_new_avg_cost := ((v_existing_qty * v_existing_cost) + (p_quantity * p_unit_cost)) / (v_existing_qty + p_quantity);

    -- Update existing inventory
    UPDATE group_stock_inventory
    SET current_qty = current_qty + p_quantity,
        avg_unit_cost = v_new_avg_cost,
        last_received_date = CURRENT_DATE,
        batch_code = v_batch_code,
        is_dedicated = COALESCE(p_is_dedicated, is_dedicated),
        dedicated_site_id = COALESCE(p_dedicated_site_id, dedicated_site_id),
        updated_at = NOW()
    WHERE id = v_inventory_id;
  END IF;

  -- Create transaction record
  INSERT INTO group_stock_transactions (
    site_group_id, inventory_id, material_id, brand_id,
    transaction_type, quantity, unit_cost, total_cost,
    payment_source, payment_source_site_id,
    reference_type, reference_id,
    batch_code, notes
  ) VALUES (
    p_site_group_id, v_inventory_id, p_material_id, p_brand_id,
    'purchase', p_quantity, p_unit_cost, p_quantity * p_unit_cost,
    p_payment_source, p_payment_source_site_id,
    p_reference_type, p_reference_id,
    v_batch_code, p_notes
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Update the group stock usage function to include batch code and check eligibility
CREATE OR REPLACE FUNCTION update_group_stock_on_usage(
  p_site_group_id UUID,
  p_inventory_id UUID,
  p_quantity DECIMAL,
  p_usage_site_id UUID,
  p_work_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_material_id UUID;
  v_brand_id UUID;
  v_unit_cost DECIMAL;
  v_batch_code TEXT;
  v_is_dedicated BOOLEAN;
  v_dedicated_site_id UUID;
  v_current_qty DECIMAL;
BEGIN
  -- Get inventory details
  SELECT material_id, brand_id, avg_unit_cost, batch_code,
         is_dedicated, dedicated_site_id, current_qty
  INTO v_material_id, v_brand_id, v_unit_cost, v_batch_code,
       v_is_dedicated, v_dedicated_site_id, v_current_qty
  FROM group_stock_inventory
  WHERE id = p_inventory_id
    AND site_group_id = p_site_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory record not found';
  END IF;

  -- Check if site can use this batch
  IF v_is_dedicated AND v_dedicated_site_id IS NOT NULL AND v_dedicated_site_id != p_usage_site_id THEN
    RAISE EXCEPTION 'This batch is dedicated to another site and cannot be used';
  END IF;

  -- Check sufficient quantity
  IF v_current_qty < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_qty, p_quantity;
  END IF;

  -- Update inventory
  UPDATE group_stock_inventory
  SET current_qty = current_qty - p_quantity,
      last_used_date = CURRENT_DATE,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  -- Create transaction record
  INSERT INTO group_stock_transactions (
    site_group_id, inventory_id, material_id, brand_id,
    transaction_type, quantity, unit_cost, total_cost,
    usage_site_id, work_description,
    batch_code, notes
  ) VALUES (
    p_site_group_id, p_inventory_id, v_material_id, v_brand_id,
    'usage', -p_quantity, v_unit_cost, p_quantity * v_unit_cost,
    p_usage_site_id, p_work_description,
    v_batch_code, p_notes
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- RLS POLICIES
-- ============================================

-- Allow authenticated users to view batch-related views
-- (Views inherit RLS from base tables, but we ensure access)

-- ============================================
-- END OF BATCH TRACKING MIGRATION
-- ============================================
