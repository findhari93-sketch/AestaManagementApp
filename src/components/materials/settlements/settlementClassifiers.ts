import type {
  MaterialPurchaseExpenseWithDetails,
  PurchaseOrderWithDetails,
} from "@/types/material.types";

export type SettlementItemType = "own_site" | "group_po" | "intersite" | "advance";

export type SettlementItem =
  | (MaterialPurchaseExpenseWithDetails & { itemType: "expense" })
  | (PurchaseOrderWithDetails & { itemType: "po" });

export type SourceKind = "po" | "ai_bill" | "direct" | "advance" | "intersite";

export function isExpenseSettled(p: MaterialPurchaseExpenseWithDetails): boolean {
  if (p.purchase_type === "group_stock") return !!p.is_paid;
  if (p.original_batch_code && p.settlement_reference && p.settlement_reference !== "SELF-USE") return true;
  return !!p.settlement_reference;
}

export function isItemSettled(item: SettlementItem): boolean {
  if (item.itemType === "expense") return isExpenseSettled(item);
  return !!item.advance_paid;
}

export function getSettlementType(item: SettlementItem): SettlementItemType {
  if (item.itemType === "po") return "advance";
  const purchase = item as MaterialPurchaseExpenseWithDetails;
  if (purchase.original_batch_code && purchase.settlement_reference === "SELF-USE") return "intersite";
  if (purchase.original_batch_code && purchase.settlement_reference && purchase.settlement_reference !== "SELF-USE") return "intersite";
  if (purchase.purchase_type === "group_stock") return "group_po";
  return "own_site";
}

export function getSourceKind(item: SettlementItem): SourceKind {
  if (item.itemType === "po") return "advance";
  const purchase = item as MaterialPurchaseExpenseWithDetails;
  if (purchase.original_batch_code) return "intersite";
  if (purchase.purchase_order_id) return "po";
  const source = (purchase as unknown as { source?: string | null }).source;
  if (source === "ai_ingest") return "ai_bill";
  return "direct";
}

export function getItemAmount(item: SettlementItem): number {
  // purchase_orders.total_amount already includes transport_cost (the PO save
  // path stamps it as subtotal + tax + transport — see usePurchaseOrders.ts).
  // Adding transport_cost on top of total_amount here was the source of the
  // "₹100 too high" display bug.
  if (item.itemType === "po") {
    return Number(item.total_amount || 0);
  }
  const purchase = item as MaterialPurchaseExpenseWithDetails;
  if (purchase.purchase_order?.total_amount) {
    return Number(purchase.purchase_order.total_amount);
  }
  return Number(purchase.total_amount || 0);
}

export function getItemDate(item: SettlementItem): string {
  if (item.itemType === "po") return item.order_date || "";
  return (item as MaterialPurchaseExpenseWithDetails).purchase_date || "";
}

export function getItemRefCode(item: SettlementItem): string {
  if (item.itemType === "po") return item.po_number || "";
  return (item as MaterialPurchaseExpenseWithDetails).ref_code || "";
}

export function getItemVendorName(item: SettlementItem): string {
  return (
    item.vendor?.name ||
    (item.itemType === "expense"
      ? (item as MaterialPurchaseExpenseWithDetails).vendor_name || ""
      : "") ||
    "—"
  );
}

export function getItemVendorId(item: SettlementItem): string | null {
  return item.vendor?.id || null;
}

export function getAgeInDays(item: SettlementItem, now: Date = new Date()): number {
  const d = getItemDate(item);
  if (!d) return 0;
  const t = Date.parse(d);
  if (Number.isNaN(t)) return 0;
  const ms = now.getTime() - t;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
