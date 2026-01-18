-- Migration: Material Purchase Expense Tracking System
-- Adds bill uploads, payment tracking, ref codes, batch management

-- =====================================================
-- 1. Add columns to group_stock_transactions
-- =====================================================

ALTER TABLE group_stock_transactions
ADD COLUMN IF NOT EXISTS bill_url TEXT,
ADD COLUMN IF NOT EXISTS payment_mode TEXT,
ADD COLUMN IF NOT EXISTS payment_reference TEXT,
ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS ref_code TEXT,
ADD COLUMN IF NOT EXISTS batch_status TEXT DEFAULT 'in_stock',
ADD COLUMN IF NOT EXISTS expense_id UUID,
ADD COLUMN IF NOT EXISTS settlement_id UUID,
ADD COLUMN IF NOT EXISTS vendor_id UUID,
ADD COLUMN IF NOT EXISTS vendor_name TEXT;

-- Add check constraint for payment_mode
ALTER TABLE group_stock_transactions
DROP CONSTRAINT IF EXISTS group_stock_transactions_payment_mode_check;

ALTER TABLE group_stock_transactions
ADD CONSTRAINT group_stock_transactions_payment_mode_check
CHECK (payment_mode IS NULL OR payment_mode = ANY (ARRAY['cash', 'upi', 'bank_transfer', 'cheque', 'credit']));

-- Add check constraint for batch_status
ALTER TABLE group_stock_transactions
DROP CONSTRAINT IF EXISTS group_stock_transactions_batch_status_check;

ALTER TABLE group_stock_transactions
ADD CONSTRAINT group_stock_transactions_batch_status_check
CHECK (batch_status IS NULL OR batch_status = ANY (ARRAY['in_stock', 'partial_used', 'completed', 'converted']));

-- Add unique constraint on ref_code
CREATE UNIQUE INDEX IF NOT EXISTS group_stock_transactions_ref_code_unique
ON group_stock_transactions (ref_code) WHERE ref_code IS NOT NULL;

-- =====================================================
-- 2. Add columns to group_stock_inventory
-- =====================================================

ALTER TABLE group_stock_inventory
ADD COLUMN IF NOT EXISTS original_quantity NUMERIC(15,4),
ADD COLUMN IF NOT EXISTS remaining_quantity NUMERIC(15,4),
ADD COLUMN IF NOT EXISTS batch_status TEXT DEFAULT 'in_stock';

-- Add check constraint for batch_status
ALTER TABLE group_stock_inventory
DROP CONSTRAINT IF EXISTS group_stock_inventory_batch_status_check;

ALTER TABLE group_stock_inventory
ADD CONSTRAINT group_stock_inventory_batch_status_check
CHECK (batch_status IS NULL OR batch_status = ANY (ARRAY['in_stock', 'partial_used', 'completed', 'converted']));

-- =====================================================
-- 3. Create material_purchase_expenses table
-- =====================================================

CREATE TABLE IF NOT EXISTS material_purchase_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  ref_code TEXT UNIQUE NOT NULL,
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('own_site', 'group_stock')),

  -- Purchase details
  vendor_id UUID REFERENCES vendors(id),
  vendor_name TEXT,
  purchase_date DATE NOT NULL,

  -- Financial
  total_amount NUMERIC(12,2) NOT NULL,
  transport_cost NUMERIC(12,2) DEFAULT 0,

  -- Payment
  payment_mode TEXT CHECK (payment_mode IS NULL OR payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque', 'credit')),
  payment_reference TEXT,
  payment_screenshot_url TEXT,
  is_paid BOOLEAN DEFAULT false,
  paid_date DATE,

  -- Documents
  bill_url TEXT,

  -- Status
  status TEXT DEFAULT 'recorded' CHECK (status IN ('recorded', 'partial_used', 'completed', 'converted')),

  -- For group stock: tracks if converted to own site
  converted_from_group BOOLEAN DEFAULT false,
  original_batch_code TEXT,

  -- Links to other tables
  group_stock_transaction_id UUID REFERENCES group_stock_transactions(id),
  local_purchase_id UUID REFERENCES local_purchases(id),
  site_group_id UUID REFERENCES site_groups(id),

  -- Metadata
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_site_id ON material_purchase_expenses(site_id);
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_purchase_type ON material_purchase_expenses(purchase_type);
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_status ON material_purchase_expenses(status);
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_purchase_date ON material_purchase_expenses(purchase_date);
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_ref_code ON material_purchase_expenses(ref_code);

-- Enable RLS
ALTER TABLE material_purchase_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using site-based access like other tables)
CREATE POLICY "Users can view material purchases for accessible sites"
  ON material_purchase_expenses FOR SELECT
  USING (can_access_site(site_id));

