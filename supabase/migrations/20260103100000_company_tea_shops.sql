-- Company Tea Shops Redesign
-- Transforms tea shops from site-specific to company-level entities
-- Enables assignment to individual sites or site groups
-- Adds day_units-based allocation for grouped entries

-- =============================================================================
-- 1. CREATE tea_shops TABLE (Company-level entity)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "public"."tea_shops" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(255) NOT NULL,
    "owner_name" varchar(255),
    "contact_phone" varchar(20),
    "address" text,
    "upi_id" varchar(100),
    "qr_code_url" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "created_by" uuid REFERENCES "public"."users"("id"),
    "updated_by" uuid REFERENCES "public"."users"("id"),

    PRIMARY KEY ("id")
);

ALTER TABLE "public"."tea_shops" OWNER TO "postgres";

COMMENT ON TABLE "public"."tea_shops" IS 'Company-level tea shop vendors that can be assigned to sites or site groups';
COMMENT ON COLUMN "public"."tea_shops"."upi_id" IS 'UPI ID for the tea shop vendor (e.g., shopname@upi)';
COMMENT ON COLUMN "public"."tea_shops"."qr_code_url" IS 'URL to the payment QR code image stored in Supabase Storage';

-- Indexes
CREATE INDEX "idx_tea_shops_is_active" ON "public"."tea_shops"("is_active");
CREATE INDEX "idx_tea_shops_name" ON "public"."tea_shops"("name");

-- =============================================================================
-- 2. CREATE tea_shop_site_assignments TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "public"."tea_shop_site_assignments" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "tea_shop_id" uuid NOT NULL REFERENCES "public"."tea_shops"("id") ON DELETE CASCADE,
    "site_id" uuid REFERENCES "public"."sites"("id") ON DELETE CASCADE,
    "site_group_id" uuid REFERENCES "public"."site_groups"("id") ON DELETE CASCADE,
    "is_active" boolean DEFAULT true NOT NULL,
    "assigned_at" timestamptz DEFAULT now() NOT NULL,
    "assigned_by" uuid REFERENCES "public"."users"("id"),

    PRIMARY KEY ("id"),
    -- Either site_id OR site_group_id must be set, not both
    CONSTRAINT "chk_site_or_group" CHECK (
        (site_id IS NOT NULL AND site_group_id IS NULL) OR
        (site_id IS NULL AND site_group_id IS NOT NULL)
    )
);

ALTER TABLE "public"."tea_shop_site_assignments" OWNER TO "postgres";

COMMENT ON TABLE "public"."tea_shop_site_assignments" IS 'Links tea shops to individual sites or site groups';
COMMENT ON COLUMN "public"."tea_shop_site_assignments"."site_id" IS 'For individual site assignment (mutually exclusive with site_group_id)';
COMMENT ON COLUMN "public"."tea_shop_site_assignments"."site_group_id" IS 'For group assignment - serves all sites in the group (mutually exclusive with site_id)';

-- Indexes
CREATE INDEX "idx_tea_shop_assignments_shop" ON "public"."tea_shop_site_assignments"("tea_shop_id");
CREATE INDEX "idx_tea_shop_assignments_site" ON "public"."tea_shop_site_assignments"("site_id") WHERE "site_id" IS NOT NULL;
CREATE INDEX "idx_tea_shop_assignments_group" ON "public"."tea_shop_site_assignments"("site_group_id") WHERE "site_group_id" IS NOT NULL;
CREATE UNIQUE INDEX "idx_tea_shop_assignments_unique_site" ON "public"."tea_shop_site_assignments"("site_id") WHERE "site_id" IS NOT NULL AND "is_active" = true;
CREATE UNIQUE INDEX "idx_tea_shop_assignments_unique_group" ON "public"."tea_shop_site_assignments"("site_group_id") WHERE "site_group_id" IS NOT NULL AND "is_active" = true;

