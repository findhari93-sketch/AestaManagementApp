-- Migration: Atomic Settlement Reference Generation
-- This function creates a settlement_group with guaranteed unique sequential reference
-- by generating the reference and inserting in a single atomic transaction

-- Drop the function if it exists (for idempotency)
DROP FUNCTION IF EXISTS create_settlement_group(
  uuid, date, numeric, integer, text, text, text, text, text, text,
  uuid, uuid, uuid, text, text, date, text, jsonb, text[]
);

-- Create the atomic function with all settlement_groups columns supported
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
BEGIN
  -- Create unique lock key from site_id (using hash of site_id)
  v_lock_key := ('x' || substr(md5(p_site_id::text), 1, 8))::bit(32)::int;

  -- Acquire advisory lock for this site (held until transaction commits)
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Get current date in YYMMDD format
  v_date_code := TO_CHAR(p_settlement_date, 'YYMMDD');

  -- Retry loop for handling any edge cases
  WHILE v_retry_count < v_max_retries LOOP
    BEGIN
      -- Find the next sequence number for this site and day
      -- Only count numeric suffixes to maintain clean sequential numbering
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
        -- Duplicate key - increment retry count and try again
        v_retry_count := v_retry_count + 1;
        IF v_retry_count >= v_max_retries THEN
          RAISE EXCEPTION 'Failed to create settlement after % retries due to duplicate key', v_max_retries;
        END IF;
        -- Loop will continue and recalculate sequence
    END;
  END LOOP;
END;
$$;

-- Add comment
COMMENT ON FUNCTION create_settlement_group IS 'Atomically creates a settlement_group with guaranteed unique sequential reference (SET-YYMMDD-NNN format). Uses advisory lock to prevent race conditions.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_settlement_group TO authenticated;
GRANT EXECUTE ON FUNCTION create_settlement_group TO service_role;
