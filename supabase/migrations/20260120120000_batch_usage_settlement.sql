-- Migration: Batch Usage Settlement System
-- Purpose: Track per-site usage against specific batches and enable batch-level settlements
-- with automatic expense allocation

-- =====================================================
-- 1. Add batch tracking columns to material_purchase_expenses
-- =====================================================

ALTER TABLE material_purchase_expenses
ADD COLUMN IF NOT EXISTS paying_site_id UUID REFERENCES sites(id),
ADD COLUMN IF NOT EXISTS original_qty NUMERIC(12,3),
ADD COLUMN IF NOT EXISTS used_qty NUMERIC(12,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_qty NUMERIC(12,3),
ADD COLUMN IF NOT EXISTS self_used_qty NUMERIC(12,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS self_used_amount NUMERIC(12,2) DEFAULT 0;

-- Add index for paying_site_id
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_paying_site_id
ON material_purchase_expenses(paying_site_id);

COMMENT ON COLUMN material_purchase_expenses.paying_site_id IS 'For group stock purchases: the site that paid for the materials';
COMMENT ON COLUMN material_purchase_expenses.original_qty IS 'Total quantity originally purchased';
COMMENT ON COLUMN material_purchase_expenses.used_qty IS 'Total quantity used across all sites';
COMMENT ON COLUMN material_purchase_expenses.remaining_qty IS 'Remaining quantity (original - used)';
COMMENT ON COLUMN material_purchase_expenses.self_used_qty IS 'Quantity used by the paying site (self-use)';
COMMENT ON COLUMN material_purchase_expenses.self_used_amount IS 'Amount for self-use portion (self_used_qty * unit_price)';

-- =====================================================
-- 2. Create batch_usage_records table
-- =====================================================

CREATE TABLE IF NOT EXISTS batch_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_ref_code TEXT NOT NULL,  -- Links to material_purchase_expenses.ref_code
  site_group_id UUID REFERENCES site_groups(id),

  -- Usage details
  usage_site_id UUID NOT NULL REFERENCES sites(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),
  quantity NUMERIC(12,3) NOT NULL,
  unit TEXT NOT NULL,  -- Inherited from material (nos, cft, bag, etc.)
  unit_cost NUMERIC(12,2) NOT NULL,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  usage_date DATE NOT NULL,
  work_description TEXT,

  -- Settlement tracking
  is_self_use BOOLEAN DEFAULT false,  -- True if usage_site = paying_site
  settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'settled', 'self_use')),
  settlement_id UUID REFERENCES inter_site_material_settlements(id),

  -- Links
  group_stock_transaction_id UUID REFERENCES group_stock_transactions(id),

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_batch_usage_records_batch_ref_code ON batch_usage_records(batch_ref_code);
CREATE INDEX IF NOT EXISTS idx_batch_usage_records_usage_site_id ON batch_usage_records(usage_site_id);
CREATE INDEX IF NOT EXISTS idx_batch_usage_records_settlement_status ON batch_usage_records(settlement_status);
CREATE INDEX IF NOT EXISTS idx_batch_usage_records_usage_date ON batch_usage_records(usage_date);
CREATE INDEX IF NOT EXISTS idx_batch_usage_records_material_id ON batch_usage_records(material_id);
CREATE INDEX IF NOT EXISTS idx_batch_usage_records_site_group_id ON batch_usage_records(site_group_id);

-- Enable RLS
ALTER TABLE batch_usage_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view batch usage for accessible sites"
  ON batch_usage_records FOR SELECT
  USING (can_access_site(usage_site_id));

CREATE POLICY "Users can insert batch usage for accessible sites"
  ON batch_usage_records FOR INSERT
  WITH CHECK (can_access_site(usage_site_id));

CREATE POLICY "Users can update batch usage for accessible sites"
  ON batch_usage_records FOR UPDATE
  USING (can_access_site(usage_site_id));

CREATE POLICY "Users can delete batch usage for accessible sites"
  ON batch_usage_records FOR DELETE
  USING (can_access_site(usage_site_id));

COMMENT ON TABLE batch_usage_records IS
'Tracks per-site usage against specific material batches. Each record represents
usage from a specific site, enabling batch-level settlement calculation.
- is_self_use: True when usage_site = paying_site (no settlement needed)
- settlement_status: pending (needs settlement), settled (payment done), self_use (no payment needed)';

