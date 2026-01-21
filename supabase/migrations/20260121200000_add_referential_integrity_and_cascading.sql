-- Migration: Add Referential Integrity and Cascading Operations
-- Purpose: Ensure all tables in the group stock flow are properly linked
-- and that any deletion/update cascades to related records

-- =====================================================
-- Step 1: Add Missing Columns
-- =====================================================

-- Add batch_ref_code to inter_site_material_settlements if not exists
ALTER TABLE inter_site_material_settlements
ADD COLUMN IF NOT EXISTS batch_ref_code TEXT;

-- Add settlement_id to group_stock_transactions if not exists
-- (The table has batch_code, not batch_ref_code, so we'll work with batch_code)
ALTER TABLE group_stock_transactions
ADD COLUMN IF NOT EXISTS settlement_id UUID;

-- Rename batch_code to batch_ref_code for consistency
-- Only if batch_ref_code doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'group_stock_transactions'
    AND column_name = 'batch_ref_code'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'group_stock_transactions'
    AND column_name = 'batch_code'
  ) THEN
    ALTER TABLE group_stock_transactions
    RENAME COLUMN batch_code TO batch_ref_code;
  END IF;
END $$;

-- =====================================================
-- Step 2: Add Foreign Key Constraints with CASCADE behavior
-- =====================================================

-- Note: We use ON DELETE CASCADE to automatically delete related records
-- when the parent record is deleted

-- 1. batch_usage_records → material_purchase_expenses
ALTER TABLE batch_usage_records
DROP CONSTRAINT IF EXISTS batch_usage_records_batch_ref_code_fkey;

ALTER TABLE batch_usage_records
ADD CONSTRAINT batch_usage_records_batch_ref_code_fkey
FOREIGN KEY (batch_ref_code)
REFERENCES material_purchase_expenses(ref_code)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 2. batch_usage_records → inter_site_material_settlements
ALTER TABLE batch_usage_records
DROP CONSTRAINT IF EXISTS batch_usage_records_settlement_id_fkey;

ALTER TABLE batch_usage_records
ADD CONSTRAINT batch_usage_records_settlement_id_fkey
FOREIGN KEY (settlement_id)
REFERENCES inter_site_material_settlements(id)
ON DELETE SET NULL  -- When settlement deleted, reset to pending
ON UPDATE CASCADE;

-- 3. group_stock_transactions → material_purchase_expenses
ALTER TABLE group_stock_transactions
DROP CONSTRAINT IF EXISTS group_stock_transactions_batch_ref_code_fkey;

ALTER TABLE group_stock_transactions
ADD CONSTRAINT group_stock_transactions_batch_ref_code_fkey
FOREIGN KEY (batch_ref_code)
REFERENCES material_purchase_expenses(ref_code)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 4. group_stock_transactions → inter_site_material_settlements
ALTER TABLE group_stock_transactions
DROP CONSTRAINT IF EXISTS group_stock_transactions_settlement_id_fkey;

ALTER TABLE group_stock_transactions
ADD CONSTRAINT group_stock_transactions_settlement_id_fkey
FOREIGN KEY (settlement_id)
REFERENCES inter_site_material_settlements(id)
ON DELETE SET NULL  -- When settlement deleted, reset to pending
ON UPDATE CASCADE;

-- 5. inter_site_material_settlements → material_purchase_expenses
ALTER TABLE inter_site_material_settlements
DROP CONSTRAINT IF EXISTS inter_site_material_settlements_batch_ref_code_fkey;

ALTER TABLE inter_site_material_settlements
ADD CONSTRAINT inter_site_material_settlements_batch_ref_code_fkey
FOREIGN KEY (batch_ref_code)
REFERENCES material_purchase_expenses(ref_code)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 6. material_purchase_expense_items → material_purchase_expenses
-- This already exists with proper CASCADE from migration 20260118200000
-- Column is named 'purchase_expense_id' and already has foreign key
-- No need to modify

-- =====================================================
-- Step 3: Create Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_batch_usage_records_batch_ref ON batch_usage_records(batch_ref_code);
CREATE INDEX IF NOT EXISTS idx_batch_usage_records_settlement ON batch_usage_records(settlement_id);
CREATE INDEX IF NOT EXISTS idx_group_stock_transactions_batch_ref ON group_stock_transactions(batch_ref_code);
CREATE INDEX IF NOT EXISTS idx_group_stock_transactions_settlement ON group_stock_transactions(settlement_id);
CREATE INDEX IF NOT EXISTS idx_inter_site_settlements_batch ON inter_site_material_settlements(batch_ref_code);