-- =============================================================================
-- 3. CREATE tea_shop_entry_allocations TABLE (Per-site breakdown)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "public"."tea_shop_entry_allocations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "entry_id" uuid NOT NULL REFERENCES "public"."tea_shop_entries"("id") ON DELETE CASCADE,
    "site_id" uuid NOT NULL REFERENCES "public"."sites"("id") ON DELETE CASCADE,

    -- Calculation inputs (day units based)
    "day_units_sum" numeric(10,2) NOT NULL DEFAULT 0,
    "worker_count" integer NOT NULL DEFAULT 0,

    -- Allocation result
    "allocation_percentage" numeric(5,2) NOT NULL,
    "allocated_amount" numeric(10,2) NOT NULL,

    -- Override tracking
    "is_manual_override" boolean DEFAULT false NOT NULL,

    "created_at" timestamptz DEFAULT now() NOT NULL,

    PRIMARY KEY ("id"),
    UNIQUE ("entry_id", "site_id")
);

ALTER TABLE "public"."tea_shop_entry_allocations" OWNER TO "postgres";

COMMENT ON TABLE "public"."tea_shop_entry_allocations" IS 'Per-site allocation of tea shop entries based on day_units sum';
COMMENT ON COLUMN "public"."tea_shop_entry_allocations"."day_units_sum" IS 'Sum of day_units from daily_attendance for this site on entry date';
COMMENT ON COLUMN "public"."tea_shop_entry_allocations"."allocation_percentage" IS 'Percentage of total allocated to this site (based on day_units ratio)';
COMMENT ON COLUMN "public"."tea_shop_entry_allocations"."allocated_amount" IS 'Actual rupee amount allocated to this site';

-- Indexes
CREATE INDEX "idx_tea_shop_entry_allocations_entry" ON "public"."tea_shop_entry_allocations"("entry_id");
CREATE INDEX "idx_tea_shop_entry_allocations_site" ON "public"."tea_shop_entry_allocations"("site_id");

-- =============================================================================
-- 4. CREATE tea_shop_settlement_site_allocations TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "public"."tea_shop_settlement_site_allocations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "settlement_id" uuid NOT NULL REFERENCES "public"."tea_shop_settlements"("id") ON DELETE CASCADE,
    "site_id" uuid NOT NULL REFERENCES "public"."sites"("id") ON DELETE CASCADE,
    "entries_amount" numeric(10,2) NOT NULL DEFAULT 0,
    "paid_amount" numeric(10,2) NOT NULL DEFAULT 0,
    "created_at" timestamptz DEFAULT now() NOT NULL,

    PRIMARY KEY ("id"),
    UNIQUE ("settlement_id", "site_id")
);

ALTER TABLE "public"."tea_shop_settlement_site_allocations" OWNER TO "postgres";

COMMENT ON TABLE "public"."tea_shop_settlement_site_allocations" IS 'Per-site settlement tracking for accounting purposes';

-- Indexes
CREATE INDEX "idx_tea_shop_settlement_site_alloc_settlement" ON "public"."tea_shop_settlement_site_allocations"("settlement_id");
CREATE INDEX "idx_tea_shop_settlement_site_alloc_site" ON "public"."tea_shop_settlement_site_allocations"("site_id");

-- =============================================================================
-- 5. MODIFY tea_shop_entries TABLE
-- =============================================================================

-- Add new columns for company tea shop reference and group support
ALTER TABLE "public"."tea_shop_entries"
ADD COLUMN IF NOT EXISTS "company_tea_shop_id" uuid REFERENCES "public"."tea_shops"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "is_group_entry" boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS "site_group_id" uuid REFERENCES "public"."site_groups"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "total_day_units" numeric(10,2);