-- =====================================================
-- 3. Create settlement_expense_allocations table
-- =====================================================

CREATE TABLE IF NOT EXISTS settlement_expense_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES inter_site_material_settlements(id),
  batch_ref_code TEXT NOT NULL,

  -- Creditor (paying site) info
  creditor_site_id UUID NOT NULL REFERENCES sites(id),
  creditor_expense_id UUID REFERENCES material_purchase_expenses(id),
  creditor_original_amount NUMERIC(12,2),
  creditor_self_use_amount NUMERIC(12,2),

  -- Debtor info
  debtor_site_id UUID NOT NULL REFERENCES sites(id),
  debtor_expense_id UUID REFERENCES material_purchase_expenses(id),
  debtor_settled_amount NUMERIC(12,2),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_settlement_expense_allocations_settlement_id
ON settlement_expense_allocations(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_expense_allocations_batch_ref_code
ON settlement_expense_allocations(batch_ref_code);
CREATE INDEX IF NOT EXISTS idx_settlement_expense_allocations_creditor_site_id
ON settlement_expense_allocations(creditor_site_id);
CREATE INDEX IF NOT EXISTS idx_settlement_expense_allocations_debtor_site_id
ON settlement_expense_allocations(debtor_site_id);

-- Enable RLS
ALTER TABLE settlement_expense_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policies (accessible if user can access either site)
CREATE POLICY "Users can view allocations for accessible sites"
  ON settlement_expense_allocations FOR SELECT
  USING (can_access_site(creditor_site_id) OR can_access_site(debtor_site_id));

CREATE POLICY "Users can insert allocations for accessible sites"
  ON settlement_expense_allocations FOR INSERT
  WITH CHECK (can_access_site(creditor_site_id) OR can_access_site(debtor_site_id));

CREATE POLICY "Users can update allocations for accessible sites"
  ON settlement_expense_allocations FOR UPDATE
  USING (can_access_site(creditor_site_id) OR can_access_site(debtor_site_id));

CREATE POLICY "Users can delete allocations for accessible sites"
  ON settlement_expense_allocations FOR DELETE
  USING (can_access_site(creditor_site_id) OR can_access_site(debtor_site_id));

COMMENT ON TABLE settlement_expense_allocations IS
'Tracks expense records created when batch settlements are processed.
Links the settlement to both creditor (paying site) and debtor expense records.';

-- =====================================================
-- 4. Function: Record batch usage
-- =====================================================

DROP FUNCTION IF EXISTS record_batch_usage(TEXT, UUID, NUMERIC, DATE, TEXT, UUID);

CREATE OR REPLACE FUNCTION record_batch_usage(
  p_batch_ref_code TEXT,
  p_usage_site_id UUID,
  p_quantity NUMERIC,
  p_usage_date DATE,
  p_work_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_batch RECORD;
  v_material RECORD;
  v_is_self_use BOOLEAN;
  v_settlement_status TEXT;
  v_usage_id UUID;
  v_unit_cost NUMERIC;
BEGIN
  -- Get batch details
  SELECT mpe.*,
         (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id) as total_qty,
         (SELECT SUM(total_price) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id) as items_total
  INTO v_batch
  FROM material_purchase_expenses mpe
  WHERE mpe.ref_code = p_batch_ref_code
    AND mpe.purchase_type = 'group_stock';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_ref_code;
  END IF;

  IF v_batch.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot add usage to completed batch: %', p_batch_ref_code;
  END IF;

  -- Check remaining quantity
  IF COALESCE(v_batch.remaining_qty, v_batch.original_qty, v_batch.total_qty) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient quantity in batch. Available: %, Requested: %',
      COALESCE(v_batch.remaining_qty, v_batch.original_qty, v_batch.total_qty), p_quantity;
  END IF;

  -- Get material details for unit
  SELECT m.* INTO v_material
  FROM materials m
  JOIN material_purchase_expense_items mpei ON mpei.material_id = m.id
  WHERE mpei.purchase_expense_id = v_batch.id
  LIMIT 1;

  -- Calculate unit cost
  v_unit_cost := COALESCE(v_batch.items_total, v_batch.total_amount) / NULLIF(COALESCE(v_batch.original_qty, v_batch.total_qty), 0);

  -- Determine if this is self-use
  v_is_self_use := (p_usage_site_id = v_batch.paying_site_id);
  v_settlement_status := CASE WHEN v_is_self_use THEN 'self_use' ELSE 'pending' END;

  -- Insert usage record
  INSERT INTO batch_usage_records (
    batch_ref_code,
    site_group_id,
    usage_site_id,
    material_id,
    brand_id,
    quantity,
    unit,
    unit_cost,
    usage_date,
    work_description,
    is_self_use,
    settlement_status,
    created_by
  )
  SELECT
    p_batch_ref_code,
    v_batch.site_group_id,
    p_usage_site_id,
    mpei.material_id,
    mpei.brand_id,
    p_quantity,
    COALESCE(v_material.unit, 'nos'),
    v_unit_cost,
    p_usage_date,
    p_work_description,
    v_is_self_use,
    v_settlement_status,
    p_created_by
  FROM material_purchase_expense_items mpei
  WHERE mpei.purchase_expense_id = v_batch.id
  LIMIT 1
  RETURNING id INTO v_usage_id;

  -- Update batch quantities
  UPDATE material_purchase_expenses
  SET
    used_qty = COALESCE(used_qty, 0) + p_quantity,
    remaining_qty = COALESCE(remaining_qty, original_qty, (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = id)) - COALESCE(used_qty, 0) - p_quantity,
    self_used_qty = CASE WHEN v_is_self_use THEN COALESCE(self_used_qty, 0) + p_quantity ELSE self_used_qty END,
    self_used_amount = CASE WHEN v_is_self_use THEN COALESCE(self_used_amount, 0) + (p_quantity * v_unit_cost) ELSE self_used_amount END,
    status = CASE
      WHEN COALESCE(remaining_qty, original_qty) - COALESCE(used_qty, 0) - p_quantity <= 0 THEN 'partial_used'
      ELSE status
    END,
    updated_at = now()
  WHERE ref_code = p_batch_ref_code;

  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Function: Get batch settlement summary
-- =====================================================

DROP FUNCTION IF EXISTS get_batch_settlement_summary(TEXT);

CREATE OR REPLACE FUNCTION get_batch_settlement_summary(p_batch_ref_code TEXT)
RETURNS TABLE (
  batch_ref_code TEXT,
  paying_site_id UUID,
  paying_site_name TEXT,
  total_amount NUMERIC,
  original_qty NUMERIC,
  used_qty NUMERIC,
  remaining_qty NUMERIC,
  site_allocations JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mpe.ref_code,
    mpe.paying_site_id,
    ps.name as paying_site_name,
    mpe.total_amount,
    COALESCE(mpe.original_qty, (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id)),
    COALESCE(mpe.used_qty, 0),
    COALESCE(mpe.remaining_qty, mpe.original_qty, (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id)),
    COALESCE(
      (
        SELECT jsonb_agg(site_data ORDER BY is_payer DESC, site_name)
        FROM (
          SELECT
            bur.usage_site_id as site_id,
            s.name as site_name,
            SUM(bur.quantity) as quantity_used,
            SUM(bur.total_cost) as amount,
            bur.is_self_use as is_payer,
            MAX(bur.settlement_status) as settlement_status
          FROM batch_usage_records bur
          JOIN sites s ON s.id = bur.usage_site_id
          WHERE bur.batch_ref_code = mpe.ref_code
          GROUP BY bur.usage_site_id, s.name, bur.is_self_use
        ) site_data
      ),
      '[]'::JSONB
    )
  FROM material_purchase_expenses mpe
  LEFT JOIN sites ps ON ps.id = mpe.paying_site_id
  WHERE mpe.ref_code = p_batch_ref_code
    AND mpe.purchase_type = 'group_stock';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Function: Process batch settlement
-- =====================================================

DROP FUNCTION IF EXISTS process_batch_settlement(TEXT, UUID, TEXT, DATE, TEXT, UUID);

CREATE OR REPLACE FUNCTION process_batch_settlement(
  p_batch_ref_code TEXT,
  p_debtor_site_id UUID,
  p_payment_mode TEXT,
  p_payment_date DATE,
  p_payment_reference TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  settlement_id UUID,
  debtor_expense_id UUID,
  settlement_code TEXT
) AS $$
DECLARE
  v_batch RECORD;
  v_usage_records RECORD;
  v_settlement_id UUID;
  v_settlement_code TEXT;
  v_total_amount NUMERIC := 0;
  v_total_qty NUMERIC := 0;
  v_debtor_expense_id UUID;
  v_debtor_ref_code TEXT;
  v_creditor_site_name TEXT;
  v_debtor_site_name TEXT;
  v_material_name TEXT;
  v_unit TEXT;
BEGIN
  -- Get batch details
  SELECT mpe.*, ps.name as payer_name
  INTO v_batch
  FROM material_purchase_expenses mpe
  LEFT JOIN sites ps ON ps.id = mpe.paying_site_id
  WHERE mpe.ref_code = p_batch_ref_code
    AND mpe.purchase_type = 'group_stock';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_ref_code;
  END IF;

  -- Get site names
  SELECT name INTO v_creditor_site_name FROM sites WHERE id = v_batch.paying_site_id;
  SELECT name INTO v_debtor_site_name FROM sites WHERE id = p_debtor_site_id;

  -- Get material name
  SELECT m.name, m.unit INTO v_material_name, v_unit
  FROM materials m
  JOIN material_purchase_expense_items mpei ON mpei.material_id = m.id
  WHERE mpei.purchase_expense_id = v_batch.id
  LIMIT 1;

  -- Calculate total amount from pending usage records for this debtor
  SELECT
    COALESCE(SUM(total_cost), 0),
    COALESCE(SUM(quantity), 0)
  INTO v_total_amount, v_total_qty
  FROM batch_usage_records
  WHERE batch_ref_code = p_batch_ref_code
    AND usage_site_id = p_debtor_site_id
    AND settlement_status = 'pending';

  IF v_total_amount = 0 THEN
    RAISE EXCEPTION 'No pending usage found for site % in batch %', p_debtor_site_id, p_batch_ref_code;
  END IF;

  -- Generate settlement code
  v_settlement_code := 'BSET-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' ||
    upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));

  -- Create inter_site_material_settlements record
  INSERT INTO inter_site_material_settlements (
    settlement_code,
    site_group_id,
    from_site_id,  -- creditor (paid for materials)
    to_site_id,    -- debtor (used materials)
    year,
    week_number,
    period_start,
    period_end,
    total_amount,
    paid_amount,
    status,
    notes,
    created_by
  ) VALUES (
    v_settlement_code,
    v_batch.site_group_id,
    v_batch.paying_site_id,
    p_debtor_site_id,
    EXTRACT(YEAR FROM p_payment_date),
    EXTRACT(WEEK FROM p_payment_date),
    p_payment_date,
    p_payment_date,
    v_total_amount,
    v_total_amount,  -- Fully paid
    'settled',
    format('Batch settlement for %s from %s', p_batch_ref_code, v_debtor_site_name),
    p_created_by
  )
  RETURNING id INTO v_settlement_id;

  -- Create settlement items from usage records
  INSERT INTO inter_site_settlement_items (
    settlement_id,
    material_id,
    brand_id,
    batch_code,
    quantity_used,
    unit,
    unit_cost,
    total_cost,
    transaction_id,
    usage_date,
    notes
  )
  SELECT
    v_settlement_id,
    bur.material_id,
    bur.brand_id,
    p_batch_ref_code,
    bur.quantity,
    bur.unit,
    bur.unit_cost,
    bur.total_cost,
    bur.group_stock_transaction_id,
    bur.usage_date,
    bur.work_description
  FROM batch_usage_records bur
  WHERE bur.batch_ref_code = p_batch_ref_code
    AND bur.usage_site_id = p_debtor_site_id
    AND bur.settlement_status = 'pending';

  -- Mark usage records as settled
  UPDATE batch_usage_records
  SET
    settlement_status = 'settled',
    settlement_id = v_settlement_id,
    updated_at = now()
  WHERE batch_ref_code = p_batch_ref_code
    AND usage_site_id = p_debtor_site_id
    AND settlement_status = 'pending';

  -- Generate reference code for debtor expense
  v_debtor_ref_code := 'SET-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' ||
    upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));

  -- Create material_purchase_expense for debtor site
  INSERT INTO material_purchase_expenses (
    site_id,
    ref_code,
    purchase_type,
    vendor_id,
    vendor_name,
    purchase_date,
    total_amount,
    transport_cost,
    payment_mode,
    payment_reference,
    is_paid,
    paid_date,
    status,
    settlement_reference,
    settlement_date,
    original_batch_code,
    site_group_id,
    notes,
    created_by
  ) VALUES (
    p_debtor_site_id,
    v_debtor_ref_code,
    'own_site',
    v_batch.vendor_id,
    v_batch.vendor_name,
    p_payment_date,
    v_total_amount,
    0,  -- Transport included in settlement
    p_payment_mode,
    p_payment_reference,
    true,
    p_payment_date,
    'recorded',
    v_settlement_code,
    p_payment_date,
    p_batch_ref_code,
    v_batch.site_group_id,
    format('Settled: %s %s %s from batch %s - paid to %s',
      v_total_qty, v_unit, v_material_name, p_batch_ref_code, v_creditor_site_name),
    p_created_by
  )
  RETURNING id INTO v_debtor_expense_id;

  -- Copy items to debtor expense
  INSERT INTO material_purchase_expense_items (
    purchase_expense_id,
    material_id,
    brand_id,
    quantity,
    unit_price,
    notes
  )
  SELECT
    v_debtor_expense_id,
    bur.material_id,
    bur.brand_id,
    SUM(bur.quantity),
    bur.unit_cost,
    format('From batch %s', p_batch_ref_code)
  FROM batch_usage_records bur
  WHERE bur.batch_ref_code = p_batch_ref_code
    AND bur.usage_site_id = p_debtor_site_id
    AND bur.settlement_id = v_settlement_id
  GROUP BY bur.material_id, bur.brand_id, bur.unit_cost;

  -- Create settlement_expense_allocations record
  INSERT INTO settlement_expense_allocations (
    settlement_id,
    batch_ref_code,
    creditor_site_id,
    creditor_expense_id,
    creditor_original_amount,
    creditor_self_use_amount,
    debtor_site_id,
    debtor_expense_id,
    debtor_settled_amount
  ) VALUES (
    v_settlement_id,
    p_batch_ref_code,
    v_batch.paying_site_id,
    v_batch.id,
    v_batch.total_amount,
    COALESCE(v_batch.self_used_amount, 0),
    p_debtor_site_id,
    v_debtor_expense_id,
    v_total_amount
  );

  -- Check if batch is fully settled (all usage accounted for)
  IF NOT EXISTS (
    SELECT 1 FROM batch_usage_records
    WHERE batch_ref_code = p_batch_ref_code
      AND settlement_status = 'pending'
  ) AND (
    SELECT COALESCE(remaining_qty, 0) FROM material_purchase_expenses WHERE ref_code = p_batch_ref_code
  ) <= 0 THEN
    -- Auto-complete the batch
    UPDATE material_purchase_expenses
    SET
      status = 'completed',
      total_amount = COALESCE(self_used_amount, 0),  -- Adjust creditor's expense to self-use amount
      updated_at = now()
    WHERE ref_code = p_batch_ref_code;
  END IF;

  RETURN QUERY SELECT v_settlement_id, v_debtor_expense_id, v_settlement_code;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Trigger: Update batch_usage_records updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_batch_usage_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_batch_usage_records_updated_at_trigger ON batch_usage_records;
