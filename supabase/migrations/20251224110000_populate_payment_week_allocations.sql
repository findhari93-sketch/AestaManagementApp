-- Migration: Populate payment_week_allocations from existing labor_payments
-- The previous migration created labor_payments but didn't create the corresponding
-- payment_week_allocations records, which the UI uses to display paid amounts.

DO $$
DECLARE
  inserted_count INTEGER;
  rec RECORD;
BEGIN
  -- Insert allocation records for all contract salary payments
  INSERT INTO payment_week_allocations (
    labor_payment_id,
    laborer_id,
    site_id,
    week_start,
    week_end,
    allocated_amount
  )
  SELECT
    lp.id,
    lp.laborer_id,
    lp.site_id,
    lp.payment_for_date as week_start,
    (lp.payment_for_date + 6) as week_end,
    lp.amount
  FROM labor_payments lp
  WHERE lp.is_under_contract = true
    AND lp.payment_type = 'salary'
    -- Don't insert duplicates
    AND NOT EXISTS (
      SELECT 1 FROM payment_week_allocations pwa
      WHERE pwa.labor_payment_id = lp.id
        AND pwa.week_start = lp.payment_for_date
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % payment_week_allocations records', inserted_count;

  -- Verify the allocations were created
  RAISE NOTICE 'Allocations by week:';
  FOR rec IN
    SELECT
      pwa.week_start,
      COUNT(*) as laborer_count,
      SUM(pwa.allocated_amount) as total_allocated
    FROM payment_week_allocations pwa
    GROUP BY pwa.week_start
    ORDER BY pwa.week_start
  LOOP
    RAISE NOTICE 'Week %: % laborers, Rs.% allocated',
      rec.week_start, rec.laborer_count, rec.total_allocated;
  END LOOP;
END $$;