COMMENT ON COLUMN "public"."tea_shop_entries"."company_tea_shop_id" IS 'Reference to company-level tea shop (new model)';
COMMENT ON COLUMN "public"."tea_shop_entries"."is_group_entry" IS 'True if this entry is for a site group with per-site allocations';
COMMENT ON COLUMN "public"."tea_shop_entries"."site_group_id" IS 'Site group ID if this is a group entry';
COMMENT ON COLUMN "public"."tea_shop_entries"."total_day_units" IS 'Total day_units across all sites for this entry';

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS "idx_tea_shop_entries_company_shop" ON "public"."tea_shop_entries"("company_tea_shop_id") WHERE "company_tea_shop_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_tea_shop_entries_group_entry" ON "public"."tea_shop_entries"("is_group_entry") WHERE "is_group_entry" = true;
CREATE INDEX IF NOT EXISTS "idx_tea_shop_entries_site_group" ON "public"."tea_shop_entries"("site_group_id") WHERE "site_group_id" IS NOT NULL;

-- =============================================================================
-- 6. MODIFY tea_shop_settlements TABLE
-- =============================================================================

ALTER TABLE "public"."tea_shop_settlements"
ADD COLUMN IF NOT EXISTS "company_tea_shop_id" uuid REFERENCES "public"."tea_shops"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "is_group_settlement" boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS "site_group_id" uuid REFERENCES "public"."site_groups"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."tea_shop_settlements"."company_tea_shop_id" IS 'Reference to company-level tea shop (new model)';
COMMENT ON COLUMN "public"."tea_shop_settlements"."is_group_settlement" IS 'True if this settlement covers a site group';
COMMENT ON COLUMN "public"."tea_shop_settlements"."site_group_id" IS 'Site group ID if this is a group settlement';

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS "idx_tea_shop_settlements_company_shop" ON "public"."tea_shop_settlements"("company_tea_shop_id") WHERE "company_tea_shop_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_tea_shop_settlements_group" ON "public"."tea_shop_settlements"("is_group_settlement") WHERE "is_group_settlement" = true;
CREATE INDEX IF NOT EXISTS "idx_tea_shop_settlements_site_group" ON "public"."tea_shop_settlements"("site_group_id") WHERE "site_group_id" IS NOT NULL;

-- =============================================================================
-- 7. DATA MIGRATION: tea_shop_accounts → tea_shops
-- =============================================================================

-- Step 1: Migrate existing tea shop accounts to new tea_shops table
INSERT INTO "public"."tea_shops" (
    "id", "name", "owner_name", "contact_phone", "address",
    "upi_id", "qr_code_url", "is_active", "notes",
    "created_at", "updated_at"
)
SELECT
    "id",
    COALESCE("shop_name", 'Unnamed Shop'),
    "owner_name",
    "contact_phone",
    "address",
    "upi_id",
    "qr_code_url",
    "is_active",
    "notes",
    "created_at",
    "updated_at"
FROM "public"."tea_shop_accounts"
ON CONFLICT ("id") DO NOTHING;

-- Step 2: Create site assignments from existing tea_shop_accounts
-- Individual site assignments (where is_group_shop is false or site_group_id is null)
INSERT INTO "public"."tea_shop_site_assignments" (
    "tea_shop_id", "site_id", "site_group_id", "is_active", "assigned_at"
)
SELECT
    "id",
    "site_id",
    NULL,
    "is_active",
    "created_at"
FROM "public"."tea_shop_accounts"
WHERE "site_id" IS NOT NULL
  AND ("is_group_shop" = false OR "site_group_id" IS NULL)
ON CONFLICT DO NOTHING;

-- Group assignments (where is_group_shop is true and site_group_id is set)
INSERT INTO "public"."tea_shop_site_assignments" (
    "tea_shop_id", "site_id", "site_group_id", "is_active", "assigned_at"
)
SELECT
    "id",
    NULL,
    "site_group_id",
    "is_active",
    "created_at"
FROM "public"."tea_shop_accounts"
WHERE "is_group_shop" = true AND "site_group_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: Update existing entries to reference new tea_shops
UPDATE "public"."tea_shop_entries"
SET "company_tea_shop_id" = "tea_shop_id"
WHERE "tea_shop_id" IS NOT NULL AND "company_tea_shop_id" IS NULL;

