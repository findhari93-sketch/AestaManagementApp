-- ============================================================================
-- ONE-TIME DATA FIX: Tea Shop Waterfall & Allocations
-- ============================================================================
-- This script fixes existing data that was incorrectly calculated:
-- 1. Recalculates tea shop entry allocations based on current attendance
-- 2. Resets and rebuilds the waterfall per site
--
-- RUN THIS AFTER APPLYING THE MIGRATIONS:
-- - 20260105100000_fix_tea_shop_waterfall_per_site.sql
-- - 20260105110000_attendance_tea_shop_auto_recalc.sql
-- ============================================================================

-- Step 1: Recalculate all group entry allocations based on attendance
-- ============================================================================

DO $$
DECLARE
  v_entry_rec RECORD;
  v_site_group_id UUID;
  v_site_rec RECORD;
  v_total_units NUMERIC;
  v_percentage NUMERIC;
  v_allocated_amount NUMERIC;
  v_total_allocated NUMERIC;
  v_entries_processed INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting tea shop allocation recalculation...';

  -- Find all group entries
  FOR v_entry_rec IN
    SELECT te.id, te.date, te.total_amount, te.tea_shop_id, te.site_group_id
    FROM tea_shop_entries te
    WHERE te.is_group_entry = true
      AND te.site_group_id IS NOT NULL
    ORDER BY te.date
  LOOP
    v_site_group_id := v_entry_rec.site_group_id;
    v_total_units := 0;
    v_total_allocated := 0;

    -- First pass: calculate total units
    FOR v_site_rec IN
      SELECT
        s.id as site_id,
        COALESCE(
          (SELECT SUM(COALESCE(da.day_units, 1))
           FROM daily_attendance da
           WHERE da.site_id = s.id
             AND da.date = v_entry_rec.date
             AND COALESCE(da.is_deleted, false) = false), 0
        ) +
        COALESCE(
          (SELECT SUM(COALESCE(mla.count, 0))
           FROM market_laborer_attendance mla
           WHERE mla.site_id = s.id
             AND mla.date = v_entry_rec.date), 0
        ) as total_units
      FROM sites s
      WHERE s.site_group_id = v_site_group_id
        AND s.status = 'active'
    LOOP
      v_total_units := v_total_units + v_site_rec.total_units;
    END LOOP;

    -- Second pass: calculate and upsert allocations
    FOR v_site_rec IN
      SELECT
        s.id as site_id,
        s.name as site_name,
        COALESCE(
          (SELECT SUM(COALESCE(da.day_units, 1))
           FROM daily_attendance da
           WHERE da.site_id = s.id
             AND da.date = v_entry_rec.date
             AND COALESCE(da.is_deleted, false) = false), 0
        ) +
        COALESCE(
          (SELECT SUM(COALESCE(mla.count, 0))
           FROM market_laborer_attendance mla
           WHERE mla.site_id = s.id
             AND mla.date = v_entry_rec.date), 0
        ) as total_units,
        COALESCE(
          (SELECT COUNT(*)
           FROM daily_attendance da
           WHERE da.site_id = s.id
             AND da.date = v_entry_rec.date
             AND COALESCE(da.is_deleted, false) = false), 0
        ) +
        COALESCE(
          (SELECT SUM(COALESCE(mla.count, 0))
           FROM market_laborer_attendance mla
           WHERE mla.site_id = s.id
             AND mla.date = v_entry_rec.date), 0
        ) as worker_count
      FROM sites s
      WHERE s.site_group_id = v_site_group_id
        AND s.status = 'active'
      ORDER BY s.name
    LOOP
      -- Calculate allocation
      IF v_total_units > 0 THEN
        v_percentage := ROUND((v_site_rec.total_units / v_total_units) * 100, 2);
        v_allocated_amount := ROUND((v_site_rec.total_units / v_total_units) * v_entry_rec.total_amount);
      ELSE
        -- No attendance = zero allocation (FIXED)
        v_percentage := 0;
        v_allocated_amount := 0;
      END IF;

      v_total_allocated := v_total_allocated + v_allocated_amount;

      -- Upsert allocation
      INSERT INTO tea_shop_entry_allocations (
        entry_id, site_id, day_units_sum, worker_count,
        allocation_percentage, allocated_amount, is_manual_override
      )
      VALUES (
        v_entry_rec.id, v_site_rec.site_id, v_site_rec.total_units,
        v_site_rec.worker_count, v_percentage, v_allocated_amount, false
      )
      ON CONFLICT (entry_id, site_id) DO UPDATE SET
        day_units_sum = EXCLUDED.day_units_sum,
        worker_count = EXCLUDED.worker_count,
        allocation_percentage = EXCLUDED.allocation_percentage,
        allocated_amount = EXCLUDED.allocated_amount,
        is_manual_override = false;
    END LOOP;

    -- Adjust for rounding errors
    IF v_total_units > 0 AND v_total_allocated != v_entry_rec.total_amount THEN
      UPDATE tea_shop_entry_allocations
      SET allocated_amount = allocated_amount + (v_entry_rec.total_amount - v_total_allocated)
      WHERE entry_id = v_entry_rec.id
        AND site_id = (
          SELECT site_id FROM tea_shop_entry_allocations
          WHERE entry_id = v_entry_rec.id
          ORDER BY allocated_amount DESC
          LIMIT 1
        );
    END IF;

    v_entries_processed := v_entries_processed + 1;
  END LOOP;

  RAISE NOTICE 'Processed % group entries', v_entries_processed;
