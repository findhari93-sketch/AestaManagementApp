-- Migration: Group Settlement Enhancements
-- Purpose:
-- 1. Fix v_all_expenses visibility - exclude group_stock, show only settled own_site and batch settlement expenses
-- 2. Add bargaining support to batch settlements
-- 3. Update process_batch_settlement to accept settlement_amount parameter

-- =====================================================
-- 1. Add bargaining columns to inter_site_material_settlements
-- =====================================================

ALTER TABLE inter_site_material_settlements
ADD COLUMN IF NOT EXISTS original_calculated_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS final_settlement_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS bill_url TEXT;

COMMENT ON COLUMN inter_site_material_settlements.original_calculated_amount IS
'The original calculated amount based on usage before any bargaining adjustments';

COMMENT ON COLUMN inter_site_material_settlements.final_settlement_amount IS
'The final settlement amount after bargaining (may be less than original due to vendor negotiations)';

COMMENT ON COLUMN inter_site_material_settlements.bill_url IS
'Reference to the original bill URL from the batch for easy access';

-- =====================================================
-- 2. Update process_batch_settlement function to support bargaining
-- =====================================================

DROP FUNCTION IF EXISTS process_batch_settlement(TEXT, UUID, TEXT, DATE, TEXT, UUID);

CREATE OR REPLACE FUNCTION process_batch_settlement(
  p_batch_ref_code TEXT,
  p_debtor_site_id UUID,
  p_payment_mode TEXT,
  p_payment_date DATE,
  p_payment_reference TEXT DEFAULT NULL,
  p_settlement_amount NUMERIC DEFAULT NULL,  -- NEW: optional amount override for bargaining
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  settlement_id UUID,
  debtor_expense_id UUID,
  settlement_code TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch RECORD;
  v_creditor_site_id UUID;
  v_creditor_site_name TEXT;
  v_debtor_site_name TEXT;
  v_total_qty NUMERIC;
  v_total_amount NUMERIC;
  v_original_amount NUMERIC;  -- NEW: track original calculated amount
  v_final_amount NUMERIC;     -- NEW: track final settlement amount (after bargaining)
  v_unit_cost NUMERIC;
  v_settlement_id UUID;
  v_settlement_code TEXT;
  v_debtor_expense_id UUID;
  v_debtor_expense_ref TEXT;
  v_usage_record RECORD;
  v_batch_completed BOOLEAN;
  v_all_settled BOOLEAN;
  v_bill_url TEXT;
BEGIN
  -- Get batch details
  SELECT
    mpe.id,
    mpe.ref_code,
    mpe.site_id AS batch_site_id,
    mpe.paying_site_id,
    mpe.total_amount,
    mpe.original_qty,
    mpe.remaining_qty,
    mpe.used_qty,
    mpe.self_used_qty,
    mpe.self_used_amount,
    mpe.status,
    mpe.bill_url,
    s.name AS paying_site_name
  INTO v_batch
  FROM material_purchase_expenses mpe
  JOIN sites s ON s.id = COALESCE(mpe.paying_site_id, mpe.site_id)
  WHERE mpe.ref_code = p_batch_ref_code
    AND mpe.purchase_type = 'group_stock';

  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'Batch not found or not a group stock batch: %', p_batch_ref_code;
  END IF;

  -- Set creditor info
  v_creditor_site_id := COALESCE(v_batch.paying_site_id, v_batch.batch_site_id);
  v_creditor_site_name := v_batch.paying_site_name;
  v_bill_url := v_batch.bill_url;

  -- Get debtor site name
  SELECT name INTO v_debtor_site_name FROM sites WHERE id = p_debtor_site_id;

  -- Calculate totals from pending usage records for this debtor
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(total_cost), 0)
  INTO v_total_qty, v_total_amount
  FROM batch_usage_records
  WHERE batch_ref_code = p_batch_ref_code
    AND usage_site_id = p_debtor_site_id
    AND settlement_status = 'pending';

  IF v_total_qty = 0 THEN
    RAISE EXCEPTION 'No pending usage records found for site %', v_debtor_site_name;
  END IF;

  -- Store original calculated amount
  v_original_amount := v_total_amount;

  -- Use settlement_amount if provided (bargaining), otherwise use calculated amount
  IF p_settlement_amount IS NOT NULL AND p_settlement_amount > 0 THEN
    v_final_amount := p_settlement_amount;
  ELSE
    v_final_amount := v_total_amount;
  END IF;

  -- Calculate unit cost for the expense items
  v_unit_cost := v_final_amount / NULLIF(v_total_qty, 0);

  -- Generate settlement code
  v_settlement_code := 'BSET-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 4));

  -- Create inter_site_material_settlements record
  INSERT INTO inter_site_material_settlements (
    settlement_code,
    creditor_site_id,
    debtor_site_id,
    batch_ref_code,
    total_amount,
    payment_mode,
    payment_date,
    payment_reference,
    status,
    original_calculated_amount,
    final_settlement_amount,
    bill_url,
    created_by
  ) VALUES (
    v_settlement_code,
    v_creditor_site_id,
    p_debtor_site_id,
    p_batch_ref_code,
    v_final_amount,
    p_payment_mode,
    p_payment_date,
    p_payment_reference,
    'completed',
    v_original_amount,
    v_final_amount,
    v_bill_url,
    p_created_by
  )
  RETURNING id INTO v_settlement_id;

  -- Generate debtor expense reference
  v_debtor_expense_ref := 'BEXP-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 4));

  -- Create material_purchase_expense for debtor site
  -- This expense should appear in debtor's Material Settlements and All Site Expenses
  INSERT INTO material_purchase_expenses (
    site_id,
    ref_code,
    purchase_type,
    vendor_name,
    purchase_date,
    total_amount,
    status,
    is_paid,
    paid_date,
    settlement_reference,
    settlement_date,
    original_batch_code,
    created_by,
    notes,
    bill_url
  ) VALUES (
    p_debtor_site_id,
    v_debtor_expense_ref,
    'own_site',  -- Convert to own_site so it appears in site's expenses
    v_creditor_site_name || ' (Group Settlement)',
    p_payment_date,
    v_final_amount,
    'recorded',
    true,
    p_payment_date,
    v_settlement_code,
    p_payment_date,
    p_batch_ref_code,  -- Link to original batch
    p_created_by,
    'Settled from batch ' || p_batch_ref_code || ' - ' || v_total_qty::text || ' units @ ' || v_unit_cost::text || '/unit' ||
    CASE
      WHEN v_original_amount <> v_final_amount THEN
        ' (Original: ' || v_original_amount::text || ', Negotiated: ' || v_final_amount::text || ')'
      ELSE ''
    END,
    v_bill_url  -- Copy bill URL for debtor's access
  )
  RETURNING id INTO v_debtor_expense_id;

  -- Create expense items for the debtor expense from usage records
  FOR v_usage_record IN
    SELECT * FROM batch_usage_records
    WHERE batch_ref_code = p_batch_ref_code
      AND usage_site_id = p_debtor_site_id
      AND settlement_status = 'pending'
  LOOP
    -- Calculate proportional amount based on bargained price
    INSERT INTO material_purchase_expense_items (
      expense_id,
      material_id,
      brand_id,
      quantity,
      unit_price
    ) VALUES (
      v_debtor_expense_id,
      v_usage_record.material_id,
      v_usage_record.brand_id,
      v_usage_record.quantity,
      v_unit_cost  -- Use the adjusted unit cost
    );
  END LOOP;

  -- Update batch_usage_records as settled
  UPDATE batch_usage_records
  SET
    settlement_status = 'settled',
    settlement_id = v_settlement_id,
    updated_at = NOW()
  WHERE batch_ref_code = p_batch_ref_code
    AND usage_site_id = p_debtor_site_id
    AND settlement_status = 'pending';

  -- Create settlement_expense_allocations record
  INSERT INTO settlement_expense_allocations (
    settlement_id,
    batch_ref_code,
    creditor_site_id,
    creditor_expense_id,
    creditor_original_amount,
    creditor_self_use_amount,
    debtor_site_id,
    debtor_expense_id,
    debtor_settled_amount
  ) VALUES (
    v_settlement_id,
    p_batch_ref_code,
    v_creditor_site_id,
    v_batch.id,
    v_batch.total_amount,
    v_batch.self_used_amount,
    p_debtor_site_id,
    v_debtor_expense_id,
    v_final_amount
  );

  -- Check if batch is fully used and all settlements done
  SELECT
    remaining_qty <= 0,
    NOT EXISTS (
      SELECT 1 FROM batch_usage_records
      WHERE batch_ref_code = p_batch_ref_code
        AND settlement_status = 'pending'
    )
  INTO v_batch_completed, v_all_settled
  FROM material_purchase_expenses
  WHERE ref_code = p_batch_ref_code;

  -- Auto-complete batch if fully used AND all settlements done
  IF v_batch_completed AND v_all_settled THEN
    -- Update batch to completed status
    UPDATE material_purchase_expenses
    SET
      status = 'completed',
      -- Update the batch total_amount to reflect only self-use for creditor
      total_amount = COALESCE(self_used_amount, 0),
      updated_at = NOW()
    WHERE ref_code = p_batch_ref_code;
  END IF;

  RETURN QUERY SELECT v_settlement_id, v_debtor_expense_id, v_settlement_code;
