-- Fix Tea Shop Waterfall Settlement - Per-Site FIFO
-- Ensures waterfall operates independently per site within a group
-- Bug fix: Previously, payments were allocated globally across all sites in a group

-- =============================================================================
-- 1. ADD site_id COLUMN TO tea_shop_settlements (for per-site settlement tracking)
-- =============================================================================

ALTER TABLE "public"."tea_shop_settlements"
ADD COLUMN IF NOT EXISTS "site_id" uuid REFERENCES "public"."sites"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."tea_shop_settlements"."site_id" IS 'Site this settlement is associated with (for per-site FIFO waterfall)';

CREATE INDEX IF NOT EXISTS "idx_tea_shop_settlements_site_id"
ON "public"."tea_shop_settlements"("site_id")
WHERE "site_id" IS NOT NULL;

-- =============================================================================
-- 2. UPDATED rebuild_tea_shop_waterfall FUNCTION (with per-site support)
-- =============================================================================

CREATE OR REPLACE FUNCTION rebuild_tea_shop_waterfall(
  p_tea_shop_id UUID,
  p_site_id UUID DEFAULT NULL  -- NEW: Optional site filter for per-site waterfall
)
RETURNS void AS $$
DECLARE
  settlement_rec RECORD;
  entry_rec RECORD;
  remaining_amount NUMERIC;
  entry_remaining NUMERIC;
  to_allocate NUMERIC;
  v_entry_amount NUMERIC;
  v_entry_paid NUMERIC;
BEGIN
  -- ==========================================================================
  -- STEP 1: Delete existing settlement allocations
  -- ==========================================================================
  IF p_site_id IS NOT NULL THEN
    -- Per-site mode: Only delete allocations for entries belonging to this site
    DELETE FROM tea_shop_settlement_allocations
    WHERE settlement_id IN (
      SELECT id FROM tea_shop_settlements
      WHERE tea_shop_id = p_tea_shop_id
        AND (site_id = p_site_id OR site_id IS NULL)
    )
    AND entry_id IN (
      -- Individual site entries
      SELECT id FROM tea_shop_entries
      WHERE site_id = p_site_id
      UNION
      -- Group entries that have allocations for this site
      SELECT te.id FROM tea_shop_entries te
      JOIN tea_shop_entry_allocations tea ON te.id = tea.entry_id
      WHERE te.is_group_entry = true AND tea.site_id = p_site_id
    );
  ELSE
    -- Global mode: Delete all allocations for this shop
    DELETE FROM tea_shop_settlement_allocations
    WHERE settlement_id IN (
      SELECT id FROM tea_shop_settlements WHERE tea_shop_id = p_tea_shop_id
    );
  END IF;

  -- ==========================================================================
  -- STEP 2: Reset entries to unpaid
  -- ==========================================================================
  IF p_site_id IS NOT NULL THEN
    -- Per-site mode: Reset only entries for this site
    -- Individual site entries
    UPDATE tea_shop_entries
    SET amount_paid = 0, is_fully_paid = false
    WHERE tea_shop_id = p_tea_shop_id
      AND site_id = p_site_id;

    -- For group entries, we track per-site payment via allocations
    -- Reset the allocation's paid status by updating the parent entry
    -- (This is handled when we reprocess allocations below)
  ELSE
    -- Global mode: Reset all entries
    UPDATE tea_shop_entries
    SET amount_paid = 0, is_fully_paid = false
    WHERE tea_shop_id = p_tea_shop_id;
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
        p_site_id IS NULL  -- Global mode: all settlements
        OR site_id = p_site_id  -- Per-site mode: only site-specific settlements
        OR (site_id IS NULL AND site_group_id IS NOT NULL)  -- Group settlements also apply
      )
    ORDER BY payment_date ASC, created_at ASC
  LOOP
    remaining_amount := settlement_rec.amount_paid;

    -- ========================================================================
    -- STEP 4: Allocate to entries (oldest first - FIFO)
    -- ========================================================================
    IF p_site_id IS NOT NULL THEN
      -- Per-site mode: Only entries for this specific site
      FOR entry_rec IN
        SELECT
          te.id,
          te.is_group_entry,
          CASE
            WHEN te.is_group_entry = true THEN
              COALESCE((SELECT allocated_amount FROM tea_shop_entry_allocations
                        WHERE entry_id = te.id AND site_id = p_site_id), 0)
            ELSE
              COALESCE(te.total_amount, 0)
          END as effective_amount,
          COALESCE(te.amount_paid, 0) as current_paid
        FROM tea_shop_entries te
        LEFT JOIN tea_shop_entry_allocations tea ON te.id = tea.entry_id AND tea.site_id = p_site_id
        WHERE te.tea_shop_id = p_tea_shop_id
          AND (
            te.site_id = p_site_id  -- Individual site entries
            OR (te.is_group_entry = true AND tea.site_id = p_site_id)  -- Group entries with allocation
          )
          AND COALESCE(te.amount_paid, 0) <
              CASE
                WHEN te.is_group_entry = true THEN COALESCE(tea.allocated_amount, 0)
                ELSE COALESCE(te.total_amount, 0)
              END
        ORDER BY te.date ASC, te.created_at ASC
      LOOP
        EXIT WHEN remaining_amount <= 0;

        v_entry_amount := entry_rec.effective_amount;
        v_entry_paid := entry_rec.current_paid;
        entry_remaining := v_entry_amount - v_entry_paid;

        IF entry_remaining > 0 THEN
          to_allocate := LEAST(remaining_amount, entry_remaining);

          -- Create allocation record
          INSERT INTO tea_shop_settlement_allocations (settlement_id, entry_id, allocated_amount)
          VALUES (settlement_rec.id, entry_rec.id, to_allocate)
          ON CONFLICT (settlement_id, entry_id)
          DO UPDATE SET allocated_amount = tea_shop_settlement_allocations.allocated_amount + EXCLUDED.allocated_amount;

          -- Update entry payment status
          UPDATE tea_shop_entries
          SET
            amount_paid = COALESCE(amount_paid, 0) + to_allocate,
            is_fully_paid = (COALESCE(amount_paid, 0) + to_allocate >= v_entry_amount)
          WHERE id = entry_rec.id;

          remaining_amount := remaining_amount - to_allocate;
        END IF;
      END LOOP;
    ELSE
      -- Global mode: All entries for the shop (original behavior)
      FOR entry_rec IN
        SELECT id, total_amount, amount_paid
        FROM tea_shop_entries
        WHERE tea_shop_id = p_tea_shop_id
          AND COALESCE(amount_paid, 0) < COALESCE(total_amount, 0)
        ORDER BY date ASC, created_at ASC
      LOOP
        EXIT WHEN remaining_amount <= 0;

        entry_remaining := COALESCE(entry_rec.total_amount, 0) - COALESCE(entry_rec.amount_paid, 0);

        IF entry_remaining > 0 THEN
          to_allocate := LEAST(remaining_amount, entry_remaining);

          -- Create allocation record
          INSERT INTO tea_shop_settlement_allocations (settlement_id, entry_id, allocated_amount)
          VALUES (settlement_rec.id, entry_rec.id, to_allocate)
          ON CONFLICT (settlement_id, entry_id)
          DO UPDATE SET allocated_amount = EXCLUDED.allocated_amount;

          -- Update entry
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

