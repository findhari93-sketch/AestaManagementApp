-- ============================================
-- INTER-SITE MATERIAL SETTLEMENT SYSTEM
-- Track and settle material costs between sites in a group
-- Settlement Frequency: WEEKLY
-- Created: 2024-12-30
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE inter_site_settlement_status AS ENUM (
  'draft',
  'pending',
  'approved',
  'settled',
  'cancelled'
);

-- ============================================
-- SETTLEMENT TABLES
-- ============================================

-- Main settlement table (tracks weekly settlements between site pairs)
CREATE TABLE inter_site_material_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_code TEXT UNIQUE NOT NULL,  -- e.g., "MAT-SET-2024-W52"

  -- Sites involved
  site_group_id UUID NOT NULL REFERENCES site_groups(id),
  from_site_id UUID NOT NULL REFERENCES sites(id),  -- Creditor (paid for materials)
  to_site_id UUID NOT NULL REFERENCES sites(id),    -- Debtor (used the materials)

  -- Period (week-based)
  year INT NOT NULL,
  week_number INT NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  period_start DATE NOT NULL,         -- Monday of the week
  period_end DATE NOT NULL,           -- Sunday of the week

  -- Amounts
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  pending_amount DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,

  -- Status
  status inter_site_settlement_status DEFAULT 'draft',

  -- Metadata
  notes TEXT,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  settled_by UUID REFERENCES users(id),
  settled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure from_site and to_site are different
  CONSTRAINT different_sites CHECK (from_site_id != to_site_id),
  -- Unique constraint for site pair per week
  UNIQUE(site_group_id, from_site_id, to_site_id, year, week_number)
);

CREATE INDEX idx_inter_site_settlements_group ON inter_site_material_settlements(site_group_id);
CREATE INDEX idx_inter_site_settlements_from ON inter_site_material_settlements(from_site_id);
CREATE INDEX idx_inter_site_settlements_to ON inter_site_material_settlements(to_site_id);
CREATE INDEX idx_inter_site_settlements_status ON inter_site_material_settlements(status);
CREATE INDEX idx_inter_site_settlements_week ON inter_site_material_settlements(year DESC, week_number DESC);

-- Settlement line items (material-level breakdown)
CREATE TABLE inter_site_settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES inter_site_material_settlements(id) ON DELETE CASCADE,

  -- Material info
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),
  batch_code TEXT,

  -- Usage details
  quantity_used DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  total_cost DECIMAL(12,2) NOT NULL,

  -- Reference to source transaction
  transaction_id UUID REFERENCES group_stock_transactions(id),
  usage_date DATE NOT NULL,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlement_items_settlement ON inter_site_settlement_items(settlement_id);
CREATE INDEX idx_settlement_items_material ON inter_site_settlement_items(material_id);
CREATE INDEX idx_settlement_items_date ON inter_site_settlement_items(usage_date);

-- Settlement payments (when sites pay each other)
CREATE TABLE inter_site_settlement_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES inter_site_material_settlements(id),

  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(12,2) NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'bank_transfer', 'upi', 'adjustment')),
  reference_number TEXT,

  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlement_payments_settlement ON inter_site_settlement_payments(settlement_id);


-- ============================================
-- VIEWS
-- ============================================

-- View for calculating who owes whom based on group stock transactions
CREATE OR REPLACE VIEW v_inter_site_balance AS
SELECT
  gst.site_group_id,
  sg.name as group_name,
  gst.payment_source_site_id as creditor_site_id,
  cs.name as creditor_site_name,
  gst.usage_site_id as debtor_site_id,
  ds.name as debtor_site_name,
  EXTRACT(YEAR FROM gst.transaction_date)::INT as year,
  EXTRACT(WEEK FROM gst.transaction_date)::INT as week_number,
  DATE_TRUNC('week', gst.transaction_date)::DATE as week_start,
  (DATE_TRUNC('week', gst.transaction_date) + INTERVAL '6 days')::DATE as week_end,
  COUNT(DISTINCT gst.id) as transaction_count,
  COUNT(DISTINCT gst.material_id) as material_count,
  SUM(ABS(gst.quantity)) as total_quantity,
  SUM(ABS(gst.total_cost)) as total_amount_owed
