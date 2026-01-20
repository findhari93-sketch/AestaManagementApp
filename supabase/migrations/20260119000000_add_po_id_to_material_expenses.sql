-- Add purchase_order_id to link material purchase expenses to purchase orders
-- This enables cascade delete: when a PO is deleted, the associated expense is also deleted

-- Add purchase_order_id column with ON DELETE CASCADE
ALTER TABLE material_purchase_expenses
ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_po_id
ON material_purchase_expenses(purchase_order_id);

-- Comment for documentation
COMMENT ON COLUMN material_purchase_expenses.purchase_order_id IS 'Links to purchase_orders for cascade delete. When PO is deleted, expense is automatically deleted.';
