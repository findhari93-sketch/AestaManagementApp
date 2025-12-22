-- Migration: Migrate existing settlement data to settlement_groups
-- Purpose: Convert existing paid attendance records to new settlement_groups architecture

-- ============================================================================
-- PART 1: Migrate Engineer Wallet Settlements
-- These are grouped by engineer_transaction_id
-- ============================================================================

DO $$
DECLARE
  v_tx RECORD;
  v_group_id UUID;
  v_reference TEXT;
  v_daily_count INT;
  v_market_count INT;
  v_total_amount NUMERIC;
BEGIN
  -- Loop through each engineer transaction that has linked attendance records
  FOR v_tx IN
    SELECT DISTINCT
      et.id as tx_id,
      et.site_id,
      et.transaction_date,
      et.amount,
      et.payment_mode,
      et.notes,
      et.proof_url,
      et.related_subcontract_id,
      et.recorded_by_user_id,
      et.recorded_by,
      da.payer_source,
      da.payer_name
    FROM site_engineer_transactions et
    LEFT JOIN daily_attendance da ON da.engineer_transaction_id = et.id
    WHERE et.transaction_type = 'received_from_company'
      AND et.settlement_status IN ('pending_settlement', 'pending_confirmation', 'confirmed')
      AND EXISTS (
        SELECT 1 FROM daily_attendance d WHERE d.engineer_transaction_id = et.id
        UNION
        SELECT 1 FROM market_laborer_attendance m WHERE m.engineer_transaction_id = et.id
      )
  LOOP
    -- Generate reference for this group
    v_reference := generate_settlement_reference(v_tx.site_id);

    -- Count daily laborers
    SELECT COUNT(*), COALESCE(SUM(daily_earnings), 0)
    INTO v_daily_count, v_total_amount
    FROM daily_attendance
    WHERE engineer_transaction_id = v_tx.tx_id;

    -- Count market laborers and add to total
    SELECT COALESCE(SUM(count), 0), COALESCE(SUM(total_cost), 0)
    INTO v_market_count
    FROM market_laborer_attendance
    WHERE engineer_transaction_id = v_tx.tx_id;

    -- Add market cost to total if exists
    v_total_amount := v_total_amount + COALESCE(
      (SELECT SUM(total_cost) FROM market_laborer_attendance WHERE engineer_transaction_id = v_tx.tx_id),
      0
    );

    -- Use transaction amount if our calculated total is 0
    IF v_total_amount = 0 OR v_total_amount IS NULL THEN
      v_total_amount := v_tx.amount;
    END IF;

    -- Create settlement group
    INSERT INTO settlement_groups (
      settlement_reference,
      site_id,
      settlement_date,
      total_amount,
      laborer_count,
      payment_channel,
      payment_mode,
      payer_source,
      payer_name,
      proof_url,
      notes,
      subcontract_id,
      engineer_transaction_id,
      created_by,
      created_by_name
    ) VALUES (
      v_reference,
      v_tx.site_id,
      v_tx.transaction_date,
      v_total_amount,
      v_daily_count + v_market_count,
      'engineer_wallet',
      v_tx.payment_mode,
      v_tx.payer_source,
      v_tx.payer_name,
      v_tx.proof_url,
      v_tx.notes,
      v_tx.related_subcontract_id,
      v_tx.tx_id,
      v_tx.recorded_by_user_id,
      v_tx.recorded_by
    )
    RETURNING id INTO v_group_id;

    -- Update daily attendance with group id
    UPDATE daily_attendance
    SET settlement_group_id = v_group_id
    WHERE engineer_transaction_id = v_tx.tx_id;

    -- Update market attendance with group id
    UPDATE market_laborer_attendance
    SET settlement_group_id = v_group_id
    WHERE engineer_transaction_id = v_tx.tx_id;

    RAISE NOTICE 'Migrated engineer wallet settlement % -> group %', v_tx.tx_id, v_group_id;
  END LOOP;
END $$;

-- ============================================================================
-- PART 2: Migrate Direct Payment Settlements
-- These are paid records without engineer_transaction_id
-- Group by site_id, payment_date, payer_source
-- ============================================================================

DO $$
DECLARE
  v_group RECORD;
  v_group_id UUID;
  v_reference TEXT;
  v_daily_count INT;
  v_market_count INT;
  v_total_amount NUMERIC;
