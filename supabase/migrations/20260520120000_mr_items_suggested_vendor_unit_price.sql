-- Carry the calculator's per-line vendor pick + unit price through the
-- material request so the office user's "Approve & Create Purchase Order"
-- dialog can pre-fill them instead of re-asking.
--
-- These are SUGGESTIONS, not authoritative — the office can override.

ALTER TABLE material_request_items
  ADD COLUMN IF NOT EXISTS suggested_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggested_unit_price NUMERIC(12, 2);

COMMENT ON COLUMN material_request_items.suggested_vendor_id IS
  'Vendor the requester picked at request time (e.g. from /company/calculator). Pre-fills the PO approval dialog when all lines agree. Not authoritative — office can override.';

COMMENT ON COLUMN material_request_items.suggested_unit_price IS
  'Unit price (excl. GST) captured at request time. Pre-fills the PO approval dialog when the chosen vendor matches the suggestion; reset when vendor changes.';
