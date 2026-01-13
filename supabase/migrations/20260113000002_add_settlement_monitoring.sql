-- Migration: Add Settlement Creation Monitoring
-- Purpose: Create views and functions to monitor settlement creation failures
-- Helps identify patterns and alert on high failure rates

-- =============================================================================
-- STEP 1: Create View for Settlement Creation Failures
-- =============================================================================

CREATE OR REPLACE VIEW v_settlement_creation_failures AS
SELECT
  date_trunc('hour', created_at) as failure_hour,
  site_id,
  settlement_date,
  COUNT(*) as failure_count,
  array_agg(DISTINCT attempted_reference) as attempted_references,
  array_agg(DISTINCT error_message) as error_types,
  max(retry_count) as max_retries,
  min(created_at) as first_failure,
  max(created_at) as last_failure
FROM settlement_creation_audit
GROUP BY date_trunc('hour', created_at), site_id, settlement_date
HAVING COUNT(*) >= 2 -- Only show if 2+ failures in same hour
ORDER BY failure_hour DESC, failure_count DESC;

COMMENT ON VIEW v_settlement_creation_failures IS
  'Aggregated view of settlement creation failures. Shows sites/dates with 2+ failures per hour. Use for monitoring and alerting.';

GRANT SELECT ON v_settlement_creation_failures TO authenticated;

-- =============================================================================
-- STEP 2: Create Function to Get Settlement Reference Stats
-- =============================================================================

