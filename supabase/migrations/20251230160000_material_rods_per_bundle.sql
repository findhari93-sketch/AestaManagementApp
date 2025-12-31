-- Migration: Add rods per bundle field for TMT and similar materials
-- This tracks how many rods/pieces are in a standard bundle

ALTER TABLE materials
ADD COLUMN IF NOT EXISTS rods_per_bundle INTEGER DEFAULT NULL;

COMMENT ON COLUMN materials.rods_per_bundle IS 'Number of rods/pieces per bundle (e.g., 10 for 8mm TMT, 5 for 12mm TMT)';
