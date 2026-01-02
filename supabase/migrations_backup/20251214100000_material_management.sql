-- ============================================
-- MATERIAL MANAGEMENT SYSTEM
-- Complete database schema migration
-- Created: 2024-12-14
-- ============================================

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- ENUMS (wrapped in DO block for idempotency)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'material_unit') THEN
    CREATE TYPE material_unit AS ENUM ('kg', 'g', 'ton', 'liter', 'ml', 'piece', 'bag', 'bundle', 'sqft', 'sqm', 'cft', 'cum', 'nos', 'rmt', 'box', 'set');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'po_status') THEN
    CREATE TYPE po_status AS ENUM ('draft', 'pending_approval', 'approved', 'ordered', 'partial_delivered', 'delivered', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
    CREATE TYPE delivery_status AS ENUM ('pending', 'in_transit', 'partial', 'delivered', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'material_request_status') THEN
    CREATE TYPE material_request_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'ordered', 'partial_fulfilled', 'fulfilled', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transaction_type') THEN
    CREATE TYPE stock_transaction_type AS ENUM ('purchase', 'usage', 'transfer_in', 'transfer_out', 'adjustment', 'return', 'wastage', 'initial');
  END IF;
END $$;

-- ============================================
-- COMPANY-LEVEL TABLES (Shared across sites)
-- ============================================

-- Vendors/Suppliers Master
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  contact_person TEXT,
  phone TEXT,
  alternate_phone TEXT,
  whatsapp_number TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'Tamil Nadu',
  pincode TEXT,
  gst_number TEXT,
  pan_number TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  payment_terms_days INTEGER DEFAULT 30,
  credit_limit DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vendors_code ON vendors(code);

-- Material Categories (hierarchical)
CREATE TABLE IF NOT EXISTS material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES material_categories(id),
  display_order INTEGER DEFAULT 0,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_categories_parent ON material_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_material_categories_active ON material_categories(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_material_categories_order ON material_categories(display_order);

-- Materials Master (Material Catalog)
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  local_name TEXT, -- Tamil name if different
  category_id UUID REFERENCES material_categories(id),
  description TEXT,

  -- Units & Specifications
  unit material_unit NOT NULL DEFAULT 'piece',
  secondary_unit material_unit,
  conversion_factor DECIMAL(10,4) DEFAULT 1,

  -- Tax & Compliance
  hsn_code TEXT,
  gst_rate DECIMAL(4,2) DEFAULT 18.00,

  -- Specifications (flexible JSON)
  specifications JSONB DEFAULT '{}',

  -- Stock Management
  min_order_qty DECIMAL(10,3) DEFAULT 1,
  reorder_level DECIMAL(10,3) DEFAULT 10,

  -- Reference
  image_url TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_active ON materials(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code);

-- Material Brands (for materials with multiple brands)
CREATE TABLE IF NOT EXISTS material_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  is_preferred BOOLEAN DEFAULT FALSE,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(material_id, brand_name)
);

CREATE INDEX IF NOT EXISTS idx_material_brands_material ON material_brands(material_id);
CREATE INDEX IF NOT EXISTS idx_material_brands_preferred ON material_brands(material_id) WHERE is_preferred = TRUE;

-- Vendor Material Categories (what categories vendor specializes in)
CREATE TABLE IF NOT EXISTS vendor_material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES material_categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_material_categories_vendor ON vendor_material_categories(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_material_categories_category ON vendor_material_categories(category_id);

-- Material-Vendor Mapping (which vendors supply which materials at what price)
CREATE TABLE IF NOT EXISTS material_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES material_brands(id),
  unit_price DECIMAL(12,2) NOT NULL,
  min_order_qty DECIMAL(10,3) DEFAULT 1,
  lead_time_days INTEGER DEFAULT 3,
  is_preferred BOOLEAN DEFAULT FALSE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_price_update DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(material_id, vendor_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_material_vendors_material ON material_vendors(material_id);
CREATE INDEX IF NOT EXISTS idx_material_vendors_vendor ON material_vendors(vendor_id);
CREATE INDEX IF NOT EXISTS idx_material_vendors_preferred ON material_vendors(material_id) WHERE is_preferred = TRUE;

-- Vendor Price History (track price changes over time)
CREATE TABLE IF NOT EXISTS vendor_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_vendor_id UUID NOT NULL REFERENCES material_vendors(id) ON DELETE CASCADE,
  old_price DECIMAL(12,2) NOT NULL,
  new_price DECIMAL(12,2) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_price_history_mv ON vendor_price_history(material_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_price_history_date ON vendor_price_history(effective_date DESC);

-- ============================================
-- SITE-LEVEL TABLES
-- ============================================

-- Stock Locations (storage areas within a site)
CREATE TABLE IF NOT EXISTS stock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  location_type TEXT DEFAULT 'store', -- store, yard, site
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, name)
);

CREATE INDEX IF NOT EXISTS idx_stock_locations_site ON stock_locations(site_id);
CREATE INDEX IF NOT EXISTS idx_stock_locations_default ON stock_locations(site_id) WHERE is_default = TRUE;

-- Stock Inventory (current stock levels per site/location)
CREATE TABLE IF NOT EXISTS stock_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  location_id UUID REFERENCES stock_locations(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),

  current_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
  reserved_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
  available_qty DECIMAL(12,3) GENERATED ALWAYS AS (current_qty - reserved_qty) STORED,

  -- Weighted average cost
  avg_unit_cost DECIMAL(12,2) DEFAULT 0,

  -- Dates
  last_received_date DATE,
  last_issued_date DATE,

  -- Site-specific reorder settings (overrides material defaults)
  reorder_level DECIMAL(10,3),
  reorder_qty DECIMAL(10,3),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(site_id, location_id, material_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_inventory_site ON stock_inventory(site_id);
CREATE INDEX IF NOT EXISTS idx_stock_inventory_material ON stock_inventory(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_inventory_location ON stock_inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_inventory_low_stock ON stock_inventory(site_id, material_id)
  WHERE current_qty > 0;

-- Stock Transactions (all stock movements - audit trail)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  inventory_id UUID NOT NULL REFERENCES stock_inventory(id),
  transaction_type stock_transaction_type NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

  quantity DECIMAL(12,3) NOT NULL, -- positive for in, negative for out
  unit_cost DECIMAL(12,2),
  total_cost DECIMAL(12,2),

  -- References to source documents
  reference_type TEXT, -- 'delivery', 'usage', 'transfer', 'adjustment'
  reference_id UUID,

  -- Additional context
  section_id UUID REFERENCES building_sections(id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_site ON stock_transactions(site_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_inventory ON stock_transactions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_date ON stock_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON stock_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_ref ON stock_transactions(reference_type, reference_id);

-- Stock Transfers (between sites or locations)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number TEXT UNIQUE,

  from_site_id UUID NOT NULL REFERENCES sites(id),
  to_site_id UUID NOT NULL REFERENCES sites(id),
  from_location_id UUID REFERENCES stock_locations(id),
  to_location_id UUID REFERENCES stock_locations(id),

  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')),

  notes TEXT,

  initiated_by UUID REFERENCES users(id),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  received_by UUID REFERENCES users(id),
  received_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_from ON stock_transfers(from_site_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to ON stock_transfers(to_site_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_date ON stock_transfers(transfer_date DESC);

-- Stock Transfer Items
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),
  quantity_sent DECIMAL(12,3) NOT NULL,
  quantity_received DECIMAL(12,3),
  unit_cost DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_material ON stock_transfer_items(material_id);

-- ============================================
-- PURCHASE ORDER TABLES
-- ============================================

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,

  site_id UUID NOT NULL REFERENCES sites(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),

  status po_status DEFAULT 'draft',

  -- Dates
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,

  -- Delivery
  delivery_address TEXT,
  delivery_location_id UUID REFERENCES stock_locations(id),

  -- Amounts
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  transport_cost DECIMAL(12,2) DEFAULT 0,
  other_charges DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,

  -- Payment
  payment_terms TEXT,
  advance_paid DECIMAL(12,2) DEFAULT 0,

  -- Documents
  quotation_url TEXT,
  po_document_url TEXT,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Workflow
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_site ON purchase_orders(site_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(po_number);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),

  description TEXT,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,

  -- Tax
  tax_rate DECIMAL(4,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,

  -- Discount
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,

  total_amount DECIMAL(12,2) NOT NULL,

  -- Tracking
  received_qty DECIMAL(12,3) DEFAULT 0,
  pending_qty DECIMAL(12,3) GENERATED ALWAYS AS (quantity - received_qty) STORED,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_material ON purchase_order_items(material_id);

-- ============================================
-- DELIVERY TABLES (Goods Receipt Notes)
-- ============================================

-- Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number TEXT UNIQUE NOT NULL,

  po_id UUID REFERENCES purchase_orders(id),
  site_id UUID NOT NULL REFERENCES sites(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  location_id UUID REFERENCES stock_locations(id),

  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_status delivery_status DEFAULT 'pending',

  -- Challan/DC details
  challan_number TEXT,
  challan_date DATE,
  challan_url TEXT,

  -- Vehicle details
  vehicle_number TEXT,
  driver_name TEXT,
  driver_phone TEXT,

  -- Verification
  received_by UUID REFERENCES users(id),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  inspection_notes TEXT,

  -- Invoice
  invoice_number TEXT,
  invoice_date DATE,
  invoice_amount DECIMAL(12,2),
  invoice_url TEXT,

  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_po ON deliveries(po_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_site ON deliveries(site_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_vendor ON deliveries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(delivery_status);
CREATE INDEX IF NOT EXISTS idx_deliveries_grn ON deliveries(grn_number);

-- Delivery Items
CREATE TABLE IF NOT EXISTS delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),

  ordered_qty DECIMAL(12,3),
  received_qty DECIMAL(12,3) NOT NULL,
  accepted_qty DECIMAL(12,3),
  rejected_qty DECIMAL(12,3) DEFAULT 0,
  rejection_reason TEXT,

  unit_price DECIMAL(12,2),

  -- Batch tracking
  batch_number TEXT,
  expiry_date DATE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_po_item ON delivery_items(po_item_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_material ON delivery_items(material_id);

-- ============================================
-- PAYMENT TABLES
-- ============================================

-- Purchase Payments
CREATE TABLE IF NOT EXISTS purchase_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  site_id UUID REFERENCES sites(id),

  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(12,2) NOT NULL,

  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque', 'card')),
  reference_number TEXT,
  bank_name TEXT,

  receipt_url TEXT,
  notes TEXT,

  is_advance BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_vendor ON purchase_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_site ON purchase_payments(site_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_date ON purchase_payments(payment_date DESC);

-- Purchase Payment Allocations (link payments to POs/deliveries)
CREATE TABLE IF NOT EXISTS purchase_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES purchase_payments(id) ON DELETE CASCADE,
  po_id UUID REFERENCES purchase_orders(id),
  delivery_id UUID REFERENCES deliveries(id),
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_payment_allocations_payment ON purchase_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payment_allocations_po ON purchase_payment_allocations(po_id);

-- ============================================
-- DAILY OPERATIONS TABLES
-- ============================================

-- Daily Material Usage (site engineers record this)
CREATE TABLE IF NOT EXISTS daily_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  section_id UUID REFERENCES building_sections(id),
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,

  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),

  quantity DECIMAL(12,3) NOT NULL,
  unit_cost DECIMAL(12,2),
  total_cost DECIMAL(12,2),

  -- Work context
  work_description TEXT,
  work_area TEXT,
  used_by TEXT,

  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_daily_material_usage_site ON daily_material_usage(site_id);
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_date ON daily_material_usage(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_section ON daily_material_usage(section_id);
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_material ON daily_material_usage(material_id);
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_site_date ON daily_material_usage(site_id, usage_date);

-- Material Requests (site engineers request materials)
CREATE TABLE IF NOT EXISTS material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE NOT NULL,

  site_id UUID NOT NULL REFERENCES sites(id),
  section_id UUID REFERENCES building_sections(id),

  requested_by UUID NOT NULL REFERENCES users(id),
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_by_date DATE,

  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status material_request_status DEFAULT 'draft',

  notes TEXT,

  -- Approval
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Conversion to PO
  converted_to_po_id UUID REFERENCES purchase_orders(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_requests_site ON material_requests(site_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_material_requests_requested_by ON material_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_material_requests_date ON material_requests(request_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_requests_priority ON material_requests(priority);

-- Material Request Items
CREATE TABLE IF NOT EXISTS material_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  brand_id UUID REFERENCES material_brands(id),

  requested_qty DECIMAL(12,3) NOT NULL,
  approved_qty DECIMAL(12,3),
  fulfilled_qty DECIMAL(12,3) DEFAULT 0,

  estimated_cost DECIMAL(12,2),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_request_items_request ON material_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_material_request_items_material ON material_request_items(material_id);

-- Site Material Budgets (optional budget tracking)
CREATE TABLE IF NOT EXISTS site_material_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  category_id UUID REFERENCES material_categories(id),

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  budget_amount DECIMAL(12,2) NOT NULL,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_site_material_budgets_site ON site_material_budgets(site_id);
CREATE INDEX IF NOT EXISTS idx_site_material_budgets_period ON site_material_budgets(period_start, period_end);

-- ============================================
-- VIEWS
-- ============================================

-- Site stock summary view
CREATE OR REPLACE VIEW v_site_stock_summary AS
SELECT
  si.site_id,
  s.name as site_name,
  m.id as material_id,
  m.name as material_name,
  m.code as material_code,
  mc.name as category_name,
  m.unit,
  COALESCE(SUM(si.current_qty), 0) as total_qty,
  COALESCE(SUM(si.reserved_qty), 0) as total_reserved,
  COALESCE(SUM(si.available_qty), 0) as total_available,
  COALESCE(AVG(si.avg_unit_cost), 0) as avg_cost,
  COALESCE(SUM(si.current_qty * si.avg_unit_cost), 0) as total_value
FROM stock_inventory si
JOIN sites s ON s.id = si.site_id
JOIN materials m ON m.id = si.material_id
LEFT JOIN material_categories mc ON mc.id = m.category_id
GROUP BY si.site_id, s.name, m.id, m.name, m.code, mc.name, m.unit;

-- Low stock alerts view
CREATE OR REPLACE VIEW v_low_stock_alerts AS
SELECT
  si.id,
  si.site_id,
  s.name as site_name,
  m.id as material_id,
  m.name as material_name,
  m.code as material_code,
  m.unit,
  si.current_qty,
  COALESCE(si.reorder_level, m.reorder_level, 0) as reorder_level,
  COALESCE(si.reorder_level, m.reorder_level, 0) - si.current_qty as shortage_qty,
  si.avg_unit_cost
FROM stock_inventory si
JOIN sites s ON s.id = si.site_id
JOIN materials m ON m.id = si.material_id
WHERE si.current_qty <= COALESCE(si.reorder_level, m.reorder_level, 0)
  AND COALESCE(si.reorder_level, m.reorder_level, 0) > 0;

-- Material usage by section view
CREATE OR REPLACE VIEW v_material_usage_by_section AS
SELECT
  dmu.site_id,
  dmu.section_id,
  bs.name as section_name,
  dmu.material_id,
  m.name as material_name,
  m.unit,
  COALESCE(SUM(dmu.quantity), 0) as total_quantity,
  COALESCE(SUM(dmu.total_cost), 0) as total_cost,
  MIN(dmu.usage_date) as first_usage,
  MAX(dmu.usage_date) as last_usage,
  COUNT(*) as usage_count
FROM daily_material_usage dmu
JOIN materials m ON m.id = dmu.material_id
LEFT JOIN building_sections bs ON bs.id = dmu.section_id
GROUP BY dmu.site_id, dmu.section_id, bs.name, dmu.material_id, m.name, m.unit;

-- Pending PO summary view
CREATE OR REPLACE VIEW v_pending_purchase_orders AS
SELECT
  po.id,
  po.po_number,
  po.site_id,
  s.name as site_name,
  po.vendor_id,
  v.name as vendor_name,
  po.status,
  po.order_date,
  po.expected_delivery_date,
  po.total_amount,
  po.created_by,
  u.name as created_by_name
FROM purchase_orders po
JOIN sites s ON s.id = po.site_id
JOIN vendors v ON v.id = po.vendor_id
LEFT JOIN users u ON u.id = po.created_by
WHERE po.status IN ('pending_approval', 'approved', 'ordered', 'partial_delivered');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Generate PO number (format: PO-YYMM-0001)
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 9) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year_month || '-%';

  new_number := 'PO-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate GRN number (format: GRN-YYMM-0001)
CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(grn_number FROM 10) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM deliveries
  WHERE grn_number LIKE 'GRN-' || year_month || '-%';

  new_number := 'GRN-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Material Request number (format: MR-YYMM-0001)
CREATE OR REPLACE FUNCTION generate_mr_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 9) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM material_requests
  WHERE request_number LIKE 'MR-' || year_month || '-%';

  new_number := 'MR-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Stock Transfer number (format: ST-YYMM-0001)
CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_month TEXT;
  seq_num INTEGER;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(transfer_number FROM 9) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM stock_transfers
  WHERE transfer_number LIKE 'ST-' || year_month || '-%';

  new_number := 'ST-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Update stock on delivery (trigger function)
CREATE OR REPLACE FUNCTION update_stock_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_site_id UUID;
  v_location_id UUID;
  v_delivery_date DATE;
  v_inv_id UUID;
BEGIN
  -- Get delivery details
  SELECT d.site_id, d.location_id, d.delivery_date
  INTO v_site_id, v_location_id, v_delivery_date
  FROM deliveries d
  WHERE d.id = NEW.delivery_id;

  -- Find or create stock inventory record
  SELECT id INTO v_inv_id
  FROM stock_inventory
  WHERE site_id = v_site_id
    AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL));

  IF v_inv_id IS NULL THEN
    -- Create new inventory record
    INSERT INTO stock_inventory (
      site_id, location_id, material_id, brand_id,
      current_qty, avg_unit_cost, last_received_date
    ) VALUES (
      v_site_id, v_location_id, NEW.material_id, NEW.brand_id,
      COALESCE(NEW.accepted_qty, NEW.received_qty),
      COALESCE(NEW.unit_price, 0),
      v_delivery_date
    )
    RETURNING id INTO v_inv_id;
  ELSE
    -- Update existing inventory with weighted average cost
    UPDATE stock_inventory
    SET
      current_qty = current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty),
      avg_unit_cost = CASE
        WHEN current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty) > 0 THEN
          ((current_qty * COALESCE(avg_unit_cost, 0)) +
           (COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0)))
          / (current_qty + COALESCE(NEW.accepted_qty, NEW.received_qty))
        ELSE 0
      END,
      last_received_date = v_delivery_date,
      updated_at = NOW()
    WHERE id = v_inv_id;
  END IF;

  -- Create stock transaction
  INSERT INTO stock_transactions (
    site_id, inventory_id, transaction_type, transaction_date,
    quantity, unit_cost, total_cost, reference_type, reference_id
  ) VALUES (
    v_site_id, v_inv_id, 'purchase', v_delivery_date,
    COALESCE(NEW.accepted_qty, NEW.received_qty),
    NEW.unit_price,
    COALESCE(NEW.accepted_qty, NEW.received_qty) * COALESCE(NEW.unit_price, 0),
    'delivery', NEW.delivery_id
  );

  -- Update PO item received quantity if linked
  IF NEW.po_item_id IS NOT NULL THEN
    UPDATE purchase_order_items
    SET received_qty = received_qty + COALESCE(NEW.accepted_qty, NEW.received_qty)
    WHERE id = NEW.po_item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update stock on usage (trigger function)
CREATE OR REPLACE FUNCTION update_stock_on_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_inv_id UUID;
  v_avg_cost DECIMAL(12,2);
BEGIN
  -- Find the inventory record
  SELECT id, avg_unit_cost INTO v_inv_id, v_avg_cost
  FROM stock_inventory
  WHERE site_id = NEW.site_id
    AND material_id = NEW.material_id
    AND (brand_id = NEW.brand_id OR (brand_id IS NULL AND NEW.brand_id IS NULL))
  LIMIT 1;

  IF v_inv_id IS NOT NULL THEN
    -- Update inventory (deduct quantity)
    UPDATE stock_inventory
    SET
      current_qty = current_qty - NEW.quantity,
      last_issued_date = NEW.usage_date,
      updated_at = NOW()
    WHERE id = v_inv_id;

    -- Update usage record with cost if not set
    IF NEW.unit_cost IS NULL THEN
      NEW.unit_cost := v_avg_cost;
      NEW.total_cost := NEW.quantity * v_avg_cost;
    END IF;

    -- Create stock transaction
    INSERT INTO stock_transactions (
      site_id, inventory_id, transaction_type, transaction_date,
      quantity, unit_cost, total_cost, reference_type, reference_id,
      section_id, created_by
    ) VALUES (
      NEW.site_id, v_inv_id, 'usage', NEW.usage_date,
      -NEW.quantity, NEW.unit_cost, NEW.total_cost,
      'daily_material_usage', NEW.id,
      NEW.section_id, NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check and create low stock notifications (trigger function)
CREATE OR REPLACE FUNCTION check_low_stock_alerts()
RETURNS TRIGGER AS $$
DECLARE
  v_reorder_level DECIMAL;
  v_material_name TEXT;
  v_site_name TEXT;
  v_user_record RECORD;
BEGIN
  -- Only check if quantity decreased
  IF NEW.current_qty >= OLD.current_qty THEN
    RETURN NEW;
  END IF;

  -- Get reorder level (use inventory-specific or material default)
  SELECT COALESCE(NEW.reorder_level, m.reorder_level, 0), m.name
  INTO v_reorder_level, v_material_name
  FROM materials m WHERE m.id = NEW.material_id;

  -- Get site name
  SELECT name INTO v_site_name FROM sites WHERE id = NEW.site_id;

  -- If stock is below reorder level and we just crossed it
  IF NEW.current_qty <= v_reorder_level
     AND OLD.current_qty > v_reorder_level
     AND v_reorder_level > 0 THEN

    -- Create notification for admins and site engineers
    FOR v_user_record IN
      SELECT u.id
      FROM users u
      WHERE u.role IN ('admin', 'office')
        AND u.status = 'active'
      UNION
      SELECT u.id
      FROM users u
      WHERE u.role = 'site_engineer'
        AND u.status = 'active'
        AND NEW.site_id = ANY(u.assigned_sites)
    LOOP
      INSERT INTO notifications (
        user_id, title, message, notification_type,
        related_id, related_table, action_url, site_id
      ) VALUES (
        v_user_record.id,
        'Low Stock Alert: ' || v_material_name,
        'Stock for ' || v_material_name || ' at ' || v_site_name ||
          ' is low (' || ROUND(NEW.current_qty::numeric, 2) || ' remaining, reorder level: ' ||
          ROUND(v_reorder_level::numeric, 2) || ')',
        'stock_low',
        NEW.id,
        'stock_inventory',
        '/site/stock',
        NEW.site_id
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update PO status based on deliveries
CREATE OR REPLACE FUNCTION update_po_status_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id UUID;
  v_total_ordered DECIMAL;
  v_total_received DECIMAL;
BEGIN
  -- Get PO ID from delivery
  SELECT po_id INTO v_po_id FROM deliveries WHERE id = NEW.delivery_id;

  IF v_po_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate total ordered and received
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(received_qty), 0)
  INTO v_total_ordered, v_total_received
  FROM purchase_order_items
  WHERE po_id = v_po_id;

  -- Update PO status
  UPDATE purchase_orders
  SET
    status = CASE
      WHEN v_total_received >= v_total_ordered THEN 'delivered'::po_status
      WHEN v_total_received > 0 THEN 'partial_delivered'::po_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = v_po_id
    AND status IN ('ordered', 'partial_delivered');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger for stock update on delivery
DROP TRIGGER IF EXISTS trg_update_stock_on_delivery ON delivery_items;
CREATE TRIGGER trg_update_stock_on_delivery
  AFTER INSERT ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_delivery();

-- Trigger for stock update on usage
DROP TRIGGER IF EXISTS trg_update_stock_on_usage ON daily_material_usage;
CREATE TRIGGER trg_update_stock_on_usage
  BEFORE INSERT ON daily_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_usage();

-- Trigger for low stock alerts
DROP TRIGGER IF EXISTS trg_check_low_stock ON stock_inventory;
CREATE TRIGGER trg_check_low_stock
  AFTER UPDATE OF current_qty ON stock_inventory
  FOR EACH ROW
  WHEN (NEW.current_qty < OLD.current_qty)
  EXECUTE FUNCTION check_low_stock_alerts();

-- Trigger for PO status update on delivery
DROP TRIGGER IF EXISTS trg_update_po_status_on_delivery ON delivery_items;
CREATE TRIGGER trg_update_po_status_on_delivery
  AFTER INSERT ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_status_on_delivery();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_material_budgets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for idempotency)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('vendors', 'material_categories', 'materials', 'material_brands',
                      'vendor_material_categories', 'material_vendors', 'vendor_price_history',
                      'stock_locations', 'stock_inventory', 'stock_transactions', 'stock_transfers',
                      'stock_transfer_items', 'purchase_orders', 'purchase_order_items',
                      'deliveries', 'delivery_items', 'purchase_payments', 'purchase_payment_allocations',
                      'daily_material_usage', 'material_requests', 'material_request_items', 'site_material_budgets')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Company-level tables: All authenticated users can view
CREATE POLICY "allow_select_vendors" ON vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_vendors" ON vendors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

CREATE POLICY "allow_select_material_categories" ON material_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_material_categories" ON material_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

CREATE POLICY "allow_select_materials" ON materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_materials" ON materials FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

CREATE POLICY "allow_select_material_brands" ON material_brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_material_brands" ON material_brands FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

CREATE POLICY "allow_select_vendor_material_categories" ON vendor_material_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_vendor_material_categories" ON vendor_material_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

CREATE POLICY "allow_select_material_vendors" ON material_vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_material_vendors" ON material_vendors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

CREATE POLICY "allow_select_vendor_price_history" ON vendor_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert_vendor_price_history" ON vendor_price_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

-- Site-level tables: All authenticated users can access
CREATE POLICY "allow_select_stock_locations" ON stock_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_stock_locations" ON stock_locations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_stock_inventory" ON stock_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_stock_inventory" ON stock_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_stock_transactions" ON stock_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert_stock_transactions" ON stock_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_select_stock_transfers" ON stock_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_stock_transfers" ON stock_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_stock_transfer_items" ON stock_transfer_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_stock_transfer_items" ON stock_transfer_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_purchase_orders" ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_purchase_orders" ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_purchase_order_items" ON purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_purchase_order_items" ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_deliveries" ON deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_deliveries" ON deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_delivery_items" ON delivery_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_delivery_items" ON delivery_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_purchase_payments" ON purchase_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_purchase_payments" ON purchase_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

CREATE POLICY "allow_select_purchase_payment_allocations" ON purchase_payment_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_purchase_payment_allocations" ON purchase_payment_allocations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

CREATE POLICY "allow_select_daily_material_usage" ON daily_material_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_daily_material_usage" ON daily_material_usage FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_material_requests" ON material_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_material_requests" ON material_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_material_request_items" ON material_request_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_material_request_items" ON material_request_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_select_site_material_budgets" ON site_material_budgets FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_all_site_material_budgets" ON site_material_budgets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'office')));

-- ============================================
-- SEED DATA: Default material categories
-- ============================================
INSERT INTO material_categories (name, code, description, display_order, icon) VALUES
('Cement & Binding', 'CEM', 'Cement, lime, binding materials', 1, 'cement'),
('Steel & Metals', 'STL', 'Reinforcement steel, structural steel, metals', 2, 'steel'),
('Sand & Aggregates', 'AGG', 'Sand, gravel, stone chips, aggregates', 3, 'sand'),
('Bricks & Blocks', 'BRK', 'Bricks, concrete blocks, AAC blocks', 4, 'brick'),
('Plumbing', 'PLB', 'Pipes, fittings, sanitary ware', 5, 'plumbing'),
('Electrical', 'ELC', 'Wires, cables, switches, electrical items', 6, 'electrical'),
('Wood & Timber', 'WOD', 'Wood, plywood, timber, doors', 7, 'wood'),
('Tiles & Flooring', 'TIL', 'Floor tiles, wall tiles, marble, granite', 8, 'tiles'),
('Paint & Finishes', 'PNT', 'Paints, primers, putty, finishes', 9, 'paint'),
('Hardware', 'HRD', 'Nails, screws, hinges, locks, hardware', 10, 'hardware'),
('Glass & Aluminum', 'GLS', 'Glass, aluminum sections, windows', 11, 'glass'),
('Waterproofing', 'WPF', 'Waterproofing chemicals and materials', 12, 'waterproof'),
('Miscellaneous', 'MSC', 'Other construction materials', 99, 'misc');

-- Add some common sub-categories
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'PPC Cement', 'CEM-PPC', id, 1 FROM material_categories WHERE code = 'CEM';
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'OPC 53 Grade', 'CEM-OPC53', id, 2 FROM material_categories WHERE code = 'CEM';
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'TMT Bars', 'STL-TMT', id, 1 FROM material_categories WHERE code = 'STL';
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'Binding Wire', 'STL-WIRE', id, 2 FROM material_categories WHERE code = 'STL';
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'M Sand', 'AGG-MSAND', id, 1 FROM material_categories WHERE code = 'AGG';
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'P Sand', 'AGG-PSAND', id, 2 FROM material_categories WHERE code = 'AGG';
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'Blue Metal 20mm', 'AGG-BM20', id, 3 FROM material_categories WHERE code = 'AGG';
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'Red Bricks', 'BRK-RED', id, 1 FROM material_categories WHERE code = 'BRK';
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'Cement Blocks', 'BRK-CMT', id, 2 FROM material_categories WHERE code = 'BRK';
INSERT INTO material_categories (name, code, parent_id, display_order)
SELECT 'AAC Blocks', 'BRK-AAC', id, 3 FROM material_categories WHERE code = 'BRK';

-- ============================================
-- END OF MIGRATION
-- ============================================
