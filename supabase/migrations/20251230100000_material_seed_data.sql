-- ============================================
-- MATERIAL & VENDOR SEED DATA
-- Sample data for testing material management features
-- Created: 2024-12-30
-- ============================================

-- ============================================
-- MATERIALS SEED DATA
-- Common construction materials for Indian construction industry
-- ============================================

-- Cement & Binding Materials
INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'PPC Cement (50kg bag)', 'MAT-CEM-001', 'PPC சிமெண்ட்', id, 'bag', 28.00, 50, 10
FROM material_categories WHERE code = 'CEM'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'OPC 53 Grade Cement (50kg bag)', 'MAT-CEM-002', 'OPC 53 சிமெண்ட்', id, 'bag', 28.00, 50, 10
FROM material_categories WHERE code = 'CEM'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'OPC 43 Grade Cement (50kg bag)', 'MAT-CEM-003', 'OPC 43 சிமெண்ட்', id, 'bag', 28.00, 30, 10
FROM material_categories WHERE code = 'CEM'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'White Cement (1kg)', 'MAT-CEM-004', 'வெள்ளை சிமெண்ட்', id, 'kg', 18.00, 20, 5
FROM material_categories WHERE code = 'CEM'
ON CONFLICT (code) DO NOTHING;

-- Sand & Aggregates
INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'M Sand (Manufactured Sand)', 'MAT-AGG-001', 'M சரளை', id, 'cft', 5.00, 500, 100
FROM material_categories WHERE code = 'AGG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'P Sand (Plastering Sand)', 'MAT-AGG-002', 'P சரளை / பூச்சு மணல்', id, 'cft', 5.00, 300, 100
FROM material_categories WHERE code = 'AGG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'River Sand', 'MAT-AGG-003', 'ஆற்று மணல்', id, 'cft', 5.00, 200, 100
FROM material_categories WHERE code = 'AGG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Blue Metal 20mm', 'MAT-AGG-004', 'நீல கற்கள் 20mm / ஜல்லி', id, 'cft', 5.00, 500, 100
FROM material_categories WHERE code = 'AGG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Blue Metal 40mm', 'MAT-AGG-005', 'நீல கற்கள் 40mm / ஜல்லி', id, 'cft', 5.00, 300, 100
FROM material_categories WHERE code = 'AGG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Blue Metal 12mm (Chips)', 'MAT-AGG-006', 'நீல கற்கள் 12mm / சிப்ஸ்', id, 'cft', 5.00, 200, 50
FROM material_categories WHERE code = 'AGG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Gravel', 'MAT-AGG-007', 'கூழாங்கல் / சூடு', id, 'cft', 5.00, 100, 50
FROM material_categories WHERE code = 'AGG'
ON CONFLICT (code) DO NOTHING;

-- Bricks & Blocks
INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Red Bricks (Standard)', 'MAT-BRK-001', 'செங்கல்', id, 'nos', 5.00, 5000, 1000
FROM material_categories WHERE code = 'BRK'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Fly Ash Bricks', 'MAT-BRK-002', 'பிளை ஆஷ் செங்கல்', id, 'nos', 5.00, 3000, 1000
FROM material_categories WHERE code = 'BRK'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Cement Blocks 4 inch', 'MAT-BRK-003', 'சிமெண்ட் பிளாக் 4"', id, 'nos', 18.00, 500, 100
FROM material_categories WHERE code = 'BRK'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Cement Blocks 6 inch', 'MAT-BRK-004', 'சிமெண்ட் பிளாக் 6"', id, 'nos', 18.00, 500, 100
FROM material_categories WHERE code = 'BRK'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Cement Blocks 8 inch', 'MAT-BRK-005', 'சிமெண்ட் பிளாக் 8"', id, 'nos', 18.00, 300, 100
FROM material_categories WHERE code = 'BRK'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'AAC Blocks 4 inch', 'MAT-BRK-006', 'AAC பிளாக் 4"', id, 'nos', 18.00, 200, 50
FROM material_categories WHERE code = 'BRK'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'AAC Blocks 6 inch', 'MAT-BRK-007', 'AAC பிளாக் 6"', id, 'nos', 18.00, 200, 50
FROM material_categories WHERE code = 'BRK'
ON CONFLICT (code) DO NOTHING;

