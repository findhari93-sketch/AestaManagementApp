-- Migration: Delete wrong labourer-wise settlement SET-251117-002
-- This settlement was incorrectly created by migration and needs to be removed
-- NOTE: Attendance records were already unlinked and labor_payments deleted in partial run

DO $$
DECLARE
  v_sg_id UUID;
  v_site_id UUID;
BEGIN
  -- Find the site
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  -- Find the settlement group
  SELECT id INTO v_sg_id
  FROM settlement_groups
  WHERE settlement_reference = 'SET-251117-002'
    AND site_id = v_site_id;

  IF v_sg_id IS NULL THEN
    RAISE NOTICE 'Settlement group SET-251117-002 not found - already deleted';
    RETURN;
  END IF;

  RAISE NOTICE 'Found settlement_group: %', v_sg_id;

  -- Ensure attendance records are unlinked (may already be done)
  UPDATE daily_attendance
  SET settlement_group_id = NULL,
      updated_at = NOW()
  WHERE settlement_group_id = v_sg_id;

  -- Ensure labor_payments are deleted (may already be done)
  DELETE FROM labor_payments
  WHERE settlement_group_id = v_sg_id;

  -- Delete the settlement group entirely
  DELETE FROM settlement_groups
  WHERE id = v_sg_id;

  RAISE NOTICE 'Settlement group SET-251117-002 has been DELETED';
  RAISE NOTICE '=== CLEANUP COMPLETE ===';
END $$;

-- Verify the deletion
DO $$
DECLARE
  v_site_id UUID;
  v_exists BOOLEAN;
BEGIN
  SELECT id INTO v_site_id
  FROM sites WHERE name ILIKE '%Srinivasan%' LIMIT 1;

  SELECT EXISTS(
    SELECT 1 FROM settlement_groups
    WHERE settlement_reference = 'SET-251117-002'
      AND site_id = v_site_id
  ) INTO v_exists;

  RAISE NOTICE '=== VERIFICATION ===';
  IF v_exists THEN
    RAISE WARNING 'Settlement SET-251117-002 still exists!';
  ELSE
    RAISE NOTICE 'SUCCESS: Settlement SET-251117-002 deleted!';
  END IF;
END $$;
