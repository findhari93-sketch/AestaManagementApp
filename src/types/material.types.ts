/**
 * Material Management Types
 * Type definitions for the Material Management System
 */

import type { Database } from "./database.types";

// ============================================
// TABLE TYPE ALIASES
// ============================================

// These will work after running supabase gen types
// For now, define them manually based on migration schema

export type MaterialUnit =
  | "kg"
  | "g"
  | "ton"
  | "liter"
  | "ml"
  | "piece"
  | "bag"
  | "bundle"
  | "sqft"
  | "sqm"
  | "cft"
  | "cum"
  | "nos"
  | "rmt"
  | "box"
  | "set";

export type POStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "ordered"
  | "partial_delivered"
  | "delivered"
  | "cancelled";

export type DeliveryStatus =
  | "pending"
  | "in_transit"
  | "partial"
  | "delivered"
  | "rejected";

export type MaterialRequestStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "ordered"
  | "partial_fulfilled"
  | "fulfilled"
  | "cancelled";

export type StockTransactionType =
  | "purchase"
  | "usage"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "return"
  | "wastage"
  | "initial";

export type RequestPriority = "low" | "normal" | "high" | "urgent";

export type VendorType = "shop" | "dealer" | "manufacturer" | "individual" | "rental_store";

export type DeliveryVerificationStatus = "pending" | "verified" | "disputed" | "rejected";

export type LocalPurchaseStatus = "draft" | "completed" | "cancelled";

export type LocalPurchasePaymentMode = "cash" | "upi" | "engineer_own";

export type PaymentSource = "company" | "site_cash" | "engineer_own";

export type PriceSource = "purchase" | "enquiry" | "quotation" | "manual" | "bill";

// ============================================
// BASE TABLE TYPES
// ============================================

export interface Vendor {
  id: string;
  name: string;
  code: string | null;
  contact_person: string | null;
  phone: string | null;
  alternate_phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  pan_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  payment_terms_days: number | null;
  credit_limit: number | null;
  notes: string | null;
  rating: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  // New vendor enhancement fields
  vendor_type: VendorType;
  shop_name: string | null;
  has_physical_store: boolean;
  store_address: string | null;
  store_city: string | null;
  store_pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  provides_transport: boolean;
  provides_loading: boolean;
  provides_unloading: boolean;
  min_order_amount: number | null;
  delivery_radius_km: number | null;
  specializations: string[] | null;
  accepts_upi: boolean;
  accepts_cash: boolean;
  accepts_credit: boolean;
  credit_days: number | null;
  upi_id: string | null;
  qr_code_url: string | null;
  shop_photo_url: string | null;
}

// ============================================
// SITE GROUPS & COMMON STOCK
// ============================================

export interface SiteGroup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface GroupStockInventory {
  id: string;
  site_group_id: string;
  material_id: string;
  brand_id: string | null;
  location_id: string | null;
  current_qty: number;
  reserved_qty: number;
  available_qty: number; // computed
  avg_unit_cost: number;
  total_value: number; // computed
  last_received_date: string | null;
  last_used_date: string | null;
  reorder_level: number | null;
  reorder_qty: number | null;
  created_at: string;
  updated_at: string;
}

