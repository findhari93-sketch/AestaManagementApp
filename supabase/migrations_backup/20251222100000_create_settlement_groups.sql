-- Migration: Create settlement_groups table and reference generator
-- Purpose: Single source of truth for salary settlements with unique reference codes

-- ============================================================================
-- 1. Create settlement_groups table
-- ============================================================================
CREATE TABLE IF NOT EXISTS settlement_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_reference TEXT NOT NULL UNIQUE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  settlement_date DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  laborer_count INT NOT NULL DEFAULT 0,
  payment_channel TEXT NOT NULL CHECK (payment_channel IN ('direct', 'engineer_wallet')),
  payment_mode TEXT,
  payer_source TEXT,
  payer_name TEXT,
  proof_url TEXT,
  notes TEXT,
  subcontract_id UUID REFERENCES subcontracts(id) ON DELETE SET NULL,
  engineer_transaction_id UUID REFERENCES site_engineer_transactions(id) ON DELETE SET NULL,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  cancelled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT
);

-- Add comments for documentation
COMMENT ON TABLE settlement_groups IS 'Single source of truth for salary settlements - groups attendance records into one settlement';
COMMENT ON COLUMN settlement_groups.settlement_reference IS 'Unique human-readable reference code (SET-YYYYMM-NNN format)';
COMMENT ON COLUMN settlement_groups.payment_channel IS 'How payment was made: direct (company pays) or engineer_wallet (via engineer)';
COMMENT ON COLUMN settlement_groups.payer_source IS 'Source of money: own_money, client_money, custom, etc.';

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================
CREATE INDEX idx_settlement_groups_reference ON settlement_groups(settlement_reference);
CREATE INDEX idx_settlement_groups_site_date ON settlement_groups(site_id, settlement_date DESC);
CREATE INDEX idx_settlement_groups_site_id ON settlement_groups(site_id);
CREATE INDEX idx_settlement_groups_engineer_tx ON settlement_groups(engineer_transaction_id) WHERE engineer_transaction_id IS NOT NULL;
CREATE INDEX idx_settlement_groups_subcontract ON settlement_groups(subcontract_id) WHERE subcontract_id IS NOT NULL;
CREATE INDEX idx_settlement_groups_not_cancelled ON settlement_groups(site_id, settlement_date) WHERE is_cancelled = false;

-- ============================================================================
-- 3. Add settlement_group_id to attendance tables
-- ============================================================================
ALTER TABLE daily_attendance
ADD COLUMN IF NOT EXISTS settlement_group_id UUID REFERENCES settlement_groups(id) ON DELETE SET NULL;

ALTER TABLE market_laborer_attendance
ADD COLUMN IF NOT EXISTS settlement_group_id UUID REFERENCES settlement_groups(id) ON DELETE SET NULL;

-- Add indexes for the new FK columns
CREATE INDEX IF NOT EXISTS idx_daily_attendance_settlement_group
ON daily_attendance(settlement_group_id) WHERE settlement_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_attendance_settlement_group
ON market_laborer_attendance(settlement_group_id) WHERE settlement_group_id IS NOT NULL;

-- ============================================================================
-- 4. Create function to generate unique settlement reference
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_settlement_reference(p_site_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year_month TEXT;
  v_next_seq INT;
  v_reference TEXT;
BEGIN
  -- Get current year-month in YYYYMM format
  v_year_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');

  -- Find the next sequence number for this site and month
  -- Extract the number from existing references like SET-202412-001
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(settlement_reference FROM 'SET-' || v_year_month || '-(\d+)')
      AS INT
    )
  ), 0) + 1
  INTO v_next_seq
  FROM settlement_groups
  WHERE site_id = p_site_id
    AND settlement_reference LIKE 'SET-' || v_year_month || '-%';

  -- Format: SET-YYYYMM-NNN (padded to 3 digits)
  v_reference := 'SET-' || v_year_month || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_reference;
END;
$$;

COMMENT ON FUNCTION generate_settlement_reference IS 'Generates unique settlement reference in SET-YYYYMM-NNN format, auto-incrementing per site per month';

-- ============================================================================
-- 5. Create updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_settlement_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_settlement_groups_updated_at
  BEFORE UPDATE ON settlement_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_settlement_groups_updated_at();

-- ============================================================================
-- 6. Enable RLS on settlement_groups
-- ============================================================================
ALTER TABLE settlement_groups ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all settlement_groups
CREATE POLICY "Allow authenticated read settlement_groups"
ON settlement_groups FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to insert settlement_groups
CREATE POLICY "Allow authenticated insert settlement_groups"
ON settlement_groups FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users to update settlement_groups
CREATE POLICY "Allow authenticated update settlement_groups"
ON settlement_groups FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to delete settlement_groups (soft delete preferred)
CREATE POLICY "Allow authenticated delete settlement_groups"
ON settlement_groups FOR DELETE
TO authenticated
USING (true);
