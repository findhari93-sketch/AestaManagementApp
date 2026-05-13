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

export interface JourneyApproverUser {
  id: string;
  name: string;
  display_name: string | null;
}

export interface JourneyBrand {
  id: string;
  brand_name: string;
  variant_name: string | null;
  image_url: string | null;
}

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
  request: MaterialRequest & {
    items: MaterialRequestItem[];
    approved_by_user: JourneyApproverUser | null;
  };

  po: (PurchaseOrder & {
    items: (PurchaseOrderItem & { brand: JourneyBrand | null })[];
  }) | null;

  deliveries: (Delivery & { items: DeliveryItem[] })[];

  expense: MaterialPurchaseExpense | null;

  batchUsage: BatchUsageRecord[];

  settlement: (InterSiteSettlement & {
    items: InterSiteSettlementItem[];
    payments: InterSiteSettlementPayment[];
  }) | null;

  overallStatus: JourneyOverallStatus;

  isGroupPO: boolean;

  /** Average unit price for the request's brand from price_history. Null when no brand or no history. */
  brandAvgPrice: number | null;
}