END;
$$;

COMMENT ON FUNCTION process_batch_settlement(TEXT, UUID, TEXT, DATE, TEXT, NUMERIC, UUID) IS
'Processes settlement when a debtor site pays for their usage.
Creates settlement record, marks usage as settled, creates debtor expense record,
and auto-completes batch if fully settled.
NEW: p_settlement_amount parameter allows specifying a different amount for bargaining.';

GRANT EXECUTE ON FUNCTION process_batch_settlement(TEXT, UUID, TEXT, DATE, TEXT, NUMERIC, UUID) TO authenticated;

-- =====================================================
-- 3. Update v_all_expenses view to properly handle group stock visibility
-- =====================================================

-- Drop and recreate view with updated logic
DROP VIEW IF EXISTS "public"."v_all_expenses";

CREATE VIEW "public"."v_all_expenses" AS
-- Regular expenses (non-labor)
SELECT "e"."id",
    "e"."site_id",
    "e"."date",
    "e"."date" AS "recorded_date",
    "e"."amount",
    "e"."description",
    "e"."category_id",
    "ec"."name" AS "category_name",
    ("e"."module")::"text" AS "module",
    (
        CASE "e"."module"
            WHEN 'material'::"public"."expense_module" THEN 'Material'::character varying
            WHEN 'machinery'::"public"."expense_module" THEN COALESCE("ec"."name", 'Machinery'::character varying)
            WHEN 'general'::"public"."expense_module" THEN 'General'::character varying
            ELSE COALESCE("ec"."name", 'Other'::character varying)
        END)::"text" AS "expense_type",
    "e"."is_cleared",
    "e"."cleared_date",
    "e"."contract_id",
    "sc"."title" AS "subcontract_title",
    "e"."site_payer_id",
    "sp"."name" AS "payer_name",
    ("e"."payment_mode")::"text" AS "payment_mode",
    "e"."vendor_name",
    "e"."receipt_url",
    "e"."paid_by",
    "e"."entered_by",
    "e"."entered_by_user_id",
    NULL::"text" AS "settlement_reference",
    NULL::"uuid" AS "settlement_group_id",
    'expense'::"text" AS "source_type",
    "e"."id" AS "source_id",
    "e"."created_at",
    "e"."is_deleted"
