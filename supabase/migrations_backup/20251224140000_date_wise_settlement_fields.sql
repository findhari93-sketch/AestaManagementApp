-- Migration: Add date-wise settlement tracking fields
-- Purpose: Support date-based settlements with waterfall allocation to multiple weeks

-- ============================================================================
-- 1. Add settlement_type to distinguish date-wise from labor-wise settlements
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settlement_groups' AND column_name = 'settlement_type'
  ) THEN
    ALTER TABLE settlement_groups
    ADD COLUMN settlement_type TEXT DEFAULT 'date_wise'
    CHECK (settlement_type IN ('date_wise', 'labor_wise', 'weekly'));
  END IF;
END $$;

COMMENT ON COLUMN settlement_groups.settlement_type IS
  'Type of settlement: date_wise (new default - single payment date covers multiple weeks), labor_wise (legacy - per laborer), weekly (batch weekly)';

-- ============================================================================
-- 2. Add week_allocations JSONB to store per-week breakdown
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settlement_groups' AND column_name = 'week_allocations'
  ) THEN
    ALTER TABLE settlement_groups
    ADD COLUMN week_allocations JSONB;
  END IF;
END $$;

COMMENT ON COLUMN settlement_groups.week_allocations IS
  'JSONB array storing week allocations: [{weekStart, weekEnd, weekLabel, allocatedAmount, laborerCount, isFullyPaid}]';

-- ============================================================================
-- 3. Add proof_urls array for multiple screenshots
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settlement_groups' AND column_name = 'proof_urls'
  ) THEN
    ALTER TABLE settlement_groups
    ADD COLUMN proof_urls TEXT[];
  END IF;
END $$;

COMMENT ON COLUMN settlement_groups.proof_urls IS
  'Array of proof screenshot URLs for this settlement (supports multiple attachments)';

-- ============================================================================
-- 4. Create index for efficient settlement type queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_settlement_groups_type_date
  ON settlement_groups(site_id, settlement_type, settlement_date DESC);

-- ============================================================================
-- 5. Backfill existing settlements as 'labor_wise' (legacy)
-- ============================================================================
UPDATE settlement_groups
SET settlement_type = 'labor_wise'
WHERE settlement_type IS NULL;

-- ============================================================================
-- 6. Migrate existing proof_url to proof_urls array
-- ============================================================================
UPDATE settlement_groups
SET proof_urls = ARRAY[proof_url]
WHERE proof_url IS NOT NULL
  AND proof_url != ''
  AND (proof_urls IS NULL OR array_length(proof_urls, 1) IS NULL);