-- Step 4: Update existing settlements to reference new tea_shops
UPDATE "public"."tea_shop_settlements"
SET "company_tea_shop_id" = "tea_shop_id"
WHERE "tea_shop_id" IS NOT NULL AND "company_tea_shop_id" IS NULL;

-- Step 5: Migrate tea_shop_group_entries to regular entries with is_group_entry=true
-- Note: This preserves the group entries in the unified entries table
INSERT INTO "public"."tea_shop_entries" (
    "company_tea_shop_id", "tea_shop_id", "site_id", "date", "total_amount",
    "is_group_entry", "site_group_id", "percentage_split",
    "notes", "entered_by", "entered_by_user_id",
    "amount_paid", "is_fully_paid", "entry_mode",
    "created_at", "updated_at"
)
SELECT
    ge."tea_shop_id",
    ge."tea_shop_id",
    NULL, -- Group entries don't have single site_id
    ge."date",
    ge."total_amount",
    true, -- is_group_entry
    ge."site_group_id",
    ge."percentage_split",
    ge."notes",
    ge."entered_by",
    ge."entered_by_user_id",
    ge."amount_paid",
    ge."is_fully_paid",
    'simple',
    ge."created_at",
    ge."updated_at"
FROM "public"."tea_shop_group_entries" ge
WHERE NOT EXISTS (
    -- Avoid duplicates if migration runs multiple times
    SELECT 1 FROM "public"."tea_shop_entries" te
    WHERE te."company_tea_shop_id" = ge."tea_shop_id"
      AND te."date" = ge."date"
      AND te."is_group_entry" = true
);

-- Step 6: Migrate group allocations to entry allocations
INSERT INTO "public"."tea_shop_entry_allocations" (
    "entry_id", "site_id", "day_units_sum", "worker_count",
    "allocation_percentage", "allocated_amount", "is_manual_override"
)
SELECT
    te."id",
    ga."site_id",
    COALESCE(ga."attendance_count", 0), -- Use attendance_count as day_units (will be recalculated)
    COALESCE(ga."attendance_count", 0),
    ga."allocation_percentage",
    ga."allocated_amount",
    false
FROM "public"."tea_shop_group_allocations" ga
JOIN "public"."tea_shop_group_entries" ge ON ga."group_entry_id" = ge."id"
JOIN "public"."tea_shop_entries" te ON te."company_tea_shop_id" = ge."tea_shop_id"
    AND te."date" = ge."date"
    AND te."is_group_entry" = true
ON CONFLICT ("entry_id", "site_id") DO NOTHING;

-- =============================================================================
-- 8. ENABLE RLS AND CREATE POLICIES
-- =============================================================================

-- tea_shops
ALTER TABLE "public"."tea_shops" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_shops_select" ON "public"."tea_shops"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "tea_shops_insert" ON "public"."tea_shops"
FOR INSERT TO authenticated
WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shops_update" ON "public"."tea_shops"
FOR UPDATE TO authenticated
USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shops_delete" ON "public"."tea_shops"
FOR DELETE TO authenticated USING ("public"."is_admin"());

-- tea_shop_site_assignments
ALTER TABLE "public"."tea_shop_site_assignments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_shop_site_assignments_select" ON "public"."tea_shop_site_assignments"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "tea_shop_site_assignments_insert" ON "public"."tea_shop_site_assignments"
FOR INSERT TO authenticated
WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shop_site_assignments_update" ON "public"."tea_shop_site_assignments"
FOR UPDATE TO authenticated
USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shop_site_assignments_delete" ON "public"."tea_shop_site_assignments"
FOR DELETE TO authenticated USING ("public"."is_admin"());

-- tea_shop_entry_allocations
ALTER TABLE "public"."tea_shop_entry_allocations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_shop_entry_allocations_select" ON "public"."tea_shop_entry_allocations"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "tea_shop_entry_allocations_insert" ON "public"."tea_shop_entry_allocations"
FOR INSERT TO authenticated
WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role", 'site_engineer'::"public"."user_role"])));