FROM ((("public"."expenses" "e"
    LEFT JOIN "public"."expense_categories" "ec" ON (("e"."category_id" = "ec"."id")))
    LEFT JOIN "public"."subcontracts" "sc" ON (("e"."contract_id" = "sc"."id")))
    LEFT JOIN "public"."site_payers" "sp" ON (("e"."site_payer_id" = "sp"."id")))
WHERE (("e"."is_deleted" = false) AND ("e"."module" <> 'labor'::"public"."expense_module"))

UNION ALL

-- Daily Salary settlements (aggregated by date)
SELECT ("array_agg"("sg"."id" ORDER BY "sg"."created_at"))[1] AS "id",
    "sg"."site_id",
    "sg"."settlement_date" AS "date",
    "max"(COALESCE("sg"."actual_payment_date", ("sg"."created_at")::"date")) AS "recorded_date",
    "sum"("sg"."total_amount") AS "amount",
    (('Salary settlement ('::"text" || "sum"("sg"."laborer_count")) || ' laborers)'::"text") AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Salary Settlement'::"text")
         LIMIT 1) AS "category_id",
    'Salary Settlement'::character varying AS "category_name",
    'labor'::"text" AS "module",
    'Daily Salary'::"text" AS "expense_type",
    "bool_and"(
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN true
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
               FROM "public"."site_engineer_transactions"
              WHERE ("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")), false)
            ELSE false
        END) AS "is_cleared",
    "max"(
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN "sg"."settlement_date"
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
               FROM "public"."site_engineer_transactions"
              WHERE (("site_engineer_transactions"."id" = "sg"."engineer_transaction_id") AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE NULL::"date"
        END) AS "cleared_date",
    ("array_agg"("sg"."subcontract_id" ORDER BY "sg"."created_at") FILTER (WHERE ("sg"."subcontract_id" IS NOT NULL)))[1] AS "contract_id",
    ("array_agg"("sc"."title" ORDER BY "sg"."created_at") FILTER (WHERE ("sc"."title" IS NOT NULL)))[1] AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE
            WHEN ("count"(DISTINCT "sg"."payer_source") = 1) THEN
            CASE
                WHEN ("max"("sg"."payer_source") IS NULL) THEN 'Own Money'::"text"
                WHEN ("max"("sg"."payer_source") = 'own_money'::"text") THEN 'Own Money'::"text"
                WHEN ("max"("sg"."payer_source") = 'amma_money'::"text") THEN 'Amma Money'::"text"
                WHEN ("max"("sg"."payer_source") = 'client_money'::"text") THEN 'Client Money'::"text"
                WHEN ("max"("sg"."payer_source") = 'other_site_money'::"text") THEN COALESCE("max"("sg"."payer_name"), 'Other Site'::"text")
                WHEN ("max"("sg"."payer_source") = 'custom'::"text") THEN COALESCE("max"("sg"."payer_name"), 'Other'::"text")
                ELSE COALESCE("max"("sg"."payer_name"), 'Own Money'::"text")
            END
            ELSE 'Multiple Sources'::"text"
        END AS "payer_name",
    ("array_agg"("sg"."payment_mode" ORDER BY "sg"."created_at"))[1] AS "payment_mode",
    NULL::"text" AS "vendor_name",
    ("array_agg"("sg"."proof_url" ORDER BY "sg"."created_at") FILTER (WHERE ("sg"."proof_url" IS NOT NULL)))[1] AS "receipt_url",
    ("array_agg"("sg"."created_by" ORDER BY "sg"."created_at"))[1] AS "paid_by",
    ("array_agg"("sg"."created_by_name" ORDER BY "sg"."created_at"))[1] AS "entered_by",
    ("array_agg"("sg"."created_by" ORDER BY "sg"."created_at"))[1] AS "entered_by_user_id",
    ("array_agg"("sg"."settlement_reference" ORDER BY "sg"."created_at"))[1] AS "settlement_reference",
    ("array_agg"("sg"."id" ORDER BY "sg"."created_at"))[1] AS "settlement_group_id",
    'settlement'::"text" AS "source_type",
    ("array_agg"("sg"."id" ORDER BY "sg"."created_at"))[1] AS "source_id",
    "min"("sg"."created_at") AS "created_at",
    false AS "is_deleted"
FROM ("public"."settlement_groups" "sg"
    LEFT JOIN "public"."subcontracts" "sc" ON (("sg"."subcontract_id" = "sc"."id")))
WHERE (("sg"."is_cancelled" = false) AND (COALESCE("sg"."payment_type", 'salary'::"text") <> 'advance'::"text") AND (NOT (EXISTS ( SELECT 1
           FROM "public"."labor_payments" "lp"
          WHERE (("lp"."settlement_group_id" = "sg"."id") AND ("lp"."is_under_contract" = true))))))
GROUP BY "sg"."site_id", "sg"."settlement_date"

UNION ALL

-- Contract Salary settlements
SELECT "sg"."id",
    "sg"."site_id",
    "sg"."settlement_date" AS "date",
    COALESCE("sg"."actual_payment_date", ("sg"."created_at")::"date") AS "recorded_date",
    "sg"."total_amount" AS "amount",
        CASE
            WHEN (("sg"."notes" IS NOT NULL) AND ("sg"."notes" <> ''::"text")) THEN ((('Salary settlement ('::"text" || "sg"."laborer_count") || ' laborers) - '::"text") || "sg"."notes")
            ELSE (('Salary settlement ('::"text" || "sg"."laborer_count") || ' laborers)'::"text")
        END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Salary Settlement'::"text")
         LIMIT 1) AS "category_id",
    'Salary Settlement'::character varying AS "category_name",
    'labor'::"text" AS "module",
    'Contract Salary'::"text" AS "expense_type",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN true
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
               FROM "public"."site_engineer_transactions"
              WHERE ("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")), false)
            ELSE false
        END AS "is_cleared",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN "sg"."settlement_date"
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
               FROM "public"."site_engineer_transactions"
              WHERE (("site_engineer_transactions"."id" = "sg"."engineer_transaction_id") AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE NULL::"date"
        END AS "cleared_date",
    "sg"."subcontract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE
            WHEN ("sg"."payer_source" IS NULL) THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'own_money'::"text") THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'amma_money'::"text") THEN 'Amma Money'::"text"
            WHEN ("sg"."payer_source" = 'client_money'::"text") THEN 'Client Money'::"text"
            WHEN ("sg"."payer_source" = 'other_site_money'::"text") THEN COALESCE("sg"."payer_name", 'Other Site'::"text")
            WHEN ("sg"."payer_source" = 'custom'::"text") THEN COALESCE("sg"."payer_name", 'Other'::"text")
            ELSE COALESCE("sg"."payer_name", 'Own Money'::"text")
        END AS "payer_name",
    "sg"."payment_mode",
    NULL::"text" AS "vendor_name",
    "sg"."proof_url" AS "receipt_url",
    "sg"."created_by" AS "paid_by",
    "sg"."created_by_name" AS "entered_by",
    "sg"."created_by" AS "entered_by_user_id",
    "sg"."settlement_reference",
    "sg"."id" AS "settlement_group_id",
    'settlement'::"text" AS "source_type",
    "sg"."id" AS "source_id",
    "sg"."created_at",
    "sg"."is_cancelled" AS "is_deleted"
