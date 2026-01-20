-- Migration: Add missing settlement columns to material_purchase_expenses
-- Purpose: Support the settlement workflow with date, reference, and payer tracking

-- Add settlement_date column
ALTER TABLE material_purchase_expenses
ADD COLUMN IF NOT EXISTS settlement_date DATE;

-- Add settlement_reference column (unique identifier for settlement)
ALTER TABLE material_purchase_expenses
ADD COLUMN IF NOT EXISTS settlement_reference TEXT;

-- Add settlement_payer_source column (who paid: own, amma, client, trust, site, other)
ALTER TABLE material_purchase_expenses
ADD COLUMN IF NOT EXISTS settlement_payer_source TEXT;

-- Add settlement_payer_name column (name if payer is 'other')
ALTER TABLE material_purchase_expenses
ADD COLUMN IF NOT EXISTS settlement_payer_name TEXT;

-- Add index for settlement queries
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_settlement_date
ON material_purchase_expenses(settlement_date);

CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_settlement_reference
ON material_purchase_expenses(settlement_reference);

-- Add comment
COMMENT ON COLUMN material_purchase_expenses.settlement_date IS 'Date when the purchase was settled/paid';
COMMENT ON COLUMN material_purchase_expenses.settlement_reference IS 'Unique reference code for the settlement (e.g., PSET-XXXXXXXX)';
COMMENT ON COLUMN material_purchase_expenses.settlement_payer_source IS 'Source of payment: own, amma, client, trust, site, other';
COMMENT ON COLUMN material_purchase_expenses.settlement_payer_name IS 'Name of payer when settlement_payer_source is other';
