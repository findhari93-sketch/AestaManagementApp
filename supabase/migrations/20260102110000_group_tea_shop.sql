-- Group Tea Shop Feature
-- Enables grouped sites to share a common tea shop with automatic percentage-based allocation

-- =============================================================================
-- 1. MODIFY tea_shop_accounts TABLE
-- =============================================================================

-- Add site_group_id and is_group_shop columns
ALTER TABLE "public"."tea_shop_accounts"
ADD COLUMN IF NOT EXISTS "site_group_id" uuid REFERENCES "public"."site_groups"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "is_group_shop" boolean DEFAULT false NOT NULL;

-- Add index for group lookups
CREATE INDEX IF NOT EXISTS "idx_tea_shop_accounts_group" ON "public"."tea_shop_accounts"("site_group_id") WHERE "site_group_id" IS NOT NULL;

COMMENT ON COLUMN "public"."tea_shop_accounts"."site_group_id" IS 'If this is a group tea shop, links to the site group it serves';
COMMENT ON COLUMN "public"."tea_shop_accounts"."is_group_shop" IS 'True if this tea shop serves all sites in a site group';

-- =============================================================================
-- 2. CREATE tea_shop_group_entries TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "public"."tea_shop_group_entries" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "tea_shop_id" uuid NOT NULL REFERENCES "public"."tea_shop_accounts"("id") ON DELETE CASCADE,
    "site_group_id" uuid NOT NULL REFERENCES "public"."site_groups"("id") ON DELETE CASCADE,
    "date" date NOT NULL,

    -- Total amount for the entire group
    "total_amount" numeric(10,2) NOT NULL,

    -- Labor group percentage split (optional, same as existing entries)
    "percentage_split" jsonb, -- { daily: 40, contract: 35, market: 25 }

    -- Override tracking
    "is_percentage_override" boolean DEFAULT false NOT NULL,

    -- Payment tracking (aggregate for group)
    "amount_paid" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_fully_paid" boolean DEFAULT false NOT NULL,

    -- Audit fields
    "notes" text,
    "entered_by" text,
    "entered_by_user_id" uuid REFERENCES "public"."users"("id"),
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "updated_by" text,
    "updated_by_user_id" uuid REFERENCES "public"."users"("id"),

    PRIMARY KEY ("id"),
    UNIQUE ("tea_shop_id", "date") -- One entry per group per day
);

ALTER TABLE "public"."tea_shop_group_entries" OWNER TO "postgres";

COMMENT ON TABLE "public"."tea_shop_group_entries" IS 'Group-level tea shop entries for site groups sharing a common tea vendor';
COMMENT ON COLUMN "public"."tea_shop_group_entries"."total_amount" IS 'Total T&S cost for all sites in the group for this day';
COMMENT ON COLUMN "public"."tea_shop_group_entries"."is_percentage_override" IS 'True if engineer manually adjusted the auto-calculated percentages';

-- Indexes
CREATE INDEX "idx_tea_shop_group_entries_group" ON "public"."tea_shop_group_entries"("site_group_id");
CREATE INDEX "idx_tea_shop_group_entries_date" ON "public"."tea_shop_group_entries"("date" DESC);
CREATE INDEX "idx_tea_shop_group_entries_shop" ON "public"."tea_shop_group_entries"("tea_shop_id");

-- =============================================================================
-- 3. CREATE tea_shop_group_allocations TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "public"."tea_shop_group_allocations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "group_entry_id" uuid NOT NULL REFERENCES "public"."tea_shop_group_entries"("id") ON DELETE CASCADE,
    "site_id" uuid NOT NULL REFERENCES "public"."sites"("id") ON DELETE CASCADE,

    -- Attendance data used for calculation
    "attendance_count" integer DEFAULT 0 NOT NULL,
    "named_laborer_count" integer DEFAULT 0 NOT NULL,
    "market_laborer_count" integer DEFAULT 0 NOT NULL,

    -- Allocation
    "allocation_percentage" numeric(5,2) NOT NULL, -- e.g., 60.00
    "allocated_amount" numeric(10,2) NOT NULL, -- Actual rupee amount (rounded)

    "created_at" timestamptz DEFAULT now() NOT NULL,

    PRIMARY KEY ("id"),
    UNIQUE ("group_entry_id", "site_id")
);

ALTER TABLE "public"."tea_shop_group_allocations" OWNER TO "postgres";

COMMENT ON TABLE "public"."tea_shop_group_allocations" IS 'Per-site allocation of group tea shop entries based on attendance';
COMMENT ON COLUMN "public"."tea_shop_group_allocations"."attendance_count" IS 'Total workers (named + market) used for percentage calculation';
COMMENT ON COLUMN "public"."tea_shop_group_allocations"."allocated_amount" IS 'Rounded amount allocated to this site (no decimals)';

-- Indexes
CREATE INDEX "idx_tea_shop_group_allocations_entry" ON "public"."tea_shop_group_allocations"("group_entry_id");
CREATE INDEX "idx_tea_shop_group_allocations_site" ON "public"."tea_shop_group_allocations"("site_id");

