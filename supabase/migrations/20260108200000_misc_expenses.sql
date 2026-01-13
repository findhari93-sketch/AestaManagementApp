-- Migration: Add Miscellaneous Expenses feature
-- Purpose: Create misc_expenses table for ad-hoc expenses with full payment tracking

-- 1. Create misc_expenses table
CREATE TABLE IF NOT EXISTS public.misc_expenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id uuid NOT NULL REFERENCES sites(id),
    reference_number text NOT NULL UNIQUE,
    date date NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    category_id uuid REFERENCES expense_categories(id),
    description text,
    vendor_name text,

    -- Full payment tracking (like tea_shop_settlements)
    payment_mode text CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque')),
    payer_source text CHECK (payer_source IN ('own_money', 'amma_money', 'client_money', 'trust_account', 'other_site_money', 'custom')),
    payer_name text,
    payer_type text DEFAULT 'company_direct' CHECK (payer_type IN ('site_engineer', 'company_direct')),
    site_engineer_id uuid REFERENCES users(id),
    engineer_transaction_id uuid REFERENCES site_engineer_transactions(id),

    -- Proof and subcontract
    proof_url text,
    subcontract_id uuid REFERENCES subcontracts(id),
    notes text,

    -- Status
    is_cleared boolean DEFAULT true,
    is_cancelled boolean DEFAULT false,
    cancelled_at timestamptz,
    cancelled_by_user_id uuid REFERENCES users(id),
    cancellation_reason text,

    -- Audit
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES users(id),
    created_by_name text,
    updated_at timestamptz DEFAULT now()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_misc_expenses_site_id ON misc_expenses(site_id);
CREATE INDEX IF NOT EXISTS idx_misc_expenses_date ON misc_expenses(date);
CREATE INDEX IF NOT EXISTS idx_misc_expenses_subcontract_id ON misc_expenses(subcontract_id);
CREATE INDEX IF NOT EXISTS idx_misc_expenses_reference_number ON misc_expenses(reference_number);
CREATE INDEX IF NOT EXISTS idx_misc_expenses_is_cancelled ON misc_expenses(is_cancelled);

-- 3. Enable RLS
ALTER TABLE misc_expenses ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "misc_expenses_select" ON misc_expenses;
CREATE POLICY "misc_expenses_select" ON misc_expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "misc_expenses_insert" ON misc_expenses;
CREATE POLICY "misc_expenses_insert" ON misc_expenses FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "misc_expenses_update" ON misc_expenses;
CREATE POLICY "misc_expenses_update" ON misc_expenses FOR UPDATE USING (true);

DROP POLICY IF EXISTS "misc_expenses_delete" ON misc_expenses;
CREATE POLICY "misc_expenses_delete" ON misc_expenses FOR DELETE USING (true);

-- 5. Create reference code generator function
CREATE OR REPLACE FUNCTION public.generate_misc_expense_reference(p_site_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_code TEXT;
  v_next_seq INT;
  v_reference TEXT;
  v_lock_key BIGINT;
BEGIN
  -- Create unique lock key from site_id to prevent race conditions
  v_lock_key := ('x' || substr(md5(p_site_id::text || 'misc_expense'), 1, 15))::bit(64)::bigint;

  -- Acquire advisory lock for this site
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Get current date in YYMMDD format
  v_date_code := TO_CHAR(CURRENT_DATE, 'YYMMDD');

  -- Find the next sequence number for this site and day
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(reference_number FROM 'MISC-' || v_date_code || '-(\d+)')
      AS INTEGER
    )
  ), 0) + 1
  INTO v_next_seq
  FROM misc_expenses
  WHERE site_id = p_site_id
    AND reference_number LIKE 'MISC-' || v_date_code || '-%';

  -- Format with 3-digit zero-padded sequence
  v_reference := 'MISC-' || v_date_code || '-' || LPAD(v_next_seq::TEXT, 3, '0');

  RETURN v_reference;
END;
$$;

COMMENT ON FUNCTION public.generate_misc_expense_reference(uuid) IS
  'Generates unique miscellaneous expense reference in MISC-YYMMDD-NNN format with advisory lock for concurrency';

-- 6. Grant permissions
GRANT ALL ON TABLE public.misc_expenses TO authenticated;
GRANT ALL ON TABLE public.misc_expenses TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_misc_expense_reference(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_misc_expense_reference(uuid) TO service_role;

-- 7. Update v_all_expenses view to include misc_expenses
-- Drop and recreate view to add the new UNION
CREATE OR REPLACE VIEW "public"."v_all_expenses" AS
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

-- Miscellaneous expenses (NEW)
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
    -- is_cleared logic: company_direct = true, engineer_wallet depends on transaction settlement
    CASE
        WHEN ("me"."payer_type" = 'company_direct'::"text") THEN true
        WHEN ("me"."engineer_transaction_id" IS NOT NULL) THEN COALESCE((
            SELECT "site_engineer_transactions"."is_settled"
            FROM "public"."site_engineer_transactions"
            WHERE ("site_engineer_transactions"."id" = "me"."engineer_transaction_id")), false)
        ELSE true
    END AS "is_cleared",
    -- cleared_date logic
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
    -- payer_name display
    CASE
        WHEN ("me"."payer_type" = 'site_engineer'::"text") THEN COALESCE((
            SELECT "users"."name"
            FROM "public"."users"
            WHERE ("users"."id" = "me"."site_engineer_id")), 'Site Engineer'::character varying)
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
WHERE ("me"."is_cancelled" = false);

-- Update view comment
COMMENT ON VIEW "public"."v_all_expenses" IS 'Unified view combining regular expenses, derived salary expenses from settlement_groups (Daily Salary aggregated by date), tea shop settlements, and miscellaneous expenses.';
