-- Migration: Add Simple Entry Mode for Tea Shop Entries
-- This allows users to enter total T&S cost and split by percentage across labor groups
-- instead of detailed per-laborer tracking

-- Add entry mode column (simple or detailed)
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS entry_mode VARCHAR(20) DEFAULT 'detailed'
CHECK (entry_mode IN ('simple', 'detailed'));

-- Add percentage split for labor groups (JSONB: {daily: 40, contract: 35, market: 25})
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS percentage_split JSONB DEFAULT NULL;

-- Add simple mode total cost field (the original total before any site split)
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS simple_total_cost DECIMAL(10,2) DEFAULT NULL;

-- Multi-site split tracking columns
-- is_split_entry: true if this entry was created as part of a multi-site split
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS is_split_entry BOOLEAN DEFAULT false;

-- split_source_entry_id: references the original entry if this is a split entry
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS split_source_entry_id UUID REFERENCES tea_shop_entries(id) ON DELETE SET NULL;

-- split_target_site_id: the other site involved in the split (for reference)
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS split_target_site_id UUID REFERENCES sites(id) ON DELETE SET NULL;

-- split_percentage: the percentage allocated to this site (e.g., 60.00 for 60%)
ALTER TABLE tea_shop_entries
ADD COLUMN IF NOT EXISTS split_percentage DECIMAL(5,2) DEFAULT NULL;

-- Set existing entries to detailed mode
UPDATE tea_shop_entries SET entry_mode = 'detailed' WHERE entry_mode IS NULL;

-- Create index for efficient querying of split entries
CREATE INDEX IF NOT EXISTS idx_tea_shop_entries_split_source
ON tea_shop_entries(split_source_entry_id)
WHERE split_source_entry_id IS NOT NULL;

-- Create index for entry mode filtering
CREATE INDEX IF NOT EXISTS idx_tea_shop_entries_entry_mode
ON tea_shop_entries(entry_mode);

-- Add comment for documentation
COMMENT ON COLUMN tea_shop_entries.entry_mode IS 'Entry mode: simple (total cost with percentage split) or detailed (per-laborer tracking)';
COMMENT ON COLUMN tea_shop_entries.percentage_split IS 'JSON object with labor group percentages: {daily: number, contract: number, market: number}';
COMMENT ON COLUMN tea_shop_entries.simple_total_cost IS 'Original total cost in simple mode (before any site split)';
COMMENT ON COLUMN tea_shop_entries.is_split_entry IS 'True if this entry was created as part of a multi-site split';
COMMENT ON COLUMN tea_shop_entries.split_source_entry_id IS 'References the primary entry if this is a secondary split entry';
COMMENT ON COLUMN tea_shop_entries.split_target_site_id IS 'The other site involved in the split';
COMMENT ON COLUMN tea_shop_entries.split_percentage IS 'Percentage of total cost allocated to this site';
