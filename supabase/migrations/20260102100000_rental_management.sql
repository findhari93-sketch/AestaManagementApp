-- =============================================
-- RENTAL MANAGEMENT MIGRATION
-- =============================================

-- Add rental_store to vendor_type enum
ALTER TYPE "public"."vendor_type" ADD VALUE IF NOT EXISTS 'rental_store';

-- =============================================
-- RENTAL TYPES (ENUMS)
-- =============================================

CREATE TYPE "public"."rental_type" AS ENUM (
    'equipment',
    'scaffolding',
    'shuttering',
    'other'
);

CREATE TYPE "public"."rental_order_status" AS ENUM (
    'draft',
    'confirmed',
    'active',
    'partially_returned',
    'completed',
    'cancelled'
);

CREATE TYPE "public"."rental_item_status" AS ENUM (
    'pending',
    'active',
    'partially_returned',
    'returned',
    'damaged'
);

CREATE TYPE "public"."return_condition" AS ENUM (
    'good',
    'damaged',
    'lost'
);

CREATE TYPE "public"."transport_handler" AS ENUM (
    'vendor',
    'company',
    'laborer'
);

CREATE TYPE "public"."rental_price_source" AS ENUM (
    'rental',
    'quotation',
    'manual'
);

-- =============================================
-- RENTAL ITEM CATEGORIES
-- =============================================

CREATE TABLE "public"."rental_item_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "name" "text" NOT NULL,
    "code" "text" UNIQUE,
    "description" "text",
    "parent_id" "uuid" REFERENCES "public"."rental_item_categories"("id"),
    "display_order" integer DEFAULT 0,
    "icon" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Insert default categories
INSERT INTO "public"."rental_item_categories" ("name", "code", "display_order") VALUES
    ('Equipment', 'EQP', 1),
    ('Scaffolding', 'SCF', 2),
    ('Shuttering', 'SHT', 3),
    ('Other', 'OTH', 4);

-- =============================================
-- RENTAL ITEMS (Catalog)
-- =============================================

CREATE TABLE "public"."rental_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "name" "text" NOT NULL,
    "code" "text" UNIQUE,
    "local_name" "text",
    "category_id" "uuid" REFERENCES "public"."rental_item_categories"("id"),
    "description" "text",
    "rental_type" "public"."rental_type" NOT NULL,
    "unit" "text" NOT NULL DEFAULT 'piece',
    "specifications" jsonb,
    "default_daily_rate" numeric(12,2),
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" REFERENCES "auth"."users"("id")
);

-- Create indexes
CREATE INDEX "idx_rental_items_category" ON "public"."rental_items" ("category_id");
CREATE INDEX "idx_rental_items_type" ON "public"."rental_items" ("rental_type");
CREATE INDEX "idx_rental_items_name" ON "public"."rental_items" USING gin ("name" gin_trgm_ops);

-- =============================================
-- RENTAL STORE INVENTORY
-- =============================================

CREATE TABLE "public"."rental_store_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "vendor_id" "uuid" NOT NULL REFERENCES "public"."vendors"("id") ON DELETE CASCADE,
    "rental_item_id" "uuid" NOT NULL REFERENCES "public"."rental_items"("id") ON DELETE CASCADE,
    "daily_rate" numeric(12,2) NOT NULL,
    "weekly_rate" numeric(12,2),
    "monthly_rate" numeric(12,2),
    "transport_cost" numeric(10,2),
    "loading_cost" numeric(10,2),
    "unloading_cost" numeric(10,2),
    "min_rental_days" integer DEFAULT 1,
    "long_term_discount_percentage" numeric(5,2) DEFAULT 0,
    "long_term_threshold_days" integer DEFAULT 30,
    "notes" "text",
    "last_price_update" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    UNIQUE("vendor_id", "rental_item_id")
);

CREATE INDEX "idx_rental_store_inventory_vendor" ON "public"."rental_store_inventory" ("vendor_id");
CREATE INDEX "idx_rental_store_inventory_item" ON "public"."rental_store_inventory" ("rental_item_id");