-- Steel & Metals
INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'TMT Bar 8mm', 'MAT-STL-001', 'TMT கம்பி 8mm', id, 'kg', 18.00, 500, 100
FROM material_categories WHERE code = 'STL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'TMT Bar 10mm', 'MAT-STL-002', 'TMT கம்பி 10mm', id, 'kg', 18.00, 500, 100
FROM material_categories WHERE code = 'STL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'TMT Bar 12mm', 'MAT-STL-003', 'TMT கம்பி 12mm', id, 'kg', 18.00, 1000, 200
FROM material_categories WHERE code = 'STL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'TMT Bar 16mm', 'MAT-STL-004', 'TMT கம்பி 16mm', id, 'kg', 18.00, 500, 100
FROM material_categories WHERE code = 'STL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'TMT Bar 20mm', 'MAT-STL-005', 'TMT கம்பி 20mm', id, 'kg', 18.00, 300, 100
FROM material_categories WHERE code = 'STL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'TMT Bar 25mm', 'MAT-STL-006', 'TMT கம்பி 25mm', id, 'kg', 18.00, 200, 50
FROM material_categories WHERE code = 'STL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Binding Wire', 'MAT-STL-007', 'கட்டும் கம்பி', id, 'kg', 18.00, 50, 10
FROM material_categories WHERE code = 'STL'
ON CONFLICT (code) DO NOTHING;

-- Plumbing
INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'PVC Pipe 1 inch', 'MAT-PLB-001', 'PVC பைப் 1"', id, 'rmt', 18.00, 50, 10
FROM material_categories WHERE code = 'PLB'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'PVC Pipe 2 inch', 'MAT-PLB-002', 'PVC பைப் 2"', id, 'rmt', 18.00, 50, 10
FROM material_categories WHERE code = 'PLB'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'CPVC Pipe 1/2 inch', 'MAT-PLB-003', 'CPVC பைப் 1/2"', id, 'rmt', 18.00, 100, 20
FROM material_categories WHERE code = 'PLB'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'SWR Pipe 4 inch', 'MAT-PLB-004', 'SWR பைப் 4"', id, 'rmt', 18.00, 30, 10
FROM material_categories WHERE code = 'PLB'
ON CONFLICT (code) DO NOTHING;

-- Electrical
INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Electrical Wire 1.5 sq mm', 'MAT-ELC-001', 'மின்சார கம்பி 1.5mm', id, 'rmt', 18.00, 200, 50
FROM material_categories WHERE code = 'ELC'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Electrical Wire 2.5 sq mm', 'MAT-ELC-002', 'மின்சார கம்பி 2.5mm', id, 'rmt', 18.00, 200, 50
FROM material_categories WHERE code = 'ELC'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Electrical Wire 4 sq mm', 'MAT-ELC-003', 'மின்சார கம்பி 4mm', id, 'rmt', 18.00, 100, 30
FROM material_categories WHERE code = 'ELC'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'PVC Conduit Pipe 20mm', 'MAT-ELC-004', 'கண்டியூட் 20mm', id, 'rmt', 18.00, 100, 20
FROM material_categories WHERE code = 'ELC'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'PVC Conduit Pipe 25mm', 'MAT-ELC-005', 'கண்டியூட் 25mm', id, 'rmt', 18.00, 50, 10
FROM material_categories WHERE code = 'ELC'
ON CONFLICT (code) DO NOTHING;

-- Paint & Finishes
INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'White Cement Putty (40kg bag)', 'MAT-PNT-001', 'வால் புட்டி', id, 'bag', 18.00, 20, 5
FROM material_categories WHERE code = 'PNT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Wall Primer (20L)', 'MAT-PNT-002', 'பிரைமர்', id, 'liter', 18.00, 20, 5
FROM material_categories WHERE code = 'PNT'
ON CONFLICT (code) DO NOTHING;

