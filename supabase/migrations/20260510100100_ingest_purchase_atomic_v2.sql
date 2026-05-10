-- ingest_purchase_atomic v2:
--   1. Accept `source` in payload (defaults to 'ai_ingest' since this RPC is
--      currently only called from the AI ingestion dialog). Forward-compat
--      values: 'ai_ingest' | 'manual' | 'purchase_order' | 'group_conversion'.
--   2. Allow site_id to be NULL → catalog-only ingest. When site_id is NULL,
--      we skip creating material_purchase_expenses + items rows but still
--      perform the catalog/vendor/material/brand/price_history/vendor_inventory
--      updates so price discovery works without committing the bill to a site.
--
--   Returns a JSONB object with:
--     { purchase_id (nullable), ref_code (nullable), vendor_id, item_ids,
--       items_count, expense_created (bool) }

CREATE OR REPLACE FUNCTION public.ingest_purchase_atomic(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $body$
DECLARE
  v_site_id UUID;
  v_purchase_date DATE;
  v_total_amount NUMERIC;
  v_transport_cost NUMERIC;
  v_invoice_no TEXT;
  v_bill_url TEXT;
  v_payment_mode TEXT;
  v_purchase_type TEXT;
  v_source TEXT;
  v_vendor_id UUID;
  v_vendor_name TEXT;
  v_purchase_id UUID;
  v_ref_code TEXT;
  v_expense_created BOOLEAN := FALSE;
  v_item JSONB;
  v_item_index INT := 0;
  v_items_array JSONB;
  v_category_id UUID;
  v_parent_cat_id UUID;
  v_material_id UUID;
  v_brand_id UUID;
  v_qty NUMERIC;
  v_unit TEXT;
  v_unit_price NUMERIC;
  v_item_ids UUID[] := ARRAY[]::UUID[];
  v_new_item_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Header validation
  v_site_id := NULLIF(p_payload->>'site_id', '')::UUID;  -- nullable now
  v_purchase_date := (p_payload->>'purchase_date')::DATE;
  v_total_amount := (p_payload->>'total_amount')::NUMERIC;
  v_transport_cost := COALESCE((p_payload->>'transport_cost')::NUMERIC, 0);
  v_invoice_no := NULLIF(TRIM(COALESCE(p_payload->>'invoice_no', '')), '');
  v_bill_url := NULLIF(TRIM(COALESCE(p_payload->>'bill_url', '')), '');
  v_payment_mode := NULLIF(TRIM(COALESCE(p_payload->>'payment_mode', '')), '');
  v_purchase_type := COALESCE(p_payload->>'purchase_type', 'own_site');
  v_source := COALESCE(p_payload->>'source', 'ai_ingest');
  v_items_array := p_payload->'items';

  IF v_purchase_date IS NULL THEN
    RAISE EXCEPTION 'purchase_date is required';
  END IF;
  IF v_total_amount IS NULL OR v_total_amount <= 0 THEN
    RAISE EXCEPTION 'total_amount must be > 0';
  END IF;
  IF v_items_array IS NULL OR jsonb_array_length(v_items_array) = 0 THEN
    RAISE EXCEPTION 'items array must be non-empty';
  END IF;
  IF v_purchase_type NOT IN ('own_site', 'group_stock') THEN
    RAISE EXCEPTION 'purchase_type must be own_site or group_stock';
  END IF;
  IF v_source NOT IN ('manual', 'ai_ingest', 'purchase_order', 'group_conversion') THEN
    RAISE EXCEPTION 'source must be manual|ai_ingest|purchase_order|group_conversion';
  END IF;

  -- 1. Resolve vendor (always required for ingestion)
  v_vendor_id := _ai_ingest_resolve_vendor(p_payload->'vendor');
  SELECT name INTO v_vendor_name FROM vendors WHERE id = v_vendor_id;

  -- 2. Generate ref_code + insert expense header IFF site is provided
  IF v_site_id IS NOT NULL THEN
    IF v_purchase_type = 'group_stock' THEN
      v_ref_code := generate_group_stock_purchase_reference(v_site_id);
    ELSE
      v_ref_code := generate_material_purchase_reference(v_site_id);
    END IF;

    -- Insert purchase header (RLS check on site_id happens here).
    -- AI-ingest rows are marked paid by default — user is recording a bill
    -- they already paid out of pocket. PO-driven rows go through their own
    -- payment flow so leave them unpaid here.
    INSERT INTO material_purchase_expenses (
      site_id,
      ref_code,
      purchase_type,
      vendor_id,
      vendor_name,
      purchase_date,
      total_amount,
      transport_cost,
      payment_mode,
      payment_reference,
      bill_url,
      status,
      source,
      is_paid,
      paid_date,
      notes,
      created_by
    )
    VALUES (
      v_site_id,
      v_ref_code,
      v_purchase_type,
      v_vendor_id,
      v_vendor_name,
      v_purchase_date,
      v_total_amount,
      v_transport_cost,
      v_payment_mode,
      v_invoice_no,
      v_bill_url,
      'recorded',
      v_source,
      v_source = 'ai_ingest',                                    -- is_paid
      CASE WHEN v_source = 'ai_ingest' THEN v_purchase_date END, -- paid_date
      NULLIF(TRIM(COALESCE(p_payload->>'notes', '')), ''),
      auth.uid()
    )
    RETURNING id INTO v_purchase_id;

    v_expense_created := TRUE;
  END IF;

  -- 3. Items loop — runs whether or not site is set; price_history + vendor_inventory
  --    are catalog-level and useful even for catalog-only ingest.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_array)
  LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_unit := COALESCE(v_item->>'unit', 'piece');
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item % has invalid quantity', v_item_index;
    END IF;
    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Item % has invalid unit_price', v_item_index;
    END IF;

    -- 3a. Resolve category tree (parent first, then child)
    v_parent_cat_id := NULL;
    v_category_id := NULL;
    IF v_item ? 'category' AND jsonb_typeof(v_item->'category') = 'object' THEN
      v_category_id := (v_item->'category'->>'id')::UUID;
      IF v_category_id IS NULL THEN
        IF (v_item->'category'->>'parent_name') IS NOT NULL THEN
          v_parent_cat_id := _ai_ingest_resolve_category(
            v_item->'category'->>'parent_name', NULL
          );
        END IF;
        IF (v_item->'category'->>'child_name') IS NOT NULL THEN
          v_category_id := _ai_ingest_resolve_category(
            v_item->'category'->>'child_name', v_parent_cat_id
          );
        ELSE
          v_category_id := v_parent_cat_id;
        END IF;
      END IF;
    END IF;

    -- 3b. Resolve material
    v_material_id := (v_item->>'material_id')::UUID;
    IF v_material_id IS NULL THEN
      v_material_id := _ai_ingest_resolve_material(
        v_item->>'name',
        v_item->>'local_name',
        v_category_id,
        v_unit,
        v_item->>'hsn_code',
        NULLIF(v_item->>'gst_rate', '')::NUMERIC
      );
    END IF;

    -- 3c. Resolve brand (optional)
    v_brand_id := NULL;
    IF v_item ? 'brand' AND jsonb_typeof(v_item->'brand') = 'object' THEN
      v_brand_id := (v_item->'brand'->>'id')::UUID;
      IF v_brand_id IS NULL THEN
        v_brand_id := _ai_ingest_resolve_brand(v_material_id, v_item->'brand'->>'name');
      END IF;
    END IF;

    -- 3d. Insert expense item IFF we created an expense header
    IF v_expense_created THEN
      INSERT INTO material_purchase_expense_items (
        purchase_expense_id, material_id, brand_id, quantity, unit_price, notes
      )
      VALUES (
        v_purchase_id, v_material_id, v_brand_id, v_qty, v_unit_price,
        NULLIF(TRIM(COALESCE(v_item->>'notes', '')), '')
      )
      RETURNING id INTO v_new_item_id;
      v_item_ids := array_append(v_item_ids, v_new_item_id);
    END IF;

    -- 3e. Append to price_history (always — catalog-level)
    INSERT INTO price_history (
      vendor_id, material_id, brand_id, price, recorded_date, source,
      source_reference, quantity, unit, total_landed_cost,
      bill_url, bill_number, bill_date, recorded_by
    )
    VALUES (
      v_vendor_id, v_material_id, v_brand_id, v_unit_price, v_purchase_date, 'bill',
      v_ref_code, v_qty, v_unit, v_qty * v_unit_price,
      v_bill_url, v_invoice_no, v_purchase_date, auth.uid()
    );

    -- 3f. Upsert vendor_inventory (always — catalog-level)
    DECLARE v_inv_id UUID;
    BEGIN
      SELECT id INTO v_inv_id
      FROM vendor_inventory
      WHERE vendor_id = v_vendor_id
        AND material_id = v_material_id
        AND brand_id IS NOT DISTINCT FROM v_brand_id
      LIMIT 1;

      IF v_inv_id IS NOT NULL THEN
        UPDATE vendor_inventory
        SET current_price = v_unit_price,
            price_source = 'bill',
            unit = v_unit,
            last_price_update = NOW(),
            updated_at = NOW()
        WHERE id = v_inv_id;
      ELSE
        INSERT INTO vendor_inventory (
          vendor_id, material_id, brand_id, current_price, unit,
          price_source, last_price_update
        )
        VALUES (
          v_vendor_id, v_material_id, v_brand_id, v_unit_price, v_unit,
          'bill', NOW()
        );
      END IF;
    END;

    v_item_index := v_item_index + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'ref_code', v_ref_code,
    'vendor_id', v_vendor_id,
    'item_ids', to_jsonb(v_item_ids),
    'items_count', v_item_index,
    'expense_created', v_expense_created
  );
END;
$body$;
-- GRANT moved to companion file 20260510100130_ai_ingest_v2_grants.sql to keep
-- the supabase CLI's SQL splitter from folding CREATE FUNCTION + GRANT into a
-- single prepared statement (same workaround as 20260509100210 / 20260509100240).