-- =============================================
-- RENTAL ORDERS
-- =============================================

CREATE TABLE "public"."rental_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "rental_order_number" "text" UNIQUE NOT NULL,
    "site_id" "uuid" NOT NULL REFERENCES "public"."sites"("id"),
    "vendor_id" "uuid" NOT NULL REFERENCES "public"."vendors"("id"),
    "order_date" date NOT NULL DEFAULT CURRENT_DATE,
    "start_date" date NOT NULL,
    "expected_return_date" date,
    "actual_return_date" date,
    "status" "public"."rental_order_status" NOT NULL DEFAULT 'draft',
    "estimated_total" numeric(12,2) DEFAULT 0,
    "actual_total" numeric(12,2),

    -- Transport outward (taking rental)
    "transport_cost_outward" numeric(10,2) DEFAULT 0,
    "loading_cost_outward" numeric(10,2) DEFAULT 0,
    "unloading_cost_outward" numeric(10,2) DEFAULT 0,
    "outward_by" "public"."transport_handler",

    -- Transport return (returning rental)
    "transport_cost_return" numeric(10,2) DEFAULT 0,
    "loading_cost_return" numeric(10,2) DEFAULT 0,
    "unloading_cost_return" numeric(10,2) DEFAULT 0,
    "return_by" "public"."transport_handler",

    -- Receipts/Proofs
    "vendor_slip_url" "text",
    "return_receipt_url" "text",

    -- Notes
    "notes" "text",
    "internal_notes" "text",

    -- Discount
    "negotiated_discount_percentage" numeric(5,2) DEFAULT 0,
    "negotiated_discount_amount" numeric(12,2) DEFAULT 0,

    -- Approval/Cancellation
    "approved_by" "uuid" REFERENCES "auth"."users"("id"),
    "approved_at" timestamp with time zone,
    "cancelled_by" "uuid" REFERENCES "auth"."users"("id"),
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",

    -- Audit
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" REFERENCES "auth"."users"("id")
);

CREATE INDEX "idx_rental_orders_site" ON "public"."rental_orders" ("site_id");
CREATE INDEX "idx_rental_orders_vendor" ON "public"."rental_orders" ("vendor_id");
CREATE INDEX "idx_rental_orders_status" ON "public"."rental_orders" ("status");
CREATE INDEX "idx_rental_orders_dates" ON "public"."rental_orders" ("start_date", "expected_return_date");

-- =============================================
-- RENTAL ORDER ITEMS
-- =============================================

CREATE TABLE "public"."rental_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "rental_order_id" "uuid" NOT NULL REFERENCES "public"."rental_orders"("id") ON DELETE CASCADE,
    "rental_item_id" "uuid" NOT NULL REFERENCES "public"."rental_items"("id"),
    "quantity" integer NOT NULL,
    "daily_rate_default" numeric(12,2) NOT NULL,
    "daily_rate_actual" numeric(12,2) NOT NULL,
    "item_start_date" date,
    "item_expected_return_date" date,
    "quantity_returned" integer DEFAULT 0,
    "quantity_outstanding" integer GENERATED ALWAYS AS (quantity - quantity_returned) STORED,
    "status" "public"."rental_item_status" DEFAULT 'pending',
    "specifications" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE INDEX "idx_rental_order_items_order" ON "public"."rental_order_items" ("rental_order_id");
CREATE INDEX "idx_rental_order_items_item" ON "public"."rental_order_items" ("rental_item_id");

-- =============================================
-- RENTAL RETURNS
-- =============================================

CREATE TABLE "public"."rental_returns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "rental_order_id" "uuid" NOT NULL REFERENCES "public"."rental_orders"("id"),
    "rental_order_item_id" "uuid" NOT NULL REFERENCES "public"."rental_order_items"("id"),
    "return_date" date NOT NULL DEFAULT CURRENT_DATE,
    "quantity_returned" integer NOT NULL,
    "condition" "public"."return_condition" DEFAULT 'good',
    "damage_description" "text",
    "damage_cost" numeric(10,2) DEFAULT 0,
    "receipt_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" REFERENCES "auth"."users"("id")
);