FROM group_stock_transactions gst
JOIN site_groups sg ON sg.id = gst.site_group_id
JOIN sites cs ON cs.id = gst.payment_source_site_id
JOIN sites ds ON ds.id = gst.usage_site_id
WHERE gst.transaction_type = 'usage'
  AND gst.usage_site_id IS NOT NULL
  AND gst.payment_source_site_id IS NOT NULL
  AND gst.payment_source_site_id != gst.usage_site_id
GROUP BY
  gst.site_group_id,
  sg.name,
  gst.payment_source_site_id,
  cs.name,
  gst.usage_site_id,
  ds.name,
  EXTRACT(YEAR FROM gst.transaction_date),
  EXTRACT(WEEK FROM gst.transaction_date),
  DATE_TRUNC('week', gst.transaction_date)
ORDER BY year DESC, week_number DESC, gst.site_group_id;

-- View for pending settlements (unsettled balances)
CREATE OR REPLACE VIEW v_pending_inter_site_settlements AS
SELECT
  vb.*,
  -- Check if settlement already exists
  isms.id as settlement_id,
  isms.status as settlement_status,
  isms.total_amount as settled_amount,
  CASE
    WHEN isms.id IS NULL THEN 'not_created'
    WHEN isms.status = 'draft' THEN 'draft'
    WHEN isms.status = 'pending' THEN 'pending_approval'
    WHEN isms.status = 'approved' THEN 'pending_payment'
    WHEN isms.status = 'settled' THEN 'settled'
    ELSE 'unknown'
  END as settlement_state
FROM v_inter_site_balance vb
LEFT JOIN inter_site_material_settlements isms
  ON isms.site_group_id = vb.site_group_id
  AND isms.from_site_id = vb.creditor_site_id
  AND isms.to_site_id = vb.debtor_site_id
  AND isms.year = vb.year
  AND isms.week_number = vb.week_number;

-- View for settlement details with items
CREATE OR REPLACE VIEW v_settlement_details AS
SELECT
  isms.id,
  isms.settlement_code,
  isms.site_group_id,
  sg.name as group_name,
  isms.from_site_id,
  fs.name as from_site_name,
  isms.to_site_id,
  ts.name as to_site_name,
  isms.year,
  isms.week_number,
  isms.period_start,
  isms.period_end,
  isms.total_amount,
  isms.paid_amount,
  isms.pending_amount,
  isms.status,
  isms.notes,
  isms.created_at,
  isms.approved_at,
  isms.settled_at,
  -- Item counts
  (SELECT COUNT(*) FROM inter_site_settlement_items WHERE settlement_id = isms.id) as item_count,
  -- Material summary
  (SELECT STRING_AGG(DISTINCT m.name, ', ' ORDER BY m.name)
   FROM inter_site_settlement_items isi
   JOIN materials m ON m.id = isi.material_id
   WHERE isi.settlement_id = isms.id
  ) as materials_summary
FROM inter_site_material_settlements isms
JOIN site_groups sg ON sg.id = isms.site_group_id
JOIN sites fs ON fs.id = isms.from_site_id
JOIN sites ts ON ts.id = isms.to_site_id;


-- ============================================
-- FUNCTIONS
-- ============================================