END $$;

-- Step 2: Rebuild waterfall for all tea shops per site
-- ============================================================================

DO $$
DECLARE
  v_shop_rec RECORD;
  v_site_rec RECORD;
  v_shops_processed INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting waterfall rebuild...';

  -- For each tea shop
  FOR v_shop_rec IN
    SELECT DISTINCT tsa.tea_shop_id, tsa.site_group_id
    FROM tea_shop_settlements tsa
    WHERE tsa.tea_shop_id IS NOT NULL
  LOOP
    -- Get all sites in the group (if any)
    IF v_shop_rec.site_group_id IS NOT NULL THEN
      FOR v_site_rec IN
        SELECT s.id
        FROM sites s
        WHERE s.site_group_id = v_shop_rec.site_group_id
          AND s.status = 'active'
      LOOP
        -- Rebuild waterfall for this site
        PERFORM rebuild_tea_shop_waterfall(v_shop_rec.tea_shop_id, v_site_rec.id);
      END LOOP;
    ELSE
      -- Single site - rebuild global waterfall
      PERFORM rebuild_tea_shop_waterfall(v_shop_rec.tea_shop_id, NULL);
    END IF;

    v_shops_processed := v_shops_processed + 1;
  END LOOP;

  RAISE NOTICE 'Rebuilt waterfall for % tea shops', v_shops_processed;
END $$;

-- Step 3: Verify the fix by checking for out-of-order paid entries
-- ============================================================================

-- This query finds entries where a newer entry is marked paid before older ones
SELECT
  'POTENTIAL ISSUE: Newer entry paid before older' as issue,
  te.id as entry_id,
  te.date,
  te.site_id,
  s.name as site_name,
  te.total_amount,
  te.amount_paid,
  te.is_fully_paid
FROM tea_shop_entries te
JOIN sites s ON te.site_id = s.id
WHERE te.is_fully_paid = true
  AND EXISTS (
    SELECT 1 FROM tea_shop_entries te2
    WHERE te2.site_id = te.site_id
      AND te2.tea_shop_id = te.tea_shop_id
      AND te2.date < te.date
      AND te2.is_fully_paid != true
      AND COALESCE(te2.amount_paid, 0) < COALESCE(te2.total_amount, 0)
  )
ORDER BY te.site_id, te.date;

-- Summary of current state
SELECT
  'Tea Shop Entries Summary' as report,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE is_fully_paid = true) as fully_paid,
  COUNT(*) FILTER (WHERE amount_paid > 0 AND is_fully_paid != true) as partially_paid,
  COUNT(*) FILTER (WHERE COALESCE(amount_paid, 0) = 0) as unpaid,
  COUNT(*) FILTER (WHERE is_group_entry = true) as group_entries
FROM tea_shop_entries;

SELECT
  'Entry Allocations Summary' as report,
  COUNT(*) as total_allocations,
  COUNT(*) FILTER (WHERE allocated_amount = 0) as zero_allocations,
  COUNT(*) FILTER (WHERE allocated_amount > 0) as non_zero_allocations
FROM tea_shop_entry_allocations;

RAISE NOTICE 'Data fix complete. Please review the verification queries above.';
