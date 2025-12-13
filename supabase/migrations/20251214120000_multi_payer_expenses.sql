-- Migration: Multi-Payer Expense Tracking
-- Description: Add support for tracking multiple external payers for site expenses

-- ============================================
-- 1. Create site_payers table
-- ============================================
CREATE TABLE IF NOT EXISTS site_payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_site_payer_name UNIQUE(site_id, name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_payers_site_id ON site_payers(site_id);
CREATE INDEX IF NOT EXISTS idx_site_payers_active ON site_payers(site_id, is_active);

-- Enable RLS
ALTER TABLE site_payers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for site_payers
CREATE POLICY "Users can view payers for sites they have access to" ON site_payers
  FOR SELECT
  USING (true);

CREATE POLICY "Admins and site engineers can manage payers" ON site_payers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'office', 'site_engineer')
    )
  );

-- ============================================
-- 2. Add has_multiple_payers to sites table
-- ============================================
ALTER TABLE sites ADD COLUMN IF NOT EXISTS has_multiple_payers BOOLEAN DEFAULT false;

-- ============================================
-- 3. Add site_payer_id to expenses table
-- ============================================
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS site_payer_id UUID REFERENCES site_payers(id);

-- Create index for expense lookups by payer
CREATE INDEX IF NOT EXISTS idx_expenses_site_payer_id ON expenses(site_payer_id);

-- ============================================
-- 4. Create view for payer expense summary
-- ============================================
CREATE OR REPLACE VIEW payer_expense_summary AS
SELECT
  sp.id as payer_id,
  sp.name as payer_name,
  sp.site_id,
  sp.phone,
  sp.is_active,
  COUNT(e.id) as expense_count,
  COALESCE(SUM(e.amount), 0) as total_amount,
  MIN(e.date) as first_expense_date,
  MAX(e.date) as last_expense_date
FROM site_payers sp
LEFT JOIN expenses e ON e.site_payer_id = sp.id AND e.is_deleted = false
GROUP BY sp.id, sp.name, sp.site_id, sp.phone, sp.is_active;

-- Grant access to the view
GRANT SELECT ON payer_expense_summary TO authenticated;

-- ============================================
-- 5. Add trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_site_payers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_site_payers_updated_at ON site_payers;
CREATE TRIGGER trigger_site_payers_updated_at
  BEFORE UPDATE ON site_payers
  FOR EACH ROW
  EXECUTE FUNCTION update_site_payers_updated_at();