FROM ("public"."settlement_groups" "sg"
    LEFT JOIN "public"."subcontracts" "sc" ON (("sg"."subcontract_id" = "sc"."id")))
WHERE (("sg"."is_cancelled" = false) AND (EXISTS ( SELECT 1
           FROM "public"."labor_payments" "lp"
          WHERE (("lp"."settlement_group_id" = "sg"."id") AND ("lp"."is_under_contract" = true)))))

UNION ALL

-- Advance payments
SELECT "sg"."id",
    "sg"."site_id",
    "sg"."settlement_date" AS "date",
    COALESCE("sg"."actual_payment_date", ("sg"."created_at")::"date") AS "recorded_date",
    "sg"."total_amount" AS "amount",
        CASE
            WHEN (("sg"."notes" IS NOT NULL) AND ("sg"."notes" <> ''::"text")) THEN ((('Advance payment ('::"text" || "sg"."laborer_count") || ' laborers) - '::"text") || "sg"."notes")
            ELSE (('Advance payment ('::"text" || "sg"."laborer_count") || ' laborers)'::"text")
        END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Salary Settlement'::"text")
         LIMIT 1) AS "category_id",
    'Salary Settlement'::character varying AS "category_name",
    'labor'::"text" AS "module",
    'Advance'::"text" AS "expense_type",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN true
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
               FROM "public"."site_engineer_transactions"
              WHERE ("site_engineer_transactions"."id" = "sg"."engineer_transaction_id")), false)
            ELSE false
        END AS "is_cleared",
        CASE
            WHEN ("sg"."payment_channel" = 'direct'::"text") THEN "sg"."settlement_date"
            WHEN ("sg"."engineer_transaction_id" IS NOT NULL) THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
               FROM "public"."site_engineer_transactions"
              WHERE (("site_engineer_transactions"."id" = "sg"."engineer_transaction_id") AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE NULL::"date"
        END AS "cleared_date",
    "sg"."subcontract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE
            WHEN ("sg"."payer_source" IS NULL) THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'own_money'::"text") THEN 'Own Money'::"text"
            WHEN ("sg"."payer_source" = 'amma_money'::"text") THEN 'Amma Money'::"text"
            WHEN ("sg"."payer_source" = 'client_money'::"text") THEN 'Client Money'::"text"
            WHEN ("sg"."payer_source" = 'other_site_money'::"text") THEN COALESCE("sg"."payer_name", 'Other Site'::"text")
            WHEN ("sg"."payer_source" = 'custom'::"text") THEN COALESCE("sg"."payer_name", 'Other'::"text")
            ELSE COALESCE("sg"."payer_name", 'Own Money'::"text")
        END AS "payer_name",
    "sg"."payment_mode",
    NULL::"text" AS "vendor_name",
    "sg"."proof_url" AS "receipt_url",
    "sg"."created_by" AS "paid_by",
    "sg"."created_by_name" AS "entered_by",
    "sg"."created_by" AS "entered_by_user_id",
    "sg"."settlement_reference",
    "sg"."id" AS "settlement_group_id",
    'settlement'::"text" AS "source_type",
    "sg"."id" AS "source_id",
    "sg"."created_at",
    "sg"."is_cancelled" AS "is_deleted"