BEGIN
  -- Loop through distinct groups of direct payments
  FOR v_group IN
    SELECT DISTINCT
      da.site_id,
      da.payment_date,
      da.payer_source,
      da.payer_name,
      da.payment_mode,
      da.subcontract_id,
      da.payment_proof_url
    FROM daily_attendance da
    WHERE da.is_paid = true
      AND da.paid_via = 'direct'
      AND da.engineer_transaction_id IS NULL
      AND da.settlement_group_id IS NULL  -- Not already migrated
      AND da.payment_date IS NOT NULL
  LOOP
    -- Generate reference for this group
    v_reference := generate_settlement_reference(v_group.site_id);

    -- Count and sum daily records for this group
    SELECT COUNT(*), COALESCE(SUM(daily_earnings), 0)
    INTO v_daily_count, v_total_amount
    FROM daily_attendance
    WHERE site_id = v_group.site_id
      AND payment_date = v_group.payment_date
      AND COALESCE(payer_source, '') = COALESCE(v_group.payer_source, '')
      AND paid_via = 'direct'
      AND engineer_transaction_id IS NULL
      AND settlement_group_id IS NULL;

    -- Count market records for same group
    SELECT COALESCE(SUM(count), 0), COALESCE(SUM(total_cost), 0)
    INTO v_market_count
    FROM market_laborer_attendance
    WHERE site_id = v_group.site_id
      AND payment_date = v_group.payment_date
      AND COALESCE(payer_source, '') = COALESCE(v_group.payer_source, '')
      AND paid_via = 'direct'
      AND engineer_transaction_id IS NULL
      AND settlement_group_id IS NULL;

    v_total_amount := v_total_amount + COALESCE(
      (SELECT SUM(total_cost) FROM market_laborer_attendance
       WHERE site_id = v_group.site_id
         AND payment_date = v_group.payment_date
         AND COALESCE(payer_source, '') = COALESCE(v_group.payer_source, '')
         AND paid_via = 'direct'
         AND engineer_transaction_id IS NULL
         AND settlement_group_id IS NULL),
      0
    );

    -- Skip if no records found
    IF v_daily_count = 0 AND v_market_count = 0 THEN
      CONTINUE;
    END IF;

    -- Create settlement group
    INSERT INTO settlement_groups (
      settlement_reference,
      site_id,
      settlement_date,
      total_amount,
      laborer_count,
      payment_channel,
      payment_mode,
      payer_source,
      payer_name,
      proof_url,
      subcontract_id
    ) VALUES (
      v_reference,
      v_group.site_id,
      v_group.payment_date,
      v_total_amount,
      v_daily_count + v_market_count,
      'direct',
      v_group.payment_mode,
      v_group.payer_source,
      v_group.payer_name,
      v_group.payment_proof_url,
      v_group.subcontract_id
    )
    RETURNING id INTO v_group_id;

    -- Update daily attendance with group id
    UPDATE daily_attendance
    SET settlement_group_id = v_group_id
    WHERE site_id = v_group.site_id
      AND payment_date = v_group.payment_date
      AND COALESCE(payer_source, '') = COALESCE(v_group.payer_source, '')
      AND paid_via = 'direct'
      AND engineer_transaction_id IS NULL
      AND settlement_group_id IS NULL;

    -- Update market attendance with group id
    UPDATE market_laborer_attendance
    SET settlement_group_id = v_group_id
    WHERE site_id = v_group.site_id
      AND payment_date = v_group.payment_date
      AND COALESCE(payer_source, '') = COALESCE(v_group.payer_source, '')
      AND paid_via = 'direct'
      AND engineer_transaction_id IS NULL
      AND settlement_group_id IS NULL;

    RAISE NOTICE 'Migrated direct payment group % -> group %', v_group.payment_date, v_group_id;
  END LOOP;
END $$;

-- ============================================================================
-- PART 3: Soft-delete old labor expenses that have engineer_transaction_id
-- These are now derived from settlement_groups via v_all_expenses view
-- ============================================================================

UPDATE expenses
SET
  is_deleted = true,
  description = description || ' [Migrated to settlement_groups]'
WHERE module = 'labor'
  AND engineer_transaction_id IS NOT NULL
  AND is_deleted = false;

-- Log how many were soft-deleted
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM expenses
  WHERE description LIKE '%[Migrated to settlement_groups]%';

  RAISE NOTICE 'Soft-deleted % labor expenses that were migrated to settlement_groups', v_count;
END $$;

-- ============================================================================
-- PART 4: Add migration audit log
-- ============================================================================

-- Create a simple log entry for auditing
DO $$
DECLARE
  v_groups_count INT;
  v_daily_linked INT;
  v_market_linked INT;
BEGIN
  SELECT COUNT(*) INTO v_groups_count FROM settlement_groups;
  SELECT COUNT(*) INTO v_daily_linked FROM daily_attendance WHERE settlement_group_id IS NOT NULL;
  SELECT COUNT(*) INTO v_market_linked FROM market_laborer_attendance WHERE settlement_group_id IS NOT NULL;

  RAISE NOTICE '=== Migration Summary ===';
  RAISE NOTICE 'Settlement groups created: %', v_groups_count;
  RAISE NOTICE 'Daily attendance records linked: %', v_daily_linked;
  RAISE NOTICE 'Market attendance records linked: %', v_market_linked;
  RAISE NOTICE '========================';
END $$;