CREATE INDEX "idx_rental_returns_order" ON "public"."rental_returns" ("rental_order_id");
CREATE INDEX "idx_rental_returns_item" ON "public"."rental_returns" ("rental_order_item_id");

-- =============================================
-- RENTAL ADVANCES
-- =============================================

CREATE TABLE "public"."rental_advances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "rental_order_id" "uuid" NOT NULL REFERENCES "public"."rental_orders"("id"),
    "advance_date" date NOT NULL DEFAULT CURRENT_DATE,
    "amount" numeric(12,2) NOT NULL,
    "payment_mode" "text",
    "payment_channel" "text",
    "payer_source" "text",
    "payer_name" "text",
    "proof_url" "text",
    "engineer_transaction_id" "uuid" REFERENCES "public"."site_engineer_transactions"("id"),
    "settlement_group_id" "uuid" REFERENCES "public"."settlement_groups"("id"),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" REFERENCES "auth"."users"("id")
);

CREATE INDEX "idx_rental_advances_order" ON "public"."rental_advances" ("rental_order_id");

-- =============================================
-- RENTAL SETTLEMENTS
-- =============================================

CREATE TABLE "public"."rental_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "rental_order_id" "uuid" NOT NULL REFERENCES "public"."rental_orders"("id") UNIQUE,
    "settlement_date" date NOT NULL DEFAULT CURRENT_DATE,
    "settlement_reference" "text" UNIQUE,
    "total_rental_amount" numeric(12,2) NOT NULL,
    "total_transport_amount" numeric(12,2) DEFAULT 0,
    "total_damage_amount" numeric(12,2) DEFAULT 0,
    "negotiated_final_amount" numeric(12,2),
    "total_advance_paid" numeric(12,2) DEFAULT 0,
    "balance_amount" numeric(12,2) NOT NULL,
    "payment_mode" "text",
    "payment_channel" "text",
    "payer_source" "text",
    "payer_name" "text",
    "final_receipt_url" "text",
    "engineer_transaction_id" "uuid" REFERENCES "public"."site_engineer_transactions"("id"),
    "settlement_group_id" "uuid" REFERENCES "public"."settlement_groups"("id"),
    "notes" "text",
    "settled_by" "uuid" REFERENCES "auth"."users"("id"),
    "settled_by_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE INDEX "idx_rental_settlements_order" ON "public"."rental_settlements" ("rental_order_id");

-- =============================================
-- RENTAL PRICE HISTORY
-- =============================================

CREATE TABLE "public"."rental_price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "vendor_id" "uuid" NOT NULL REFERENCES "public"."vendors"("id"),
    "rental_item_id" "uuid" NOT NULL REFERENCES "public"."rental_items"("id"),
    "daily_rate" numeric(12,2) NOT NULL,
    "recorded_date" date NOT NULL DEFAULT CURRENT_DATE,
    "source" "public"."rental_price_source" DEFAULT 'manual',
    "source_reference" "text",
    "notes" "text",
    "recorded_by" "uuid" REFERENCES "auth"."users"("id"),
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE INDEX "idx_rental_price_history_vendor" ON "public"."rental_price_history" ("vendor_id");
CREATE INDEX "idx_rental_price_history_item" ON "public"."rental_price_history" ("rental_item_id");
CREATE INDEX "idx_rental_price_history_date" ON "public"."rental_price_history" ("recorded_date" DESC);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Generate rental order number
CREATE OR REPLACE FUNCTION "public"."generate_rental_order_number"("p_site_id" "uuid")
RETURNS "text"
LANGUAGE "plpgsql"
AS $$
DECLARE
  v_date TEXT;
  v_seq INTEGER;
  v_result TEXT;