FROM ("public"."settlement_groups" "sg"
    LEFT JOIN "public"."subcontracts" "sc" ON (("sg"."subcontract_id" = "sc"."id")))
WHERE (("sg"."is_cancelled" = false) AND ("sg"."payment_type" = 'advance'::"text"))

UNION ALL

-- Tea Shop settlements
SELECT "ts"."id",
    "tsa"."site_id",
    "ts"."payment_date" AS "date",
    "ts"."payment_date" AS "recorded_date",
    "ts"."amount_paid" AS "amount",
        CASE
            WHEN (("ts"."notes" IS NOT NULL) AND ("ts"."notes" <> ''::"text")) THEN ((('Tea Shop - '::"text" || ("tsa"."shop_name")::"text") || ' - '::"text") || "ts"."notes")
            ELSE ('Tea Shop - '::"text" || ("tsa"."shop_name")::"text")
        END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Tea & Snacks'::"text")
         LIMIT 1) AS "category_id",
    'Tea & Snacks'::character varying AS "category_name",
    'general'::"text" AS "module",
    'Tea & Snacks'::"text" AS "expense_type",
        CASE
            WHEN (("ts"."payer_type")::"text" = 'company_direct'::"text") THEN true
            WHEN ("ts"."site_engineer_transaction_id" IS NOT NULL) THEN COALESCE(( SELECT "site_engineer_transactions"."is_settled"
               FROM "public"."site_engineer_transactions"
              WHERE ("site_engineer_transactions"."id" = "ts"."site_engineer_transaction_id")), false)
            ELSE true
        END AS "is_cleared",
        CASE
            WHEN (("ts"."payer_type")::"text" = 'company_direct'::"text") THEN "ts"."payment_date"
            WHEN ("ts"."site_engineer_transaction_id" IS NOT NULL) THEN ( SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
               FROM "public"."site_engineer_transactions"
              WHERE (("site_engineer_transactions"."id" = "ts"."site_engineer_transaction_id") AND ("site_engineer_transactions"."is_settled" = true)))
            ELSE "ts"."payment_date"
        END AS "cleared_date",
    "ts"."subcontract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
        CASE "ts"."payer_type"
            WHEN 'company_direct'::"text" THEN 'Company Direct'::character varying
            WHEN 'site_engineer'::"text" THEN COALESCE(( SELECT "users"."name"
               FROM "public"."users"
              WHERE ("users"."id" = "ts"."site_engineer_id")), 'Site Engineer'::character varying)
            ELSE "ts"."payer_type"
        END AS "payer_name",
    "ts"."payment_mode",
    "tsa"."shop_name" AS "vendor_name",
    NULL::"text" AS "receipt_url",
    "ts"."recorded_by_user_id" AS "paid_by",
    "ts"."recorded_by" AS "entered_by",
    "ts"."recorded_by_user_id" AS "entered_by_user_id",
    "ts"."settlement_reference",
    NULL::"uuid" AS "settlement_group_id",
    'tea_shop_settlement'::"text" AS "source_type",
    "ts"."id" AS "source_id",
    "ts"."created_at",
    COALESCE("ts"."is_cancelled", false) AS "is_deleted"
