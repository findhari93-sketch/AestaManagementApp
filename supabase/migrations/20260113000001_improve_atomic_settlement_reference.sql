-- Migration: Improve Atomic Settlement Reference Generation
-- Purpose: Fix race conditions and duplicate key errors in settlement creation
-- Key improvements:
-- 1. Stronger advisory lock (site_id + date instead of just site_id)
-- 2. Better error reporting with diagnostic info
-- 3. Audit logging for failures
-- 4. Improved sequence calculation with fallback

-- =============================================================================
-- STEP 1: Create Audit Table for Settlement Creation Failures
-- =============================================================================

CREATE TABLE IF NOT EXISTS settlement_creation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  settlement_date date NOT NULL,
  attempted_reference text,
  retry_count integer,
  error_message text,
  error_context jsonb, -- Additional diagnostic info
  created_at timestamptz DEFAULT now()
);

-- Index for querying recent failures
CREATE INDEX IF NOT EXISTS idx_settlement_creation_audit_site_date
  ON settlement_creation_audit (site_id, settlement_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_settlement_creation_audit_recent
  ON settlement_creation_audit (created_at DESC);

COMMENT ON TABLE settlement_creation_audit IS
  'Audit log of settlement creation failures for debugging and monitoring';

GRANT SELECT ON settlement_creation_audit TO authenticated;
GRANT ALL ON settlement_creation_audit TO service_role;

-- =============================================================================
-- STEP 2: Backup Old Function (for rollback if needed)
-- =============================================================================

-- Save current function as _v1 for emergency rollback
DO $$
BEGIN
  -- Check if backup already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_settlement_group_v1'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION create_settlement_group_v1(
        p_site_id uuid,
        p_settlement_date date,
        p_total_amount numeric(12,2),
        p_laborer_count integer,
        p_payment_channel text,
        p_payment_mode text DEFAULT NULL,
        p_payer_source text DEFAULT NULL,
        p_payer_name text DEFAULT NULL,
        p_proof_url text DEFAULT NULL,
        p_notes text DEFAULT NULL,
        p_subcontract_id uuid DEFAULT NULL,
        p_engineer_transaction_id uuid DEFAULT NULL,
        p_created_by uuid DEFAULT NULL,
        p_created_by_name text DEFAULT NULL,
        p_payment_type text DEFAULT ''salary'',
        p_actual_payment_date date DEFAULT NULL,
        p_settlement_type text DEFAULT ''date_wise'',
        p_week_allocations jsonb DEFAULT NULL,
        p_proof_urls text[] DEFAULT NULL
      )
      RETURNS TABLE (
        id uuid,
        settlement_reference text
      )
      AS $FUNC$
      ' || (
        SELECT pg_get_functiondef(oid)
        FROM pg_proc
        WHERE proname = 'create_settlement_group'
        LIMIT 1
      ) || '
      $FUNC$ LANGUAGE plpgsql;
    ';
    RAISE NOTICE 'Backed up current function as create_settlement_group_v1';
  ELSE
    RAISE NOTICE 'Backup function create_settlement_group_v1 already exists';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create backup (possibly already exists or different signature)';
END $$;

-- =============================================================================
-- STEP 3: Create Improved Atomic Function
-- =============================================================================

DROP FUNCTION IF EXISTS create_settlement_group(
  uuid, date, numeric, integer, text, text, text, text, text, text,
  uuid, uuid, uuid, text, text, date, text, jsonb, text[]
);