-- =============================================================================
-- 4. CREATE tea_shop_group_settlements TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "public"."tea_shop_group_settlements" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "tea_shop_id" uuid NOT NULL REFERENCES "public"."tea_shop_accounts"("id") ON DELETE CASCADE,
    "site_group_id" uuid NOT NULL REFERENCES "public"."site_groups"("id") ON DELETE CASCADE,
    "settlement_reference" varchar(50), -- e.g., 'GSS-260102-001'

    -- Period covered
    "period_start" date NOT NULL,
    "period_end" date NOT NULL,

    -- Amounts
    "entries_total" numeric(12,2) NOT NULL,
    "previous_balance" numeric(12,2) DEFAULT 0,
    "total_due" numeric(12,2) NOT NULL,
    "amount_paid" numeric(12,2) NOT NULL,
    "balance_remaining" numeric(12,2) DEFAULT 0,

    -- Payment details
    "payment_date" date NOT NULL,
    "payment_mode" varchar(50) NOT NULL, -- 'cash', 'upi', 'bank_transfer', 'cheque'
    "payer_type" varchar(50) NOT NULL, -- 'site_engineer', 'company_direct'
    "site_engineer_id" uuid REFERENCES "public"."users"("id"),
    "site_engineer_transaction_id" uuid, -- Links to engineer wallet if applicable
    "is_engineer_settled" boolean DEFAULT false,
    "payer_source" varchar(50), -- 'own_money', 'site_cash', 'trust_account', etc.
    "payer_name" varchar(255),

    -- Status
    "status" varchar(50) DEFAULT 'completed', -- 'partial', 'completed', 'cancelled'
    "is_cancelled" boolean DEFAULT false,

    -- Proof and linking
    "proof_url" text,
    "subcontract_id" uuid REFERENCES "public"."subcontracts"("id"),

    -- Audit
    "notes" text,
    "recorded_by" varchar(255),
    "recorded_by_user_id" uuid REFERENCES "public"."users"("id"),
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,

    PRIMARY KEY ("id")
);

ALTER TABLE "public"."tea_shop_group_settlements" OWNER TO "postgres";

COMMENT ON TABLE "public"."tea_shop_group_settlements" IS 'Group-level settlements for tea shops serving site groups';
COMMENT ON COLUMN "public"."tea_shop_group_settlements"."settlement_reference" IS 'Unique reference code (e.g., GSS-260102-001 for Group Shop Settlement)';

-- Indexes
CREATE INDEX "idx_tea_shop_group_settlements_group" ON "public"."tea_shop_group_settlements"("site_group_id");
CREATE INDEX "idx_tea_shop_group_settlements_shop" ON "public"."tea_shop_group_settlements"("tea_shop_id");
CREATE INDEX "idx_tea_shop_group_settlements_date" ON "public"."tea_shop_group_settlements"("payment_date" DESC);

-- =============================================================================
-- 5. CREATE tea_shop_group_settlement_allocations TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "public"."tea_shop_group_settlement_allocations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "settlement_id" uuid NOT NULL REFERENCES "public"."tea_shop_group_settlements"("id") ON DELETE CASCADE,
    "group_entry_id" uuid NOT NULL REFERENCES "public"."tea_shop_group_entries"("id") ON DELETE CASCADE,
    "allocated_amount" numeric(10,2) NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,

    PRIMARY KEY ("id")
);

ALTER TABLE "public"."tea_shop_group_settlement_allocations" OWNER TO "postgres";

COMMENT ON TABLE "public"."tea_shop_group_settlement_allocations" IS 'Tracks payment allocation across group entries (waterfall model)';

-- Indexes
CREATE INDEX "idx_tea_shop_group_settlement_alloc_settlement" ON "public"."tea_shop_group_settlement_allocations"("settlement_id");
CREATE INDEX "idx_tea_shop_group_settlement_alloc_entry" ON "public"."tea_shop_group_settlement_allocations"("group_entry_id");

-- =============================================================================
-- 6. ENABLE RLS AND CREATE POLICIES
-- =============================================================================

-- tea_shop_group_entries
ALTER TABLE "public"."tea_shop_group_entries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_shop_group_entries_select" ON "public"."tea_shop_group_entries"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "tea_shop_group_entries_insert" ON "public"."tea_shop_group_entries"
FOR INSERT TO authenticated
WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role", 'site_engineer'::"public"."user_role"])));

CREATE POLICY "tea_shop_group_entries_update" ON "public"."tea_shop_group_entries"
FOR UPDATE TO authenticated
USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shop_group_entries_delete" ON "public"."tea_shop_group_entries"
FOR DELETE TO authenticated USING ("public"."is_admin"());

-- tea_shop_group_allocations
ALTER TABLE "public"."tea_shop_group_allocations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_shop_group_allocations_select" ON "public"."tea_shop_group_allocations"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "tea_shop_group_allocations_insert" ON "public"."tea_shop_group_allocations"
FOR INSERT TO authenticated
WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role", 'site_engineer'::"public"."user_role"])));