BEGIN
  v_date := to_char(CURRENT_DATE, 'YYMMDD');

  SELECT COALESCE(MAX(
    SUBSTRING(rental_order_number FROM 'RNT-' || v_date || '-(\d+)')::INTEGER
  ), 0) + 1
  INTO v_seq
  FROM rental_orders
  WHERE rental_order_number LIKE 'RNT-' || v_date || '-%';

  v_result := 'RNT-' || v_date || '-' || LPAD(v_seq::TEXT, 3, '0');
  RETURN v_result;
END;
$$;

-- Generate rental settlement reference
CREATE OR REPLACE FUNCTION "public"."generate_rental_settlement_reference"("p_site_id" "uuid")
RETURNS "text"
LANGUAGE "plpgsql"
AS $$
DECLARE
  v_date TEXT;
  v_seq INTEGER;
  v_result TEXT;
BEGIN
  v_date := to_char(CURRENT_DATE, 'YYMMDD');

  SELECT COALESCE(MAX(
    SUBSTRING(settlement_reference FROM 'RSET-' || v_date || '-(\d+)')::INTEGER
  ), 0) + 1
  INTO v_seq
  FROM rental_settlements
  WHERE settlement_reference LIKE 'RSET-' || v_date || '-%';

  v_result := 'RSET-' || v_date || '-' || LPAD(v_seq::TEXT, 3, '0');
  RETURN v_result;
END;
$$;

-- Calculate rental cost for an order
CREATE OR REPLACE FUNCTION "public"."calculate_rental_cost"(
  "p_order_id" "uuid",
  "p_as_of_date" date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  "total_rental_cost" numeric,
  "total_days" integer,
  "items_count" integer,
  "accrued_cost" numeric,
  "expected_total" numeric
)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(
      roi.quantity_outstanding * roi.daily_rate_actual *
      GREATEST(1, (p_as_of_date - COALESCE(roi.item_start_date, ro.start_date) + 1))
    ), 0::numeric) AS total_rental_cost,
    COALESCE(MAX(p_as_of_date - ro.start_date + 1), 0)::integer AS total_days,
    COUNT(roi.id)::integer AS items_count,
    COALESCE(SUM(
      roi.quantity_outstanding * roi.daily_rate_actual *
      GREATEST(1, (CURRENT_DATE - COALESCE(roi.item_start_date, ro.start_date) + 1))
    ), 0::numeric) AS accrued_cost,
    COALESCE(SUM(
      roi.quantity * roi.daily_rate_actual *
      GREATEST(1, (COALESCE(roi.item_expected_return_date, ro.expected_return_date, CURRENT_DATE + 30) - COALESCE(roi.item_start_date, ro.start_date) + 1))
    ), 0::numeric) AS expected_total
  FROM rental_orders ro
  LEFT JOIN rental_order_items roi ON roi.rental_order_id = ro.id
  WHERE ro.id = p_order_id
  GROUP BY ro.id, ro.start_date;
END;
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE "public"."rental_item_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rental_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rental_store_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rental_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rental_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rental_returns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rental_advances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rental_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rental_price_history" ENABLE ROW LEVEL SECURITY;

-- Rental item categories - all authenticated users can view
CREATE POLICY "rental_item_categories_select_policy" ON "public"."rental_item_categories"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rental_item_categories_insert_policy" ON "public"."rental_item_categories"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rental_item_categories_update_policy" ON "public"."rental_item_categories"
    FOR UPDATE TO authenticated USING (true);

-- Rental items - all authenticated users can view
CREATE POLICY "rental_items_select_policy" ON "public"."rental_items"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rental_items_insert_policy" ON "public"."rental_items"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rental_items_update_policy" ON "public"."rental_items"
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "rental_items_delete_policy" ON "public"."rental_items"
    FOR DELETE TO authenticated USING (true);

-- Rental store inventory - all authenticated users can view
CREATE POLICY "rental_store_inventory_select_policy" ON "public"."rental_store_inventory"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rental_store_inventory_insert_policy" ON "public"."rental_store_inventory"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rental_store_inventory_update_policy" ON "public"."rental_store_inventory"
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "rental_store_inventory_delete_policy" ON "public"."rental_store_inventory"
    FOR DELETE TO authenticated USING (true);