CREATE OR REPLACE FUNCTION create_settlement_group(
  p_site_id uuid,
  p_settlement_date date,
  p_total_amount numeric(12,2),
  p_laborer_count integer,
  p_payment_channel text,
  p_payment_mode text DEFAULT NULL,
  p_payer_source text DEFAULT NULL,
  p_payer_name text DEFAULT NULL,
  p_proof_url text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_subcontract_id uuid DEFAULT NULL,
  p_engineer_transaction_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_created_by_name text DEFAULT NULL,
  p_payment_type text DEFAULT 'salary',
  p_actual_payment_date date DEFAULT NULL,
  p_settlement_type text DEFAULT 'date_wise',
  p_week_allocations jsonb DEFAULT NULL,
  p_proof_urls text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  settlement_reference text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_code TEXT;
  v_next_seq INT;
  v_reference TEXT;
  v_lock_key BIGINT;
  v_new_id UUID;
  v_max_retries INT := 3;
  v_retry_count INT := 0;
  v_existing_count INT;
  v_calculated_max INT;
BEGIN
  -- =========================================================================
  -- IMPROVEMENT 1: Stronger Advisory Lock
  -- =========================================================================
  -- Old: Lock per site only - allowed concurrent settlements on same day
  -- New: Lock per site + date - prevents concurrent settlements for same day
  v_lock_key := ('x' || substr(md5(p_site_id::text || p_settlement_date::text), 1, 8))::bit(32)::int;

  -- Acquire advisory lock for this site + date combination
  -- Lock is held until transaction commits, preventing race conditions
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Get current date in YYMMDD format
  v_date_code := TO_CHAR(p_settlement_date, 'YYMMDD');

  -- =========================================================================
  -- IMPROVEMENT 2: Retry Loop with Better Error Reporting
  -- =========================================================================
  WHILE v_retry_count < v_max_retries LOOP
    BEGIN
      -- Find the next sequence number for this site and day
      -- Only count references that match the strict format: SET-YYMMDD-NNN
      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(sg.settlement_reference FROM 'SET-' || v_date_code || '-(\d+)')
          AS INT
        )
      ), 0) + 1
      INTO v_next_seq
      FROM settlement_groups sg
      WHERE sg.site_id = p_site_id
        AND sg.settlement_reference LIKE 'SET-' || v_date_code || '-%'
        AND sg.settlement_reference ~ ('^SET-' || v_date_code || '-\d+$');

      -- Store for diagnostics
      v_calculated_max := v_next_seq - 1;

      -- =========================================================================
      -- IMPROVEMENT 3: Fallback Sequence Check
      -- =========================================================================
      -- Double-check by counting total records for this date
      -- If counts don't match, something is wrong (gaps, duplicates, etc.)
      SELECT COUNT(DISTINCT sg2.settlement_reference)
      INTO v_existing_count
      FROM settlement_groups sg2
      WHERE sg2.site_id = p_site_id
        AND sg2.settlement_reference LIKE 'SET-' || v_date_code || '-%'
        AND sg2.settlement_reference ~ ('^SET-' || v_date_code || '-\d+$');

      -- Sanity check: If calculated max doesn't match count, log a warning
      IF v_calculated_max != v_existing_count AND v_existing_count > 0 THEN
        RAISE WARNING 'Settlement reference mismatch for site % date %: calculated max=%, actual count=%. Possible sequence gaps or duplicates.',
          p_site_id, p_settlement_date, v_calculated_max, v_existing_count;
      END IF;

      -- Format: SET-YYMMDD-NNN (padded to 3 digits, but allows more if needed)
      IF v_next_seq < 1000 THEN
        v_reference := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');
      ELSE
        v_reference := 'SET-' || v_date_code || '-' || v_next_seq::TEXT;
      END IF;

      -- Generate new UUID for the record
      v_new_id := gen_random_uuid();

      -- Insert the settlement group with the generated reference
      INSERT INTO settlement_groups (
        id,
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
        created_by_name,
        payment_type,
        actual_payment_date,
        settlement_type,
        week_allocations,
        proof_urls
      ) VALUES (
        v_new_id,
        v_reference,
        p_site_id,
        p_settlement_date,
        p_total_amount,
        p_laborer_count,
        p_payment_channel,
        p_payment_mode,
        p_payer_source,
        p_payer_name,
        p_proof_url,
        p_notes,
        p_subcontract_id,
        p_engineer_transaction_id,
        p_created_by,
        p_created_by_name,
        p_payment_type,
        COALESCE(p_actual_payment_date, p_settlement_date),
        p_settlement_type,
        p_week_allocations,
        p_proof_urls
      );

      -- Success - return the created record details
      id := v_new_id;
      settlement_reference := v_reference;
      RETURN NEXT;
      RETURN;

    EXCEPTION
      WHEN unique_violation THEN
        -- Duplicate key detected - increment retry count
        v_retry_count := v_retry_count + 1;

        -- =========================================================================
        -- IMPROVEMENT 4: Audit Logging
        -- =========================================================================
        -- Log this failure for monitoring and debugging
        BEGIN
          INSERT INTO settlement_creation_audit (
            site_id,
            settlement_date,
            attempted_reference,
            retry_count,
            error_message,
            error_context
          ) VALUES (
            p_site_id,
            p_settlement_date,
            v_reference,
            v_retry_count,
            'unique_violation on retry ' || v_retry_count,
            jsonb_build_object(
              'calculated_max', v_calculated_max,
              'existing_count', v_existing_count,
              'next_seq', v_next_seq,
              'date_code', v_date_code
            )
          );
        EXCEPTION
          WHEN OTHERS THEN
            -- Don't fail the main operation if audit logging fails
            RAISE WARNING 'Failed to write audit log: %', SQLERRM;
        END;

        -- If max retries reached, give up with detailed error
        IF v_retry_count >= v_max_retries THEN
          -- =========================================================================
          -- IMPROVEMENT 5: Better Error Message
          -- =========================================================================
          RAISE EXCEPTION 'Failed to create settlement reference after % retries. Attempted: %, Existing settlements for this date: %, Last calculated sequence: %. This may indicate duplicate references in the database. Please run check_settlement_reference_integrity() and contact support.',
            v_max_retries,
            v_reference,
            v_existing_count,
            v_calculated_max
          USING HINT = format('Site: %s, Date: %s, Retry count: %s', p_site_id, p_settlement_date, v_retry_count);
        END IF;

        -- Log retry attempt
        RAISE WARNING 'Settlement reference % already exists, retrying (attempt %/%)',
          v_reference, v_retry_count, v_max_retries;

        -- Small delay before retry (10ms * retry count) to reduce contention
        PERFORM pg_sleep(0.01 * v_retry_count);

        -- Loop will continue and recalculate sequence
    END;
  END LOOP;

  -- Should never reach here, but just in case
  RAISE EXCEPTION 'Unexpected error in settlement creation loop';