CREATE POLICY "tea_shop_group_allocations_update" ON "public"."tea_shop_group_allocations"
FOR UPDATE TO authenticated
USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shop_group_allocations_delete" ON "public"."tea_shop_group_allocations"
FOR DELETE TO authenticated USING ("public"."is_admin"());

-- tea_shop_group_settlements
ALTER TABLE "public"."tea_shop_group_settlements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_shop_group_settlements_select" ON "public"."tea_shop_group_settlements"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "tea_shop_group_settlements_insert" ON "public"."tea_shop_group_settlements"
FOR INSERT TO authenticated
WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role", 'site_engineer'::"public"."user_role"])));

CREATE POLICY "tea_shop_group_settlements_update" ON "public"."tea_shop_group_settlements"
FOR UPDATE TO authenticated
USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shop_group_settlements_delete" ON "public"."tea_shop_group_settlements"
FOR DELETE TO authenticated USING ("public"."is_admin"());

-- tea_shop_group_settlement_allocations
ALTER TABLE "public"."tea_shop_group_settlement_allocations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_shop_group_settlement_alloc_select" ON "public"."tea_shop_group_settlement_allocations"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "tea_shop_group_settlement_alloc_insert" ON "public"."tea_shop_group_settlement_allocations"
FOR INSERT TO authenticated
WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role", 'site_engineer'::"public"."user_role"])));

CREATE POLICY "tea_shop_group_settlement_alloc_update" ON "public"."tea_shop_group_settlement_allocations"
FOR UPDATE TO authenticated
USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shop_group_settlement_alloc_delete" ON "public"."tea_shop_group_settlement_allocations"
FOR DELETE TO authenticated USING ("public"."is_admin"());

-- =============================================================================
-- 7. HELPER FUNCTION: Generate Group Settlement Reference
-- =============================================================================

CREATE OR REPLACE FUNCTION "public"."generate_group_tea_shop_settlement_reference"()
RETURNS varchar(50) AS $$
DECLARE
    v_date_part varchar(6);
    v_sequence int;
    v_reference varchar(50);
BEGIN
    -- Get today's date in YYMMDD format
    v_date_part := to_char(CURRENT_DATE, 'YYMMDD');

    -- Get next sequence number for today
    SELECT COALESCE(MAX(
        CASE
            WHEN settlement_reference ~ ('^GSS-' || v_date_part || '-\d{3}$')
            THEN CAST(RIGHT(settlement_reference, 3) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM public.tea_shop_group_settlements
    WHERE settlement_reference LIKE 'GSS-' || v_date_part || '-%';

    -- Format: GSS-YYMMDD-NNN
    v_reference := 'GSS-' || v_date_part || '-' || LPAD(v_sequence::text, 3, '0');

    RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION "public"."generate_group_tea_shop_settlement_reference"() IS 'Generates unique settlement reference for group tea shop settlements (GSS-YYMMDD-NNN)';

-- =============================================================================
-- 8. TRIGGER: Auto-generate settlement reference
-- =============================================================================

CREATE OR REPLACE FUNCTION "public"."tea_shop_group_settlement_before_insert"()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate settlement reference if not provided
    IF NEW.settlement_reference IS NULL OR NEW.settlement_reference = '' THEN
        NEW.settlement_reference := public.generate_group_tea_shop_settlement_reference();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_tea_shop_group_settlement_before_insert"
BEFORE INSERT ON "public"."tea_shop_group_settlements"
FOR EACH ROW
EXECUTE FUNCTION "public"."tea_shop_group_settlement_before_insert"();

-- =============================================================================
-- 9. TRIGGER: Update group entry payment status after settlement
-- =============================================================================

CREATE OR REPLACE FUNCTION "public"."update_group_entry_payment_on_settlement_alloc"()
RETURNS TRIGGER AS $$
DECLARE
    v_entry_id uuid;
    v_total_allocated numeric(10,2);
    v_entry_total numeric(10,2);
BEGIN
    -- Get the entry ID (handles both INSERT and DELETE)
    IF TG_OP = 'DELETE' THEN
        v_entry_id := OLD.group_entry_id;
    ELSE
        v_entry_id := NEW.group_entry_id;
    END IF;

    -- Calculate total allocated to this entry
    SELECT COALESCE(SUM(allocated_amount), 0)
    INTO v_total_allocated
    FROM public.tea_shop_group_settlement_allocations
    WHERE group_entry_id = v_entry_id;

    -- Get entry total
    SELECT total_amount INTO v_entry_total
    FROM public.tea_shop_group_entries
    WHERE id = v_entry_id;

    -- Update the entry
    UPDATE public.tea_shop_group_entries
    SET
        amount_paid = v_total_allocated,
        is_fully_paid = (v_total_allocated >= v_entry_total),
        updated_at = now()
    WHERE id = v_entry_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_update_group_entry_payment"
AFTER INSERT OR UPDATE OR DELETE ON "public"."tea_shop_group_settlement_allocations"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_group_entry_payment_on_settlement_alloc"();

COMMENT ON FUNCTION "public"."update_group_entry_payment_on_settlement_alloc"() IS 'Updates group entry payment status when settlement allocations change';