CREATE TRIGGER update_batch_usage_records_updated_at_trigger
  BEFORE UPDATE ON batch_usage_records
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_usage_records_updated_at();

-- =====================================================
-- 8. Grant permissions
-- =====================================================

GRANT ALL ON batch_usage_records TO authenticated;
GRANT ALL ON settlement_expense_allocations TO authenticated;
GRANT EXECUTE ON FUNCTION record_batch_usage(TEXT, UUID, NUMERIC, DATE, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_batch_settlement_summary(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_batch_settlement(TEXT, UUID, TEXT, DATE, TEXT, UUID) TO authenticated;

-- =====================================================
-- 9. Add comments for documentation
-- =====================================================

COMMENT ON FUNCTION record_batch_usage(TEXT, UUID, NUMERIC, DATE, TEXT, UUID) IS
'Records usage from a specific site against a group stock batch.
Automatically determines if it is self-use (usage_site = paying_site).
Updates batch quantities and status accordingly.';

COMMENT ON FUNCTION get_batch_settlement_summary(TEXT) IS
'Returns summary of a batch including site-wise allocations for settlement display.';

COMMENT ON FUNCTION process_batch_settlement(TEXT, UUID, TEXT, DATE, TEXT, UUID) IS
'Processes settlement when a debtor site pays for their usage.
Creates settlement record, marks usage as settled, creates debtor expense record,
and auto-completes batch if fully settled.';
