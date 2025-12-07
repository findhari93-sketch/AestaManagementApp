-- =====================================================
-- TEA SHOP FIX: Add ALL missing columns
-- =====================================================
-- Run this migration in Supabase SQL Editor to fix the
-- "Could not find the 'snacks_items' column" error
-- =====================================================

-- =====================================================
-- STEP 1: Fix tea_shop_entries table
-- =====================================================

-- Add tea tracking columns
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS tea_rounds INTEGER DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS tea_people_count INTEGER DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS tea_rate_per_round DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS tea_total DECIMAL(10,2) DEFAULT 0;

-- Add snacks tracking columns (THIS IS THE MISSING ONE!)
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS snacks_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS snacks_total DECIMAL(10,2) DEFAULT 0;

-- Add total amount column
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;

-- Add updated_at for tracking modifications
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Change entered_by to TEXT (code sends user name as string)
ALTER TABLE tea_shop_entries DROP CONSTRAINT IF EXISTS tea_shop_entries_entered_by_fkey;
DO $$
BEGIN
  -- Only alter if column is UUID type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tea_shop_entries'
    AND column_name = 'entered_by'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE tea_shop_entries ALTER COLUMN entered_by TYPE TEXT USING entered_by::TEXT;
  END IF;
END $$;

-- =====================================================
-- STEP 2: Fix tea_shop_consumption_details table
-- =====================================================

-- Add is_working column (code uses this to distinguish working vs non-working laborers)
ALTER TABLE tea_shop_consumption_details ADD COLUMN IF NOT EXISTS is_working BOOLEAN DEFAULT true;

-- Add updated_at
ALTER TABLE tea_shop_consumption_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- =====================================================
-- STEP 3: Create/update triggers
-- =====================================================

-- Trigger for tea_shop_entries updated_at
CREATE OR REPLACE FUNCTION update_tea_shop_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tea_shop_entries_updated_at ON tea_shop_entries;
CREATE TRIGGER trigger_tea_shop_entries_updated_at
  BEFORE UPDATE ON tea_shop_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_tea_shop_entries_updated_at();

-- Trigger for consumption details updated_at
CREATE OR REPLACE FUNCTION update_tea_shop_consumption_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tea_shop_consumption_updated_at ON tea_shop_consumption_details;
CREATE TRIGGER trigger_tea_shop_consumption_updated_at
  BEFORE UPDATE ON tea_shop_consumption_details
  FOR EACH ROW
  EXECUTE FUNCTION update_tea_shop_consumption_updated_at();

-- =====================================================
-- STEP 4: Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tea_shop_consumption_laborer ON tea_shop_consumption_details(laborer_id);
CREATE INDEX IF NOT EXISTS idx_tea_shop_consumption_entry ON tea_shop_consumption_details(entry_id);

-- =====================================================
-- STEP 5: Add column comments
-- =====================================================
COMMENT ON COLUMN tea_shop_entries.tea_rounds IS 'Number of tea rounds';
COMMENT ON COLUMN tea_shop_entries.tea_people_count IS 'Total number of people who had tea';
COMMENT ON COLUMN tea_shop_entries.tea_rate_per_round IS 'Cost per round of tea';
COMMENT ON COLUMN tea_shop_entries.tea_total IS 'Total tea cost (rounds * rate)';
COMMENT ON COLUMN tea_shop_entries.snacks_items IS 'JSON array of snack items [{name, quantity, rate, total}]';
COMMENT ON COLUMN tea_shop_entries.snacks_total IS 'Total snacks cost';
COMMENT ON COLUMN tea_shop_entries.total_amount IS 'Grand total (tea + snacks)';
COMMENT ON COLUMN tea_shop_entries.entered_by IS 'Name of user who entered this record';
COMMENT ON COLUMN tea_shop_consumption_details.is_working IS 'true = laborer was working that day, false = on leave but consumed';

-- =====================================================
-- VERIFICATION: Check the updated structure
-- =====================================================
SELECT 'tea_shop_entries columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tea_shop_entries'
ORDER BY ordinal_position;

SELECT 'tea_shop_consumption_details columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tea_shop_consumption_details'
ORDER BY ordinal_position;
