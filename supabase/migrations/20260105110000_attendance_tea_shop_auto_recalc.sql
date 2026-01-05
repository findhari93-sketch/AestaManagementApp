-- Auto-Recalculate Tea Shop Allocations When Attendance Changes
-- When attendance is marked on a date that has tea shop entries,
-- automatically recalculate the per-site allocations based on new WD units

-- =============================================================================
-- 1. FUNCTION: Recalculate tea shop allocations for a specific date and site
-- =============================================================================

CREATE OR REPLACE FUNCTION recalculate_tea_shop_allocations_for_date(
  p_date DATE,
  p_site_id UUID
)
RETURNS void AS $$
DECLARE
  v_site_group_id UUID;
  v_entry_rec RECORD;
  v_site_rec RECORD;
  v_total_units NUMERIC;
  v_site_units NUMERIC;
  v_percentage NUMERIC;
  v_allocated_amount NUMERIC;
  v_remaining_amount NUMERIC;
  v_total_allocated NUMERIC;
BEGIN
  -- Get the site's group ID
  SELECT site_group_id INTO v_site_group_id
  FROM sites
  WHERE id = p_site_id;

  -- If site is not in a group, nothing to recalculate (single site entries don't need allocation)
  IF v_site_group_id IS NULL THEN
    RETURN;
  END IF;

  -- Find all group tea shop entries for this date in this group
  FOR v_entry_rec IN
    SELECT te.id, te.total_amount, te.tea_shop_id
    FROM tea_shop_entries te
    WHERE te.date = p_date
      AND te.is_group_entry = true
      AND te.site_group_id = v_site_group_id
  LOOP
    -- Calculate total day units across all sites in the group for this date
    v_total_units := 0;
    v_remaining_amount := v_entry_rec.total_amount;
    v_total_allocated := 0;

    -- Get day units for each site in the group
    FOR v_site_rec IN
      SELECT
        s.id as site_id,
        s.name as site_name,
        COALESCE(
          (SELECT SUM(COALESCE(da.day_units, 1))
           FROM daily_attendance da
           WHERE da.site_id = s.id
             AND da.date = p_date
             AND COALESCE(da.is_deleted, false) = false), 0
        ) +
        COALESCE(
          (SELECT SUM(COALESCE(mla.count, 0))
           FROM market_laborer_attendance mla
           WHERE mla.site_id = s.id
             AND mla.date = p_date), 0
        ) as total_units,
        COALESCE(
          (SELECT COUNT(*)
           FROM daily_attendance da
           WHERE da.site_id = s.id
             AND da.date = p_date
             AND COALESCE(da.is_deleted, false) = false), 0
        ) +
        COALESCE(
          (SELECT SUM(COALESCE(mla.count, 0))
           FROM market_laborer_attendance mla
           WHERE mla.site_id = s.id
             AND mla.date = p_date), 0
        ) as worker_count
      FROM sites s
      WHERE s.site_group_id = v_site_group_id
        AND s.status = 'active'
      ORDER BY s.name
    LOOP
      v_total_units := v_total_units + v_site_rec.total_units;
    END LOOP;

    -- Now calculate and update allocations for each site
    FOR v_site_rec IN
      SELECT
        s.id as site_id,
        s.name as site_name,
        COALESCE(
          (SELECT SUM(COALESCE(da.day_units, 1))
           FROM daily_attendance da
           WHERE da.site_id = s.id
             AND da.date = p_date
             AND COALESCE(da.is_deleted, false) = false), 0
        ) +
        COALESCE(
          (SELECT SUM(COALESCE(mla.count, 0))
           FROM market_laborer_attendance mla
           WHERE mla.site_id = s.id
             AND mla.date = p_date), 0
        ) as total_units,
        COALESCE(
          (SELECT COUNT(*)
           FROM daily_attendance da
           WHERE da.site_id = s.id
             AND da.date = p_date
             AND COALESCE(da.is_deleted, false) = false), 0
        ) +
        COALESCE(
          (SELECT SUM(COALESCE(mla.count, 0))
           FROM market_laborer_attendance mla
           WHERE mla.site_id = s.id
             AND mla.date = p_date), 0
        ) as worker_count
      FROM sites s
      WHERE s.site_group_id = v_site_group_id
        AND s.status = 'active'
      ORDER BY s.name
    LOOP
      -- Calculate percentage and allocated amount
      IF v_total_units > 0 THEN
        v_site_units := v_site_rec.total_units;
        v_percentage := ROUND((v_site_units / v_total_units) * 100, 2);
        v_allocated_amount := ROUND((v_site_units / v_total_units) * v_entry_rec.total_amount);
      ELSE
        -- No attendance = zero allocation (FIXED: was equal split before)
        v_percentage := 0;
        v_allocated_amount := 0;
      END IF;

      v_total_allocated := v_total_allocated + v_allocated_amount;

      -- Upsert the allocation record
      INSERT INTO tea_shop_entry_allocations (
        entry_id,
        site_id,
        day_units_sum,
        worker_count,
        allocation_percentage,
        allocated_amount,
        is_manual_override
      )
      VALUES (
        v_entry_rec.id,
        v_site_rec.site_id,
        v_site_rec.total_units,
        v_site_rec.worker_count,
        v_percentage,
        v_allocated_amount,
        false
      )
      ON CONFLICT (entry_id, site_id) DO UPDATE SET
        day_units_sum = EXCLUDED.day_units_sum,
        worker_count = EXCLUDED.worker_count,
        allocation_percentage = EXCLUDED.allocation_percentage,
        allocated_amount = EXCLUDED.allocated_amount,
        is_manual_override = false;
    END LOOP;

    -- Adjust for rounding errors - add/subtract difference from largest site
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

    -- After updating allocations, trigger waterfall rebuild for affected sites
    -- This will recalculate the paid status based on new allocations
    PERFORM rebuild_tea_shop_waterfall(v_entry_rec.tea_shop_id, p_site_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_tea_shop_allocations_for_date(DATE, UUID) IS
  'Recalculates tea shop entry allocations when attendance changes for a date/site.
   Automatically updates allocations based on new day_units and triggers waterfall rebuild.';

-- =============================================================================
-- 2. TRIGGER FUNCTION: Called when attendance changes
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_attendance_tea_shop_recalc()
RETURNS TRIGGER AS $$
DECLARE
  v_date DATE;
  v_site_id UUID;
BEGIN
  -- Determine date and site_id based on operation
  IF TG_OP = 'DELETE' THEN
    v_date := OLD.date;
    v_site_id := OLD.site_id;
  ELSE
    v_date := NEW.date;
    v_site_id := NEW.site_id;
  END IF;

  -- Skip if date or site_id is null
  IF v_date IS NULL OR v_site_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only recalculate if day_units changed (for UPDATE) or for INSERT/DELETE
  IF TG_OP = 'UPDATE' THEN
    IF OLD.day_units IS NOT DISTINCT FROM NEW.day_units
       AND OLD.is_deleted IS NOT DISTINCT FROM NEW.is_deleted THEN
      -- No relevant change
      RETURN NEW;
    END IF;
  END IF;

  -- Recalculate tea shop allocations for this date/site
  PERFORM recalculate_tea_shop_allocations_for_date(v_date, v_site_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_attendance_tea_shop_recalc() IS
  'Trigger function that recalculates tea shop allocations when attendance changes.
   Called on INSERT, UPDATE, or DELETE of daily_attendance records.';

-- =============================================================================
-- 3. CREATE TRIGGER ON daily_attendance
-- =============================================================================

DROP TRIGGER IF EXISTS trg_attendance_tea_shop_recalc ON daily_attendance;
CREATE TRIGGER trg_attendance_tea_shop_recalc
  AFTER INSERT OR UPDATE OR DELETE ON daily_attendance
  FOR EACH ROW
  EXECUTE FUNCTION trigger_attendance_tea_shop_recalc();

-- =============================================================================
-- 4. TRIGGER FOR market_laborer_attendance (also affects day units)
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_market_attendance_tea_shop_recalc()
RETURNS TRIGGER AS $$
DECLARE
  v_date DATE;
  v_site_id UUID;
BEGIN
  -- Determine date and site_id based on operation
  IF TG_OP = 'DELETE' THEN
    v_date := OLD.date;
    v_site_id := OLD.site_id;
  ELSE
    v_date := NEW.date;
    v_site_id := NEW.site_id;
  END IF;

  -- Skip if date or site_id is null
  IF v_date IS NULL OR v_site_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only recalculate if count changed (for UPDATE) or for INSERT/DELETE
  IF TG_OP = 'UPDATE' THEN
    IF OLD.count IS NOT DISTINCT FROM NEW.count THEN
      -- No relevant change
      RETURN NEW;
    END IF;
  END IF;

  -- Recalculate tea shop allocations for this date/site
  PERFORM recalculate_tea_shop_allocations_for_date(v_date, v_site_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_market_attendance_tea_shop_recalc ON market_laborer_attendance;
CREATE TRIGGER trg_market_attendance_tea_shop_recalc
  AFTER INSERT OR UPDATE OR DELETE ON market_laborer_attendance
  FOR EACH ROW
  EXECUTE FUNCTION trigger_market_attendance_tea_shop_recalc();

-- =============================================================================
-- 5. GRANTS
-- =============================================================================

GRANT EXECUTE ON FUNCTION recalculate_tea_shop_allocations_for_date(DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_tea_shop_allocations_for_date(DATE, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION trigger_attendance_tea_shop_recalc() TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_attendance_tea_shop_recalc() TO service_role;
GRANT EXECUTE ON FUNCTION trigger_market_attendance_tea_shop_recalc() TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_market_attendance_tea_shop_recalc() TO service_role;