CREATE POLICY "Users can insert material purchases for accessible sites"
  ON material_purchase_expenses FOR INSERT
  WITH CHECK (can_access_site(site_id));

CREATE POLICY "Users can update material purchases for accessible sites"
  ON material_purchase_expenses FOR UPDATE
  USING (can_access_site(site_id));

CREATE POLICY "Users can delete material purchases for accessible sites"
  ON material_purchase_expenses FOR DELETE
  USING (can_access_site(site_id));

-- =====================================================
-- 4. Create material_purchase_expense_items table
-- =====================================================

CREATE TABLE IF NOT EXISTS material_purchase_expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_expense_id UUID NOT NULL REFERENCES material_purchase_expenses(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_material_purchase_expense_items_purchase_id ON material_purchase_expense_items(purchase_expense_id);
CREATE INDEX IF NOT EXISTS idx_material_purchase_expense_items_material_id ON material_purchase_expense_items(material_id);

-- Enable RLS
ALTER TABLE material_purchase_expense_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (inherit from parent via site access)
CREATE POLICY "Users can view items for accessible purchases"
  ON material_purchase_expense_items FOR SELECT
  USING (purchase_expense_id IN (
    SELECT id FROM material_purchase_expenses WHERE can_access_site(site_id)
  ));

CREATE POLICY "Users can insert items for accessible purchases"
  ON material_purchase_expense_items FOR INSERT
  WITH CHECK (purchase_expense_id IN (
    SELECT id FROM material_purchase_expenses WHERE can_access_site(site_id)
  ));

CREATE POLICY "Users can update items for accessible purchases"
  ON material_purchase_expense_items FOR UPDATE
  USING (purchase_expense_id IN (
    SELECT id FROM material_purchase_expenses WHERE can_access_site(site_id)
  ));

CREATE POLICY "Users can delete items for accessible purchases"
  ON material_purchase_expense_items FOR DELETE
  USING (purchase_expense_id IN (
    SELECT id FROM material_purchase_expenses WHERE can_access_site(site_id)
  ));

-- =====================================================
-- 5. Reference Code Generation Functions
-- =====================================================

-- For own-site material purchases: MAT-YYMMDD-XXXX
CREATE OR REPLACE FUNCTION generate_material_purchase_reference(p_site_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_date_part TEXT;
  v_random_part TEXT;
  v_ref_code TEXT;
  v_attempts INT := 0;
BEGIN
  v_date_part := to_char(CURRENT_DATE, 'YYMMDD');

  LOOP
    v_random_part := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
    v_ref_code := 'MAT-' || v_date_part || '-' || v_random_part;

    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM material_purchase_expenses WHERE ref_code = v_ref_code) THEN
      RETURN v_ref_code;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique reference code after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- For group stock purchases: GSP-YYMMDD-XXXX
CREATE OR REPLACE FUNCTION generate_group_stock_purchase_reference(p_site_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_date_part TEXT;
  v_random_part TEXT;
  v_ref_code TEXT;
  v_attempts INT := 0;
BEGIN
  v_date_part := to_char(CURRENT_DATE, 'YYMMDD');

  LOOP
    v_random_part := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
    v_ref_code := 'GSP-' || v_date_part || '-' || v_random_part;

    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM material_purchase_expenses WHERE ref_code = v_ref_code) THEN
      RETURN v_ref_code;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique reference code after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Batch Completion Function
-- =====================================================

CREATE OR REPLACE FUNCTION complete_group_stock_batch(
  p_batch_code TEXT,
  p_site_allocations JSONB -- [{"site_id": "xxx", "amount": 5000, "usage_percent": 50}]
)
RETURNS TABLE(child_ref_codes TEXT[]) AS $$
DECLARE
  v_allocation JSONB;
  v_purchase RECORD;
  v_child_ref TEXT;
  v_child_refs TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Get original purchase
  SELECT * INTO v_purchase FROM material_purchase_expenses
  WHERE ref_code = p_batch_code AND purchase_type = 'group_stock';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group purchase not found: %', p_batch_code;
  END IF;

  IF v_purchase.status = 'completed' THEN
    RAISE EXCEPTION 'Batch already completed: %', p_batch_code;
  END IF;

  -- Create expense for each site based on usage
  FOR v_allocation IN SELECT * FROM jsonb_array_elements(p_site_allocations) LOOP
    -- Generate child ref code
    v_child_ref := p_batch_code || '-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 3));

    -- Insert child expense record
    INSERT INTO material_purchase_expenses (
      site_id, ref_code, purchase_type, vendor_id, vendor_name, purchase_date,
      total_amount, transport_cost, payment_mode, bill_url, status, original_batch_code,
      site_group_id, notes, created_by
    ) VALUES (
      (v_allocation->>'site_id')::UUID,
      v_child_ref,
      'own_site',
      v_purchase.vendor_id,
      v_purchase.vendor_name,
      v_purchase.purchase_date,
      (v_allocation->>'amount')::NUMERIC,
      0, -- Transport already included in amount
      v_purchase.payment_mode,
      v_purchase.bill_url,
      'completed',
      p_batch_code,
      v_purchase.site_group_id,
      format('Allocated from group purchase %s (%s%%)', p_batch_code, v_allocation->>'usage_percent'),
      v_purchase.created_by
    );

    v_child_refs := array_append(v_child_refs, v_child_ref);
  END LOOP;

  -- Mark parent as completed
  UPDATE material_purchase_expenses
  SET status = 'completed', updated_at = now()
  WHERE ref_code = p_batch_code;

  -- Update related group_stock_transactions
  UPDATE group_stock_transactions
  SET batch_status = 'completed'
  WHERE batch_code = p_batch_code;

  -- Update group_stock_inventory
  UPDATE group_stock_inventory
  SET batch_status = 'completed'
  WHERE batch_code = p_batch_code;

  RETURN QUERY SELECT v_child_refs;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Convert Group to Own Site Function
-- =====================================================

CREATE OR REPLACE FUNCTION convert_group_to_own_site(
  p_batch_code TEXT,
  p_target_site_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_purchase RECORD;
  v_new_ref TEXT;
BEGIN
  -- Get original purchase
  SELECT * INTO v_purchase FROM material_purchase_expenses
  WHERE ref_code = p_batch_code AND purchase_type = 'group_stock';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group purchase not found: %', p_batch_code;
  END IF;

  IF v_purchase.status IN ('completed', 'converted') THEN
    RAISE EXCEPTION 'Cannot convert batch with status: %', v_purchase.status;
  END IF;

  -- Generate new ref code for own site
  v_new_ref := generate_material_purchase_reference(p_target_site_id);

  -- Update the record to own_site type
  UPDATE material_purchase_expenses SET
    site_id = p_target_site_id,
    ref_code = v_new_ref,
    purchase_type = 'own_site',
    converted_from_group = true,
    original_batch_code = p_batch_code,
    status = 'completed',
    notes = COALESCE(notes, '') || format(' [Converted from group purchase %s]', p_batch_code),
    updated_at = now()
  WHERE ref_code = p_batch_code;

  -- Update group_stock_transactions status
  UPDATE group_stock_transactions
  SET batch_status = 'converted'
  WHERE batch_code = p_batch_code;

  -- Update group_stock_inventory status
  UPDATE group_stock_inventory
  SET batch_status = 'converted'
  WHERE batch_code = p_batch_code;

  RETURN v_new_ref;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Updated Trigger for updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_material_purchase_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_material_purchase_expenses_updated_at_trigger ON material_purchase_expenses;
CREATE TRIGGER update_material_purchase_expenses_updated_at_trigger
  BEFORE UPDATE ON material_purchase_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_material_purchase_expenses_updated_at();

-- =====================================================
-- 9. Grant permissions
-- =====================================================

GRANT ALL ON material_purchase_expenses TO authenticated;
GRANT ALL ON material_purchase_expense_items TO authenticated;
GRANT EXECUTE ON FUNCTION generate_material_purchase_reference TO authenticated;
GRANT EXECUTE ON FUNCTION generate_group_stock_purchase_reference TO authenticated;
GRANT EXECUTE ON FUNCTION complete_group_stock_batch TO authenticated;
GRANT EXECUTE ON FUNCTION convert_group_to_own_site TO authenticated;

-- =====================================================
-- 10. Add comment for documentation
-- =====================================================

COMMENT ON TABLE material_purchase_expenses IS
'Material purchase expense tracking. Own-site purchases (MAT-*) are direct expenses.
Group stock purchases (GSP-*) track shared material with lifecycle: in_stock -> partial_used -> completed/converted.
Should be added to v_all_expenses view for unified expense reporting.';