-- Waterproofing
INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Dr Fixit LW+', 'MAT-WPF-001', 'Dr Fixit', id, 'liter', 18.00, 20, 5
FROM material_categories WHERE code = 'WPF'
ON CONFLICT (code) DO NOTHING;

INSERT INTO materials (name, code, local_name, category_id, unit, gst_rate, reorder_level, min_order_qty)
SELECT 'Fosroc Waterproofing', 'MAT-WPF-002', 'Fosroc', id, 'kg', 18.00, 10, 5
FROM material_categories WHERE code = 'WPF'
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- MATERIAL BRANDS
-- Common brands for materials
-- ============================================

-- Cement Brands
INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Ultratech', true, 5 FROM materials WHERE code = 'MAT-CEM-001'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'ACC', false, 4 FROM materials WHERE code = 'MAT-CEM-001'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Ramco', false, 4 FROM materials WHERE code = 'MAT-CEM-001'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Dalmia', false, 4 FROM materials WHERE code = 'MAT-CEM-001'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Ultratech', true, 5 FROM materials WHERE code = 'MAT-CEM-002'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Birla A1', false, 4 FROM materials WHERE code = 'MAT-CEM-002'
ON CONFLICT (material_id, brand_name) DO NOTHING;

-- Steel Brands
INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'TATA Tiscon', true, 5 FROM materials WHERE code = 'MAT-STL-003'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'JSW Neosteel', false, 4 FROM materials WHERE code = 'MAT-STL-003'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'SAIL', false, 4 FROM materials WHERE code = 'MAT-STL-003'
ON CONFLICT (material_id, brand_name) DO NOTHING;

-- Electrical Wire Brands
INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Finolex', true, 5 FROM materials WHERE code = 'MAT-ELC-001'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Havells', false, 5 FROM materials WHERE code = 'MAT-ELC-001'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Polycab', false, 4 FROM materials WHERE code = 'MAT-ELC-001'
ON CONFLICT (material_id, brand_name) DO NOTHING;

-- Plumbing Brands
INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Ashirvad', true, 5 FROM materials WHERE code = 'MAT-PLB-003'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Supreme', false, 4 FROM materials WHERE code = 'MAT-PLB-003'
ON CONFLICT (material_id, brand_name) DO NOTHING;

-- Waterproofing Brands
INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Dr Fixit', true, 5 FROM materials WHERE code = 'MAT-WPF-001'
ON CONFLICT (material_id, brand_name) DO NOTHING;

INSERT INTO material_brands (material_id, brand_name, is_preferred, quality_rating)
SELECT id, 'Fosroc', true, 5 FROM materials WHERE code = 'MAT-WPF-002'
ON CONFLICT (material_id, brand_name) DO NOTHING;


-- ============================================
-- VENDORS SEED DATA
-- 10 sample vendors for testing
-- ============================================

INSERT INTO vendors (
  name, code, contact_person, phone, whatsapp_number, city, state,
  vendor_type, shop_name, provides_transport, provides_loading,
  accepts_upi, accepts_cash, accepts_credit, credit_days, rating, is_active
) VALUES
-- Cement Dealer
('Arun Cement Agencies', 'VND-001', 'Arun Kumar', '9876543210', '9876543210',
 'Chennai', 'Tamil Nadu', 'dealer', 'Arun Cement Agencies',
 true, true, true, true, true, 30, 4.5, true),

-- Multi-category Shop
('Sri Balaji Building Materials', 'VND-002', 'Balaji', '9876543211', '9876543211',
 'Chennai', 'Tamil Nadu', 'shop', 'Sri Balaji Building Materials',
 true, true, true, true, false, NULL, 4.2, true),

-- Sand Supplier (Individual)
('Murugappan Sand Suppliers', 'VND-003', 'Murugappan', '9876543212', '9876543212',
 'Thiruvallur', 'Tamil Nadu', 'individual', NULL,
 true, true, true, true, false, NULL, 4.0, true),

-- Aggregates Dealer
('Thirumalai Blue Metals', 'VND-004', 'Thirumalai', '9876543213', '9876543213',
 'Kanchipuram', 'Tamil Nadu', 'dealer', 'Thirumalai Blue Metals',
 true, true, true, true, true, 15, 4.3, true),