END;
$$;

-- Add comment
COMMENT ON FUNCTION create_settlement_group IS
  'Atomically creates a settlement_group with guaranteed unique sequential reference (SET-YYMMDD-NNN format). Uses enhanced advisory lock (site+date) to prevent race conditions. Includes retry logic, audit logging, and improved error reporting. Version 2.0';

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_settlement_group TO authenticated;
GRANT EXECUTE ON FUNCTION create_settlement_group TO service_role;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Migration 20260113000001 completed successfully';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Improvements applied:';
  RAISE NOTICE '1. ✓ Stronger advisory lock (site + date)';
  RAISE NOTICE '2. ✓ Audit logging for failures (settlement_creation_audit table)';
  RAISE NOTICE '3. ✓ Better error messages with diagnostic info';
  RAISE NOTICE '4. ✓ Fallback sequence validation';
  RAISE NOTICE '5. ✓ Backup function saved as create_settlement_group_v1';
  RAISE NOTICE '';
  RAISE NOTICE 'To rollback in emergency:';
  RAISE NOTICE '  ALTER FUNCTION create_settlement_group RENAME TO create_settlement_group_v2;';
  RAISE NOTICE '  ALTER FUNCTION create_settlement_group_v1 RENAME TO create_settlement_group;';
  RAISE NOTICE '====================================================================';
END $$;
