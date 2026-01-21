-- Migration: Add amount_paid column for bargaining support
-- Purpose: Allow recording the actual amount paid after bargaining, which may differ from the original total_amount

-- Add amount_paid column to material_purchase_expenses
ALTER TABLE material_purchase_expenses
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2);

-- Add comment
COMMENT ON COLUMN material_purchase_expenses.amount_paid IS 'Actual amount paid after bargaining. May differ from total_amount due to negotiations. NULL means amount_paid equals total_amount.';

-- Add index for queries that filter by payment status
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_amount_paid
ON material_purchase_expenses(amount_paid) WHERE amount_paid IS NOT NULL;