CREATE POLICY "tea_shop_entry_allocations_update" ON "public"."tea_shop_entry_allocations"
FOR UPDATE TO authenticated
USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shop_entry_allocations_delete" ON "public"."tea_shop_entry_allocations"
FOR DELETE TO authenticated USING ("public"."is_admin"());

-- tea_shop_settlement_site_allocations
ALTER TABLE "public"."tea_shop_settlement_site_allocations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_shop_settlement_site_alloc_select" ON "public"."tea_shop_settlement_site_allocations"
FOR SELECT TO authenticated USING (true);

CREATE POLICY "tea_shop_settlement_site_alloc_insert" ON "public"."tea_shop_settlement_site_allocations"
FOR INSERT TO authenticated
WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role", 'site_engineer'::"public"."user_role"])));

CREATE POLICY "tea_shop_settlement_site_alloc_update" ON "public"."tea_shop_settlement_site_allocations"
FOR UPDATE TO authenticated
USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"public"."user_role", 'office'::"public"."user_role"])));

CREATE POLICY "tea_shop_settlement_site_alloc_delete" ON "public"."tea_shop_settlement_site_allocations"
FOR DELETE TO authenticated USING ("public"."is_admin"());

-- =============================================================================
-- 9. HELPER FUNCTION: Get tea shop for site (handles group lookup)
-- =============================================================================

CREATE OR REPLACE FUNCTION "public"."get_tea_shop_for_site"("p_site_id" uuid)
RETURNS uuid AS $$
DECLARE
    v_tea_shop_id uuid;
    v_site_group_id uuid;
BEGIN
    -- First check for direct site assignment
    SELECT tsa.tea_shop_id INTO v_tea_shop_id
    FROM public.tea_shop_site_assignments tsa
    WHERE tsa.site_id = p_site_id AND tsa.is_active = true
    LIMIT 1;

    IF v_tea_shop_id IS NOT NULL THEN
        RETURN v_tea_shop_id;
    END IF;

    -- Check if site is in a group that has a tea shop assigned
    SELECT s.site_group_id INTO v_site_group_id
    FROM public.sites s
    WHERE s.id = p_site_id;

    IF v_site_group_id IS NOT NULL THEN
        SELECT tsa.tea_shop_id INTO v_tea_shop_id
        FROM public.tea_shop_site_assignments tsa
        WHERE tsa.site_group_id = v_site_group_id AND tsa.is_active = true
        LIMIT 1;
    END IF;

    RETURN v_tea_shop_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION "public"."get_tea_shop_for_site"(uuid) IS 'Returns the tea shop ID assigned to a site, checking both direct assignment and group assignment';

-- =============================================================================
-- 10. TRIGGER: Update tea_shops timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION "public"."update_tea_shops_timestamp"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "tea_shops_updated_at"
BEFORE UPDATE ON "public"."tea_shops"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_tea_shops_timestamp"();

-- =============================================================================
-- 11. GRANTS
-- =============================================================================

GRANT ALL ON TABLE "public"."tea_shops" TO "anon";
GRANT ALL ON TABLE "public"."tea_shops" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shops" TO "service_role";

GRANT ALL ON TABLE "public"."tea_shop_site_assignments" TO "anon";
GRANT ALL ON TABLE "public"."tea_shop_site_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shop_site_assignments" TO "service_role";

GRANT ALL ON TABLE "public"."tea_shop_entry_allocations" TO "anon";
GRANT ALL ON TABLE "public"."tea_shop_entry_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shop_entry_allocations" TO "service_role";

GRANT ALL ON TABLE "public"."tea_shop_settlement_site_allocations" TO "anon";
GRANT ALL ON TABLE "public"."tea_shop_settlement_site_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."tea_shop_settlement_site_allocations" TO "service_role";

GRANT ALL ON FUNCTION "public"."get_tea_shop_for_site"(uuid) TO "anon";
GRANT ALL ON FUNCTION "public"."get_tea_shop_for_site"(uuid) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tea_shop_for_site"(uuid) TO "service_role";