-- =====================================================
-- Step 4: Create Trigger to Reset Usage Records When Settlement Deleted
-- =====================================================

-- When a settlement is deleted, reset related usage records to pending
CREATE OR REPLACE FUNCTION reset_usage_on_settlement_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset batch_usage_records
  UPDATE batch_usage_records
  SET
    settlement_id = NULL,
    settlement_status = 'pending',
    updated_at = NOW()
  WHERE settlement_id = OLD.id;

  -- Reset group_stock_transactions
  UPDATE group_stock_transactions
  SET
    settlement_id = NULL,
    updated_at = NOW()
  WHERE settlement_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reset_usage_on_settlement_delete ON inter_site_material_settlements;

CREATE TRIGGER trigger_reset_usage_on_settlement_delete
BEFORE DELETE ON inter_site_material_settlements
FOR EACH ROW
EXECUTE FUNCTION reset_usage_on_settlement_delete();

-- =====================================================
-- Step 5: Create Trigger to Sync Transaction and Batch Usage Records
-- =====================================================

-- When a transaction is deleted, also delete the corresponding batch usage record
CREATE OR REPLACE FUNCTION sync_transaction_batch_usage_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a usage transaction with a batch_ref_code, delete the batch usage record
  IF OLD.transaction_type = 'usage' AND OLD.batch_ref_code IS NOT NULL THEN
    DELETE FROM batch_usage_records
    WHERE batch_ref_code = OLD.batch_ref_code
      AND usage_site_id = OLD.usage_site_id
      AND material_id = OLD.material_id
      AND quantity = ABS(OLD.quantity);
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_transaction_batch_usage_delete ON group_stock_transactions;

CREATE TRIGGER trigger_sync_transaction_batch_usage_delete
BEFORE DELETE ON group_stock_transactions
FOR EACH ROW
EXECUTE FUNCTION sync_transaction_batch_usage_delete();

-- =====================================================
-- Step 6: Create Trigger to Update Batch Quantities
-- =====================================================

-- Automatically update batch remaining_qty and used_qty when usage changes
CREATE OR REPLACE FUNCTION update_batch_quantities_on_usage_change()
RETURNS TRIGGER AS $$
DECLARE
  v_batch RECORD;
  v_total_used NUMERIC;
BEGIN
  -- Get the batch ref code (works for both INSERT, UPDATE, and DELETE)
  DECLARE
    batch_ref TEXT;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      batch_ref := OLD.batch_ref_code;
    ELSE
      batch_ref := NEW.batch_ref_code;
    END IF;

    -- Get batch details
    SELECT
      id,
      ref_code,
      original_qty,
      status
    INTO v_batch
    FROM material_purchase_expenses
    WHERE ref_code = batch_ref
      AND purchase_type = 'group_stock';

    IF v_batch.id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    -- Calculate total used quantity from batch_usage_records
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_used
    FROM batch_usage_records
    WHERE batch_ref_code = batch_ref;

    -- Update the batch record
    UPDATE material_purchase_expenses
    SET
      used_qty = v_total_used,
      remaining_qty = COALESCE(original_qty, 0) - v_total_used,
      updated_at = NOW()
    WHERE ref_code = batch_ref;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_batch_on_usage_insert ON batch_usage_records;
DROP TRIGGER IF EXISTS trigger_update_batch_on_usage_update ON batch_usage_records;
DROP TRIGGER IF EXISTS trigger_update_batch_on_usage_delete ON batch_usage_records;

CREATE TRIGGER trigger_update_batch_on_usage_insert
AFTER INSERT ON batch_usage_records
FOR EACH ROW
EXECUTE FUNCTION update_batch_quantities_on_usage_change();

CREATE TRIGGER trigger_update_batch_on_usage_update
AFTER UPDATE ON batch_usage_records
FOR EACH ROW
EXECUTE FUNCTION update_batch_quantities_on_usage_change();