CREATE OR REPLACE FUNCTION get_settlement_reference_stats(
  p_site_id uuid,
  p_days_back integer DEFAULT 30
)
RETURNS TABLE (
  settlement_date date,
  total_settlements integer,
  max_sequence integer,
  min_sequence integer,
  has_gaps boolean,
  has_duplicates boolean,
  duplicate_references text[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH date_stats AS (
    SELECT
      sg.settlement_date,
      COUNT(*) as total,
      MAX(
        CAST(
          SUBSTRING(sg.settlement_reference FROM 'SET-\d{6}-(\d+)')
          AS INTEGER
        )
      ) as max_seq,
      MIN(
        CAST(
          SUBSTRING(sg.settlement_reference FROM 'SET-\d{6}-(\d+)')
          AS INTEGER
        )
      ) as min_seq
    FROM settlement_groups sg
    WHERE sg.site_id = p_site_id
      AND sg.settlement_date >= CURRENT_DATE - p_days_back
      AND NOT sg.is_cancelled
      AND sg.settlement_reference ~ '^SET-\d{6}-\d+$'
    GROUP BY sg.settlement_date
  ),
  duplicates AS (
    SELECT
      sg.settlement_date,
      array_agg(sg.settlement_reference) as dup_refs
    FROM settlement_groups sg
    WHERE sg.site_id = p_site_id
      AND sg.settlement_date >= CURRENT_DATE - p_days_back
      AND NOT sg.is_cancelled
    GROUP BY sg.settlement_date, sg.settlement_reference
    HAVING COUNT(*) > 1
  )
  SELECT
    ds.settlement_date,
    ds.total::integer,
    ds.max_seq::integer,
    ds.min_seq::integer,
    (ds.max_seq - ds.min_seq + 1 != ds.total) as has_gaps,
    (d.dup_refs IS NOT NULL) as has_duplicates,
    COALESCE(d.dup_refs, ARRAY[]::text[]) as duplicate_references
  FROM date_stats ds
  LEFT JOIN duplicates d ON ds.settlement_date = d.settlement_date
  ORDER BY ds.settlement_date DESC;
END;
$$;

COMMENT ON FUNCTION get_settlement_reference_stats IS
  'Get daily statistics for settlement references for a site. Shows total settlements, sequence ranges, gaps, and duplicates. Useful for detecting data quality issues.';

GRANT EXECUTE ON FUNCTION get_settlement_reference_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_settlement_reference_stats TO service_role;

-- =============================================================================
-- STEP 3: Create Function to Get Recent Failure Summary
-- =============================================================================

CREATE OR REPLACE FUNCTION get_recent_settlement_failures(
  p_hours_back integer DEFAULT 24,
  p_site_id uuid DEFAULT NULL
)
RETURNS TABLE (
  site_id uuid,
  failure_count bigint,
  unique_dates integer,
  most_recent_failure timestamptz,
  common_error_patterns text[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    sca.site_id,
    COUNT(*) as failure_count,
    COUNT(DISTINCT sca.settlement_date)::integer as unique_dates,
    MAX(sca.created_at) as most_recent_failure,
    array_agg(DISTINCT sca.error_message) as common_error_patterns
  FROM settlement_creation_audit sca
  WHERE sca.created_at >= (now() - (p_hours_back || ' hours')::interval)
    AND (p_site_id IS NULL OR sca.site_id = p_site_id)
  GROUP BY sca.site_id
  HAVING COUNT(*) >= 3 -- Only show sites with 3+ failures
  ORDER BY failure_count DESC;
$$;

COMMENT ON FUNCTION get_recent_settlement_failures IS
  'Get summary of settlement creation failures in the last N hours. Shows sites with 3+ failures. Pass NULL for p_site_id to see all sites.';

GRANT EXECUTE ON FUNCTION get_recent_settlement_failures TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_settlement_failures TO service_role;

-- =============================================================================
-- STEP 4: Create Alert Function
-- =============================================================================

CREATE OR REPLACE FUNCTION check_settlement_failure_alerts()
RETURNS TABLE (
  alert_level text,
  alert_message text,
  site_id uuid,
  details jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_failures bigint;
  v_sites_affected integer;
BEGIN
  -- Check for critical: >10 failures in last hour for any site
  FOR site_id, v_total_failures IN
    SELECT
      sca.site_id,
      COUNT(*)
    FROM settlement_creation_audit sca
    WHERE sca.created_at >= (now() - interval '1 hour')
    GROUP BY sca.site_id
    HAVING COUNT(*) > 10
  LOOP
    alert_level := 'CRITICAL';
    alert_message := format('Settlement creation failing repeatedly for site (10+ failures in last hour)');
    details := jsonb_build_object(
      'failure_count', v_total_failures,
      'site_id', check_settlement_failure_alerts.site_id,
      'time_window', '1 hour'
    );
    RETURN NEXT;
  END LOOP;

  -- Check for warning: >5 failures in last hour for any site
  FOR site_id, v_total_failures IN
    SELECT
      sca.site_id,
      COUNT(*)
    FROM settlement_creation_audit sca
    WHERE sca.created_at >= (now() - interval '1 hour')
    GROUP BY sca.site_id
    HAVING COUNT(*) BETWEEN 5 AND 10
  LOOP
    alert_level := 'WARNING';
    alert_message := format('Increased settlement creation failures for site (5+ in last hour)');
    details := jsonb_build_object(
      'failure_count', v_total_failures,
      'site_id', check_settlement_failure_alerts.site_id,
      'time_window', '1 hour'
    );
    RETURN NEXT;
  END LOOP;

  -- Check for info: Multiple sites failing in last 24 hours
  SELECT COUNT(DISTINCT sca.site_id)
  INTO v_sites_affected
  FROM settlement_creation_audit sca
  WHERE sca.created_at >= (now() - interval '24 hours');

  IF v_sites_affected >= 3 THEN
    alert_level := 'INFO';
    alert_message := format('Settlement failures affecting multiple sites (%s sites)', v_sites_affected);
    site_id := NULL;
    details := jsonb_build_object(
      'sites_affected', v_sites_affected,
      'time_window', '24 hours'
    );
    RETURN NEXT;
  END IF;

  -- If no alerts, return nothing (empty table)
  RETURN;
END;
$$;

COMMENT ON FUNCTION check_settlement_failure_alerts IS
  'Check for settlement creation failure patterns that require attention. Returns CRITICAL/WARNING/INFO alerts based on failure frequency.';

GRANT EXECUTE ON FUNCTION check_settlement_failure_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION check_settlement_failure_alerts TO service_role;

-- =============================================================================
-- STEP 5: Create Cleanup Function for Old Audit Records
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_settlement_audit_records(
  p_days_to_keep integer DEFAULT 90
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM settlement_creation_audit
  WHERE created_at < (now() - (p_days_to_keep || ' days')::interval);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % old audit records (older than % days)', v_deleted_count, p_days_to_keep;

  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_settlement_audit_records IS
  'Delete settlement creation audit records older than specified days (default 90). Returns count of deleted records. Run periodically to prevent audit table bloat.';

GRANT EXECUTE ON FUNCTION cleanup_old_settlement_audit_records TO service_role;
-- DO NOT grant to authenticated - only admins should run cleanup

-- =============================================================================
-- STEP 6: Create Materialized View for Daily Summary (Optional Performance Optimization)
-- =============================================================================

-- This materialized view can be refreshed daily for faster dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_settlement_failures_daily AS
SELECT
  date_trunc('day', created_at)::date as failure_date,
  site_id,
  COUNT(*) as total_failures,
  COUNT(DISTINCT settlement_date) as unique_dates_affected,
  COUNT(DISTINCT attempted_reference) as unique_references_attempted,
  array_agg(DISTINCT error_message) as error_types,
  max(retry_count) as max_retries_seen
FROM settlement_creation_audit
GROUP BY date_trunc('day', created_at), site_id;

-- Create unique index for efficient refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_settlement_failures_daily_pk
  ON mv_settlement_failures_daily (failure_date, site_id);

COMMENT ON MATERIALIZED VIEW mv_settlement_failures_daily IS
  'Daily aggregated view of settlement creation failures. Refresh daily for dashboard metrics. Run: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_settlement_failures_daily;';

GRANT SELECT ON mv_settlement_failures_daily TO authenticated;

-- =============================================================================
-- STEP 7: Create Scheduled Job for Daily Refresh (If pg_cron is available)
-- =============================================================================

-- Note: This requires pg_cron extension. If not available, refresh manually
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Refresh materialized view daily at 1 AM
    PERFORM cron.schedule(
      'refresh-settlement-failures-daily',
      '0 1 * * *', -- Every day at 1 AM
      $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_settlement_failures_daily$$
    );
    RAISE NOTICE 'Scheduled daily refresh of mv_settlement_failures_daily at 1 AM';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Please refresh mv_settlement_failures_daily manually or via application cron job.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
END $outer$;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
DECLARE
  v_recent_failures bigint;
  v_total_failures bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_recent_failures
  FROM settlement_creation_audit
  WHERE created_at >= (now() - interval '24 hours');

  SELECT COUNT(*)
  INTO v_total_failures
  FROM settlement_creation_audit;

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Migration 20260113000002 completed successfully';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Monitoring components created:';
  RAISE NOTICE '1. ✓ v_settlement_creation_failures view';
  RAISE NOTICE '2. ✓ get_settlement_reference_stats() function';
  RAISE NOTICE '3. ✓ get_recent_settlement_failures() function';
  RAISE NOTICE '4. ✓ check_settlement_failure_alerts() function';
  RAISE NOTICE '5. ✓ cleanup_old_settlement_audit_records() function';
  RAISE NOTICE '6. ✓ mv_settlement_failures_daily materialized view';
  RAISE NOTICE '';
  RAISE NOTICE 'Current Status:';
  RAISE NOTICE '  Total audit records: %', v_total_failures;
  RAISE NOTICE '  Failures in last 24 hours: %', v_recent_failures;
  RAISE NOTICE '';
  RAISE NOTICE 'Useful Queries:';
  RAISE NOTICE '  • Check alerts: SELECT * FROM check_settlement_failure_alerts();';
  RAISE NOTICE '  • Recent failures: SELECT * FROM get_recent_settlement_failures(24);';
  RAISE NOTICE '  • Site stats: SELECT * FROM get_settlement_reference_stats(''site-id'');';
  RAISE NOTICE '  • View summary: SELECT * FROM v_settlement_creation_failures LIMIT 10;';
  RAISE NOTICE '====================================================================';
END $$;
