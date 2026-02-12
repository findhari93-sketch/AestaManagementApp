-- =============================================
-- EQUIPMENT MANAGEMENT MIGRATION
-- Company Equipment/Asset Tracking System
-- =============================================

-- =============================================
-- EQUIPMENT TYPES (ENUMS)
-- =============================================

CREATE TYPE "public"."equipment_status" AS ENUM (
    'available',
    'deployed',
    'under_repair',
    'lost',
    'disposed'
);

CREATE TYPE "public"."equipment_condition" AS ENUM (
    'excellent',
    'good',
    'fair',
    'needs_repair',
    'damaged'
);

CREATE TYPE "public"."equipment_transfer_status" AS ENUM (
    'pending',
    'in_transit',
    'received',
    'rejected',
    'cancelled'
);

CREATE TYPE "public"."equipment_location_type" AS ENUM (
    'warehouse',
    'site'
);

CREATE TYPE "public"."equipment_purchase_source" AS ENUM (
    'online',
    'store',
    'other'
);

CREATE TYPE "public"."maintenance_type" AS ENUM (
    'routine',
    'repair',
    'overhaul'
);

CREATE TYPE "public"."sim_operator" AS ENUM (
    'airtel',
    'jio',
    'vi',
    'bsnl',
    'other'
);

-- =============================================
-- EQUIPMENT CATEGORIES
-- =============================================

CREATE TABLE "public"."equipment_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "name" "text" NOT NULL,
    "code" "text" UNIQUE NOT NULL,
    "code_prefix" "text" NOT NULL,
    "description" "text",
    "parent_id" "uuid" REFERENCES "public"."equipment_categories"("id"),
    "display_order" integer DEFAULT 0,
    "icon" "text",
    "default_maintenance_interval_days" integer DEFAULT 90,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Insert default categories
INSERT INTO "public"."equipment_categories" ("name", "code", "code_prefix", "display_order", "icon", "default_maintenance_interval_days") VALUES
    ('Tools', 'TOOL', 'TOOL', 1, 'Build', 180),
    ('Machinery', 'MACH', 'MACH', 2, 'PrecisionManufacturing', 90),
    ('Surveillance', 'SURV', 'CAM', 3, 'Videocam', 365),
    ('Phones', 'PHN', 'PHN', 4, 'PhoneAndroid', 365),
    ('Electronics', 'ELEC', 'ELEC', 5, 'Devices', 180),
    ('Vehicles', 'VEHI', 'VEH', 6, 'LocalShipping', 90),
    ('Safety Equipment', 'SAFE', 'SAFE', 7, 'Security', 180),
    ('Office Equipment', 'OFFC', 'OFFC', 8, 'Business', 365),
    ('Accessories', 'ACC', 'ACC', 9, 'Extension', NULL),
    ('Other', 'OTHR', 'OTH', 10, 'Category', 180);

-- =============================================
-- EQUIPMENT (Main Table)
-- =============================================

CREATE TABLE "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "equipment_code" "text" UNIQUE NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category_id" "uuid" REFERENCES "public"."equipment_categories"("id"),
    "status" "public"."equipment_status" NOT NULL DEFAULT 'available',
    "condition" "public"."equipment_condition" DEFAULT 'good',

    -- Current location tracking
    "current_location_type" "public"."equipment_location_type" DEFAULT 'warehouse',
    "current_site_id" "uuid" REFERENCES "public"."sites"("id") ON DELETE SET NULL,
    "warehouse_location" "text",
    "deployed_at" timestamp with time zone,

    -- Responsibility tracking
    "responsible_user_id" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "responsible_laborer_id" "uuid" REFERENCES "public"."laborers"("id") ON DELETE SET NULL,

    -- Purchase info
    "purchase_date" date,
    "purchase_cost" numeric(12,2),
    "purchase_vendor_id" "uuid" REFERENCES "public"."vendors"("id") ON DELETE SET NULL,
    "purchase_source" "public"."equipment_purchase_source",
    "payment_source" "text",
    "warranty_expiry_date" date,

    -- Identification
    "serial_number" "text",
    "model_number" "text",
    "brand" "text",
    "manufacturer" "text",

    -- Accessory linking (for accessories linked to parent machines)
    "parent_equipment_id" "uuid" REFERENCES "public"."equipment"("id") ON DELETE SET NULL,

    -- Additional specs (extensible JSON for category-specific data)
    "specifications" jsonb DEFAULT '{}',

    -- Camera-specific fields (populated for surveillance category)
    "camera_details" jsonb,

    -- Photos
    "photos" text[] DEFAULT '{}',
    "primary_photo_url" "text",

    -- Maintenance tracking
    "last_maintenance_date" date,
    "next_maintenance_date" date,
    "maintenance_interval_days" integer,

    -- Notes
    "notes" "text",

    -- Soft delete and audit
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" REFERENCES "auth"."users"("id"),
    "updated_by" "uuid" REFERENCES "auth"."users"("id")
);

