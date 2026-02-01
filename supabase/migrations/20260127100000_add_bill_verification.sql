-- Migration: Add bill verification columns to purchase_orders
-- Purpose: Track vendor bill uploads and verification status before settlement

-- Add bill verification columns to purchase_orders
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS vendor_bill_url TEXT,
ADD COLUMN IF NOT EXISTS bill_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bill_verified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS bill_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bill_verification_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN purchase_orders.vendor_bill_url IS 'URL to the original vendor bill/invoice uploaded for this PO';
COMMENT ON COLUMN purchase_orders.bill_verified IS 'Whether the vendor bill has been verified against PO details';
COMMENT ON COLUMN purchase_orders.bill_verified_by IS 'User who verified the bill';
COMMENT ON COLUMN purchase_orders.bill_verified_at IS 'Timestamp when bill was verified';
COMMENT ON COLUMN purchase_orders.bill_verification_notes IS 'Notes from bill verification process (discrepancies, etc.)';

-- Index for filtering unverified POs that have bills (for verification dashboard)
CREATE INDEX IF NOT EXISTS idx_po_bill_unverified
ON purchase_orders(site_id, bill_verified)
WHERE vendor_bill_url IS NOT NULL AND bill_verified = FALSE;

-- Index for quick lookup of verified POs
CREATE INDEX IF NOT EXISTS idx_po_bill_verified_at
ON purchase_orders(bill_verified_at DESC)
WHERE bill_verified = TRUE;
