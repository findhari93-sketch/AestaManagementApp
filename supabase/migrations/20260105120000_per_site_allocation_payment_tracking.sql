-- Per-Site Allocation Payment Tracking
-- Fixes the waterfall FIFO issue where group entries with mixed allocations
-- were being skipped because payment was tracked at entry level, not site level.
--
-- Problem: Dec 29 entry (100% Padmavathy) was paid before Dec 23-28 entries
-- (mixed allocations) because the waterfall checked entry.is_fully_paid
-- instead of tracking payment per-site allocation.

-- =============================================================================
-- 1. ADD amount_paid COLUMN TO tea_shop_entry_allocations
-- =============================================================================

ALTER TABLE "public"."tea_shop_entry_allocations"
ADD COLUMN IF NOT EXISTS "amount_paid" NUMERIC DEFAULT 0;

ALTER TABLE "public"."tea_shop_entry_allocations"
ADD COLUMN IF NOT EXISTS "is_fully_paid" BOOLEAN DEFAULT false;

COMMENT ON COLUMN "public"."tea_shop_entry_allocations"."amount_paid" IS
  'Amount paid towards this site allocation. For per-site FIFO waterfall tracking.';

COMMENT ON COLUMN "public"."tea_shop_entry_allocations"."is_fully_paid" IS
  'Whether this site allocation is fully paid. True when amount_paid >= allocated_amount.';

-- =============================================================================
-- 2. UPDATED rebuild_tea_shop_waterfall FUNCTION (per-site allocation tracking)
-- =============================================================================