FROM (("public"."tea_shop_settlements" "ts"
    JOIN "public"."tea_shop_accounts" "tsa" ON (("ts"."tea_shop_id" = "tsa"."id")))
    LEFT JOIN "public"."subcontracts" "sc" ON (("ts"."subcontract_id" = "sc"."id")))
WHERE (COALESCE("ts"."is_cancelled", false) = false)

UNION ALL

-- Miscellaneous expenses
SELECT
    "me"."id",
    "me"."site_id",
    "me"."date",
    "me"."date" AS "recorded_date",
    "me"."amount",
    CASE
        WHEN (("me"."notes" IS NOT NULL) AND ("me"."notes" <> ''::"text")) THEN
            CASE
                WHEN ("me"."vendor_name" IS NOT NULL) THEN (('Misc - '::"text" || "me"."vendor_name") || ' - '::"text") || "me"."notes"
                ELSE 'Misc - '::"text" || "me"."notes"
            END
        WHEN ("me"."vendor_name" IS NOT NULL) THEN 'Misc - '::"text" || "me"."vendor_name"
        ELSE COALESCE("me"."description", 'Miscellaneous Expense'::"text")
    END AS "description",
    "me"."category_id",
    COALESCE("ec"."name", 'Miscellaneous'::character varying) AS "category_name",
    'miscellaneous'::"text" AS "module",
    'Miscellaneous'::"text" AS "expense_type",
    CASE
        WHEN ("me"."payer_type" = 'company_direct'::"text") THEN true
        WHEN ("me"."engineer_transaction_id" IS NOT NULL) THEN COALESCE((
            SELECT "site_engineer_transactions"."is_settled"
            FROM "public"."site_engineer_transactions"
            WHERE ("site_engineer_transactions"."id" = "me"."engineer_transaction_id")), false)
        ELSE true
    END AS "is_cleared",
    CASE
        WHEN ("me"."payer_type" = 'company_direct'::"text") THEN "me"."date"
        WHEN ("me"."engineer_transaction_id" IS NOT NULL) THEN (
            SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
            FROM "public"."site_engineer_transactions"
            WHERE (("site_engineer_transactions"."id" = "me"."engineer_transaction_id")
                AND ("site_engineer_transactions"."is_settled" = true)))
        ELSE "me"."date"
    END AS "cleared_date",
    "me"."subcontract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
    CASE
        WHEN ("me"."payer_type" = 'site_engineer'::"text") THEN COALESCE((
            SELECT "users"."name"
            FROM "public"."users"
            WHERE ("users"."id" = "me"."site_engineer_id")), 'Site Engineer'::character varying)::"text"
        WHEN ("me"."payer_source" IS NULL) THEN 'Own Money'::"text"
        WHEN ("me"."payer_source" = 'own_money'::"text") THEN 'Own Money'::"text"
        WHEN ("me"."payer_source" = 'amma_money'::"text") THEN 'Amma Money'::"text"
        WHEN ("me"."payer_source" = 'client_money'::"text") THEN 'Client Money'::"text"
        WHEN ("me"."payer_source" = 'trust_account'::"text") THEN 'Trust Account'::"text"
        WHEN ("me"."payer_source" = 'other_site_money'::"text") THEN COALESCE("me"."payer_name", 'Other Site'::"text")
        WHEN ("me"."payer_source" = 'custom'::"text") THEN COALESCE("me"."payer_name", 'Other'::"text")
        ELSE 'Own Money'::"text"
    END AS "payer_name",
    "me"."payment_mode",
    "me"."vendor_name",
    "me"."proof_url" AS "receipt_url",
    "me"."created_by" AS "paid_by",
    "me"."created_by_name" AS "entered_by",
    "me"."created_by" AS "entered_by_user_id",
    "me"."reference_number" AS "settlement_reference",
    NULL::"uuid" AS "settlement_group_id",
    'misc_expense'::"text" AS "source_type",
    "me"."id" AS "source_id",
    "me"."created_at",
    "me"."is_cancelled" AS "is_deleted"
