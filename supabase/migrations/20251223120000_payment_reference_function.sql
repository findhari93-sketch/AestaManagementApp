-- Migration: Create function to generate unique payment reference codes
-- Purpose: Generate PAY-YYYYMM-NNN format reference codes (unique per payment)

-- Create or replace the function to generate payment reference
CREATE OR REPLACE FUNCTION generate_payment_reference(p_site_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year_month TEXT;
  v_next_seq INT;
  v_reference TEXT;
BEGIN
  -- Get current year-month
  v_year_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');

  -- Find the next sequence number for this site and month
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(payment_reference FROM 'PAY-' || v_year_month || '-(\d+)')
      AS INT
    )
  ), 0) + 1
  INTO v_next_seq
  FROM labor_payments
  WHERE site_id = p_site_id
    AND payment_reference LIKE 'PAY-' || v_year_month || '-%';

  -- Format: PAY-YYYYMM-NNN (e.g., PAY-202412-001)
  v_reference := 'PAY-' || v_year_month || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_reference;
END;
$$;

-- Add comment
COMMENT ON FUNCTION generate_payment_reference(UUID) IS 'Generates unique payment reference in PAY-YYYYMM-NNN format. Sequence resets monthly per site.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_payment_reference(UUID) TO authenticated;
