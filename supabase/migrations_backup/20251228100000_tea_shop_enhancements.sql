-- Migration: Tea Shop Feature Enhancements
-- 1. Convert all detailed entries to simple mode
-- 2. Add QR code and UPI ID to tea shop accounts
-- 3. Add settlement reference and waterfall tracking

-- ============================================================
-- Part 1: Convert existing detailed entries to simple mode
-- ============================================================

-- Update all detailed entries to simple mode (preserve totals)
UPDATE tea_shop_entries
SET
  entry_mode = 'simple',
  simple_total_cost = COALESCE(simple_total_cost, total_amount, 0),
  percentage_split = COALESCE(percentage_split, '{"daily": 40, "contract": 35, "market": 25}'::jsonb)
WHERE entry_mode = 'detailed' OR entry_mode IS NULL;

-- Add deprecation comments to detailed-mode columns (data preserved for audit)
COMMENT ON COLUMN tea_shop_entries.tea_rounds IS 'DEPRECATED: Only used in detailed mode. Data preserved for historical records.';
COMMENT ON COLUMN tea_shop_entries.tea_rate_per_round IS 'DEPRECATED: Only used in detailed mode. Data preserved for historical records.';
COMMENT ON COLUMN tea_shop_entries.snacks_items IS 'DEPRECATED: Only used in detailed mode. Data preserved for historical records.';
COMMENT ON TABLE tea_shop_consumption_details IS 'DEPRECATED: Per-laborer consumption tracking. Data preserved for historical records. No longer created for new entries.';

-- ============================================================
-- Part 2: Add QR code and UPI ID to tea shop accounts
-- ============================================================

-- Add UPI ID column
ALTER TABLE tea_shop_accounts
ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);

-- Add QR code URL column
ALTER TABLE tea_shop_accounts
ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

COMMENT ON COLUMN tea_shop_accounts.upi_id IS 'UPI ID for the tea shop vendor (e.g., shopname@upi)';
COMMENT ON COLUMN tea_shop_accounts.qr_code_url IS 'URL to the payment QR code image stored in Supabase Storage';

-- ============================================================
-- Part 3: Add settlement reference and waterfall tracking
-- ============================================================

-- Add settlement reference to tea_shop_settlements
ALTER TABLE tea_shop_settlements
ADD COLUMN IF NOT EXISTS settlement_reference VARCHAR(50);

-- Add payment tracking to entries for waterfall model
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;

ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS is_fully_paid BOOLEAN DEFAULT false;

-- Initialize amount_paid based on existing settlements
-- (This needs to be done manually or via a script if there are existing settlements)

COMMENT ON COLUMN tea_shop_settlements.settlement_reference IS 'Unique settlement reference code (e.g., TSS-251228-001)';
COMMENT ON COLUMN tea_shop_entries.amount_paid IS 'Total amount paid towards this entry via settlements';
COMMENT ON COLUMN tea_shop_entries.is_fully_paid IS 'True if the entry has been fully paid via settlements';

-- Create allocation tracking table
CREATE TABLE IF NOT EXISTS tea_shop_settlement_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES tea_shop_settlements(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES tea_shop_entries(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(settlement_id, entry_id)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tea_shop_settlement_allocations_settlement
ON tea_shop_settlement_allocations(settlement_id);

CREATE INDEX IF NOT EXISTS idx_tea_shop_settlement_allocations_entry
ON tea_shop_settlement_allocations(entry_id);

CREATE INDEX IF NOT EXISTS idx_tea_shop_entries_is_fully_paid
ON tea_shop_entries(is_fully_paid)
WHERE is_fully_paid = false;

COMMENT ON TABLE tea_shop_settlement_allocations IS 'Tracks how each settlement payment is allocated across tea shop entries (waterfall model)';

-- Function to generate tea shop settlement reference (TSS-YYMMDD-001 format)
CREATE OR REPLACE FUNCTION generate_tea_shop_settlement_reference()
RETURNS TEXT AS $$
DECLARE
  ref TEXT;
  counter INT;
  date_str TEXT;
BEGIN
  date_str := TO_CHAR(NOW(), 'YYMMDD');

  -- Count settlements created today
  SELECT COUNT(*) + 1 INTO counter
  FROM tea_shop_settlements
  WHERE DATE(created_at) = CURRENT_DATE
    AND settlement_reference IS NOT NULL
    AND settlement_reference LIKE 'TSS-' || date_str || '-%';

  -- Generate reference with zero-padded counter
  ref := 'TSS-' || date_str || '-' || LPAD(counter::TEXT, 3, '0');

  RETURN ref;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_tea_shop_settlement_reference() IS 'Generates unique settlement reference in TSS-YYMMDD-NNN format';

-- ============================================================
-- Part 4: Initialize waterfall tracking for existing entries
-- ============================================================

-- Mark entries as fully paid if they are older than oldest settlement period_start
-- This is a simplified approach - in practice, you may need to run a script
-- to properly calculate amount_paid based on existing settlements

-- For now, we'll leave amount_paid=0 and is_fully_paid=false for all entries
-- The settlement dialog will calculate pending amounts correctly

-- Grant necessary permissions (if using RLS)
-- These may need adjustment based on your RLS policy setup