-- Indexes
CREATE INDEX "idx_equipment_category" ON "public"."equipment" ("category_id");
CREATE INDEX "idx_equipment_status" ON "public"."equipment" ("status");
CREATE INDEX "idx_equipment_condition" ON "public"."equipment" ("condition");
CREATE INDEX "idx_equipment_site" ON "public"."equipment" ("current_site_id");
CREATE INDEX "idx_equipment_code" ON "public"."equipment" ("equipment_code");
CREATE INDEX "idx_equipment_parent" ON "public"."equipment" ("parent_equipment_id");
CREATE INDEX "idx_equipment_responsible_user" ON "public"."equipment" ("responsible_user_id");
CREATE INDEX "idx_equipment_responsible_laborer" ON "public"."equipment" ("responsible_laborer_id");
CREATE INDEX "idx_equipment_maintenance" ON "public"."equipment" ("next_maintenance_date") WHERE "is_active" = true;
CREATE INDEX "idx_equipment_name" ON "public"."equipment" USING gin ("name" gin_trgm_ops);

-- =============================================
-- EQUIPMENT TRANSFERS
-- =============================================

CREATE TABLE "public"."equipment_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "transfer_number" "text" UNIQUE,
    "equipment_id" "uuid" NOT NULL REFERENCES "public"."equipment"("id") ON DELETE CASCADE,

    -- From location
    "from_location_type" "public"."equipment_location_type" NOT NULL,
    "from_site_id" "uuid" REFERENCES "public"."sites"("id") ON DELETE SET NULL,
    "from_warehouse_location" "text",
    "from_responsible_user_id" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "from_responsible_laborer_id" "uuid" REFERENCES "public"."laborers"("id") ON DELETE SET NULL,

    -- To location
    "to_location_type" "public"."equipment_location_type" NOT NULL,
    "to_site_id" "uuid" REFERENCES "public"."sites"("id") ON DELETE SET NULL,
    "to_warehouse_location" "text",
    "to_responsible_user_id" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "to_responsible_laborer_id" "uuid" REFERENCES "public"."laborers"("id") ON DELETE SET NULL,

    -- Transfer details
    "transfer_date" date DEFAULT CURRENT_DATE NOT NULL,
    "received_date" date,
    "status" "public"."equipment_transfer_status" DEFAULT 'pending' NOT NULL,
    "reason" "text",
    "notes" "text",

    -- Condition verification
    "condition_at_handover" "public"."equipment_condition",
    "condition_at_receipt" "public"."equipment_condition",
    "is_working" boolean DEFAULT true,
    "condition_notes" "text",

    -- Photos at transfer
    "handover_photos" text[] DEFAULT '{}',
    "receiving_photos" text[] DEFAULT '{}',

    -- Workflow tracking
    "initiated_by" "uuid" REFERENCES "auth"."users"("id"),
    "initiated_at" timestamp with time zone DEFAULT "now"(),
    "verified_by" "uuid" REFERENCES "auth"."users"("id"),
    "verified_at" timestamp with time zone,
    "received_by" "uuid" REFERENCES "auth"."users"("id"),
    "received_at" timestamp with time zone,
    "rejected_by" "uuid" REFERENCES "auth"."users"("id"),
    "rejected_at" timestamp with time zone,
    "rejection_reason" "text",

    -- Audit
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Indexes
CREATE INDEX "idx_equipment_transfers_equipment" ON "public"."equipment_transfers" ("equipment_id");
CREATE INDEX "idx_equipment_transfers_from_site" ON "public"."equipment_transfers" ("from_site_id");
CREATE INDEX "idx_equipment_transfers_to_site" ON "public"."equipment_transfers" ("to_site_id");
CREATE INDEX "idx_equipment_transfers_status" ON "public"."equipment_transfers" ("status");
CREATE INDEX "idx_equipment_transfers_date" ON "public"."equipment_transfers" ("transfer_date" DESC);

-- =============================================
-- EQUIPMENT MAINTENANCE
-- =============================================

