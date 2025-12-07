-- =====================================================
-- TEA SHOP & SNACKS TRACKING SYSTEM
-- =====================================================
-- This migration creates tables for:
-- 1. Tea shop accounts (per-site shop management)
-- 2. Daily tea/snacks entries
-- 3. Per-person consumption details (optional)
-- 4. Settlement/clearance tracking
-- =====================================================

-- =====================================================
-- PART 1: Tea Shop Accounts (per-site shop management)
-- =====================================================

CREATE TABLE IF NOT EXISTS tea_shop_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  shop_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by site
CREATE INDEX IF NOT EXISTS idx_tea_shop_accounts_site ON tea_shop_accounts(site_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_tea_shop_accounts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tea_shop_accounts_updated_at ON tea_shop_accounts;
CREATE TRIGGER tea_shop_accounts_updated_at
  BEFORE UPDATE ON tea_shop_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_tea_shop_accounts_timestamp();

-- =====================================================
-- PART 2: Tea Shop Entries (daily purchases)
-- =====================================================

CREATE TABLE IF NOT EXISTS tea_shop_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tea_shop_id UUID NOT NULL REFERENCES tea_shop_accounts(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Tea details
  tea_rounds INTEGER DEFAULT 0,
  tea_people_count INTEGER DEFAULT 0,
  tea_rate_per_round DECIMAL(10,2) DEFAULT 0,
  tea_total DECIMAL(10,2) DEFAULT 0,

  -- Snacks details (JSON array of {name, quantity, rate, total})
  snacks_items JSONB DEFAULT '[]',
  snacks_total DECIMAL(10,2) DEFAULT 0,

  -- Total
  total_amount DECIMAL(10,2) NOT NULL,

  -- On account = shop notebook entry (to be settled later)
  -- Not on account = paid immediately (cash/UPI at time of purchase)
  is_on_account BOOLEAN DEFAULT true,

  -- Audit fields
  notes TEXT,
  entered_by VARCHAR(255),
  entered_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tea_shop_entries_shop_date ON tea_shop_entries(tea_shop_id, date);
CREATE INDEX IF NOT EXISTS idx_tea_shop_entries_site_date ON tea_shop_entries(site_id, date);
CREATE INDEX IF NOT EXISTS idx_tea_shop_entries_date ON tea_shop_entries(date);

-- =====================================================
-- PART 3: Tea Shop Consumption Details (optional per-person tracking)
-- =====================================================
-- This table allows detailed tracking of who consumed what
-- Useful for verifying when a day's expense is higher than usual

CREATE TABLE IF NOT EXISTS tea_shop_consumption_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES tea_shop_entries(id) ON DELETE CASCADE,
  laborer_id UUID REFERENCES laborers(id) ON DELETE SET NULL,
  laborer_name VARCHAR(255),  -- For market laborers or manual entry
  laborer_type VARCHAR(50),   -- contract, daily, market

  tea_rounds INTEGER DEFAULT 0,
  tea_amount DECIMAL(10,2) DEFAULT 0,
  snacks_items JSONB DEFAULT '{}',  -- {vada: 2, bajji: 1}
  snacks_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by entry
CREATE INDEX IF NOT EXISTS idx_tea_shop_consumption_entry ON tea_shop_consumption_details(entry_id);

-- =====================================================
-- PART 4: Tea Shop Settlements (payment tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS tea_shop_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tea_shop_id UUID NOT NULL REFERENCES tea_shop_accounts(id) ON DELETE CASCADE,

  -- Period covered by this settlement
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Amounts
  entries_total DECIMAL(12,2) NOT NULL,      -- Total from entries in this period
  previous_balance DECIMAL(12,2) DEFAULT 0,  -- Carried forward from previous settlement
  total_due DECIMAL(12,2) NOT NULL,          -- entries_total + previous_balance
  amount_paid DECIMAL(12,2) NOT NULL,        -- Amount paid in this settlement
  balance_remaining DECIMAL(12,2) DEFAULT 0, -- Carries to next settlement

  -- Payment details
  payment_date DATE NOT NULL,
  payment_mode VARCHAR(50) NOT NULL,  -- cash, upi, bank_transfer

  -- Who paid?
  payer_type VARCHAR(50) NOT NULL,  -- 'site_engineer' or 'company_direct'

  -- Site Engineer integration (if payer_type = 'site_engineer')
  site_engineer_id UUID REFERENCES users(id),
  site_engineer_transaction_id UUID,  -- Link to site_engineer_transactions table
  is_engineer_settled BOOLEAN DEFAULT false,  -- Has company reimbursed the engineer?

  -- Status
  status VARCHAR(50) DEFAULT 'completed',  -- completed, partial

  -- Audit fields
  notes TEXT,
  recorded_by VARCHAR(255),
  recorded_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tea_shop_settlements_shop ON tea_shop_settlements(tea_shop_id);
CREATE INDEX IF NOT EXISTS idx_tea_shop_settlements_date ON tea_shop_settlements(payment_date);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_tea_shop_settlements_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tea_shop_settlements_updated_at ON tea_shop_settlements;
CREATE TRIGGER tea_shop_settlements_updated_at
  BEFORE UPDATE ON tea_shop_settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_tea_shop_settlements_timestamp();

-- =====================================================
-- PART 5: Enable Row Level Security (RLS)
-- =====================================================

ALTER TABLE tea_shop_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tea_shop_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tea_shop_consumption_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE tea_shop_settlements ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (full access)
CREATE POLICY "Users can view tea shop accounts"
  ON tea_shop_accounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert tea shop accounts"
  ON tea_shop_accounts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update tea shop accounts"
  ON tea_shop_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete tea shop accounts"
  ON tea_shop_accounts FOR DELETE TO authenticated USING (true);

-- Entries policies
CREATE POLICY "Users can view tea shop entries"
  ON tea_shop_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert tea shop entries"
  ON tea_shop_entries FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update tea shop entries"
  ON tea_shop_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete tea shop entries"
  ON tea_shop_entries FOR DELETE TO authenticated USING (true);

-- Consumption details policies
CREATE POLICY "Users can view consumption details"
  ON tea_shop_consumption_details FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert consumption details"
  ON tea_shop_consumption_details FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update consumption details"
  ON tea_shop_consumption_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete consumption details"
  ON tea_shop_consumption_details FOR DELETE TO authenticated USING (true);

-- Settlements policies
CREATE POLICY "Users can view tea shop settlements"
  ON tea_shop_settlements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert tea shop settlements"
  ON tea_shop_settlements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update tea shop settlements"
  ON tea_shop_settlements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete tea shop settlements"
  ON tea_shop_settlements FOR DELETE TO authenticated USING (true);

-- =====================================================
-- VERIFICATION QUERIES (run after migration)
-- =====================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tea_shop_accounts';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tea_shop_entries';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tea_shop_consumption_details';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tea_shop_settlements';