-- Generate settlement code
CREATE OR REPLACE FUNCTION generate_settlement_code(p_year INT, p_week INT)
RETURNS TEXT AS $$
DECLARE
  next_seq INT;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN settlement_code ~ ('^MAT-SET-' || p_year || '-W' || LPAD(p_week::TEXT, 2, '0') || '-\d{3}$')
      THEN CAST(SUBSTRING(settlement_code FROM 19 FOR 3) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_seq
  FROM inter_site_material_settlements
  WHERE year = p_year AND week_number = p_week;

  new_code := 'MAT-SET-' || p_year || '-W' || LPAD(p_week::TEXT, 2, '0') || '-' || LPAD(next_seq::TEXT, 3, '0');

  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Create weekly settlement from transactions
CREATE OR REPLACE FUNCTION create_weekly_settlement(
  p_site_group_id UUID,
  p_from_site_id UUID,
  p_to_site_id UUID,
  p_year INT,
  p_week INT,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_settlement_id UUID;
  v_settlement_code TEXT;
  v_week_start DATE;
  v_week_end DATE;
  v_total_amount DECIMAL;
  v_transaction RECORD;
BEGIN
  -- Calculate week dates
  v_week_start := DATE_TRUNC('week', MAKE_DATE(p_year, 1, 1) + (p_week - 1) * INTERVAL '1 week')::DATE;
  v_week_end := (v_week_start + INTERVAL '6 days')::DATE;

  -- Check if settlement already exists
  SELECT id INTO v_settlement_id
  FROM inter_site_material_settlements
  WHERE site_group_id = p_site_group_id
    AND from_site_id = p_from_site_id
    AND to_site_id = p_to_site_id
    AND year = p_year
    AND week_number = p_week;

  IF v_settlement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Settlement already exists for this week';
  END IF;

  -- Calculate total amount from transactions
  SELECT COALESCE(SUM(ABS(gst.total_cost)), 0)
  INTO v_total_amount
  FROM group_stock_transactions gst
  WHERE gst.site_group_id = p_site_group_id
    AND gst.payment_source_site_id = p_from_site_id
    AND gst.usage_site_id = p_to_site_id
    AND gst.transaction_type = 'usage'
    AND EXTRACT(YEAR FROM gst.transaction_date) = p_year
    AND EXTRACT(WEEK FROM gst.transaction_date) = p_week;

  IF v_total_amount = 0 THEN
    RAISE EXCEPTION 'No transactions found for this period';
  END IF;

  -- Generate settlement code
  v_settlement_code := generate_settlement_code(p_year, p_week);

  -- Create settlement record
  INSERT INTO inter_site_material_settlements (
    settlement_code, site_group_id, from_site_id, to_site_id,
    year, week_number, period_start, period_end,
    total_amount, status, created_by
  ) VALUES (
    v_settlement_code, p_site_group_id, p_from_site_id, p_to_site_id,
    p_year, p_week, v_week_start, v_week_end,
    v_total_amount, 'draft', p_created_by
  )
  RETURNING id INTO v_settlement_id;

  -- Create settlement items from transactions
  FOR v_transaction IN
    SELECT
      gst.material_id,
      gst.brand_id,
      gst.batch_code,
      ABS(gst.quantity) as quantity,
      m.unit,
      gst.unit_cost,
      ABS(gst.total_cost) as total_cost,
      gst.id as transaction_id,
      gst.transaction_date as usage_date
    FROM group_stock_transactions gst
    JOIN materials m ON m.id = gst.material_id
    WHERE gst.site_group_id = p_site_group_id
      AND gst.payment_source_site_id = p_from_site_id
      AND gst.usage_site_id = p_to_site_id
      AND gst.transaction_type = 'usage'
      AND EXTRACT(YEAR FROM gst.transaction_date) = p_year
      AND EXTRACT(WEEK FROM gst.transaction_date) = p_week
  LOOP
    INSERT INTO inter_site_settlement_items (
      settlement_id, material_id, brand_id, batch_code,
      quantity_used, unit, unit_cost, total_cost,
      transaction_id, usage_date
    ) VALUES (
      v_settlement_id, v_transaction.material_id, v_transaction.brand_id, v_transaction.batch_code,
      v_transaction.quantity, v_transaction.unit, v_transaction.unit_cost, v_transaction.total_cost,
      v_transaction.transaction_id, v_transaction.usage_date
    );
  END LOOP;

  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;

-- Approve settlement
CREATE OR REPLACE FUNCTION approve_settlement(
  p_settlement_id UUID,
  p_approved_by UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE inter_site_material_settlements
  SET status = 'approved',
      approved_by = p_approved_by,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_settlement_id
    AND status IN ('draft', 'pending');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Record settlement payment
CREATE OR REPLACE FUNCTION record_settlement_payment(
  p_settlement_id UUID,
  p_amount DECIMAL,
  p_payment_mode TEXT,
  p_reference_number TEXT DEFAULT NULL,
  p_recorded_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_current_paid DECIMAL;
  v_total_amount DECIMAL;
  v_new_status inter_site_settlement_status;
BEGIN
  -- Get current amounts
  SELECT paid_amount, total_amount
  INTO v_current_paid, v_total_amount
  FROM inter_site_material_settlements
  WHERE id = p_settlement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement not found';
  END IF;

  -- Create payment record
  INSERT INTO inter_site_settlement_payments (
    settlement_id, amount, payment_mode, reference_number, notes, recorded_by
  ) VALUES (
    p_settlement_id, p_amount, p_payment_mode, p_reference_number, p_notes, p_recorded_by
  )
  RETURNING id INTO v_payment_id;

  -- Update settlement
  v_current_paid := v_current_paid + p_amount;

  IF v_current_paid >= v_total_amount THEN
    v_new_status := 'settled';
  ELSE
    v_new_status := 'approved'; -- Keep as approved if partial payment
  END IF;

  UPDATE inter_site_material_settlements
  SET paid_amount = v_current_paid,
      status = v_new_status,
      settled_by = CASE WHEN v_new_status = 'settled' THEN p_recorded_by ELSE settled_by END,
      settled_at = CASE WHEN v_new_status = 'settled' THEN NOW() ELSE settled_at END,
      updated_at = NOW()
  WHERE id = p_settlement_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- Cancel settlement
CREATE OR REPLACE FUNCTION cancel_settlement(
  p_settlement_id UUID,
  p_cancelled_by UUID,
  p_reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE inter_site_material_settlements
  SET status = 'cancelled',
      cancelled_by = p_cancelled_by,
      cancelled_at = NOW(),
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_settlement_id
    AND status NOT IN ('settled', 'cancelled');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get unsettled balance for a site pair
CREATE OR REPLACE FUNCTION get_unsettled_balance(
  p_site_group_id UUID,
  p_from_site_id UUID,
  p_to_site_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  v_total_usage DECIMAL;
  v_total_settled DECIMAL;
BEGIN
  -- Total usage cost
  SELECT COALESCE(SUM(ABS(gst.total_cost)), 0)
  INTO v_total_usage
  FROM group_stock_transactions gst
  WHERE gst.site_group_id = p_site_group_id
    AND gst.payment_source_site_id = p_from_site_id
    AND gst.usage_site_id = p_to_site_id
    AND gst.transaction_type = 'usage';

  -- Total settled amount
  SELECT COALESCE(SUM(isms.paid_amount), 0)
  INTO v_total_settled
  FROM inter_site_material_settlements isms
  WHERE isms.site_group_id = p_site_group_id
    AND isms.from_site_id = p_from_site_id
    AND isms.to_site_id = p_to_site_id
    AND isms.status != 'cancelled';

  RETURN v_total_usage - v_total_settled;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE inter_site_material_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inter_site_settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inter_site_settlement_payments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view settlements
CREATE POLICY "allow_select_inter_site_settlements" ON inter_site_material_settlements
  FOR SELECT TO authenticated USING (true);

-- Only admin/office can manage settlements
CREATE POLICY "allow_all_inter_site_settlements" ON inter_site_material_settlements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

-- Settlement items
CREATE POLICY "allow_select_settlement_items" ON inter_site_settlement_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_all_settlement_items" ON inter_site_settlement_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

-- Settlement payments
CREATE POLICY "allow_select_settlement_payments" ON inter_site_settlement_payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_all_settlement_payments" ON inter_site_settlement_payments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));


-- ============================================
-- END OF INTER-SITE SETTLEMENT MIGRATION
-- ============================================