FROM ("public"."misc_expenses" "me"
    LEFT JOIN "public"."expense_categories" "ec" ON (("me"."category_id" = "ec"."id")))
    LEFT JOIN "public"."subcontracts" "sc" ON (("me"."subcontract_id" = "sc"."id"))
WHERE ("me"."is_cancelled" = false)

UNION ALL

-- Subcontract direct payments
SELECT
    "sp"."id",
    "sc"."site_id",
    "sp"."payment_date" AS "date",
    ("sp"."created_at")::"date" AS "recorded_date",
    "sp"."amount",
    CASE
        WHEN (("sp"."comments" IS NOT NULL) AND ("sp"."comments" <> ''::"text")) THEN
            ('Contract Payment - '::"text" || ("sc"."title")::"text") || ' - '::"text" || "sp"."comments"
        ELSE
            'Contract Payment - '::"text" || ("sc"."title")::"text"
    END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Contract Payment'::"text")
         LIMIT 1) AS "category_id",
    'Contract Payment'::character varying AS "category_name",
    'labor'::"text" AS "module",
    'Direct Payment'::"text" AS "expense_type",
    CASE
        WHEN ("sp"."payment_channel" = 'company_direct_online'::"text") THEN true
        WHEN ("sp"."payment_channel" = 'mesthri_at_office'::"text") THEN true
        WHEN ("sp"."site_engineer_transaction_id" IS NOT NULL) THEN COALESCE((
            SELECT "site_engineer_transactions"."is_settled"
            FROM "public"."site_engineer_transactions"
            WHERE ("site_engineer_transactions"."id" = "sp"."site_engineer_transaction_id")), false)
        ELSE true
    END AS "is_cleared",
    CASE
        WHEN ("sp"."payment_channel" IN ('company_direct_online'::"text", 'mesthri_at_office'::"text")) THEN "sp"."payment_date"
        WHEN ("sp"."site_engineer_transaction_id" IS NOT NULL) THEN (
            SELECT ("site_engineer_transactions"."confirmed_at")::"date" AS "confirmed_at"
            FROM "public"."site_engineer_transactions"
            WHERE (("site_engineer_transactions"."id" = "sp"."site_engineer_transaction_id")
                AND ("site_engineer_transactions"."is_settled" = true)))
        ELSE "sp"."payment_date"
    END AS "cleared_date",
    "sp"."contract_id" AS "contract_id",
    "sc"."title" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
    CASE
        WHEN ("sp"."payment_channel" = 'company_direct_online'::"text") THEN 'Company Direct'::"text"
        WHEN ("sp"."payment_channel" = 'mesthri_at_office'::"text") THEN 'Office'::"text"
        WHEN ("sp"."payment_channel" = 'via_site_engineer'::"text") THEN COALESCE((
            SELECT "users"."name"
            FROM "public"."users"
            WHERE ("users"."id" = "sp"."paid_by_user_id")), 'Site Engineer'::character varying)::"text"
        ELSE 'Company'::"text"
    END AS "payer_name",
    ("sp"."payment_mode")::"text" AS "payment_mode",
    NULL::"text" AS "vendor_name",
    "sp"."receipt_url",
    "sp"."paid_by_user_id" AS "paid_by",
    "sp"."recorded_by" AS "entered_by",
    "sp"."recorded_by_user_id" AS "entered_by_user_id",
    COALESCE("sp"."reference_number", 'SCP-' || TO_CHAR("sp"."payment_date", 'YYMMDD') || '-' || LEFT("sp"."id"::text, 4)) AS "settlement_reference",
    NULL::"uuid" AS "settlement_group_id",
    'subcontract_payment'::"text" AS "source_type",
    "sp"."id" AS "source_id",
    "sp"."created_at",
    COALESCE("sp"."is_deleted", false) AS "is_deleted"
FROM ("public"."subcontract_payments" "sp"
    JOIN "public"."subcontracts" "sc" ON (("sp"."contract_id" = "sc"."id")))
WHERE (COALESCE("sp"."is_deleted", false) = false)

UNION ALL

