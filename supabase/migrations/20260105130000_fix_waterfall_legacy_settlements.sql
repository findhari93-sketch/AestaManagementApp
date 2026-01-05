-- Hotfix: Handle legacy settlements that have neither site_id nor site_group_id set
-- For legacy settlements, we split them proportionally based on each site's share of unpaid allocations

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
  v_total_unpaid NUMERIC;
  v_site_unpaid NUMERIC;
  v_site_portion NUMERIC;
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
    UPDATE tea_shop_entry_allocations
    SET amount_paid = 0, is_fully_paid = false
    WHERE site_id = p_site_id
      AND entry_id IN (
        SELECT id FROM tea_shop_entries WHERE tea_shop_id = p_tea_shop_id
      );

    UPDATE tea_shop_entries
    SET amount_paid = 0, is_fully_paid = false
    WHERE tea_shop_id = p_tea_shop_id
      AND site_id = p_site_id
      AND is_group_entry = false;
  ELSE
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
  -- For legacy settlements (site_id IS NULL), calculate this site's portion
  -- ==========================================================================
  FOR settlement_rec IN
    SELECT id, amount_paid, site_id as settlement_site_id
    FROM tea_shop_settlements
    WHERE tea_shop_id = p_tea_shop_id
      AND COALESCE(is_cancelled, false) = false
      AND (
        p_site_id IS NULL  -- Global mode: all settlements
        OR site_id = p_site_id  -- Per-site mode: only site-specific settlements
        OR site_id IS NULL  -- Legacy settlements apply proportionally
      )
    ORDER BY payment_date ASC, created_at ASC
  LOOP
    -- Calculate this site's portion of the settlement
    IF p_site_id IS NOT NULL AND settlement_rec.settlement_site_id IS NULL THEN
      -- Legacy settlement: calculate this site's proportional share
      -- Based on ratio of this site's unpaid allocations to total unpaid
      SELECT COALESCE(SUM(
        CASE
          WHEN te.is_group_entry = true THEN COALESCE(tea.allocated_amount, 0) - COALESCE(tea.amount_paid, 0)
          ELSE COALESCE(te.total_amount, 0) - COALESCE(te.amount_paid, 0)
        END
      ), 0) INTO v_site_unpaid
      FROM tea_shop_entries te
      LEFT JOIN tea_shop_entry_allocations tea ON te.id = tea.entry_id AND tea.site_id = p_site_id
      WHERE te.tea_shop_id = p_tea_shop_id
        AND (
          (te.is_group_entry = false AND te.site_id = p_site_id)
          OR (te.is_group_entry = true AND tea.site_id = p_site_id)
        );

      SELECT COALESCE(SUM(COALESCE(total_amount, 0) - COALESCE(amount_paid, 0)), 0)
      INTO v_total_unpaid
      FROM tea_shop_entries
      WHERE tea_shop_id = p_tea_shop_id;

      IF v_total_unpaid > 0 THEN
        v_site_portion := ROUND((v_site_unpaid / v_total_unpaid) * settlement_rec.amount_paid);
      ELSE
        v_site_portion := 0;
      END IF;

      remaining_amount := v_site_portion;
    ELSE
      remaining_amount := settlement_rec.amount_paid;
    END IF;

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

          INSERT INTO tea_shop_settlement_allocations (settlement_id, entry_id, allocated_amount)
          VALUES (settlement_rec.id, entry_rec.entry_id, to_allocate)
          ON CONFLICT (settlement_id, entry_id)
          DO UPDATE SET allocated_amount = tea_shop_settlement_allocations.allocated_amount + EXCLUDED.allocated_amount;

          IF entry_rec.is_group_entry THEN
            UPDATE tea_shop_entry_allocations
            SET
              amount_paid = COALESCE(amount_paid, 0) + to_allocate,
              is_fully_paid = (COALESCE(amount_paid, 0) + to_allocate >= allocated_amount)
            WHERE entry_id = entry_rec.entry_id AND site_id = p_site_id;

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
