-- Migration: Sync stock_inventory when batch usage is recorded
-- Purpose: record_batch_usage() updates material_purchase_expenses.remaining_qty
--          but does NOT update stock_inventory.current_qty. This causes the
--          inventory page to show inflated total stock counts.
-- Fix: Add stock_inventory update to record_batch_usage() and reconcile existing data.
-- Date: 2026-02-14

-- =====================================================
-- Step 1: Replace record_batch_usage to also update stock_inventory
-- =====================================================

CREATE OR REPLACE FUNCTION public.record_batch_usage(
  p_batch_ref_code text,
  p_usage_site_id uuid,
  p_quantity numeric,
  p_usage_date date,
  p_work_description text DEFAULT NULL::text,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_batch RECORD;
  v_material RECORD;
  v_is_self_use BOOLEAN;
  v_settlement_status TEXT;
  v_usage_id UUID;
  v_unit_cost NUMERIC;
  v_new_remaining NUMERIC;
  v_new_used NUMERIC;
  -- Auto-completion variables
  v_creditor_site_id UUID;
  v_effective_total_amount NUMERIC;
  v_total_other_sites_cost NUMERIC;
  v_final_self_used_qty NUMERIC;
  v_final_self_used_amount NUMERIC;
  v_self_use_expense_id UUID;
  v_self_use_expense_ref TEXT;
  v_self_use_material RECORD;
BEGIN
  -- Get batch details
  SELECT mpe.*,
         (SELECT SUM(quantity) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id) as total_qty,
         (SELECT SUM(total_price) FROM material_purchase_expense_items WHERE purchase_expense_id = mpe.id) as items_total
  INTO v_batch
  FROM material_purchase_expenses mpe
  WHERE mpe.ref_code = p_batch_ref_code
    AND mpe.purchase_type = 'group_stock';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_ref_code;
  END IF;

  IF v_batch.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot add usage to completed batch: %', p_batch_ref_code;
  END IF;

  -- Check remaining quantity
  IF COALESCE(v_batch.remaining_qty, v_batch.original_qty, v_batch.total_qty) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient quantity in batch. Available: %, Requested: %',
      COALESCE(v_batch.remaining_qty, v_batch.original_qty, v_batch.total_qty), p_quantity;
  END IF;

  -- Get material details for unit
  SELECT m.* INTO v_material
  FROM materials m
  JOIN material_purchase_expense_items mpei ON mpei.material_id = m.id
  WHERE mpei.purchase_expense_id = v_batch.id
  LIMIT 1;

  -- Calculate unit cost
  v_unit_cost := COALESCE(v_batch.items_total, v_batch.total_amount) / NULLIF(COALESCE(v_batch.original_qty, v_batch.total_qty), 0);

  -- Determine if this is self-use
  v_is_self_use := (p_usage_site_id = v_batch.paying_site_id);
  v_settlement_status := CASE WHEN v_is_self_use THEN 'self_use' ELSE 'pending' END;

  -- Insert usage record
  INSERT INTO batch_usage_records (
    batch_ref_code,
    site_group_id,
    usage_site_id,
    material_id,
    brand_id,
    quantity,
    unit,
    unit_cost,
    usage_date,
    work_description,
    is_self_use,
    settlement_status,
    created_by
  )
  SELECT
    p_batch_ref_code,
    v_batch.site_group_id,
    p_usage_site_id,
    mpei.material_id,
    mpei.brand_id,
    p_quantity,
    COALESCE(v_material.unit, 'nos'),
    v_unit_cost,
    p_usage_date,
    p_work_description,
    v_is_self_use,
    v_settlement_status,
    p_created_by
  FROM material_purchase_expense_items mpei
  WHERE mpei.purchase_expense_id = v_batch.id
  LIMIT 1
  RETURNING id INTO v_usage_id;

  -- Calculate new quantities
  v_new_used := COALESCE(v_batch.used_qty, 0) + p_quantity;
  v_new_remaining := COALESCE(v_batch.original_qty, v_batch.total_qty, 0) - v_new_used;

  -- Update batch quantities with auto-complete status logic
  UPDATE material_purchase_expenses
  SET
    used_qty = v_new_used,
    remaining_qty = v_new_remaining,
    self_used_qty = CASE WHEN v_is_self_use THEN COALESCE(self_used_qty, 0) + p_quantity ELSE self_used_qty END,
    self_used_amount = CASE WHEN v_is_self_use THEN COALESCE(self_used_amount, 0) + (p_quantity * v_unit_cost) ELSE self_used_amount END,
    status = CASE
      WHEN v_new_remaining <= 0 THEN 'completed'           -- AUTO-COMPLETE at 100% usage
      WHEN v_new_used > 0 AND v_new_remaining > 0 THEN 'partial_used'
      ELSE status
    END,
    updated_at = now()
  WHERE ref_code = p_batch_ref_code;

  -- =====================================================
  -- SYNC STOCK INVENTORY: Decrement current_qty
  -- The stock_inventory row is identified by batch_code = ref_code
  -- =====================================================
  UPDATE stock_inventory
  SET
    current_qty = GREATEST(current_qty - p_quantity, 0),
    last_issued_date = p_usage_date,
    updated_at = now()
  WHERE batch_code = p_batch_ref_code
    AND current_qty > 0;

  -- =====================================================
  -- AUTO-COMPLETE: Create self-use expense when remaining hits 0
  -- =====================================================
  IF v_new_remaining <= 0 THEN
    v_creditor_site_id := COALESCE(v_batch.paying_site_id, v_batch.site_id);

    -- Calculate self-use quantity from batch_usage_records
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_final_self_used_qty
    FROM batch_usage_records
    WHERE batch_ref_code = p_batch_ref_code
      AND is_self_use = true;

    -- Calculate total cost used by OTHER sites (non-self-use)
    SELECT COALESCE(SUM(total_cost), 0)
    INTO v_total_other_sites_cost
    FROM batch_usage_records
    WHERE batch_ref_code = p_batch_ref_code
      AND is_self_use = false;

    -- Self-use amount = Total paid - Amount used by other sites
    v_effective_total_amount := COALESCE(v_batch.amount_paid, v_batch.total_amount);
    v_final_self_used_amount := v_effective_total_amount - v_total_other_sites_cost;

    -- Update batch with final self-use figures
    UPDATE material_purchase_expenses
    SET
      self_used_qty = v_final_self_used_qty,
      self_used_amount = GREATEST(v_final_self_used_amount, 0),
      updated_at = now()
    WHERE ref_code = p_batch_ref_code;

    -- Only create self-use expense if there IS self-use
    IF v_final_self_used_qty > 0 AND v_final_self_used_amount > 0 THEN

      -- Check no duplicate self-use expense exists
      IF NOT EXISTS (
        SELECT 1 FROM material_purchase_expenses
        WHERE original_batch_code = p_batch_ref_code
          AND settlement_reference = 'SELF-USE'
          AND site_id = v_creditor_site_id
      ) THEN

        -- Generate reference code
        v_self_use_expense_ref := 'SELF-' || TO_CHAR(NOW(), 'YYMMDD') || '-'
          || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 4));

        -- Create self-use material_purchase_expense for paying site
        INSERT INTO material_purchase_expenses (
          site_id,
          ref_code,
          purchase_type,
          vendor_name,
          purchase_date,
          total_amount,
          transport_cost,
          status,
          is_paid,
          paid_date,
          settlement_reference,
          settlement_date,
          original_batch_code,
          site_group_id,
          created_by,
          notes,
          bill_url
        ) VALUES (
          v_creditor_site_id,
          v_self_use_expense_ref,
          'own_site',
          'Self-Use from Group Stock',
          COALESCE(v_batch.purchase_date, CURRENT_DATE),
          v_final_self_used_amount,
          0,
          'recorded',
          true,
          COALESCE(v_batch.purchase_date, CURRENT_DATE),
          'SELF-USE',
          CURRENT_DATE,
          p_batch_ref_code,
          v_batch.site_group_id,
          p_created_by,
          'Auto-completed: Self-use from batch ' || p_batch_ref_code,
          v_batch.bill_url
        )
        RETURNING id INTO v_self_use_expense_id;

        -- Create expense items from the original batch items (proportional to self-use)
        FOR v_self_use_material IN
          SELECT
            mpei.material_id,
            mpei.brand_id,
            mpei.quantity as item_qty,
            mpei.unit_price
          FROM material_purchase_expense_items mpei
          WHERE mpei.purchase_expense_id = v_batch.id
        LOOP
          INSERT INTO material_purchase_expense_items (
            purchase_expense_id,
            material_id,
            brand_id,
            quantity,
            unit_price,
            notes
          ) VALUES (
            v_self_use_expense_id,
            v_self_use_material.material_id,
            v_self_use_material.brand_id,
            -- Proportional quantity: (self_used_qty / original_qty) * item_qty
            CASE
              WHEN COALESCE(v_batch.original_qty, v_batch.total_qty, 0) > 0
              THEN (v_final_self_used_qty / COALESCE(v_batch.original_qty, v_batch.total_qty)) * v_self_use_material.item_qty
              ELSE 0
            END,
            v_self_use_material.unit_price,
            'Self-use from batch ' || p_batch_ref_code
          );
        END LOOP;

      END IF;  -- duplicate check
    END IF;  -- self-use exists check
  END IF;  -- remaining <= 0 check

  RETURN v_usage_id;
END;
$function$;

COMMENT ON FUNCTION public.record_batch_usage(TEXT, UUID, NUMERIC, DATE, TEXT, UUID) IS
'Records usage from a specific site against a group stock batch.
Automatically determines if it is self-use (usage_site = paying_site).
Updates batch quantities, stock_inventory, and status accordingly.
AUTO-COMPLETES when remaining_qty reaches 0:
- Sets status to completed
- Decrements stock_inventory.current_qty
- Creates self-use expense for the paying site
- Does NOT create inter-site settlements (those are manual)';

-- =====================================================
-- Step 2: Reconcile existing stock_inventory data
-- Fix batches where usage was recorded but stock_inventory wasn't decremented
-- =====================================================

UPDATE stock_inventory si
SET
  current_qty = GREATEST(COALESCE(mpe.remaining_qty, 0), 0),
  updated_at = now()
FROM material_purchase_expenses mpe
WHERE si.batch_code = mpe.ref_code
  AND mpe.purchase_type = 'group_stock'
  AND si.current_qty != GREATEST(COALESCE(mpe.remaining_qty, 0), 0);
