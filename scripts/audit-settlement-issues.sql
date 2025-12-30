-- Audit Script: Analyze Settlement Issues
-- Run this BEFORE and AFTER migration to compare results
-- Usage: psql -f scripts/audit-settlement-issues.sql

\echo '============================================================'
\echo 'SETTLEMENT ISSUES AUDIT REPORT'
\echo '============================================================'
\echo ''

-- 1. Count settlement_groups by subcontract status
\echo '--- 1. Settlement Groups by Subcontract Status ---'
SELECT
  CASE
    WHEN subcontract_id IS NULL THEN 'Unlinked (NULL)'
    ELSE 'Linked to Subcontract'
  END as status,
  COUNT(*) as count
FROM settlement_groups
WHERE is_cancelled = false
GROUP BY (subcontract_id IS NULL)
ORDER BY status;

\echo ''

-- 2. Settlement groups created by migration (System Migration)
\echo '--- 2. Settlement Groups Created by Migration ---'
SELECT
  created_by_name,
  COUNT(*) as count,
  SUM(CASE WHEN subcontract_id IS NULL THEN 1 ELSE 0 END) as unlinked_count
FROM settlement_groups
WHERE is_cancelled = false
GROUP BY created_by_name
ORDER BY count DESC;

\echo ''

-- 3. Dates with multiple settlement_groups (potential duplicates)
\echo '--- 3. Dates with DUPLICATE Settlement Groups ---'
SELECT
  site_id,
  settlement_date,
  COUNT(*) as settlement_count,
  STRING_AGG(settlement_reference, ', ' ORDER BY settlement_reference) as references
FROM settlement_groups
WHERE is_cancelled = false
  AND (payment_type IS NULL OR payment_type NOT IN ('advance', 'other'))
GROUP BY site_id, settlement_date
HAVING COUNT(*) > 1
ORDER BY settlement_date DESC
LIMIT 20;

\echo ''

-- 4. Daily attendance records unlinked vs linked
\echo '--- 4. Daily Attendance Subcontract Status ---'
SELECT
  CASE
    WHEN subcontract_id IS NULL THEN 'Unlinked'
    ELSE 'Linked'
  END as status,
  COUNT(*) as count
FROM daily_attendance
WHERE is_paid = true
GROUP BY (subcontract_id IS NULL);

\echo ''

-- 5. Market attendance records unlinked vs linked
\echo '--- 5. Market Attendance Subcontract Status ---'
SELECT
  CASE
    WHEN subcontract_id IS NULL THEN 'Unlinked'
    ELSE 'Linked'
  END as status,
  COUNT(*) as count
FROM market_laborer_attendance
WHERE is_paid = true
GROUP BY (subcontract_id IS NULL);

\echo ''

-- 6. Mismatch between settlement_group and attendance subcontract_id
\echo '--- 6. Records with Mismatched Subcontract (attendance vs settlement_group) ---'
SELECT
  'daily_attendance' as table_name,
  COUNT(*) as mismatched_count
FROM daily_attendance da
JOIN settlement_groups sg ON da.settlement_group_id = sg.id
WHERE da.subcontract_id IS DISTINCT FROM sg.subcontract_id
  AND (da.subcontract_id IS NOT NULL OR sg.subcontract_id IS NOT NULL)
UNION ALL
SELECT
  'market_laborer_attendance' as table_name,
  COUNT(*) as mismatched_count
FROM market_laborer_attendance ma
JOIN settlement_groups sg ON ma.settlement_group_id = sg.id
WHERE ma.subcontract_id IS DISTINCT FROM sg.subcontract_id
  AND (ma.subcontract_id IS NOT NULL OR sg.subcontract_id IS NOT NULL);

\echo ''

-- 7. Settlement groups that COULD get subcontract from attendance
\echo '--- 7. Unlinked Settlement Groups that Could Be Fixed ---'
SELECT COUNT(*) as fixable_count
FROM settlement_groups sg
WHERE sg.subcontract_id IS NULL
  AND sg.is_cancelled = false
  AND (
    EXISTS (
      SELECT 1 FROM daily_attendance da
      WHERE da.settlement_group_id = sg.id AND da.subcontract_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM market_laborer_attendance ma
      WHERE ma.settlement_group_id = sg.id AND ma.subcontract_id IS NOT NULL
    )
  );

\echo ''

-- 8. Total expense records by type (from v_all_expenses view)
\echo '--- 8. Expense Records by Type ---'
SELECT
  expense_type,
  COUNT(*) as count,
  SUM(CASE WHEN contract_id IS NULL THEN 1 ELSE 0 END) as unlinked_count
FROM v_all_expenses
WHERE is_deleted = false
GROUP BY expense_type
ORDER BY count DESC;

\echo ''
\echo '============================================================'
\echo 'END OF AUDIT REPORT'
\echo '============================================================'
