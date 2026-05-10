-- Add `source` column to material_purchase_expenses so /site/material-expenses
-- can distinguish AI-ingested bills from PO-driven, manual, and group-converted
-- rows. Backfill from the existing nullable links.

ALTER TABLE material_purchase_expenses
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai_ingest', 'purchase_order', 'group_conversion'));

UPDATE material_purchase_expenses
   SET source = CASE
     WHEN local_purchase_id IS NOT NULL THEN 'purchase_order'
     WHEN converted_from_group = true OR original_batch_code IS NOT NULL THEN 'group_conversion'
     ELSE 'manual'
   END
 WHERE source = 'manual';  -- Only touch rows still on the default

CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_source
  ON material_purchase_expenses(source);

COMMENT ON COLUMN material_purchase_expenses.source IS
  'Origin of this expense row. ai_ingest = created by AI bill ingestion dialog. '
  'purchase_order = auto-created when a PO was delivered + verified. '
  'group_conversion = split from a group_stock parent. '
  'manual = typed in directly via the UI. Backfilled in 20260510100000.';