CREATE TRIGGER trigger_update_batch_on_usage_delete
AFTER DELETE ON batch_usage_records
FOR EACH ROW
EXECUTE FUNCTION update_batch_quantities_on_usage_change();

-- =====================================================
-- Step 7: Create Function to Delete Batch with All Related Records
-- =====================================================

-- This function safely deletes a batch and all related records in the correct order
CREATE OR REPLACE FUNCTION delete_batch_cascade(p_batch_ref_code TEXT)
RETURNS TABLE (
  deleted_settlements INT,
  deleted_usage_records INT,
  deleted_transactions INT,
  deleted_expense_items INT,
  deleted_batch BOOLEAN
) AS $$
DECLARE
  v_deleted_settlements INT := 0;
  v_deleted_usage_records INT := 0;
  v_deleted_transactions INT := 0;
  v_deleted_expense_items INT := 0;
  v_batch_id UUID;
BEGIN
  -- Get batch ID
  SELECT id INTO v_batch_id
  FROM material_purchase_expenses
  WHERE ref_code = p_batch_ref_code;

  IF v_batch_id IS NULL THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_ref_code;
  END IF;

  -- Delete settlements (this will trigger reset of usage records via trigger)
  DELETE FROM inter_site_material_settlements
  WHERE batch_ref_code = p_batch_ref_code;
  GET DIAGNOSTICS v_deleted_settlements = ROW_COUNT;

  -- Delete batch usage records (foreign key cascade will handle this, but be explicit)
  DELETE FROM batch_usage_records
  WHERE batch_ref_code = p_batch_ref_code;
  GET DIAGNOSTICS v_deleted_usage_records = ROW_COUNT;

  -- Delete transactions (foreign key cascade will handle this, but be explicit)
  DELETE FROM group_stock_transactions
  WHERE batch_ref_code = p_batch_ref_code;
  GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;

  -- Delete expense items (will cascade automatically when we delete the batch)
  -- Using purchase_expense_id since that's the actual column name
  SELECT COUNT(*) INTO v_deleted_expense_items
  FROM material_purchase_expense_items
  WHERE purchase_expense_id = v_batch_id;

  -- Delete the batch itself (this will cascade to expense_items)
  DELETE FROM material_purchase_expenses
  WHERE ref_code = p_batch_ref_code;

  RETURN QUERY SELECT
    v_deleted_settlements,
    v_deleted_usage_records,
    v_deleted_transactions,
    v_deleted_expense_items,
    TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_batch_cascade(TEXT) IS
'Safely deletes a batch and all related records (settlements, usage records, transactions, items).
Returns counts of deleted records for auditing.';

GRANT EXECUTE ON FUNCTION delete_batch_cascade(TEXT) TO authenticated;

-- =====================================================
-- Step 8: Backfill batch_ref_code for Existing Settlements
-- =====================================================

-- Update existing settlements that are missing batch_ref_code
-- We can derive it from batch_usage_records
UPDATE inter_site_material_settlements s
SET batch_ref_code = (
  SELECT DISTINCT bur.batch_ref_code
  FROM batch_usage_records bur
  WHERE bur.settlement_id = s.id
  LIMIT 1
)
WHERE s.batch_ref_code IS NULL
  AND EXISTS (
    SELECT 1 FROM batch_usage_records bur
    WHERE bur.settlement_id = s.id
  );

-- =====================================================
-- Final Comments
-- =====================================================

COMMENT ON TRIGGER trigger_reset_usage_on_settlement_delete ON inter_site_material_settlements IS
'Automatically resets batch_usage_records and group_stock_transactions to pending state when a settlement is deleted';

COMMENT ON TRIGGER trigger_sync_transaction_batch_usage_delete ON group_stock_transactions IS
'Automatically deletes the corresponding batch_usage_record when a usage transaction is deleted';

COMMENT ON TRIGGER trigger_update_batch_on_usage_insert ON batch_usage_records IS
'Automatically updates batch remaining_qty and used_qty when usage records are inserted';

COMMENT ON TRIGGER trigger_update_batch_on_usage_update ON batch_usage_records IS
'Automatically updates batch remaining_qty and used_qty when usage records are updated';

COMMENT ON TRIGGER trigger_update_batch_on_usage_delete ON batch_usage_records IS
'Automatically updates batch remaining_qty and used_qty when usage records are deleted';
