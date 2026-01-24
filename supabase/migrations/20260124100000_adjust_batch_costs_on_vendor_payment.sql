-- Migration: Adjust Batch Costs When Vendor Payment Differs from Original
-- Purpose: When a vendor is paid a bargained amount (less than original),
-- automatically adjust unit_cost and total_cost in batch_usage_records
-- and group_stock_transactions so inter-site settlements use the correct amounts

-- =====================================================
-- Step 1: Create Function to Adjust Batch Costs
-- =====================================================

CREATE OR REPLACE FUNCTION adjust_batch_costs_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_adjustment_ratio NUMERIC;
  v_updated_usage INT;
  v_updated_transactions INT;
BEGIN
  -- Only run when:
  -- 1. amount_paid is set/changed
  -- 2. is_paid is TRUE
  -- 3. amount_paid differs from total_amount
  -- 4. total_amount is positive (avoid division by zero)
  IF NEW.amount_paid IS NOT NULL
     AND NEW.is_paid = TRUE
     AND (OLD.amount_paid IS NULL OR NEW.amount_paid != OLD.amount_paid)
     AND NEW.amount_paid != NEW.total_amount
     AND NEW.total_amount > 0 THEN

    -- Calculate the adjustment ratio
    v_adjustment_ratio := NEW.amount_paid::NUMERIC / NEW.total_amount::NUMERIC;

    -- Adjust batch_usage_records (only unit_cost, total_cost is generated)
    UPDATE batch_usage_records
    SET
      unit_cost = unit_cost * v_adjustment_ratio,
      updated_at = NOW()
    WHERE batch_ref_code = NEW.ref_code;
    GET DIAGNOSTICS v_updated_usage = ROW_COUNT;

    -- Adjust group_stock_transactions (only unit_cost, total_cost is generated)
    UPDATE group_stock_transactions
    SET
      unit_cost = unit_cost * v_adjustment_ratio,
      updated_at = NOW()
    WHERE batch_ref_code = NEW.ref_code
      AND transaction_type = 'usage';
    GET DIAGNOSTICS v_updated_transactions = ROW_COUNT;

    -- Log for debugging
    RAISE NOTICE 'Adjusted batch costs for %: ratio=%, updated % usage records, % transactions',
      NEW.ref_code, v_adjustment_ratio, v_updated_usage, v_updated_transactions;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION adjust_batch_costs_on_payment() IS
'Automatically adjusts batch_usage_records and group_stock_transactions costs
when a vendor is paid a different amount than the original calculated amount.
This ensures inter-site settlements use the actual paid amount, not the original.';

-- =====================================================
-- Step 2: Create Trigger
-- =====================================================

DROP TRIGGER IF EXISTS trigger_adjust_batch_costs_on_payment ON material_purchase_expenses;

CREATE TRIGGER trigger_adjust_batch_costs_on_payment
AFTER UPDATE ON material_purchase_expenses
FOR EACH ROW
WHEN (NEW.is_paid = TRUE AND NEW.amount_paid IS NOT NULL)
EXECUTE FUNCTION adjust_batch_costs_on_payment();

COMMENT ON TRIGGER trigger_adjust_batch_costs_on_payment ON material_purchase_expenses IS
'Triggers cost adjustment when vendor payment is recorded with a bargained amount.';

-- =====================================================
-- Step 3: Create Function to Manually Adjust Existing Data
-- =====================================================

CREATE OR REPLACE FUNCTION adjust_batch_costs_manual(p_batch_ref_code TEXT, p_amount_paid NUMERIC)
RETURNS TABLE (
  updated_usage_records INT,
  updated_transactions INT,
  adjustment_ratio NUMERIC
) AS $$
DECLARE
  v_original_amount NUMERIC;
  v_ratio NUMERIC;
  v_updated_usage INT := 0;
  v_updated_transactions INT := 0;
BEGIN
  -- Get original amount from the batch
  SELECT total_amount INTO v_original_amount
  FROM material_purchase_expenses
  WHERE ref_code = p_batch_ref_code;

  IF v_original_amount IS NULL THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_ref_code;
  END IF;

  IF v_original_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid original amount for batch: %', p_batch_ref_code;
  END IF;

  v_ratio := p_amount_paid / v_original_amount;

  -- Adjust batch_usage_records (only unit_cost, total_cost is generated)
  UPDATE batch_usage_records
  SET
    unit_cost = unit_cost * v_ratio,
    updated_at = NOW()
  WHERE batch_ref_code = p_batch_ref_code;
  GET DIAGNOSTICS v_updated_usage = ROW_COUNT;

  -- Adjust group_stock_transactions (only unit_cost, total_cost is generated)
  UPDATE group_stock_transactions
  SET
    unit_cost = unit_cost * v_ratio,
    updated_at = NOW()
  WHERE batch_ref_code = p_batch_ref_code
    AND transaction_type = 'usage';
  GET DIAGNOSTICS v_updated_transactions = ROW_COUNT;

  -- Update the batch's amount_paid
  UPDATE material_purchase_expenses
  SET amount_paid = p_amount_paid
  WHERE ref_code = p_batch_ref_code;

  RETURN QUERY SELECT v_updated_usage, v_updated_transactions, v_ratio;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION adjust_batch_costs_manual(TEXT, NUMERIC) IS
'Manually adjust batch costs for existing data. Use when a batch was paid with
a bargained amount but the costs were not automatically adjusted.
Parameters: batch ref_code, actual amount paid to vendor';

GRANT EXECUTE ON FUNCTION adjust_batch_costs_manual(TEXT, NUMERIC) TO authenticated;

-- =====================================================
-- Step 4: Backfill Existing Data (if needed)
-- =====================================================

-- Adjust existing batches where amount_paid differs from total_amount
-- This is a one-time fix for data that existed before this trigger
DO $$
DECLARE
  r RECORD;
  v_ratio NUMERIC;
BEGIN
  FOR r IN
    SELECT ref_code, total_amount, amount_paid
    FROM material_purchase_expenses
    WHERE amount_paid IS NOT NULL
      AND is_paid = TRUE
      AND amount_paid != total_amount
      AND total_amount > 0
  LOOP
    v_ratio := r.amount_paid::NUMERIC / r.total_amount::NUMERIC;

    -- Adjust batch_usage_records (only unit_cost, total_cost is generated)
    UPDATE batch_usage_records
    SET
      unit_cost = unit_cost * v_ratio,
      updated_at = NOW()
    WHERE batch_ref_code = r.ref_code;

    -- Adjust group_stock_transactions (only unit_cost, total_cost is generated)
    UPDATE group_stock_transactions
    SET
      unit_cost = unit_cost * v_ratio,
      updated_at = NOW()
    WHERE batch_ref_code = r.ref_code
      AND transaction_type = 'usage';

    RAISE NOTICE 'Backfilled batch %: ratio=%', r.ref_code, v_ratio;
  END LOOP;
END $$;
