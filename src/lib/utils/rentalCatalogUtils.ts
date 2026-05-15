import type {
  RentalItem,
  RentalItemSize,
  RentalStoreInventoryWithDetails,
  EstimateBasketItem,
  VendorEstimate,
} from "@/types/rental.types";

/**
 * Returns the daily rate for a given size label from inventory.
 * Falls back to daily_rate when:
 *   - sizeLabel is null
 *   - size_rates is null/undefined
 *   - sizeLabel is not present in size_rates
 */
export function getRateForSize(
  inventory: RentalStoreInventoryWithDetails,
  sizeLabel: string | null
): number {
  if (!sizeLabel || !inventory.size_rates) return inventory.daily_rate ?? 0;
  return inventory.size_rates[sizeLabel] ?? (inventory.daily_rate ?? 0);
}

/**
 * Computes per-vendor cost estimates for a basket of items.
 * Returns estimates sorted cheapest-first with is_cheapest flagged.
 */
export function computeVendorEstimates(
  basketItems: EstimateBasketItem[],
  inventoryByItemId: Record<string, RentalStoreInventoryWithDetails[]>
): VendorEstimate[] {
  if (basketItems.length === 0) return [];

  // Build a map: vendor_id → { name, inventoryByItem }
  const vendorMap = new Map<
    string,
    { name: string; inventoryByItem: Map<string, RentalStoreInventoryWithDetails> }
  >();

  for (const item of basketItems) {
    const inventories = inventoryByItemId[item.rental_item_id] ?? [];
    for (const inv of inventories) {
      if (!inv.vendor) continue;
      if (!vendorMap.has(inv.vendor_id)) {
        vendorMap.set(inv.vendor_id, {
          name: inv.vendor.name,
          inventoryByItem: new Map(),
        });
      }
      vendorMap.get(inv.vendor_id)!.inventoryByItem.set(inv.rental_item_id, inv);
    }
  }

  const estimates: VendorEstimate[] = [];

  for (const [vendorId, { name, inventoryByItem }] of vendorMap) {
    const lineItems: VendorEstimate["line_items"] = [];
    let total = 0;

    for (const item of basketItems) {
      const inv = inventoryByItem.get(item.rental_item_id);
      const rate = inv ? getRateForSize(inv, item.size_label) : 0;
      const lineTotal = item.quantity * rate * item.days;
      total += lineTotal;
      lineItems.push({
        rental_item_id: item.rental_item_id,
        size_label: item.size_label,
        qty: item.quantity,
        days: item.days,
        daily_rate: rate,
        line_total: lineTotal,
      });
    }

    estimates.push({
      vendor_id: vendorId,
      vendor_name: name,
      total_rental_cost: total,
      line_items: lineItems,
      is_cheapest: false,
    });
  }

  if (estimates.length > 0) {
    const minCost = Math.min(...estimates.map((e) => e.total_rental_cost));
    for (const e of estimates) {
      e.is_cheapest = e.total_rental_cost === minCost;
    }
  }

  return estimates.sort((a, b) => a.total_rental_cost - b.total_rental_cost);
}

/**
 * Returns the vendor_id of the cheapest estimate, or null if the list is empty.
 */
export function cheapestVendorId(estimates: VendorEstimate[]): string | null {
  if (estimates.length === 0) return null;
  return estimates.reduce((best, e) =>
    e.total_rental_cost < best.total_rental_cost ? e : best
  ).vendor_id;
}

/**
 * Daily/hourly rate for an order line. Priority:
 *   1. vendor size_rates[label] (existing override)
 *   2. variant default (daily_rate or default_hourly_rate based on parent rate_type)
 *   3. parent default_daily_rate
 *   4. 0
 */
export function resolveVariantRate(
  parent: Pick<RentalItem, "default_daily_rate" | "rate_type">,
  variant: RentalItemSize | null,
  vendorInventory: RentalStoreInventoryWithDetails | null
): number {
  const isHourly = parent.rate_type === "hourly";

  if (variant && vendorInventory?.size_rates) {
    const override = vendorInventory.size_rates[variant.size_label];
    if (typeof override === "number") return override;
  }

  if (variant) {
    const variantRate = isHourly ? variant.default_hourly_rate : variant.daily_rate;
    if (typeof variantRate === "number") return variantRate;
  }

  return parent.default_daily_rate ?? 0;
}