-- Steel Dealer
('Lakshmi Steel Traders', 'VND-005', 'Lakshmi', '9876543214', '9876543214',
 'Chennai', 'Tamil Nadu', 'dealer', 'Lakshmi Steel Traders',
 true, false, true, true, true, 45, 4.7, true),

-- Brick Manufacturer
('Anbu Brick Works', 'VND-006', 'Anbu', '9876543215', '9876543215',
 'Sriperumbudur', 'Tamil Nadu', 'manufacturer', 'Anbu Brick Works',
 true, true, false, true, true, 30, 4.1, true),

-- Electrical Shop
('Sakthi Electricals', 'VND-007', 'Sakthi', '9876543216', '9876543216',
 'Chennai', 'Tamil Nadu', 'shop', 'Sakthi Electricals',
 false, false, true, true, false, NULL, 4.4, true),

-- Plumbing Shop
('Kumar Plumbing Solutions', 'VND-008', 'Kumar', '9876543217', '9876543217',
 'Chennai', 'Tamil Nadu', 'shop', 'Kumar Plumbing Solutions',
 false, false, true, true, false, NULL, 4.0, true),

-- Hardware Store
('Sri Vinayaka Hardware', 'VND-009', 'Vinayak', '9876543218', '9876543218',
 'Chennai', 'Tamil Nadu', 'shop', 'Sri Vinayaka Hardware',
 false, false, true, true, false, NULL, 4.2, true),

-- Multi-category Dealer
('Chennai Building Centre', 'VND-010', 'Rajesh', '9876543219', '9876543219',
 'Chennai', 'Tamil Nadu', 'dealer', 'Chennai Building Centre',
 true, true, true, true, true, 30, 4.6, true)

ON CONFLICT (code) DO NOTHING;


-- ============================================
-- VENDOR MATERIAL CATEGORIES
-- Link vendors to their specialty categories
-- ============================================

-- Arun Cement - Cement specialty
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-001' AND c.code = 'CEM'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

-- Sri Balaji - Multiple categories
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-002' AND c.code = 'CEM'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, false
FROM vendors v, material_categories c
WHERE v.code = 'VND-002' AND c.code = 'AGG'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, false
FROM vendors v, material_categories c
WHERE v.code = 'VND-002' AND c.code = 'BRK'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

-- Murugappan - Sand specialty
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-003' AND c.code = 'AGG'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

-- Thirumalai - Aggregates
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-004' AND c.code = 'AGG'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

-- Lakshmi Steel - Steel specialty
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-005' AND c.code = 'STL'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

-- Anbu Brick - Bricks
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-006' AND c.code = 'BRK'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

-- Sakthi - Electrical
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-007' AND c.code = 'ELC'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

-- Kumar - Plumbing
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-008' AND c.code = 'PLB'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

-- Sri Vinayaka - Hardware
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-009' AND c.code = 'HRD'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

-- Chennai Building Centre - Multiple
INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, true
FROM vendors v, material_categories c
WHERE v.code = 'VND-010' AND c.code = 'CEM'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, false
FROM vendors v, material_categories c
WHERE v.code = 'VND-010' AND c.code = 'STL'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, false
FROM vendors v, material_categories c
WHERE v.code = 'VND-010' AND c.code = 'AGG'
ON CONFLICT (vendor_id, category_id) DO NOTHING;

INSERT INTO vendor_material_categories (vendor_id, category_id, is_primary)
SELECT v.id, c.id, false
FROM vendors v, material_categories c
WHERE v.code = 'VND-010' AND c.code = 'BRK'
ON CONFLICT (vendor_id, category_id) DO NOTHING;


-- ============================================
-- VENDOR INVENTORY (Pricing)
-- Sample pricing for vendor-material combinations
-- ============================================

-- Arun Cement - Cement prices
INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 380.00, true, 28.00, 0, 0, 50, 'bag', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-001' AND m.code = 'MAT-CEM-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 420.00, true, 28.00, 0, 0, 50, 'bag', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-001' AND m.code = 'MAT-CEM-002'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