export interface GroupStockTransaction {
  id: string;
  site_group_id: string;
  inventory_id: string;
  material_id: string;
  brand_id: string | null;
  transaction_type: StockTransactionType;
  transaction_date: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  payment_source: PaymentSource | null;
  payment_source_site_id: string | null;
  usage_site_id: string | null;
  work_description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  batch_ref_code: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ============================================
// INTER-SITE SETTLEMENT
// ============================================

export type InterSiteSettlementStatus =
  | "draft"
  | "pending"
  | "approved"
  | "settled"
  | "cancelled";

export type SettlementPaymentMode = "cash" | "bank_transfer" | "upi" | "adjustment";

export interface InterSiteSettlement {
  id: string;
  settlement_code: string;
  site_group_id: string;
  from_site_id: string; // Creditor site (paid for materials)
  to_site_id: string; // Debtor site (used the materials)
  batch_ref_code: string | null; // NEW: Reference to the batch being settled
  year: number;
  week_number: number;
  period_start: string;
  period_end: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  status: InterSiteSettlementStatus;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  settled_by: string | null;
  settled_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterSiteSettlementItem {
  id: string;
  settlement_id: string;
  material_id: string;
  brand_id: string | null;
  batch_code: string | null;
  quantity_used: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  transaction_id: string | null;
  usage_date: string;
  notes: string | null;
  created_at: string;
}

export interface InterSiteSettlementPayment {
  id: string;
  settlement_id: string;
  payment_date: string;
  amount: number;
  payment_mode: SettlementPaymentMode;
  reference_number: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

// Pending balance between sites (calculated from transactions)
export interface InterSiteBalance {
  site_group_id: string;
  group_name: string;
  creditor_site_id: string;
  creditor_site_name: string;
  debtor_site_id: string;
  debtor_site_name: string;
  year: number;
  week_number: number;
  week_start: string;
  week_end: string;
  transaction_count: number;
  material_count: number;
  total_quantity: number;
  total_amount_owed: number;
  settlement_id?: string;
  settlement_status?: InterSiteSettlementStatus;
  is_settled: boolean;
}

// Site settlement summary (aggregated view)
export interface SiteSettlementSummary {
  site_id: string;
  site_name: string;
  group_id: string;
  group_name: string;
  total_owed_to_you: number; // Sum of what other sites owe this site (unsettled only)
  total_you_owe: number; // Sum of what this site owes others (unsettled only)
  net_balance: number; // total_owed_to_you - total_you_owe
  pending_settlements_count: number; // Number of pending settlement records
  unsettled_count: number; // Number of unsettled usage records (not yet in a settlement)
  owed_to_you_count: number; // Number of unsettled records where others owe this site
  you_owe_count: number; // Number of unsettled records where this site owes others
}

// ============================================
// VENDOR INVENTORY & PRICE HISTORY
// ============================================

export interface VendorInventory {
  id: string;
  vendor_id: string;
  material_id: string | null;
  custom_material_name: string | null;
  brand_id: string | null;
  current_price: number | null;
  price_includes_gst: boolean;
  gst_rate: number | null;
  price_includes_transport: boolean;
  transport_cost: number | null;
  loading_cost: number | null;
  unloading_cost: number | null;
  is_available: boolean;
  min_order_qty: number | null;
  unit: string | null;
  lead_time_days: number | null;
  last_price_update: string | null;
  price_source: PriceSource | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceHistory {
  id: string;
  vendor_id: string;
  material_id: string;
  brand_id: string | null;
  price: number;
  price_includes_gst: boolean;
  gst_rate: number | null;
  transport_cost: number | null;
  loading_cost: number | null;
  unloading_cost: number | null;
  total_landed_cost: number | null;
  recorded_date: string;
  source: PriceSource;
  source_reference: string | null;
  quantity: number | null;
  unit: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
}

// ============================================
// PRICE ALERTS
// ============================================

export type PriceAlertType = "price_drop" | "price_increase" | "threshold_below" | "threshold_above";

export interface PriceAlert {
  id: string;
  material_id: string;
  brand_id: string | null;
  alert_type: PriceAlertType;
  threshold_value: number | null; // For threshold_below/threshold_above
  threshold_percent: number | null; // For price_drop/price_increase
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceAlertWithDetails extends PriceAlert {
  material?: Material;
  brand?: MaterialBrand | null;
  created_by_user?: { name: string } | null;
}

export interface PriceAlertTriggered {
  id: string;
  alert_id: string;
  triggered_at: string;
  old_price: number;
  new_price: number;
  change_percent: number;
  vendor_id: string | null;
  source_reference: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

export interface PriceAlertTriggeredWithDetails extends PriceAlertTriggered {
  alert?: PriceAlert;
  vendor?: Vendor;
}

// ============================================
// LOCAL PURCHASES
// ============================================

export interface LocalPurchase {
  id: string;
  purchase_number: string | null;
  site_id: string;
  site_group_id: string | null;
  engineer_id: string;
  vendor_id: string | null;
  vendor_name: string;
  vendor_phone: string | null;
  vendor_address: string | null;
  is_new_vendor: boolean;
  purchase_date: string;
  receipt_url: string | null;
  total_amount: number;
  payment_mode: LocalPurchasePaymentMode;
  payment_reference: string | null;
  payment_source: PaymentSource | null;
  description: string | null;
  status: LocalPurchaseStatus;
  needs_reimbursement: boolean;
  reimbursement_amount: number | null;
  reimbursement_status: "pending" | "processed" | "completed";
  reimbursement_transaction_id: string | null;
  reimbursed_at: string | null;
  add_to_stock: boolean;
  stock_added: boolean;
  is_group_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocalPurchaseItem {
  id: string;
  local_purchase_id: string;
  material_id: string | null;
  custom_material_name: string | null;
  brand_id: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  save_to_vendor_inventory: boolean;
  save_to_price_history: boolean;
  notes: string | null;
  created_at: string;
}

// ============================================
// DELIVERY VERIFICATION ENHANCEMENTS
// ============================================

export interface DeliveryDiscrepancy {
  item_id: string;
  expected_qty: number;
  received_qty: number;
  issue: "damaged" | "missing" | "wrong_spec" | "short";
  notes?: string;
}

export interface MaterialCategory {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parent_id: string | null;
  display_order: number;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  name: string;
  code: string | null;
  local_name: string | null;
  category_id: string | null;
  parent_id: string | null; // For material variants
  description: string | null;
  unit: MaterialUnit;
  secondary_unit: MaterialUnit | null;
  conversion_factor: number | null;
  hsn_code: string | null;
  gst_rate: number | null;
  specifications: Record<string, unknown> | null;
  weight_per_unit: number | null; // Weight per unit piece (e.g., 0.395 kg for 8mm TMT)
  weight_unit: string | null; // Unit for weight measurement (kg, g, ton)
  length_per_piece: number | null; // Standard length per piece (e.g., 12m for TMT bars)
  length_unit: string | null; // Unit for length measurement (m, ft, mm)
  rods_per_bundle: number | null; // Number of rods per bundle (e.g., 10 for 8mm TMT)
  min_order_qty: number | null;
  reorder_level: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface MaterialBrand {
  id: string;
  material_id: string;
  brand_name: string;
  variant_name: string | null; // Brand sub-variant (e.g., "DSP" for Dalmia DSP, "Grade" for Ramco Grade)
  is_preferred: boolean;
  quality_rating: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

// Helper type for grouped brand display with variants
export interface BrandWithVariants {
  brand_name: string;
  is_preferred: boolean;
  variants: Array<{
    id: string;
    variant_name: string | null;
    quality_rating: number | null;
    notes: string | null;
    is_active: boolean;
  }>;
}

export interface VendorMaterialCategory {
  id: string;
  vendor_id: string;
  category_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface MaterialVendor {
  id: string;
  material_id: string;
  vendor_id: string;
  brand_id: string | null;
  unit_price: number;
  min_order_qty: number | null;
  lead_time_days: number | null;
  is_preferred: boolean;
  notes: string | null;
  is_active: boolean;
  last_price_update: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorPriceHistory {
  id: string;
  material_vendor_id: string;
  old_price: number;
  new_price: number;
  effective_date: string;
  reason: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface StockLocation {
  id: string;
  site_id: string;
  name: string;
  code: string | null;
  description: string | null;
  location_type: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockInventory {
  id: string;
  site_id: string;
  location_id: string | null;
  material_id: string;
  brand_id: string | null;
  current_qty: number;
  reserved_qty: number;
  available_qty: number; // computed
  avg_unit_cost: number | null;
  last_received_date: string | null;
  last_issued_date: string | null;
  reorder_level: number | null;
  reorder_qty: number | null;
  created_at: string;
  updated_at: string;
}

export interface StockTransaction {
  id: string;
  site_id: string;
  inventory_id: string;
  transaction_type: StockTransactionType;
  transaction_date: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  section_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface StockTransfer {
  id: string;
  transfer_number: string | null;
  from_site_id: string;
  to_site_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  transfer_date: string;
  status: "pending" | "in_transit" | "received" | "cancelled";
  notes: string | null;
  initiated_by: string | null;
  initiated_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  received_by: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  material_id: string;
  brand_id: string | null;
  quantity_sent: number;
  quantity_received: number | null;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  site_id: string;
  vendor_id: string;
  status: POStatus;
  order_date: string;
  expected_delivery_date: string | null;
  delivery_address: string | null;
  delivery_location_id: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  transport_cost: number | null;
  other_charges: number | null;
  total_amount: number | null;
  payment_terms: string | null;
  payment_timing: "advance" | "on_delivery";
  advance_paid: number | null;
  quotation_url: string | null;
  po_document_url: string | null;
  notes: string | null;
  internal_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  material_id: string;
  brand_id: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  tax_amount: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  total_amount: number;
  received_qty: number;
  pending_qty: number; // computed
  notes: string | null;
  created_at: string;
}

export interface Delivery {
  id: string;
  grn_number: string;
  po_id: string | null;
  site_id: string;
  vendor_id: string;
  location_id: string | null;
  delivery_date: string;
  delivery_status: DeliveryStatus;
  challan_number: string | null;
  challan_date: string | null;
  challan_url: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  received_by: string | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  inspection_notes: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_amount: number | null;
  invoice_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Verification enhancement fields
  verification_status: DeliveryVerificationStatus;
  verification_photos: string[] | null;
  verification_notes: string | null;
  discrepancies: DeliveryDiscrepancy[] | null;
  engineer_verified_by: string | null;
  engineer_verified_at: string | null;
  requires_verification: boolean;
  // Delivery recording tracking fields
  delivery_photos: string[] | null;
  recorded_by: string | null;
  recorded_at: string | null;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  po_item_id: string | null;
  material_id: string;
  brand_id: string | null;
  ordered_qty: number | null;
  received_qty: number;
  accepted_qty: number | null;
  rejected_qty: number | null;
  rejection_reason: string | null;
  unit_price: number | null;
  batch_number: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchasePayment {
  id: string;
  vendor_id: string;
  site_id: string | null;
  payment_date: string;
  amount: number;
  payment_mode: "cash" | "upi" | "bank_transfer" | "cheque" | "card";
  reference_number: string | null;
  bank_name: string | null;
  receipt_url: string | null;
  notes: string | null;
  is_advance: boolean;
  created_at: string;
  created_by: string | null;
}

export interface DailyMaterialUsage {
  id: string;
  site_id: string;
  section_id: string | null;
  usage_date: string;
  material_id: string;
  brand_id: string | null;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  work_description: string | null;
  work_area: string | null;
  used_by: string | null;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface MaterialRequest {
  id: string;
  request_number: string;
  site_id: string;
  section_id: string | null;
  requested_by: string;
  request_date: string;
  required_by_date: string | null;
  priority: RequestPriority;
  status: MaterialRequestStatus;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  converted_to_po_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialRequestItem {
  id: string;
  request_id: string;
  material_id: string;
  brand_id: string | null;
  requested_qty: number;
  approved_qty: number | null;
  fulfilled_qty: number;
  estimated_cost: number | null;
  notes: string | null;
  created_at: string;
}

// ============================================
// EXTENDED TYPES WITH RELATIONSHIPS
// ============================================

export interface VendorWithCategories extends Vendor {
  categories?: MaterialCategory[];
}

export interface MaterialCategoryWithChildren extends MaterialCategory {
  children?: MaterialCategory[];
}

export interface MaterialWithDetails extends Material {
  category?: MaterialCategory | null;
  brands?: MaterialBrand[];
  parent_material?: { id: string; name: string; code: string | null } | null;
  variants?: MaterialWithDetails[];
  variant_count?: number;
}

export interface MaterialVendorWithDetails extends MaterialVendor {
  vendor?: Vendor;
  material?: Material;
  brand?: MaterialBrand | null;
}

export interface StockInventoryWithDetails extends StockInventory {
  material?: Material;
  brand?: MaterialBrand | null;
  location?: StockLocation | null;
  site?: { name: string };
}

export interface StockTransactionWithDetails extends StockTransaction {
  inventory?: StockInventory;
  material?: Material;
  section?: { name: string } | null;
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  vendor?: Vendor;
  site?: { name: string };
  items?: PurchaseOrderItemWithMaterial[];
  deliveries?: Delivery[];
}

export interface PurchaseOrderItemWithMaterial extends PurchaseOrderItem {
  material?: Material;
  brand?: MaterialBrand | null;
}

export interface DeliveryWithDetails extends Delivery {
  vendor?: Vendor;
  site?: { name: string };
  po?: PurchaseOrder | null;
  items?: DeliveryItemWithMaterial[];
}

export interface DeliveryItemWithMaterial extends DeliveryItem {
  material?: Material;
  brand?: MaterialBrand | null;
}

export interface MaterialRequestWithDetails extends MaterialRequest {
  site?: { name: string };
  section?: { name: string } | null;
  requested_by_user?: { name: string; email: string };
  approved_by_user?: { name: string } | null;
  items?: MaterialRequestItemWithMaterial[];
}

export interface MaterialRequestItemWithMaterial extends MaterialRequestItem {
  material?: Material;
  brand?: MaterialBrand | null;
}

export interface DailyMaterialUsageWithDetails extends DailyMaterialUsage {
  material?: Material;
  brand?: MaterialBrand | null;
  section?: { name: string } | null;
  created_by_user?: { name: string };
}

export interface StockTransferWithDetails extends StockTransfer {
  from_site?: { name: string };
  to_site?: { name: string };
  from_location?: StockLocation | null;
  to_location?: StockLocation | null;
  items?: StockTransferItemWithMaterial[];
}

export interface StockTransferItemWithMaterial extends StockTransferItem {
  material?: Material;
  brand?: MaterialBrand | null;
}

// New extended types for vendor enhancements
export interface SiteGroupWithSites extends SiteGroup {
  sites?: Array<{ id: string; name: string }>;
}

export interface GroupStockInventoryWithDetails extends GroupStockInventory {
  material?: Material;
  brand?: MaterialBrand | null;
  site_group?: SiteGroup;
}

export interface GroupStockTransactionWithDetails extends GroupStockTransaction {
  material?: Material;
  brand?: MaterialBrand | null;
  site_group?: SiteGroup;
  usage_site?: { id: string; name: string } | null;
  payment_source_site?: { id: string; name: string } | null;
}

export interface InterSiteSettlementWithDetails extends InterSiteSettlement {
  from_site?: { id: string; name: string };
  to_site?: { id: string; name: string };
  site_group?: SiteGroup;
  items?: InterSiteSettlementItemWithDetails[];
  payments?: InterSiteSettlementPayment[];
}

export interface InterSiteSettlementItemWithDetails extends InterSiteSettlementItem {
  material?: Material;
  brand?: MaterialBrand | null;
}

export interface VendorInventoryWithDetails extends VendorInventory {
  vendor?: Vendor;
  material?: Material | null;
  brand?: MaterialBrand | null;
  total_landed_cost?: number;
}

// ============================================
// STORE CATALOG TYPES
// ============================================

export interface LowestCompetingPrice {
  price: number;
  vendorName: string;
  vendorId: string;
}

export interface StoreCatalogItem extends VendorInventoryWithDetails {
  lowestCompetingPrice?: LowestCompetingPrice | null;
  isBestPrice: boolean;
  category?: MaterialCategory | null;
}

export interface StoreCatalogFilter {
  categoryId?: string | null;
  searchQuery?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'name' | 'recent';
}

export interface PriceHistoryWithDetails extends PriceHistory {
  vendor?: Vendor;
  material?: Material;
  brand?: MaterialBrand | null;
  recorded_by_user?: { name: string } | null;
}

export interface LocalPurchaseWithDetails extends LocalPurchase {
  site?: { name: string };
  site_group?: SiteGroup | null;
  engineer?: { name: string; email: string };
  vendor?: Vendor | null;
  items?: LocalPurchaseItemWithDetails[];
}

export interface LocalPurchaseItemWithDetails extends LocalPurchaseItem {
  material?: Material | null;
  brand?: MaterialBrand | null;
}

export interface DeliveryWithVerification extends Delivery {
  vendor?: Vendor;
  site?: { name: string };
  po?: PurchaseOrder | null;
  items?: DeliveryItemWithMaterial[];
  verified_by_user?: { name: string } | null;
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface VendorFormData {
  name: string;
  code?: string;
  contact_person?: string;
  phone?: string;
  alternate_phone?: string;
  whatsapp_number?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gst_number?: string;
  pan_number?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  payment_terms_days?: number;
  credit_limit?: number;
  notes?: string;
  rating?: number;
  category_ids?: string[];
  // New vendor enhancement fields
  vendor_type?: VendorType;
  shop_name?: string;
  has_physical_store?: boolean;
  store_address?: string;
  store_city?: string;
  store_pincode?: string;
  latitude?: number;
  longitude?: number;
  provides_transport?: boolean;
  provides_loading?: boolean;
  provides_unloading?: boolean;
  min_order_amount?: number;
  delivery_radius_km?: number;
  specializations?: string[];
  accepts_upi?: boolean;
  accepts_cash?: boolean;
  accepts_credit?: boolean;
  credit_days?: number;
  upi_id?: string;
  qr_code_url?: string;
  shop_photo_url?: string;
}

export interface MaterialFormData {
  name: string;
  code?: string;
  local_name?: string;
  category_id?: string;
  parent_id?: string | null; // For material variants
  description?: string;
  unit: MaterialUnit;
  secondary_unit?: MaterialUnit;
  conversion_factor?: number;
  hsn_code?: string;
  gst_rate?: number;
  specifications?: Record<string, unknown>;
  weight_per_unit?: number | null;
  weight_unit?: string;
  length_per_piece?: number | null;
  length_unit?: string;
  rods_per_bundle?: number | null; // Number of rods per bundle
  min_order_qty?: number;
  reorder_level?: number;
  image_url?: string;
}

// Variant creation form data for inline variant table
export interface VariantFormData {
  name: string;
  code?: string;
  local_name?: string;
  // Legacy fields (for backward compatibility with TMT materials)
  weight_per_unit?: number | null;
  length_per_piece?: number | null;
  rods_per_bundle?: number | null;
  // Dynamic specifications based on category template
  specifications?: Record<string, unknown>;
}

// Extended form data for creating a material with variants in one operation
export interface CreateMaterialWithVariantsData extends MaterialFormData {
  variants?: VariantFormData[];
}

// Weight calculation result
export interface WeightCalculation {
  pieces: number;
  totalWeight: number;
  weightUnit: string;
  weightPerUnit: number;
  displayText: string; // e.g., "100 pcs = 39.5 kg"
}

export interface MaterialBrandFormData {
  material_id: string;
  brand_name: string;
  variant_name?: string | null; // Brand sub-variant (e.g., "DSP", "Regular", "Grade")
  is_preferred?: boolean;
  quality_rating?: number;
  notes?: string;
}

export interface StockAdjustmentFormData {
  inventory_id: string;
  adjustment_qty: number;
  adjustment_type: "adjustment" | "wastage" | "return";
  notes?: string;
}

export interface UsageEntryFormData {
  site_id: string;
  section_id?: string;
  usage_date: string;
  material_id: string;
  brand_id?: string;
  quantity: number;
  work_description?: string;
  work_area?: string;
  notes?: string;
}

export interface MaterialRequestFormData {
  site_id: string;
  section_id?: string;
  requested_by?: string;
  required_by_date?: string;
  priority: RequestPriority;
  notes?: string;
  items: MaterialRequestItemFormData[];
}

export interface MaterialRequestItemFormData {
  material_id: string;
  brand_id?: string;
  requested_qty: number;
  notes?: string;
  estimated_cost?: number;
}

export interface PurchaseOrderFormData {
  site_id: string;
  vendor_id: string;
  expected_delivery_date?: string;
  delivery_address?: string;
  delivery_location_id?: string;
  payment_terms?: string;
  payment_timing?: "advance" | "on_delivery";
  transport_cost?: number;
  notes?: string;
  internal_notes?: string; // For storing group stock info as JSON
  items: PurchaseOrderItemFormData[];
  // For historical purchases - allow overriding defaults
  order_date?: string; // Override default (today's date)
  status?: string; // Override default ("draft")
}

export interface PurchaseOrderItemFormData {
  material_id: string;
  brand_id?: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  discount_percent?: number;
  notes?: string;
}

export interface DeliveryFormData {
  po_id?: string;
  site_id: string;
  vendor_id: string;
  location_id?: string;
  delivery_date: string;
  challan_number?: string;
  challan_date?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  delivery_photos?: string[];
  notes?: string;
  items: DeliveryItemFormData[];
}

export interface DeliveryItemFormData {
  po_item_id?: string;
  material_id: string;
  brand_id?: string;
  ordered_qty?: number;
  received_qty: number;
  accepted_qty?: number;
  rejected_qty?: number;
  rejection_reason?: string;
  unit_price?: number;
  notes?: string;
}

export interface StockTransferFormData {
  from_site_id: string;
  to_site_id: string;
  from_location_id?: string;
  to_location_id?: string;
  transfer_date: string;
  notes?: string;
  items: StockTransferItemFormData[];
}

export interface StockTransferItemFormData {
  material_id: string;
  brand_id?: string;
  quantity_sent: number;
  unit_cost?: number;
  notes?: string;
}

export interface SiteGroupFormData {
  name: string;
  description?: string;
}

export interface LocalPurchaseFormData {
  site_id: string;
  site_group_id?: string;
  vendor_id?: string;
  vendor_name: string;
  vendor_phone?: string;
  vendor_address?: string;
  is_new_vendor?: boolean;
  purchase_date: string;
  receipt_url?: string;
  payment_mode: LocalPurchasePaymentMode;
  payment_reference?: string;
  payment_source?: PaymentSource;
  description?: string;
  add_to_stock?: boolean;
  is_group_stock?: boolean;
  items: LocalPurchaseItemFormData[];
}

export interface LocalPurchaseItemFormData {
  material_id?: string;
  custom_material_name?: string;
  brand_id?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  save_to_vendor_inventory?: boolean;
  save_to_price_history?: boolean;
  notes?: string;
}

export interface VendorInventoryFormData {
  vendor_id: string;
  material_id?: string;
  custom_material_name?: string;
  brand_id?: string;
  current_price: number;
  price_includes_gst?: boolean;
  gst_rate?: number;
  price_includes_transport?: boolean;
  transport_cost?: number;
  loading_cost?: number;
  unloading_cost?: number;
  is_available?: boolean;
  min_order_qty?: number;
  unit?: string;
  lead_time_days?: number;
  price_source?: PriceSource;
  notes?: string;
}

export interface PriceEntryFormData {
  vendor_id: string;
  material_id: string;
  brand_id?: string;
  price: number;
  price_includes_gst?: boolean;
  gst_rate?: number;
  transport_cost?: number;
  loading_cost?: number;
  unloading_cost?: number;
  source: PriceSource;
  source_reference?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

export interface DeliveryVerificationFormData {
  delivery_id: string;
  verification_photos: string[];
  verification_notes?: string;
  discrepancies?: DeliveryDiscrepancy[];
  verification_status: DeliveryVerificationStatus;
}

// Form data for historical group stock purchase entry
export interface HistoricalPurchaseFormData {
  group_id: string;
  payment_source_site_id: string;
  purchase_date: string;
  vendor_id?: string;
  vendor_name?: string;
  transport_cost?: number;
  notes?: string;
  items: Array<{
    material_id: string;
    brand_id?: string;
    quantity: number;
    unit_price: number;
  }>;
}

// Form data for weekly usage report entry
export interface WeeklyUsageReportFormData {
  group_id: string;
  week_start: string;
  week_end: string;
  entries: Array<{
    material_id: string;
    brand_id?: string;
    quantity: number;
    usage_site_id: string;
    work_description?: string;
    usage_date?: string;
  }>;
}

// Form data for generating a settlement
export interface GenerateSettlementFormData {
  site_group_id: string;
  from_site_id: string; // Creditor
  to_site_id: string; // Debtor
  year: number;
  week_number: number;
}

// Form data for recording settlement payment
export interface SettlementPaymentFormData {
  settlement_id: string;
  amount: number;
  payment_date: string;
  payment_mode: SettlementPaymentMode;
  reference_number?: string;
  notes?: string;
}

// Form data for creating/updating price alerts
export interface PriceAlertFormData {
  material_id: string;
  brand_id?: string;
  alert_type: PriceAlertType;
  threshold_value?: number;
  threshold_percent?: number;
}

// ============================================
// VIEW TYPES
// ============================================

export interface SiteStockSummary {
  site_id: string;
  site_name: string;
  material_id: string;
  material_name: string;
  material_code: string | null;
  category_name: string | null;
  unit: MaterialUnit;
  total_qty: number;
  total_reserved: number;
  total_available: number;
  avg_cost: number;
  total_value: number;
}

export interface LowStockAlert {
  id: string;
  site_id: string;
  site_name: string;
  material_id: string;
  material_name: string;
  material_code: string | null;
  unit: MaterialUnit;
  current_qty: number;
  reorder_level: number;
  shortage_qty: number;
  avg_unit_cost: number | null;
}

export interface MaterialUsageBySection {
  site_id: string;
  section_id: string | null;
  section_name: string | null;
  material_id: string;
  material_name: string;
  unit: MaterialUnit;
  total_quantity: number;
  total_cost: number;
  first_usage: string;
  last_usage: string;
  usage_count: number;
}

// ============================================
// NOTIFICATION TYPES FOR MATERIALS
// ============================================

export type MaterialNotificationType =
  | "stock_low"
  | "stock_critical"
  | "material_request_new"
  | "material_request_approved"
  | "material_request_rejected"
  | "po_created"
  | "po_pending_approval"
  | "po_approved"
  | "po_rejected"
  | "delivery_expected"
  | "delivery_arrived"
  | "delivery_discrepancy"
  | "price_update";

// ============================================
// UTILITY TYPES
// ============================================

export const MATERIAL_UNIT_LABELS: Record<MaterialUnit, string> = {
  kg: "Kilogram",
  g: "Gram",
  ton: "Ton",
  liter: "Liter",
  ml: "Milliliter",
  piece: "Piece",
  bag: "Bag",
  bundle: "Bundle",
  sqft: "Square Feet",
  sqm: "Square Meter",
  cft: "Cubic Feet",
  cum: "Cubic Meter",
  nos: "Numbers",
  rmt: "Running Meter",
  box: "Box",
  set: "Set",
};

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  ordered: "Ordered",
  partial_delivered: "Partially Delivered",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  partial: "Partial",
  delivered: "Delivered",
  rejected: "Rejected",
};

export const REQUEST_STATUS_LABELS: Record<MaterialRequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  ordered: "Ordered",
  partial_fulfilled: "Partially Fulfilled",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_COLORS: Record<RequestPriority, "default" | "info" | "warning" | "error"> = {
  low: "default",
  normal: "info",
  high: "warning",
  urgent: "error",
};

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  shop: "Shop",
  dealer: "Dealer",
  manufacturer: "Manufacturer",
  individual: "Individual",
  rental_store: "Rental Store",
};

export const VENDOR_TYPE_ICONS: Record<VendorType, string> = {
  shop: "store",
  dealer: "local_shipping",
  manufacturer: "factory",
  individual: "person",
  rental_store: "handyman",
};

export const DELIVERY_VERIFICATION_STATUS_LABELS: Record<DeliveryVerificationStatus, string> = {
  pending: "Pending Verification",
  verified: "Verified",
  disputed: "Disputed",
  rejected: "Rejected",
};

export const DELIVERY_VERIFICATION_STATUS_COLORS: Record<DeliveryVerificationStatus, "warning" | "success" | "error" | "default"> = {
  pending: "warning",
  verified: "success",
  disputed: "error",
  rejected: "error",
};

export const LOCAL_PURCHASE_STATUS_LABELS: Record<LocalPurchaseStatus, string> = {
  draft: "Draft",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  company: "Company Account",
  site_cash: "Site Cash",
  engineer_own: "Engineer's Own Money",
};

export const PRICE_SOURCE_LABELS: Record<PriceSource, string> = {
  purchase: "Purchase",
  enquiry: "Enquiry",
  quotation: "Quotation",
  manual: "Manual Entry",
  bill: "Bill",
};

export const SETTLEMENT_STATUS_LABELS: Record<InterSiteSettlementStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  settled: "Settled",
  cancelled: "Cancelled",
};

export const SETTLEMENT_STATUS_COLORS: Record<InterSiteSettlementStatus, "default" | "warning" | "info" | "success" | "error"> = {
  draft: "default",
  pending: "warning",
  approved: "info",
  settled: "success",
  cancelled: "error",
};

export const SETTLEMENT_PAYMENT_MODE_LABELS: Record<SettlementPaymentMode, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  upi: "UPI",
  adjustment: "Adjustment",
};

export const PRICE_ALERT_TYPE_LABELS: Record<PriceAlertType, string> = {
  price_drop: "Price Drop",
  price_increase: "Price Increase",
  threshold_below: "Below Threshold",
  threshold_above: "Above Threshold",
};

export const PRICE_ALERT_TYPE_DESCRIPTIONS: Record<PriceAlertType, string> = {
  price_drop: "Alert when price drops by a percentage",
  price_increase: "Alert when price increases by a percentage",
  threshold_below: "Alert when price falls below a fixed value",
  threshold_above: "Alert when price exceeds a fixed value",
};

export const PRICE_ALERT_TYPE_COLORS: Record<PriceAlertType, "success" | "error" | "info" | "warning"> = {
  price_drop: "success",
  price_increase: "error",
  threshold_below: "info",
  threshold_above: "warning",
};

// ============================================
// MATERIAL PURCHASE EXPENSE TRACKING (PHASE 7)
// ============================================

export type MaterialPurchaseType = "own_site" | "group_stock";

export type MaterialBatchStatus = "in_stock" | "partial_used" | "completed" | "converted" | "recorded";

export type MaterialPaymentMode = "cash" | "upi" | "bank_transfer" | "cheque" | "credit";

export interface MaterialPurchaseExpense {
  id: string;
  site_id: string;
  ref_code: string;
  purchase_type: MaterialPurchaseType;

  // Purchase details
  vendor_id: string | null;
  vendor_name: string | null;
  purchase_date: string;

  // Financial
  total_amount: number;
  transport_cost: number;

  // Payment
  payment_mode: MaterialPaymentMode | null;
  payment_reference: string | null;
  payment_screenshot_url: string | null;
  is_paid: boolean;
  paid_date: string | null;
  amount_paid: number | null; // Actual amount paid after bargaining

  // Documents
  bill_url: string | null;

  // Status
  status: MaterialBatchStatus;

  // Settlement fields (for Material Settlement flow)
  settlement_reference: string | null;
  settlement_date: string | null;
  settlement_payer_source: string | null;
  settlement_payer_name: string | null;

  // For group stock: tracks if converted to own site
  converted_from_group: boolean;
  original_batch_code: string | null;

  // Links
  purchase_order_id: string | null;
  group_stock_transaction_id: string | null;
  local_purchase_id: string | null;
  site_group_id: string | null;

  // Batch tracking fields (for group stock)
  paying_site_id: string | null;
  original_qty: number | null;
  used_qty: number | null;
  remaining_qty: number | null;
  self_used_qty: number | null;
  self_used_amount: number | null;

  // Metadata
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialPurchaseExpenseItem {
  id: string;
  purchase_expense_id: string;
  material_id: string;
  brand_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number; // computed: quantity * unit_price
  notes: string | null;
  created_at: string;
}

export interface BatchAllocation {
  site_id: string;
  site_name: string;
  quantity_used: number;
  amount: number;
  usage_percent: number;
}

export interface GroupStockBatch {
  batch_code: string;
  ref_code: string;
  purchase_date: string;
  vendor_id: string | null;
  vendor_name: string | null;
  payment_source_site_id: string | null;
  payment_source_site_name: string | null;
  total_amount: number;
  original_quantity: number;
  remaining_quantity: number;
  status: MaterialBatchStatus;
  bill_url: string | null;
  payment_mode: MaterialPaymentMode | null;
  payment_reference: string | null;
  payment_screenshot_url: string | null;
  notes: string | null;
  items: Array<{
    material_id: string;
    material_name: string;
    material_code: string | null;
    brand_id: string | null;
    brand_name: string | null;
    quantity: number;
    unit: string;
    unit_price: number;
  }>;
  allocations: BatchAllocation[];
  // Site allocations with settlement status (from useBatchesWithUsage hook)
  site_allocations?: BatchSiteAllocation[];
  // Actual usage recorded from sites
  site_usage?: Array<{
    site_id: string;
    site_name: string;
    quantity_used: number;
    amount: number;
  }>;
  // Optional joined data
  material?: { id: string; name: string; code: string | null; unit: string };
  brand?: { id: string; brand_name: string };
  paying_site?: { id: string; name: string };
  id?: string;
  site_id?: string;
  site_group_id?: string | null;
  inventory_id?: string;
  material_id?: string;
}

// Extended types with relationships
export interface MaterialPurchaseExpenseWithDetails extends MaterialPurchaseExpense {
  site?: { id: string; name: string };
  paying_site?: { id: string; name: string } | null;
  vendor?: Vendor | null;
  site_group?: SiteGroup | null;
  purchase_order?: { id: string; po_number: string } | null;
  items?: MaterialPurchaseExpenseItemWithDetails[];
  created_by_user?: { name: string } | null;
}

export interface MaterialPurchaseExpenseItemWithDetails extends MaterialPurchaseExpenseItem {
  material?: Material;
  brand?: MaterialBrand | null;
}

// Form data for creating/updating material purchase expenses
export interface MaterialPurchaseExpenseFormData {
  site_id: string;
  purchase_type: MaterialPurchaseType;
  site_group_id?: string; // Required for group_stock type

  // Purchase details
  vendor_id?: string;
  vendor_name?: string;
  purchase_date: string;

  // Financial
  transport_cost?: number;

  // Payment
  payment_mode?: MaterialPaymentMode;
  payment_reference?: string;
  payment_screenshot_url?: string;
  is_paid?: boolean;
  paid_date?: string;

  // Documents
  bill_url?: string;

  // For group_stock type
  payment_source_site_id?: string; // Site that paid for the materials

  // Link to purchase order (for cascade delete)
  purchase_order_id?: string;

  // Metadata
  notes?: string;

  // Items
  items: MaterialPurchaseExpenseItemFormData[];
}

export interface MaterialPurchaseExpenseItemFormData {
  material_id: string;
  brand_id?: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

// Form data for completing a group stock batch
export interface CompleteBatchFormData {
  batch_code: string;
  allocations: Array<{
    site_id: string;
    amount: number;
    usage_percent: number;
  }>;
}

// Form data for converting group to own site
export interface ConvertToOwnSiteFormData {
  batch_code: string;
  target_site_id: string;
}

// Labels
export const MATERIAL_PURCHASE_TYPE_LABELS: Record<MaterialPurchaseType, string> = {
  own_site: "Own Site Purchase",
  group_stock: "Group Stock Purchase",
};

export const MATERIAL_BATCH_STATUS_LABELS: Record<MaterialBatchStatus, string> = {
  recorded: "Recorded",
  in_stock: "In Stock",
  partial_used: "Partially Used",
  completed: "Completed",
  converted: "Converted",
};

export const MATERIAL_BATCH_STATUS_COLORS: Record<MaterialBatchStatus, "default" | "info" | "warning" | "success" | "error"> = {
  recorded: "default",
  in_stock: "info",
  partial_used: "warning",
  completed: "success",
  converted: "default",
};

export const MATERIAL_PAYMENT_MODE_LABELS: Record<MaterialPaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  credit: "Credit",
};

// ============================================
// BATCH USAGE & SETTLEMENT TYPES
// ============================================

export type BatchUsageSettlementStatus = "pending" | "in_settlement" | "settled" | "self_use";

export interface BatchUsageRecord {
  id: string;
  batch_ref_code: string;
  site_group_id: string | null;
  usage_site_id: string;
  material_id: string;
  brand_id: string | null;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  usage_date: string;
  work_description: string | null;
  is_self_use: boolean;
  settlement_status: BatchUsageSettlementStatus;
  settlement_id: string | null;
  group_stock_transaction_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchUsageRecordWithDetails extends BatchUsageRecord {
  usage_site?: { id: string; name: string };
  material?: Material;
  brand?: MaterialBrand | null;
  settlement?: InterSiteSettlement | null;
}

export interface SettlementExpenseAllocation {
  id: string;
  settlement_id: string;
  batch_ref_code: string;
  creditor_site_id: string;
  creditor_expense_id: string | null;
  creditor_original_amount: number | null;
  creditor_self_use_amount: number | null;
  debtor_site_id: string;
  debtor_expense_id: string | null;
  debtor_settled_amount: number | null;
  created_at: string;
}

export interface BatchSiteAllocation {
  site_id: string;
  site_name: string;
  quantity_used: number;
  amount: number;
  is_payer: boolean;
  settlement_status: BatchUsageSettlementStatus;
}

export interface BatchSettlementSummary {
  batch_ref_code: string;
  paying_site_id: string;
  paying_site_name: string;
  total_amount: number;
  original_qty: number;
  used_qty: number;
  remaining_qty: number;
  site_allocations: BatchSiteAllocation[];
}

// Form data for recording batch usage
export interface RecordBatchUsageFormData {
  batch_ref_code: string;
  usage_site_id: string;
  quantity: number;
  usage_date: string;
  work_description?: string;
}

// Form data for initiating batch settlement
export interface InitiateBatchSettlementFormData {
  batch_ref_code: string;
  debtor_site_id: string;
  payment_mode: string;
  payment_date: string;
  payment_reference?: string;
}

// Response from process_batch_settlement function
export interface BatchSettlementResult {
  settlement_id: string;
  debtor_expense_id: string;
  settlement_code: string;
}

// Labels for batch usage settlement status
export const BATCH_USAGE_SETTLEMENT_STATUS_LABELS: Record<BatchUsageSettlementStatus, string> = {
  pending: "Pending Settlement",
  in_settlement: "Settlement Pending",
  settled: "Settled",
  self_use: "Self Use",
};

export const BATCH_USAGE_SETTLEMENT_STATUS_COLORS: Record<BatchUsageSettlementStatus, "warning" | "success" | "info" | "primary"> = {
  pending: "warning",
  in_settlement: "primary",
  settled: "success",
  self_use: "info",
};
