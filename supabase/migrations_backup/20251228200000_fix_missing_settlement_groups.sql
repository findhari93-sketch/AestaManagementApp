-- Migration: Fix paid records missing settlement_group_id
-- Purpose: Create settlement_groups for paid daily_attendance and market_laborer_attendance
--          records that have is_paid=true but no settlement_group_id
-- Root cause: DailySettlementDialog.tsx was directly setting is_paid=true without creating settlement_groups

-- ============================================================================
-- 1. Create temporary table to hold grouped settlements
-- ============================================================================
CREATE TEMP TABLE temp_missing_settlements AS
WITH daily_missing AS (
  SELECT
    site_id,
    date,
    id as attendance_id,
    'daily' as source_type,
    daily_earnings as amount,
    payment_mode,
    payment_proof_url,
    payment_notes,
    payer_source
  FROM daily_attendance
  WHERE is_paid = true
    AND settlement_group_id IS NULL
),
market_missing AS (
  SELECT
    site_id,
    date,
    id as attendance_id,
    'market' as source_type,
    total_cost as amount,
    payment_mode,
    payment_proof_url,
    payment_notes,
    payer_source
  FROM market_laborer_attendance
  WHERE is_paid = true
    AND settlement_group_id IS NULL
),
all_missing AS (
  SELECT * FROM daily_missing
  UNION ALL
  SELECT * FROM market_missing
),
grouped AS (
  SELECT
    site_id,
    date,
    SUM(amount) as total_amount,
    COUNT(*) as laborer_count,
    -- Take first non-null values for these fields
    (array_agg(payment_mode) FILTER (WHERE payment_mode IS NOT NULL))[1] as payment_mode,
    (array_agg(payment_proof_url) FILTER (WHERE payment_proof_url IS NOT NULL))[1] as proof_url,
    (array_agg(payment_notes) FILTER (WHERE payment_notes IS NOT NULL))[1] as notes,
    (array_agg(payer_source) FILTER (WHERE payer_source IS NOT NULL))[1] as payer_source
  FROM all_missing
  GROUP BY site_id, date
)
SELECT * FROM grouped;

-- ============================================================================
-- 2. Create settlement_groups for each missing group
-- Uses GLOBAL sequence per month (not per site) to ensure uniqueness
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_year_month TEXT;
  v_next_seq INT;
  v_settlement_reference TEXT;
  v_settlement_group_id UUID;
BEGIN
  -- Process each group of missing settlements
  FOR rec IN SELECT * FROM temp_missing_settlements ORDER BY site_id, date
  LOOP
    -- Use the settlement date's month for reference (not CURRENT_DATE)
    v_year_month := TO_CHAR(rec.date, 'YYYYMM');

    -- Find the next GLOBAL sequence number for this month (across ALL sites)
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(settlement_reference FROM 'SET-' || v_year_month || '-(\d+)')
        AS INT
      )
    ), 0) + 1
    INTO v_next_seq
    FROM settlement_groups
    WHERE settlement_reference LIKE 'SET-' || v_year_month || '-%';

    -- Format: SET-YYYYMM-NNN (padded to 3 digits)
    v_settlement_reference := 'SET-' || v_year_month || '-' || LPAD(v_next_seq::TEXT, 3, '0');

    -- Create the settlement_group
    INSERT INTO settlement_groups (
      settlement_reference,
      site_id,
      settlement_date,
      total_amount,
      laborer_count,
      payment_channel,
      payment_mode,
      payer_source,
      proof_url,
      notes,
      created_by_name
    ) VALUES (
      v_settlement_reference,
      rec.site_id,
      rec.date,
      rec.total_amount,
      rec.laborer_count,
      'direct',  -- These were direct payments (not via engineer wallet)
      rec.payment_mode,
      COALESCE(rec.payer_source, 'client_money'),  -- Default to client_money if not set
      rec.proof_url,
      COALESCE(rec.notes, 'Settlement group created by migration fix'),
      'System Migration'
    )
    RETURNING id INTO v_settlement_group_id;

    -- Update daily_attendance records for this site/date
    UPDATE daily_attendance
    SET settlement_group_id = v_settlement_group_id
    WHERE site_id = rec.site_id
      AND date = rec.date
      AND is_paid = true
      AND settlement_group_id IS NULL;

    -- Update market_laborer_attendance records for this site/date
    UPDATE market_laborer_attendance
    SET settlement_group_id = v_settlement_group_id
    WHERE site_id = rec.site_id
      AND date = rec.date
      AND is_paid = true
      AND settlement_group_id IS NULL;

    RAISE NOTICE 'Created settlement_group % for site % date %', v_settlement_reference, rec.site_id, rec.date;
  END LOOP;
END $$;

-- ============================================================================
-- 3. Cleanup
-- ============================================================================
DROP TABLE IF EXISTS temp_missing_settlements;

-- ============================================================================
-- 4. Verify no orphaned paid records remain
-- ============================================================================
DO $$
DECLARE
  daily_orphan_count INT;
  market_orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO daily_orphan_count
  FROM daily_attendance
  WHERE is_paid = true AND settlement_group_id IS NULL;

  SELECT COUNT(*) INTO market_orphan_count
  FROM market_laborer_attendance
  WHERE is_paid = true AND settlement_group_id IS NULL;

  IF daily_orphan_count > 0 OR market_orphan_count > 0 THEN
    RAISE WARNING 'Still have orphaned paid records: daily=%, market=%', daily_orphan_count, market_orphan_count;
  ELSE
    RAISE NOTICE 'All paid records now have settlement_group_id';
  END IF;
END $$;