-- Rental orders - site-based access
CREATE POLICY "rental_orders_select_policy" ON "public"."rental_orders"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rental_orders_insert_policy" ON "public"."rental_orders"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rental_orders_update_policy" ON "public"."rental_orders"
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "rental_orders_delete_policy" ON "public"."rental_orders"
    FOR DELETE TO authenticated USING (true);

-- Rental order items
CREATE POLICY "rental_order_items_select_policy" ON "public"."rental_order_items"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rental_order_items_insert_policy" ON "public"."rental_order_items"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rental_order_items_update_policy" ON "public"."rental_order_items"
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "rental_order_items_delete_policy" ON "public"."rental_order_items"
    FOR DELETE TO authenticated USING (true);

-- Rental returns
CREATE POLICY "rental_returns_select_policy" ON "public"."rental_returns"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rental_returns_insert_policy" ON "public"."rental_returns"
    FOR INSERT TO authenticated WITH CHECK (true);

-- Rental advances
CREATE POLICY "rental_advances_select_policy" ON "public"."rental_advances"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rental_advances_insert_policy" ON "public"."rental_advances"
    FOR INSERT TO authenticated WITH CHECK (true);

-- Rental settlements
CREATE POLICY "rental_settlements_select_policy" ON "public"."rental_settlements"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rental_settlements_insert_policy" ON "public"."rental_settlements"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rental_settlements_update_policy" ON "public"."rental_settlements"
    FOR UPDATE TO authenticated USING (true);

-- Rental price history
CREATE POLICY "rental_price_history_select_policy" ON "public"."rental_price_history"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "rental_price_history_insert_policy" ON "public"."rental_price_history"
    FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION "public"."update_rental_updated_at"()
RETURNS TRIGGER
LANGUAGE "plpgsql"
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "update_rental_items_updated_at"
    BEFORE UPDATE ON "public"."rental_items"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_rental_updated_at"();

CREATE TRIGGER "update_rental_orders_updated_at"
    BEFORE UPDATE ON "public"."rental_orders"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_rental_updated_at"();

CREATE TRIGGER "update_rental_order_items_updated_at"
    BEFORE UPDATE ON "public"."rental_order_items"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_rental_updated_at"();

CREATE TRIGGER "update_rental_store_inventory_updated_at"
    BEFORE UPDATE ON "public"."rental_store_inventory"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_rental_updated_at"();

CREATE TRIGGER "update_rental_settlements_updated_at"
    BEFORE UPDATE ON "public"."rental_settlements"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_rental_updated_at"();

-- Record price history when rental order is created
CREATE OR REPLACE FUNCTION "public"."record_rental_price_history"()
RETURNS TRIGGER
LANGUAGE "plpgsql"
AS $$
BEGIN
  -- Record price from rental order items
  INSERT INTO rental_price_history (
    vendor_id,
    rental_item_id,
    daily_rate,
    recorded_date,
    source,
    source_reference,
    recorded_by
  )
  SELECT
    (SELECT vendor_id FROM rental_orders WHERE id = NEW.rental_order_id),
    NEW.rental_item_id,
    NEW.daily_rate_actual,
    CURRENT_DATE,
    'rental',
    (SELECT rental_order_number FROM rental_orders WHERE id = NEW.rental_order_id),
    NEW.created_by
  ON CONFLICT DO NOTHING;

  -- Update vendor inventory price if exists
  UPDATE rental_store_inventory
  SET daily_rate = NEW.daily_rate_actual,
      last_price_update = NOW()
  WHERE vendor_id = (SELECT vendor_id FROM rental_orders WHERE id = NEW.rental_order_id)
    AND rental_item_id = NEW.rental_item_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_record_rental_price"
    AFTER INSERT ON "public"."rental_order_items"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."record_rental_price_history"();
