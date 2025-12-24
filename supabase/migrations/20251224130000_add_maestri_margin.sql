-- Migration: Add maestri_margin_per_day to subcontracts table
-- Purpose: Track daily margin earned by maestri (contractor) per laborer

-- ============================================================================
-- 1. Add maestri_margin_per_day column to subcontracts
-- ============================================================================
ALTER TABLE subcontracts
ADD COLUMN IF NOT EXISTS maestri_margin_per_day NUMERIC(10,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN subcontracts.maestri_margin_per_day IS
  'Daily margin earned by the maestri (contractor) per laborer per day worked. Total maestri earnings = margin x days_worked x laborer_count';
