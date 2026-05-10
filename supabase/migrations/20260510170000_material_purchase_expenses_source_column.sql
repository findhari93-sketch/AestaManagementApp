-- Add source column to material_purchase_expenses.
--
-- useSiteLevelMaterialExpenses hook selects "source" for the Origin filter
-- (AI / PO / Manual / Group) on /site/material-expenses. The column was
-- referenced in the hook without a migration, causing 42703 "column does not
-- exist" errors on all three sub-queries. isQueryError() catches this and
-- silently returns empty — making every expense category show 0.

ALTER TABLE material_purchase_expenses
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Backfill existing rows by best available signal:

-- PO-based purchases
UPDATE material_purchase_expenses
SET source = 'purchase_order'
WHERE purchase_order_id IS NOT NULL AND source IS NULL;

-- Group conversion / allocated / self-use (batch origin)
UPDATE material_purchase_expenses
SET source = 'group_conversion'
WHERE original_batch_code IS NOT NULL AND source IS NULL;

-- Remaining rows have no PO and no batch: treat as ai_ingest / manual.
-- We cannot distinguish them retroactively; labelling as 'ai_ingest' is
-- acceptable since the only known non-PO own-site expenses are AI-ingested.
UPDATE material_purchase_expenses
SET source = 'ai_ingest'
WHERE source IS NULL;
