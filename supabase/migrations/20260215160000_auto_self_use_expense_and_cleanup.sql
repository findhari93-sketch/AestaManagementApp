-- Migration: Auto Self-Use Expense Creation + Orphaned Record Cleanup
-- Fixes:
-- 1. Self-use expense not created when inter-site settlement page flow is used
--    (only process_batch_settlement RPC created self-use expenses)
-- 2. Orphaned derived expenses left behind when settlements are deleted
-- 3. Retroactive cleanup of existing orphaned records

-- =====================================================
-- FUNCTION: create_self_use_expense_if_needed
-- Idempotent function to create self-use expense for a group stock batch
-- Safe to call multiple times - won't create duplicates
-- =====================================================

CREATE OR REPLACE FUNCTION create_self_use_expense_if_needed(p_batch_ref_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch RECORD;
  v_creditor_site_id UUID;
  v_self_use_expense_id UUID;
  v_self_use_expense_ref TEXT;
  v_self_use_material RECORD;
  v_batch_completed BOOLEAN;
  v_all_settled BOOLEAN;
  v_self_use_exists BOOLEAN;
BEGIN
  -- Get batch details
  SELECT
    mpe.id, mpe.ref_code, mpe.site_id AS batch_site_id, mpe.paying_site_id,
    mpe.site_group_id, mpe.total_amount, mpe.remaining_qty,
    mpe.self_used_qty, mpe.self_used_amount, mpe.status,
    mpe.bill_url, mpe.purchase_date
  INTO v_batch
  FROM material_purchase_expenses mpe
  WHERE mpe.ref_code = p_batch_ref_code AND mpe.purchase_type = 'group_stock';

  -- Exit if batch not found
  IF v_batch IS NULL THEN
    RETURN;
  END IF;

  -- Exit if no self-use to record
  IF COALESCE(v_batch.self_used_qty, 0) <= 0 OR COALESCE(v_batch.self_used_amount, 0) <= 0 THEN
    RETURN;
  END IF;

  -- Check if batch is fully used and all settlements are done
  SELECT
    v_batch.remaining_qty <= 0,
    NOT EXISTS (
      SELECT 1 FROM batch_usage_records
      WHERE batch_ref_code = p_batch_ref_code AND settlement_status = 'pending'
    )
  INTO v_batch_completed, v_all_settled;

  IF NOT v_batch_completed OR NOT v_all_settled THEN
    RETURN;
  END IF;

  -- Check if self-use expense already exists (idempotency)
  SELECT EXISTS (
    SELECT 1 FROM material_purchase_expenses
    WHERE original_batch_code = p_batch_ref_code AND settlement_reference = 'SELF-USE'
  ) INTO v_self_use_exists;

  IF v_self_use_exists THEN
    RETURN;
  END IF;

  -- Determine creditor site
  v_creditor_site_id := COALESCE(v_batch.paying_site_id, v_batch.batch_site_id);

  -- Mark batch as completed if not already
  IF v_batch.status <> 'completed' THEN
    UPDATE material_purchase_expenses
    SET status = 'completed', updated_at = NOW()
    WHERE ref_code = p_batch_ref_code;
  END IF;

  -- Generate self-use expense reference
  v_self_use_expense_ref := 'SELF-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 4));

  -- Create the self-use expense record
  INSERT INTO material_purchase_expenses (
    site_id, ref_code, purchase_type, vendor_name, purchase_date,
    total_amount, status, is_paid, paid_date, settlement_reference,
    settlement_date, original_batch_code, notes, bill_url
  ) VALUES (
    v_creditor_site_id,
    v_self_use_expense_ref,
    'own_site',
    'Self-Use from Group Stock',
    COALESCE(v_batch.purchase_date, CURRENT_DATE),
    v_batch.self_used_amount,
    'recorded',
    true,
    COALESCE(v_batch.purchase_date, CURRENT_DATE),
    'SELF-USE',
    CURRENT_DATE,
    p_batch_ref_code,
    'Self-use from batch ' || p_batch_ref_code || ' - ' || COALESCE(v_batch.self_used_qty, 0)::text || ' units',
    v_batch.bill_url
  ) RETURNING id INTO v_self_use_expense_id;

  -- Create expense items from self-use usage records
  FOR v_self_use_material IN
    SELECT
      material_id,
      brand_id,
      SUM(quantity) as total_qty,
      AVG(unit_cost) as avg_unit_cost
    FROM batch_usage_records
    WHERE batch_ref_code = p_batch_ref_code
      AND usage_site_id = v_creditor_site_id
      AND is_self_use = true
    GROUP BY material_id, brand_id
  LOOP
    INSERT INTO material_purchase_expense_items (purchase_expense_id, material_id, brand_id, quantity, unit_price)
    VALUES (v_self_use_expense_id, v_self_use_material.material_id, v_self_use_material.brand_id,
            v_self_use_material.total_qty, v_self_use_material.avg_unit_cost);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION create_self_use_expense_if_needed(TEXT) IS
'Idempotent function to create a self-use expense for a group stock batch creditor site.
Checks that batch is fully used, all settlements complete, and no self-use expense exists yet.
Safe to call multiple times.';

GRANT EXECUTE ON FUNCTION create_self_use_expense_if_needed(TEXT) TO authenticated;


-- =====================================================
-- TRIGGER FUNCTION: auto_self_use_on_settlement_complete
-- Called when inter_site_material_settlements.status changes to 'settled'
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_fn_auto_self_use_on_settlement_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only proceed if batch_ref_code is set
  IF NEW.batch_ref_code IS NOT NULL THEN
    PERFORM create_self_use_expense_if_needed(NEW.batch_ref_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_self_use_on_settlement_complete ON inter_site_material_settlements;

CREATE TRIGGER trigger_auto_self_use_on_settlement_complete
AFTER UPDATE ON inter_site_material_settlements
FOR EACH ROW
WHEN (NEW.status = 'settled' AND (OLD.status IS DISTINCT FROM 'settled') AND NEW.batch_ref_code IS NOT NULL)
EXECUTE FUNCTION trigger_fn_auto_self_use_on_settlement_complete();

-- Also fire on INSERT with status 'settled' (for process_batch_settlement which inserts directly as settled)
DROP TRIGGER IF EXISTS trigger_auto_self_use_on_settlement_insert ON inter_site_material_settlements;

CREATE TRIGGER trigger_auto_self_use_on_settlement_insert
AFTER INSERT ON inter_site_material_settlements
FOR EACH ROW
WHEN (NEW.status = 'settled' AND NEW.batch_ref_code IS NOT NULL)
EXECUTE FUNCTION trigger_fn_auto_self_use_on_settlement_complete();


-- =====================================================
-- TRIGGER FUNCTION: cascade_delete_settlement_derived_expenses
-- When a settlement is deleted, also delete its derived expenses
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_fn_cascade_delete_settlement_derived_expenses()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete derived expenses that reference this settlement's code
  -- material_purchase_expense_items are auto-deleted via FK CASCADE
  IF OLD.settlement_code IS NOT NULL THEN
    DELETE FROM material_purchase_expenses
    WHERE settlement_reference = OLD.settlement_code
      AND original_batch_code IS NOT NULL;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_cascade_delete_settlement_expenses ON inter_site_material_settlements;

CREATE TRIGGER trigger_cascade_delete_settlement_expenses
BEFORE DELETE ON inter_site_material_settlements
FOR EACH ROW EXECUTE FUNCTION trigger_fn_cascade_delete_settlement_derived_expenses();


-- =====================================================
-- ONE-TIME CLEANUP: Remove orphaned derived expenses
-- These are expenses where settlement_reference points to a
-- settlement that no longer exists
-- =====================================================

-- Delete orphaned expense items first (FK CASCADE would handle this, but be explicit)
DELETE FROM material_purchase_expense_items
WHERE purchase_expense_id IN (
  SELECT mpe.id
  FROM material_purchase_expenses mpe
  WHERE mpe.settlement_reference IS NOT NULL
    AND mpe.original_batch_code IS NOT NULL
    AND mpe.settlement_reference <> 'SELF-USE'
    AND NOT EXISTS (
      SELECT 1 FROM inter_site_material_settlements isms
      WHERE isms.settlement_code = mpe.settlement_reference
    )
);

-- Delete the orphaned expenses themselves
DELETE FROM material_purchase_expenses
WHERE settlement_reference IS NOT NULL
  AND original_batch_code IS NOT NULL
  AND settlement_reference <> 'SELF-USE'
  AND NOT EXISTS (
    SELECT 1 FROM inter_site_material_settlements isms
    WHERE isms.settlement_code = settlement_reference
  );


-- =====================================================
-- RETROACTIVE FIX: Create self-use expense for MAT-260214-2D7D
-- Batch is completed, self_used_qty=30, self_used_amount=8400
-- but self-use expense was never created
-- =====================================================

SELECT create_self_use_expense_if_needed('MAT-260214-2D7D');


-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