CREATE TABLE "public"."equipment_maintenance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "equipment_id" "uuid" NOT NULL REFERENCES "public"."equipment"("id") ON DELETE CASCADE,
    "maintenance_date" date NOT NULL DEFAULT CURRENT_DATE,
    "maintenance_type" "public"."maintenance_type" NOT NULL,
    "description" "text",
    "cost" numeric(12,2),
    "vendor_id" "uuid" REFERENCES "public"."vendors"("id") ON DELETE SET NULL,
    "condition_before" "public"."equipment_condition",
    "condition_after" "public"."equipment_condition",
    "next_maintenance_date" date,
    "receipt_url" "text",
    "performed_by" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" REFERENCES "auth"."users"("id")
);

-- Indexes
CREATE INDEX "idx_equipment_maintenance_equipment" ON "public"."equipment_maintenance" ("equipment_id");
CREATE INDEX "idx_equipment_maintenance_date" ON "public"."equipment_maintenance" ("maintenance_date" DESC);
CREATE INDEX "idx_equipment_maintenance_type" ON "public"."equipment_maintenance" ("maintenance_type");

-- =============================================
-- SIM CARDS
-- =============================================

CREATE TABLE "public"."equipment_sim_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "phone_number" "text" NOT NULL,
    "operator" "public"."sim_operator" NOT NULL,
    "sim_serial_number" "text",
    "is_data_sim" boolean DEFAULT true,
    "monthly_plan" "text",
    "purchase_date" date,
    "notes" "text",

    -- Current assignment
    "assigned_equipment_id" "uuid" REFERENCES "public"."equipment"("id") ON DELETE SET NULL,
    "assigned_at" timestamp with time zone,

    -- Status
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" REFERENCES "auth"."users"("id")
);

-- Indexes
CREATE INDEX "idx_sim_cards_equipment" ON "public"."equipment_sim_cards" ("assigned_equipment_id");
CREATE INDEX "idx_sim_cards_phone" ON "public"."equipment_sim_cards" ("phone_number");
CREATE INDEX "idx_sim_cards_operator" ON "public"."equipment_sim_cards" ("operator");

-- =============================================
-- SIM RECHARGES
-- =============================================

CREATE TABLE "public"."equipment_sim_recharges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "sim_card_id" "uuid" NOT NULL REFERENCES "public"."equipment_sim_cards"("id") ON DELETE CASCADE,
    "recharge_date" date NOT NULL DEFAULT CURRENT_DATE,
    "amount" numeric(10,2) NOT NULL,
    "validity_days" integer,
    "validity_end_date" date,
    "plan_description" "text",
    "payment_mode" "text",
    "payment_reference" "text",
    "receipt_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" REFERENCES "auth"."users"("id")
);

-- Indexes
CREATE INDEX "idx_sim_recharges_sim" ON "public"."equipment_sim_recharges" ("sim_card_id");
CREATE INDEX "idx_sim_recharges_date" ON "public"."equipment_sim_recharges" ("recharge_date" DESC);
CREATE INDEX "idx_sim_recharges_validity" ON "public"."equipment_sim_recharges" ("validity_end_date");

-- =============================================
-- MEMORY CARDS
-- =============================================

CREATE TABLE "public"."equipment_memory_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "capacity_gb" integer NOT NULL,
    "brand" "text",
    "model" "text",
    "speed_class" "text",
    "serial_number" "text",
    "notes" "text",

    -- Current assignment
    "assigned_equipment_id" "uuid" REFERENCES "public"."equipment"("id") ON DELETE SET NULL,
    "assigned_at" timestamp with time zone,

    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" REFERENCES "auth"."users"("id")
);

-- Indexes
CREATE INDEX "idx_memory_cards_equipment" ON "public"."equipment_memory_cards" ("assigned_equipment_id");

-- =============================================
-- SIM ASSIGNMENT HISTORY
-- =============================================

CREATE TABLE "public"."equipment_sim_assignment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "sim_card_id" "uuid" NOT NULL REFERENCES "public"."equipment_sim_cards"("id") ON DELETE CASCADE,
    "equipment_id" "uuid" REFERENCES "public"."equipment"("id") ON DELETE SET NULL,
    "assigned_at" timestamp with time zone NOT NULL,
    "unassigned_at" timestamp with time zone,
    "notes" "text",
    "created_by" "uuid" REFERENCES "auth"."users"("id")
);

-- Indexes
CREATE INDEX "idx_sim_assignment_history_sim" ON "public"."equipment_sim_assignment_history" ("sim_card_id");
CREATE INDEX "idx_sim_assignment_history_equipment" ON "public"."equipment_sim_assignment_history" ("equipment_id");

-- =============================================
-- FUNCTIONS
-- =============================================

