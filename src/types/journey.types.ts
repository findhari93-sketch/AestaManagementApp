/**
 * Material Request Journey Types
 * Types for tracking the complete lifecycle of a material request from creation through settlement
 */

import type {
  MaterialRequest,
  MaterialRequestItem,
  PurchaseOrder,
  PurchaseOrderItem,
  Delivery,
  DeliveryItem,
  MaterialPurchaseExpense,
  InterSiteSettlement,
  InterSiteSettlementItem,
  InterSiteSettlementPayment,
  BatchUsageRecord,
} from "./material.types";

/**
 * Overall status of a request journey through its complete lifecycle
 */
export type JourneyOverallStatus =
  | "pending_approval" // Request created, awaiting approval
  | "ordered" // Request approved, PO created
  | "delivery_pending" // PO placed, awaiting delivery
  | "delivery_verified" // Delivery received and verified
  | "vendor_paid" // Vendor payment processed (expense recorded)
  | "settlement_done" // Inter-site settlement completed (for group stock)
  | "complete"; // All steps completed

/**
 * Phase-level status for UI component rendering
 * Indicates whether a phase is completed, in progress, pending, or blocked
 */
export type JourneyPhaseStatus = "done" | "active" | "pending" | "blocked";

/**
 * Complete journey record for a material request
 * Aggregates the request, purchase order, delivery, expense, and settlement data
 */
export interface RequestJourney {
  /**
   * The original material request with its items
   */
  request: MaterialRequest & { items: MaterialRequestItem[] };

  /**
   * Associated purchase order if created from this request
   * Null if request not yet converted to PO
   */
  po: (PurchaseOrder & { items: PurchaseOrderItem[] }) | null;

  /**
   * Deliveries recorded against the PO or request
   */
  deliveries: (Delivery & { items: DeliveryItem[] })[];

  /**
   * Expense record for the purchase (vendor payment tracking)
   * Null if not yet paid/recorded
   */
  expense: MaterialPurchaseExpense | null;

  /**
   * Per-site usage records for group stock purchases
   * Empty array if not a group stock purchase or no usage yet
   */
  batchUsage: BatchUsageRecord[];

  /**
   * Inter-site settlement if materials were shared across multiple sites
   * Null if single-site or not yet settled
   */
  settlement: (InterSiteSettlement & {
    items: InterSiteSettlementItem[];
    payments: InterSiteSettlementPayment[];
  }) | null;

  /**
   * Overall status indicating where the request is in its journey
   */
  overallStatus: JourneyOverallStatus;

  /**
   * True if this is a group stock purchase (shared across multiple sites)
   * False if single-site own stock
   */
  isGroupPO: boolean;
}