-- Settled Material Purchases (UPDATED: Exclude group_stock, only show own_site and settled batch expenses)
-- 1. Own site purchases that are settled (is_paid = true OR settlement_date IS NOT NULL)
-- 2. Debtor expenses from batch settlements (has original_batch_code - these are converted to own_site)
-- Group stock batches themselves NEVER appear here
SELECT
    "mpe"."id",
    "mpe"."site_id",
    COALESCE("mpe"."settlement_date", "mpe"."purchase_date") AS "date",
    "mpe"."purchase_date" AS "recorded_date",
    "mpe"."total_amount" AS "amount",
    CASE
        WHEN ("mpe"."original_batch_code" IS NOT NULL) THEN
            'Group Settlement - '::"text" || COALESCE("mpe"."vendor_name", 'Unknown'::"text") ||
            CASE
                WHEN "mpe"."notes" IS NOT NULL AND "mpe"."notes" <> '' THEN ' - '::"text" || "mpe"."notes"
                ELSE ''
            END
        WHEN (("mpe"."notes" IS NOT NULL) AND ("mpe"."notes" <> ''::"text")) THEN
            ('Material Purchase - '::"text" || COALESCE("mpe"."vendor_name", 'Unknown'::"text")) || ' - '::"text" || "mpe"."notes"
        ELSE
            'Material Purchase - '::"text" || COALESCE("mpe"."vendor_name", 'Unknown'::"text")
    END AS "description",
    ( SELECT "expense_categories"."id"
           FROM "public"."expense_categories"
          WHERE (("expense_categories"."name")::"text" = 'Material Purchase'::"text")
         LIMIT 1) AS "category_id",
    'Material Purchase'::character varying AS "category_name",
    'material'::"text" AS "module",
    CASE
        WHEN ("mpe"."original_batch_code" IS NOT NULL) THEN 'Group Settlement'::"text"
        ELSE 'Material'::"text"
    END AS "expense_type",
    COALESCE("mpe"."is_paid", false) AS "is_cleared",
    "mpe"."paid_date" AS "cleared_date",
    NULL::"uuid" AS "contract_id",
    NULL::"text" AS "subcontract_title",
    NULL::"uuid" AS "site_payer_id",
    CASE
        WHEN ("mpe"."settlement_payer_source" IS NULL) THEN 'Own Money'::"text"
        WHEN ("mpe"."settlement_payer_source" = 'own'::"text") THEN 'Own Money'::"text"
        WHEN ("mpe"."settlement_payer_source" = 'amma'::"text") THEN 'Amma Money'::"text"
        WHEN ("mpe"."settlement_payer_source" = 'client'::"text") THEN 'Client Money'::"text"
        WHEN ("mpe"."settlement_payer_source" = 'trust'::"text") THEN 'Trust Account'::"text"
        WHEN ("mpe"."settlement_payer_source" = 'site'::"text") THEN COALESCE("mpe"."settlement_payer_name", 'Other Site'::"text")
        WHEN ("mpe"."settlement_payer_source" = 'other'::"text") THEN COALESCE("mpe"."settlement_payer_name", 'Other'::"text")
        ELSE 'Own Money'::"text"
    END AS "payer_name",
    ("mpe"."payment_mode")::"text" AS "payment_mode",
    "mpe"."vendor_name",
    "mpe"."bill_url" AS "receipt_url",
    "mpe"."created_by" AS "paid_by",
    NULL::"text" AS "entered_by",
    "mpe"."created_by" AS "entered_by_user_id",
    "mpe"."ref_code" AS "settlement_reference",
    NULL::"uuid" AS "settlement_group_id",
    CASE
        WHEN ("mpe"."original_batch_code" IS NOT NULL) THEN 'batch_settlement'::"text"
        ELSE 'material_purchase'::"text"
    END AS "source_type",
    "mpe"."id" AS "source_id",
    "mpe"."created_at",
    false AS "is_deleted"
FROM "public"."material_purchase_expenses" "mpe"
WHERE (
    -- EXCLUDE group_stock purchases - they should NEVER appear in All Site Expenses
    "mpe"."purchase_type" = 'own_site'
    AND
    (
        -- Include settled own_site purchases
        (("mpe"."is_paid" = true) OR ("mpe"."settlement_date" IS NOT NULL))
        OR
        -- Include debtor expenses from batch settlements (has original_batch_code)
        ("mpe"."original_batch_code" IS NOT NULL)
    )
);

-- Update view comment
COMMENT ON VIEW "public"."v_all_expenses" IS 'Unified view combining regular expenses, derived salary expenses from settlement_groups (Daily Salary aggregated by date), tea shop settlements, miscellaneous expenses, subcontract direct payments, and settled material purchases. NOTE: Group stock batches are excluded - only settled own_site purchases and batch settlement expenses appear.';
