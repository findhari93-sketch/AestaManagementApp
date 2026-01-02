-- Migration: Cancel 4 specific orphaned settlement_groups
-- Purpose: These 4 settlement_groups were created by migration but don't have corresponding
--          daily/market settlements. They show as "Daily Salary" in expenses incorrectly.
--
-- Records to cancel:
--   SET-202512-048 (Dec 22) - ₹3,000
--   SET-202512-043 (Dec 14) - ₹5,200
--   SET-202512-041 (Dec 04) - ₹7,600
--   SET-202511-008 (Nov 23) - ₹2,000

-- ============================================================================
-- 1. Cancel the 4 specific settlement_groups
-- ============================================================================
UPDATE settlement_groups
SET
  is_cancelled = true,
  cancelled_at = NOW(),
  cancelled_by = 'Manual Cleanup',
  cancellation_reason = 'Orphaned settlement - no corresponding daily/market settlement exists'
WHERE settlement_reference IN (
  'SET-202512-048',
  'SET-202512-043',
  'SET-202512-041',
  'SET-202511-008'
)
AND is_cancelled = false;

-- ============================================================================
-- 2. Unlink attendance records from these cancelled settlements
--    Keep is_paid status intact
-- ============================================================================

-- Unlink daily_attendance records
UPDATE daily_attendance da
SET settlement_group_id = NULL
WHERE da.settlement_group_id IN (
  SELECT id FROM settlement_groups
  WHERE settlement_reference IN (
    'SET-202512-048',
    'SET-202512-043',
    'SET-202512-041',
    'SET-202511-008'
  )
);

-- Unlink market_laborer_attendance records
UPDATE market_laborer_attendance mla
SET settlement_group_id = NULL
WHERE mla.settlement_group_id IN (
  SELECT id FROM settlement_groups
  WHERE settlement_reference IN (
    'SET-202512-048',
    'SET-202512-043',
    'SET-202512-041',
    'SET-202511-008'
  )
);

-- ============================================================================
-- 3. Verify
-- ============================================================================
DO $$
DECLARE
  cancelled_count INT;
BEGIN
  SELECT COUNT(*) INTO cancelled_count
  FROM settlement_groups
  WHERE settlement_reference IN (
    'SET-202512-048',
    'SET-202512-043',
    'SET-202512-041',
    'SET-202511-008'
  )
  AND is_cancelled = true;

  RAISE NOTICE 'Cancelled % settlement_groups', cancelled_count;
END $$;
