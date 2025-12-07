-- =====================================================
-- TEA SHOP V2: Consumption Tracking by Category
-- =====================================================
-- This migration adds support for tracking consumption by:
-- 1. Working laborers (individual tracking)
-- 2. Non-working laborers (individual tracking)
-- 3. Market laborers (group total only)

-- 1. Add new columns to tea_shop_entries for category tracking
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS market_laborer_count INTEGER DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS market_laborer_tea_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS market_laborer_snacks_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS market_laborer_total DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS nonworking_laborer_count INTEGER DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS nonworking_laborer_total DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS working_laborer_count INTEGER DEFAULT 0;
ALTER TABLE tea_shop_entries ADD COLUMN IF NOT EXISTS working_laborer_total DECIMAL(10,2) DEFAULT 0;

-- 2. Add is_working flag to consumption_details to distinguish working vs non-working
ALTER TABLE tea_shop_consumption_details ADD COLUMN IF NOT EXISTS is_working BOOLEAN DEFAULT true;

-- 3. Add index for faster lookups by laborer
CREATE INDEX IF NOT EXISTS idx_tea_shop_consumption_laborer ON tea_shop_consumption_details(laborer_id);
CREATE INDEX IF NOT EXISTS idx_tea_shop_consumption_entry ON tea_shop_consumption_details(entry_id);

-- 4. Add updated_at to consumption_details for tracking changes
ALTER TABLE tea_shop_consumption_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. Create trigger to auto-update updated_at
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

-- 6. Add comments for documentation
COMMENT ON COLUMN tea_shop_entries.market_laborer_count IS 'Number of market laborers who consumed (anonymous group)';
COMMENT ON COLUMN tea_shop_entries.market_laborer_total IS 'Total tea+snacks amount for market laborers as a group';
COMMENT ON COLUMN tea_shop_entries.nonworking_laborer_total IS 'Total for laborers not working that day but consumed';
COMMENT ON COLUMN tea_shop_entries.working_laborer_total IS 'Total for laborers who worked that day and consumed';
COMMENT ON COLUMN tea_shop_consumption_details.is_working IS 'true = laborer was working that day, false = on leave but consumed';
