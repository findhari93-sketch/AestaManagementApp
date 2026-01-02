-- =====================================================
-- Add Payment Source to Tea Shop Settlements
-- =====================================================
-- Adds payer_source and payer_name columns to tea_shop_settlements
-- to track where the money came from (Trust, Amma, Own Money, etc.)
-- Consistent with salary settlement payment sources
-- =====================================================

-- Add payer_source column
ALTER TABLE tea_shop_settlements ADD COLUMN IF NOT EXISTS payer_source TEXT;

-- Add payer_name column for custom/other_site_money sources
ALTER TABLE tea_shop_settlements ADD COLUMN IF NOT EXISTS payer_name TEXT;

-- Add constraint for valid payer_source values (same as salary settlements)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tea_shop_settlements_payer_source_check'
  ) THEN
    ALTER TABLE tea_shop_settlements ADD CONSTRAINT tea_shop_settlements_payer_source_check
      CHECK (payer_source IS NULL OR payer_source IN ('own_money', 'amma_money', 'client_money', 'other_site_money', 'custom', 'mothers_money', 'trust_account'));
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'tea_shop_settlements' AND column_name IN ('payer_source', 'payer_name');