CREATE OR REPLACE FUNCTION rebuild_tea_shop_waterfall(
  p_tea_shop_id UUID,
  p_site_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  settlement_rec RECORD;
  entry_rec RECORD;
  remaining_amount NUMERIC;
  entry_remaining NUMERIC;
  to_allocate NUMERIC;
  v_site_allocation NUMERIC;
  v_site_paid NUMERIC;
BEGIN
  -- ==========================================================================
  -- STEP 1: Delete existing settlement allocations for this site
  -- ==========================================================================
  IF p_site_id IS NOT NULL THEN
    DELETE FROM tea_shop_settlement_allocations
    WHERE settlement_id IN (
      SELECT id FROM tea_shop_settlements
      WHERE tea_shop_id = p_tea_shop_id
        AND (site_id = p_site_id OR site_id IS NULL)
    )
    AND entry_id IN (
      SELECT id FROM tea_shop_entries
      WHERE site_id = p_site_id
      UNION
      SELECT te.id FROM tea_shop_entries te
      JOIN tea_shop_entry_allocations tea ON te.id = tea.entry_id
      WHERE te.is_group_entry = true AND tea.site_id = p_site_id
    );
  ELSE
    DELETE FROM tea_shop_settlement_allocations
    WHERE settlement_id IN (
      SELECT id FROM tea_shop_settlements WHERE tea_shop_id = p_tea_shop_id
    );
  END IF;

  -- ==========================================================================
  -- STEP 2: Reset payment status
  -- ==========================================================================
  IF p_site_id IS NOT NULL THEN
    -- Per-site mode: Reset allocation payment for this site
    UPDATE tea_shop_entry_allocations
    SET amount_paid = 0, is_fully_paid = false
    WHERE site_id = p_site_id
      AND entry_id IN (
        SELECT id FROM tea_shop_entries WHERE tea_shop_id = p_tea_shop_id
      );

    -- Also reset individual site entries
    UPDATE tea_shop_entries
    SET amount_paid = 0, is_fully_paid = false
    WHERE tea_shop_id = p_tea_shop_id
      AND site_id = p_site_id
      AND is_group_entry = false;
  ELSE
    -- Global mode: Reset all
    UPDATE tea_shop_entries
    SET amount_paid = 0, is_fully_paid = false
    WHERE tea_shop_id = p_tea_shop_id;

    UPDATE tea_shop_entry_allocations
    SET amount_paid = 0, is_fully_paid = false
    WHERE entry_id IN (
      SELECT id FROM tea_shop_entries WHERE tea_shop_id = p_tea_shop_id
    );
  END IF;

  -- ==========================================================================
  -- STEP 3: Reprocess settlements chronologically (FIFO)
  -- ==========================================================================
  FOR settlement_rec IN
    SELECT id, amount_paid, site_id as settlement_site_id
    FROM tea_shop_settlements
    WHERE tea_shop_id = p_tea_shop_id
      AND COALESCE(is_cancelled, false) = false
      AND (
        p_site_id IS NULL
        OR site_id = p_site_id
        OR (site_id IS NULL AND site_group_id IS NOT NULL)
      )
    ORDER BY payment_date ASC, created_at ASC
  LOOP
    remaining_amount := settlement_rec.amount_paid;

    -- ========================================================================
    -- STEP 4: Allocate to entries/allocations (oldest first - FIFO)
    -- ========================================================================
    IF p_site_id IS NOT NULL THEN
      -- Per-site mode: Pay this site's allocations only
      FOR entry_rec IN
        SELECT
          te.id as entry_id,
          te.is_group_entry,
          te.date,
          CASE
            WHEN te.is_group_entry = true THEN
              COALESCE(tea.allocated_amount, 0)
            ELSE
              COALESCE(te.total_amount, 0)
          END as site_amount,
          CASE
            WHEN te.is_group_entry = true THEN
              COALESCE(tea.amount_paid, 0)
            ELSE
              COALESCE(te.amount_paid, 0)
          END as site_paid
        FROM tea_shop_entries te
        LEFT JOIN tea_shop_entry_allocations tea ON te.id = tea.entry_id AND tea.site_id = p_site_id
        WHERE te.tea_shop_id = p_tea_shop_id
          AND (
            (te.is_group_entry = false AND te.site_id = p_site_id)
            OR (te.is_group_entry = true AND tea.site_id = p_site_id)
          )
        ORDER BY te.date ASC, te.created_at ASC
      LOOP
        EXIT WHEN remaining_amount <= 0;

        v_site_allocation := entry_rec.site_amount;
        v_site_paid := entry_rec.site_paid;
        entry_remaining := v_site_allocation - v_site_paid;

        IF entry_remaining > 0 THEN
          to_allocate := LEAST(remaining_amount, entry_remaining);

          -- Create settlement allocation record
          INSERT INTO tea_shop_settlement_allocations (settlement_id, entry_id, allocated_amount)
          VALUES (settlement_rec.id, entry_rec.entry_id, to_allocate)
          ON CONFLICT (settlement_id, entry_id)
          DO UPDATE SET allocated_amount = tea_shop_settlement_allocations.allocated_amount + EXCLUDED.allocated_amount;

          IF entry_rec.is_group_entry THEN
            -- Update allocation-level payment (NEW per-site tracking)
            UPDATE tea_shop_entry_allocations
            SET
              amount_paid = COALESCE(amount_paid, 0) + to_allocate,
              is_fully_paid = (COALESCE(amount_paid, 0) + to_allocate >= allocated_amount)
            WHERE entry_id = entry_rec.entry_id AND site_id = p_site_id;

            -- Also update entry-level for backwards compatibility
            -- Entry is fully paid only when ALL allocations are paid
            UPDATE tea_shop_entries te
            SET
              amount_paid = (
                SELECT COALESCE(SUM(amount_paid), 0)
                FROM tea_shop_entry_allocations
                WHERE entry_id = te.id
              ),
              is_fully_paid = NOT EXISTS (
                SELECT 1 FROM tea_shop_entry_allocations
                WHERE entry_id = te.id
                  AND (is_fully_paid = false OR is_fully_paid IS NULL)
                  AND allocated_amount > 0
              )
            WHERE id = entry_rec.entry_id;
          ELSE
            -- Individual entry: update directly
            UPDATE tea_shop_entries
            SET
              amount_paid = COALESCE(amount_paid, 0) + to_allocate,
              is_fully_paid = (COALESCE(amount_paid, 0) + to_allocate >= COALESCE(total_amount, 0))
            WHERE id = entry_rec.entry_id;
          END IF;

          remaining_amount := remaining_amount - to_allocate;
        END IF;
      END LOOP;
    ELSE
      -- Global mode: Original behavior (all entries)
      FOR entry_rec IN
        SELECT id, total_amount, amount_paid, is_group_entry
        FROM tea_shop_entries
        WHERE tea_shop_id = p_tea_shop_id
          AND COALESCE(amount_paid, 0) < COALESCE(total_amount, 0)
        ORDER BY date ASC, created_at ASC
      LOOP
        EXIT WHEN remaining_amount <= 0;

        entry_remaining := COALESCE(entry_rec.total_amount, 0) - COALESCE(entry_rec.amount_paid, 0);

        IF entry_remaining > 0 THEN
          to_allocate := LEAST(remaining_amount, entry_remaining);

          INSERT INTO tea_shop_settlement_allocations (settlement_id, entry_id, allocated_amount)
          VALUES (settlement_rec.id, entry_rec.id, to_allocate)
          ON CONFLICT (settlement_id, entry_id)
          DO UPDATE SET allocated_amount = EXCLUDED.allocated_amount;

          UPDATE tea_shop_entries
          SET
            amount_paid = COALESCE(amount_paid, 0) + to_allocate,
            is_fully_paid = (COALESCE(amount_paid, 0) + to_allocate >= COALESCE(total_amount, 0))
          WHERE id = entry_rec.id;

          remaining_amount := remaining_amount - to_allocate;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rebuild_tea_shop_waterfall(UUID, UUID) IS
  'Rebuilds waterfall settlement allocations for a tea shop.
   When p_site_id is provided, operates in per-site FIFO mode using
   tea_shop_entry_allocations.amount_paid for group entries.
   When p_site_id is NULL, operates in global mode.';

-- =============================================================================
-- 3. CREATE FUNCTION TO GET PER-SITE UNSETTLED ENTRIES
-- =============================================================================

CREATE OR REPLACE FUNCTION get_site_unsettled_entries(
  p_tea_shop_id UUID,
  p_site_id UUID
)
RETURNS TABLE (
  entry_id UUID,
  entry_date DATE,
  is_group_entry BOOLEAN,
  entry_total_amount NUMERIC,
  site_allocated_amount NUMERIC,
  site_amount_paid NUMERIC,
  site_remaining NUMERIC,
  site_is_fully_paid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    te.id as entry_id,
    te.date as entry_date,
    te.is_group_entry,
    te.total_amount as entry_total_amount,
    CASE
      WHEN te.is_group_entry = true THEN COALESCE(tea.allocated_amount, 0)
      ELSE COALESCE(te.total_amount, 0)
    END as site_allocated_amount,
    CASE
      WHEN te.is_group_entry = true THEN COALESCE(tea.amount_paid, 0)
      ELSE COALESCE(te.amount_paid, 0)
    END as site_amount_paid,
    CASE
      WHEN te.is_group_entry = true THEN
        COALESCE(tea.allocated_amount, 0) - COALESCE(tea.amount_paid, 0)
      ELSE
        COALESCE(te.total_amount, 0) - COALESCE(te.amount_paid, 0)
    END as site_remaining,
    CASE
      WHEN te.is_group_entry = true THEN COALESCE(tea.is_fully_paid, false)
      ELSE COALESCE(te.is_fully_paid, false)
    END as site_is_fully_paid
  FROM tea_shop_entries te
  LEFT JOIN tea_shop_entry_allocations tea ON te.id = tea.entry_id AND tea.site_id = p_site_id
  WHERE te.tea_shop_id = p_tea_shop_id
    AND (
      (te.is_group_entry = false AND te.site_id = p_site_id)
      OR (te.is_group_entry = true AND tea.site_id = p_site_id)
    )
  ORDER BY te.date ASC, te.created_at ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_site_unsettled_entries(UUID, UUID) IS
  'Returns entries for a specific site with per-site payment status.
   For group entries, uses tea_shop_entry_allocations for site-specific amounts.
   For individual entries, uses tea_shop_entries directly.';

-- =============================================================================
-- 4. GRANTS
-- =============================================================================

GRANT EXECUTE ON FUNCTION rebuild_tea_shop_waterfall(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_tea_shop_waterfall(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_site_unsettled_entries(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_site_unsettled_entries(UUID, UUID) TO service_role;