-- Generate equipment code based on category
CREATE OR REPLACE FUNCTION "public"."generate_equipment_code"(p_category_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prefix text;
    v_seq integer;
    v_result text;
BEGIN
    -- Get category prefix
    SELECT code_prefix INTO v_prefix
    FROM equipment_categories
    WHERE id = p_category_id;

    IF v_prefix IS NULL THEN
        v_prefix := 'EQ';
    END IF;

    -- Get next sequence number for this prefix
    SELECT COALESCE(MAX(
        NULLIF(SUBSTRING(equipment_code FROM v_prefix || '-(\d+)'), '')::INTEGER
    ), 0) + 1
    INTO v_seq
    FROM equipment
    WHERE equipment_code LIKE v_prefix || '-%';

    v_result := v_prefix || '-' || LPAD(v_seq::TEXT, 3, '0');
    RETURN v_result;
END;
$$;

-- Generate transfer number
CREATE OR REPLACE FUNCTION "public"."generate_transfer_number"()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date text;
    v_seq integer;
BEGIN
    v_date := to_char(CURRENT_DATE, 'YYMMDD');

    SELECT COALESCE(MAX(
        NULLIF(SUBSTRING(transfer_number FROM 'TRF-' || v_date || '-(\d+)'), '')::INTEGER
    ), 0) + 1
    INTO v_seq
    FROM equipment_transfers
    WHERE transfer_number LIKE 'TRF-' || v_date || '-%';

    RETURN 'TRF-' || v_date || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$;

-- Trigger to auto-set equipment code on insert
CREATE OR REPLACE FUNCTION "public"."set_equipment_code"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.equipment_code IS NULL OR NEW.equipment_code = '' THEN
        NEW.equipment_code := generate_equipment_code(NEW.category_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "tr_equipment_set_code"
    BEFORE INSERT ON "public"."equipment"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_equipment_code"();

-- Trigger to auto-set transfer number on insert
CREATE OR REPLACE FUNCTION "public"."set_transfer_number"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.transfer_number IS NULL OR NEW.transfer_number = '' THEN
        NEW.transfer_number := generate_transfer_number();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "tr_transfer_set_number"
    BEFORE INSERT ON "public"."equipment_transfers"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_transfer_number"();

-- Update equipment location when transfer is received
CREATE OR REPLACE FUNCTION "public"."update_equipment_on_transfer_receive"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'received' AND OLD.status != 'received' THEN
        UPDATE equipment
        SET
            current_location_type = NEW.to_location_type,
            current_site_id = NEW.to_site_id,
            warehouse_location = NEW.to_warehouse_location,
            responsible_user_id = NEW.to_responsible_user_id,
            responsible_laborer_id = NEW.to_responsible_laborer_id,
            condition = COALESCE(NEW.condition_at_receipt, condition),
            status = CASE
                WHEN NEW.to_location_type = 'site' THEN 'deployed'::equipment_status
                ELSE 'available'::equipment_status
            END,
            deployed_at = CASE
                WHEN NEW.to_location_type = 'site' THEN NOW()
                ELSE NULL
            END,
            updated_at = NOW()
        WHERE id = NEW.equipment_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "tr_equipment_transfer_receive"
    AFTER UPDATE ON "public"."equipment_transfers"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_equipment_on_transfer_receive"();

-- Update equipment maintenance dates after maintenance record
CREATE OR REPLACE FUNCTION "public"."update_equipment_after_maintenance"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE equipment
    SET
        last_maintenance_date = NEW.maintenance_date,
        next_maintenance_date = COALESCE(
            NEW.next_maintenance_date,
            NEW.maintenance_date + COALESCE(
                maintenance_interval_days,
                (SELECT default_maintenance_interval_days FROM equipment_categories WHERE id = category_id),
                90
            )
        ),
        condition = COALESCE(NEW.condition_after, condition),
        status = CASE
            WHEN NEW.condition_after IN ('excellent', 'good', 'fair') AND status = 'under_repair'
            THEN CASE
                WHEN current_location_type = 'site' THEN 'deployed'::equipment_status
                ELSE 'available'::equipment_status
            END
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = NEW.equipment_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "tr_equipment_maintenance_update"
    AFTER INSERT ON "public"."equipment_maintenance"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_equipment_after_maintenance"();

-- Track SIM assignment history
CREATE OR REPLACE FUNCTION "public"."track_sim_assignment"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If assignment changed
    IF OLD.assigned_equipment_id IS DISTINCT FROM NEW.assigned_equipment_id THEN
        -- Close previous assignment
        IF OLD.assigned_equipment_id IS NOT NULL THEN
            UPDATE equipment_sim_assignment_history
            SET unassigned_at = NOW()
            WHERE sim_card_id = NEW.id
              AND equipment_id = OLD.assigned_equipment_id
              AND unassigned_at IS NULL;
        END IF;

        -- Create new assignment record
        IF NEW.assigned_equipment_id IS NOT NULL THEN
            INSERT INTO equipment_sim_assignment_history (
                sim_card_id,
                equipment_id,
                assigned_at,
                created_by
            ) VALUES (
                NEW.id,
                NEW.assigned_equipment_id,
                COALESCE(NEW.assigned_at, NOW()),
                NEW.created_by
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "tr_sim_assignment_history"
    AFTER UPDATE ON "public"."equipment_sim_cards"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."track_sim_assignment"();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION "public"."set_equipment_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "tr_equipment_updated_at"
    BEFORE UPDATE ON "public"."equipment"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_equipment_updated_at"();

CREATE TRIGGER "tr_equipment_categories_updated_at"
    BEFORE UPDATE ON "public"."equipment_categories"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_equipment_updated_at"();

CREATE TRIGGER "tr_equipment_transfers_updated_at"
    BEFORE UPDATE ON "public"."equipment_transfers"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_equipment_updated_at"();

CREATE TRIGGER "tr_equipment_sim_cards_updated_at"
    BEFORE UPDATE ON "public"."equipment_sim_cards"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."set_equipment_updated_at"();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE "public"."equipment_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."equipment_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."equipment_maintenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."equipment_sim_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."equipment_sim_recharges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."equipment_memory_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."equipment_sim_assignment_history" ENABLE ROW LEVEL SECURITY;

-- Equipment Categories (read for all authenticated)
CREATE POLICY "equipment_categories_select" ON "public"."equipment_categories"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "equipment_categories_insert" ON "public"."equipment_categories"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "equipment_categories_update" ON "public"."equipment_categories"
    FOR UPDATE TO authenticated USING (true);

-- Equipment (all authenticated can read, create, update)
CREATE POLICY "equipment_select" ON "public"."equipment"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "equipment_insert" ON "public"."equipment"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "equipment_update" ON "public"."equipment"
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "equipment_delete" ON "public"."equipment"
    FOR DELETE TO authenticated USING (true);

-- Equipment Transfers
CREATE POLICY "equipment_transfers_select" ON "public"."equipment_transfers"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "equipment_transfers_insert" ON "public"."equipment_transfers"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "equipment_transfers_update" ON "public"."equipment_transfers"
    FOR UPDATE TO authenticated USING (true);

-- Equipment Maintenance
CREATE POLICY "equipment_maintenance_select" ON "public"."equipment_maintenance"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "equipment_maintenance_insert" ON "public"."equipment_maintenance"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "equipment_maintenance_update" ON "public"."equipment_maintenance"
    FOR UPDATE TO authenticated USING (true);

-- SIM Cards
CREATE POLICY "sim_cards_select" ON "public"."equipment_sim_cards"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "sim_cards_insert" ON "public"."equipment_sim_cards"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "sim_cards_update" ON "public"."equipment_sim_cards"
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "sim_cards_delete" ON "public"."equipment_sim_cards"
    FOR DELETE TO authenticated USING (true);

-- SIM Recharges
CREATE POLICY "sim_recharges_select" ON "public"."equipment_sim_recharges"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "sim_recharges_insert" ON "public"."equipment_sim_recharges"
    FOR INSERT TO authenticated WITH CHECK (true);

-- Memory Cards
CREATE POLICY "memory_cards_select" ON "public"."equipment_memory_cards"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "memory_cards_insert" ON "public"."equipment_memory_cards"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "memory_cards_update" ON "public"."equipment_memory_cards"
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "memory_cards_delete" ON "public"."equipment_memory_cards"
    FOR DELETE TO authenticated USING (true);

-- SIM Assignment History
CREATE POLICY "sim_assignment_history_select" ON "public"."equipment_sim_assignment_history"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "sim_assignment_history_insert" ON "public"."equipment_sim_assignment_history"
    FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- GRANTS
-- =============================================

GRANT ALL ON "public"."equipment_categories" TO authenticated;
GRANT ALL ON "public"."equipment" TO authenticated;
GRANT ALL ON "public"."equipment_transfers" TO authenticated;
GRANT ALL ON "public"."equipment_maintenance" TO authenticated;
GRANT ALL ON "public"."equipment_sim_cards" TO authenticated;
GRANT ALL ON "public"."equipment_sim_recharges" TO authenticated;
GRANT ALL ON "public"."equipment_memory_cards" TO authenticated;
GRANT ALL ON "public"."equipment_sim_assignment_history" TO authenticated;

GRANT EXECUTE ON FUNCTION "public"."generate_equipment_code"(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."generate_transfer_number"() TO authenticated;
