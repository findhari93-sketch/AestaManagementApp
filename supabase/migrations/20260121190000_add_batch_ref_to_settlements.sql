-- Migration: Add batch_ref_code to inter_site_material_settlements
-- Purpose: Link settlements to specific batches for better tracking and dialog opening
-- Date: 2026-01-21

-- Add batch_ref_code column to inter_site_material_settlements table
ALTER TABLE inter_site_material_settlements
ADD COLUMN IF NOT EXISTS batch_ref_code TEXT;

-- Add foreign key constraint to material_purchase_expenses(ref_code)
ALTER TABLE inter_site_material_settlements
ADD CONSTRAINT fk_inter_site_settlements_batch
FOREIGN KEY (batch_ref_code)
REFERENCES material_purchase_expenses(ref_code)
ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_inter_site_settlements_batch
ON inter_site_material_settlements(batch_ref_code);

-- Add comment for documentation
COMMENT ON COLUMN inter_site_material_settlements.batch_ref_code IS 'Reference to the batch (material_purchase_expense) that this settlement is for. Required for opening correct settlement dialog from Pending Settlements tab.';
