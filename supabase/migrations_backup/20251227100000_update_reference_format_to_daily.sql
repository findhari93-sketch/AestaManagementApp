-- Migration: Update reference code format from YYYYMM to YYMMDD
-- Purpose: Change all reference codes to include full date (YYMMDD) instead of just month (YYYYMM)
-- This makes sequences reset daily instead of monthly

-- ============================================================================
-- 1. Update generate_settlement_reference function
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_settlement_reference(p_site_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_code TEXT;
  v_next_seq INT;
  v_reference TEXT;
BEGIN
  -- Get current date in YYMMDD format (was YYYYMM)
  v_date_code := TO_CHAR(CURRENT_DATE, 'YYMMDD');

  -- Find the next sequence number for this site and day
  -- Extract the number from existing references like SET-241225-001
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(settlement_reference FROM 'SET-' || v_date_code || '-(\d+)')
      AS INT
    )
  ), 0) + 1
  INTO v_next_seq
  FROM settlement_groups
  WHERE site_id = p_site_id
    AND settlement_reference LIKE 'SET-' || v_date_code || '-%';

  -- Format: SET-YYMMDD-NNN (padded to 3 digits)
  v_reference := 'SET-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_reference;
END;
$$;

COMMENT ON FUNCTION generate_settlement_reference IS 'Generates unique settlement reference in SET-YYMMDD-NNN format, auto-incrementing per site per day';

-- ============================================================================
-- 2. Update generate_payment_reference function
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_payment_reference(p_site_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_code TEXT;
  v_next_seq INT;
  v_reference TEXT;
BEGIN
  -- Get current date in YYMMDD format (was YYYYMM)
  v_date_code := TO_CHAR(CURRENT_DATE, 'YYMMDD');

  -- Find the next sequence number for this site and day
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(payment_reference FROM 'PAY-' || v_date_code || '-(\d+)')
      AS INT
    )
  ), 0) + 1
  INTO v_next_seq
  FROM labor_payments
  WHERE site_id = p_site_id
    AND payment_reference LIKE 'PAY-' || v_date_code || '-%';

  -- Format: PAY-YYMMDD-NNN (e.g., PAY-241225-001)
  v_reference := 'PAY-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_reference;
END;
$$;

COMMENT ON FUNCTION generate_payment_reference(UUID) IS 'Generates unique payment reference in PAY-YYMMDD-NNN format. Sequence resets daily per site.';

-- ============================================================================
-- 3. Update generate_batch_code function
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_batch_code(p_payer_source TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_date_code TEXT;
  v_sequence INT;
  v_code TEXT;
BEGIN
  -- Map payer_source to prefix
  v_prefix := CASE p_payer_source
    WHEN 'trust_account' THEN 'TRUST'
    WHEN 'amma_money' THEN 'AMMA'
    WHEN 'mothers_money' THEN 'AMMA'  -- Legacy support
    WHEN 'client_money' THEN 'CLIENT'
    WHEN 'own_money' THEN 'OWN'
    WHEN 'other_site_money' THEN 'SITE'
    WHEN 'custom' THEN 'OTHER'
    ELSE 'MISC'
  END;

  -- Get current date in YYMMDD format (was YYYYMM)
  v_date_code := TO_CHAR(NOW(), 'YYMMDD');

  -- Get next sequence for this prefix+date combination
  SELECT COALESCE(MAX(
    CASE
      WHEN batch_code ~ ('^' || v_prefix || '-' || v_date_code || '-[0-9]+$')
      THEN CAST(SPLIT_PART(batch_code, '-', 3) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence
  FROM site_engineer_transactions
  WHERE batch_code LIKE v_prefix || '-' || v_date_code || '-%';

  -- Format: PREFIX-YYMMDD-NNN (padded to 3 digits)
  v_code := v_prefix || '-' || v_date_code || '-' || LPAD(v_sequence::TEXT, 3, '0');

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_batch_code(TEXT) IS 'Generates unique batch code for wallet deposits like TRUST-241225-001. Sequence resets daily.';

-- ============================================================================
-- 4. Update schema comments
-- ============================================================================
COMMENT ON COLUMN settlement_groups.settlement_reference IS 'Unique human-readable reference code (SET-YYMMDD-NNN format)';
