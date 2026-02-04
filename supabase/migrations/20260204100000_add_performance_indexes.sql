-- Performance Optimization: Add composite indexes for common query patterns
-- These indexes address the missing composite indexes identified in the performance audit

-- Material requests: site + status + date
CREATE INDEX IF NOT EXISTS idx_material_requests_site_status_date
ON material_requests(site_id, status, created_at DESC);

-- Purchase orders: site + status + date
CREATE INDEX IF NOT EXISTS idx_purchase_orders_site_status_date
ON purchase_orders(site_id, status, created_at DESC);

-- Inter-site settlements: from site + status
CREATE INDEX IF NOT EXISTS idx_inter_site_settlements_from_site_status
ON inter_site_material_settlements(from_site_id, status, created_at DESC);

-- Inter-site settlements: to site + status
CREATE INDEX IF NOT EXISTS idx_inter_site_settlements_to_site_status
ON inter_site_material_settlements(to_site_id, status, created_at DESC);

-- Batch usage: pending settlement filter
CREATE INDEX IF NOT EXISTS idx_batch_usage_pending_settlement
ON batch_usage_records(site_group_id, settlement_status, usage_site_id)
WHERE settlement_status = 'pending' AND is_self_use = false;

-- PO items: PO + material composite
CREATE INDEX IF NOT EXISTS idx_po_items_po_material
ON purchase_order_items(po_id, material_id);

-- Delivery items: delivery + material + brand
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_material
ON delivery_items(delivery_id, material_id, brand_id);

-- Stock inventory: site + material + brand
CREATE INDEX IF NOT EXISTS idx_stock_inventory_site_material_brand
ON stock_inventory(site_id, material_id, brand_id);

-- Material purchase expenses: PO lookup
CREATE INDEX IF NOT EXISTS idx_material_purchase_expenses_po
ON material_purchase_expenses(purchase_order_id)
WHERE purchase_order_id IS NOT NULL;

-- Settlement groups: site + date for active
CREATE INDEX IF NOT EXISTS idx_settlement_groups_site_date
ON settlement_groups(site_id, settlement_date DESC)
WHERE NOT is_cancelled;
