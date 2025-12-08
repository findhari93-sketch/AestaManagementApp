-- Migration: Add Payment Linking Support
-- Purpose: Enable linking tea shop settlements to subcontracts
-- Date: 2025-12-08

-- ============================================
-- STEP 1: Add subcontract_id column to tea_shop_settlements
-- Run this first:
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tea_shop_settlements'
    AND column_name = 'subcontract_id'
  ) THEN
    ALTER TABLE tea_shop_settlements
    ADD COLUMN subcontract_id UUID REFERENCES subcontracts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- STEP 2: Create index on tea_shop_settlements.subcontract_id
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tea_shop_settlements_subcontract_id
ON tea_shop_settlements(subcontract_id);

-- ============================================
-- STEP 3: Create index on expenses.subcontract_id (if not exists)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expenses_subcontract_id
ON expenses(subcontract_id);

-- ============================================
-- VERIFICATION: Run this after to confirm success
-- ============================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'tea_shop_settlements' AND column_name = 'subcontract_id';