-- Sri Balaji - Multiple materials
INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 375.00, true, 28.00, 10, 5, 25, 'bag', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-002' AND m.code = 'MAT-CEM-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 55.00, false, 5.00, 500, 0, 100, 'cft', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-002' AND m.code = 'MAT-AGG-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

-- Murugappan - Sand prices
INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 50.00, false, 5.00, 400, 0, 200, 'cft', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-003' AND m.code = 'MAT-AGG-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 65.00, false, 5.00, 400, 0, 100, 'cft', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-003' AND m.code = 'MAT-AGG-002'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 85.00, false, 5.00, 500, 0, 100, 'cft', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-003' AND m.code = 'MAT-AGG-003'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

-- Thirumalai - Blue Metal prices
INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 45.00, false, 5.00, 300, 50, 200, 'cft', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-004' AND m.code = 'MAT-AGG-004'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 42.00, false, 5.00, 300, 50, 200, 'cft', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-004' AND m.code = 'MAT-AGG-005'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 48.00, false, 5.00, 300, 50, 100, 'cft', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-004' AND m.code = 'MAT-AGG-006'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

-- Lakshmi Steel - TMT prices
INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 72.00, true, 18.00, 0, 50, 500, 'kg', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-005' AND m.code = 'MAT-STL-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 71.00, true, 18.00, 0, 50, 500, 'kg', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-005' AND m.code = 'MAT-STL-002'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 70.00, true, 18.00, 0, 50, 1000, 'kg', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-005' AND m.code = 'MAT-STL-003'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 85.00, true, 18.00, 0, 0, 20, 'kg', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-005' AND m.code = 'MAT-STL-007'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

-- Anbu Brick - Brick prices
INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 8.50, false, 5.00, 1500, 500, 5000, 'nos', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-006' AND m.code = 'MAT-BRK-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 7.00, false, 5.00, 1500, 500, 5000, 'nos', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-006' AND m.code = 'MAT-BRK-002'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 38.00, true, 18.00, 2000, 500, 500, 'nos', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-006' AND m.code = 'MAT-BRK-004'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

-- Sakthi Electricals - Wire prices
INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 22.00, true, 18.00, 0, 0, 90, 'rmt', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-007' AND m.code = 'MAT-ELC-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 35.00, true, 18.00, 0, 0, 90, 'rmt', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-007' AND m.code = 'MAT-ELC-002'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 55.00, true, 18.00, 0, 0, 90, 'rmt', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-007' AND m.code = 'MAT-ELC-003'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

-- Kumar Plumbing - Pipe prices
INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 45.00, true, 18.00, 0, 0, 10, 'rmt', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-008' AND m.code = 'MAT-PLB-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 65.00, true, 18.00, 0, 0, 10, 'rmt', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-008' AND m.code = 'MAT-PLB-002'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 38.00, true, 18.00, 0, 0, 20, 'rmt', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-008' AND m.code = 'MAT-PLB-003'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

-- Chennai Building Centre - Multiple materials at competitive prices
INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 370.00, true, 28.00, 0, 0, 100, 'bag', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-010' AND m.code = 'MAT-CEM-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 68.00, true, 18.00, 0, 100, 1000, 'kg', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-010' AND m.code = 'MAT-STL-003'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 48.00, false, 5.00, 350, 0, 300, 'cft', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-010' AND m.code = 'MAT-AGG-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;

INSERT INTO vendor_inventory (
  vendor_id, material_id, current_price, price_includes_gst, gst_rate,
  transport_cost, loading_cost, min_order_qty, unit, is_available, price_source, last_price_update
)
SELECT v.id, m.id, 8.00, false, 5.00, 2000, 300, 10000, 'nos', true, 'manual', NOW()
FROM vendors v, materials m
WHERE v.code = 'VND-010' AND m.code = 'MAT-BRK-001'
ON CONFLICT (vendor_id, material_id, brand_id) DO NOTHING;


-- ============================================
-- END OF SEED DATA MIGRATION
-- ============================================