-- =============================================================================
-- 3. UPDATED trigger_tea_shop_entry_change FUNCTION (passes site_id)
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_tea_shop_entry_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only rebuild if total_amount changed
  IF TG_OP = 'UPDATE' AND OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    -- Pass site_id for per-site waterfall rebuild
    IF NEW.site_id IS NOT NULL THEN
      PERFORM rebuild_tea_shop_waterfall(NEW.tea_shop_id, NEW.site_id);
    ELSE
      -- Group entry - rebuild for all affected sites
      PERFORM rebuild_tea_shop_waterfall(NEW.tea_shop_id, NULL);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.site_id IS NOT NULL THEN
      PERFORM rebuild_tea_shop_waterfall(OLD.tea_shop_id, OLD.site_id);
    ELSE
      PERFORM rebuild_tea_shop_waterfall(OLD.tea_shop_id, NULL);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. UPDATED trigger_tea_shop_settlement_change FUNCTION (passes site_id)
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_tea_shop_settlement_change()
RETURNS TRIGGER AS $$
DECLARE
  v_tea_shop_id UUID;
  v_site_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tea_shop_id := OLD.tea_shop_id;
    v_site_id := OLD.site_id;
  ELSE
    v_tea_shop_id := NEW.tea_shop_id;
    v_site_id := NEW.site_id;
  END IF;

  -- Rebuild waterfall for the specific site if site_id is set
  PERFORM rebuild_tea_shop_waterfall(v_tea_shop_id, v_site_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. RECREATE TRIGGERS (to use updated functions)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_tea_shop_entry_waterfall ON tea_shop_entries;
CREATE TRIGGER trg_tea_shop_entry_waterfall
  AFTER UPDATE OR DELETE ON tea_shop_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_tea_shop_entry_change();

DROP TRIGGER IF EXISTS trg_tea_shop_settlement_waterfall ON tea_shop_settlements;
CREATE TRIGGER trg_tea_shop_settlement_waterfall
  AFTER INSERT OR UPDATE OR DELETE ON tea_shop_settlements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_tea_shop_settlement_change();

-- =============================================================================
-- 6. ADD COMMENTS
-- =============================================================================

COMMENT ON FUNCTION rebuild_tea_shop_waterfall(UUID, UUID) IS
  'Rebuilds waterfall settlement allocations for a tea shop.
   When p_site_id is provided, operates in per-site FIFO mode.
   When p_site_id is NULL, operates in global mode (original behavior).';

COMMENT ON FUNCTION trigger_tea_shop_entry_change() IS
  'Trigger function that calls rebuild_tea_shop_waterfall when tea_shop_entries.total_amount changes.
   Passes site_id for per-site waterfall rebuild.';

COMMENT ON FUNCTION trigger_tea_shop_settlement_change() IS
  'Trigger function that calls rebuild_tea_shop_waterfall when settlements change.
   Passes site_id for per-site waterfall rebuild.';
