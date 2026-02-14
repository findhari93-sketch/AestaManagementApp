import type { ExtendedStockInventory } from "@/hooks/queries/useStockInventory";

/**
 * Represents a single batch allocation from FIFO distribution.
 */
export interface BatchAllocation {
  /** The stock_inventory row to deduct from */
  inventory_id: string;
  /** Material ID */
  material_id: string;
  /** Brand ID (null if unbranded) */
  brand_id: string | null;
  /** The batch code (null for own stock) */
  batch_code: string | null;
  /** Whether this is shared/group stock */
  is_shared: boolean;
  /** Quantity to deduct from this batch */
  quantity: number;
  /** Unit cost for this batch */
  unit_cost: number;
  /** Total cost for this allocation */
  total_cost: number;
  /** The site that paid for this stock (for shared stock settlement) */
  paid_by_site_id: string | null;
  /** Pricing mode */
  pricing_mode: "per_piece" | "per_kg";
  /** Total weight in this batch before deduction (for per_kg weight tracking) */
  total_weight: number | null;
  /** Current qty in this batch before deduction (for weight-per-piece calc) */
  current_qty: number;
}

/**
 * Represents a consolidated material grouping multiple batches.
 */
export interface ConsolidatedStockItem {
  /** Composite key: material_id */
  key: string;
  material_id: string;
  material_name: string;
  material_code: string | null;
  /** Unique brand names across all batches (for display) */
  brand_names: string[];
  /** Unit from material */
  unit: string;
  /** Category from material */
  category_id: string | null;
  category_name: string | null;
  /** Total current quantity across all batches */
  total_qty: number;
  /** Total available quantity across all batches */
  total_available_qty: number;
  /** Number of underlying stock_inventory rows */
  batch_count: number;
  /** Weighted average cost (by quantity) */
  weighted_avg_cost: number;
  /** Total stock value */
  total_value: number;
  /** Whether any batch is shared */
  has_shared_batches: boolean;
  /** Whether any batch is own stock */
  has_own_batches: boolean;
  /** Pricing mode across batches */
  pricing_mode: "per_piece" | "per_kg" | "mixed";
  /** Total weight (for per-kg items) */
  total_weight: number | null;
  /** Underlying batches sorted by date (oldest first) */
  batches: ExtendedStockInventory[];
}

/**
 * Compute effective cost-per-piece for a stock inventory row.
 * For per_kg items, converts weight-based cost to per-piece cost.
 */
function getEffectiveCostPerPiece(stock: ExtendedStockInventory): number {
  const baseCost =
    stock.is_shared && stock.batch_unit_cost
      ? stock.batch_unit_cost
      : stock.avg_unit_cost;

  if (!baseCost) return 0;

  if (
    stock.pricing_mode === "per_kg" &&
    stock.total_weight &&
    stock.current_qty > 0
  ) {
    const weightPerPiece = stock.total_weight / stock.current_qty;
    return weightPerPiece * baseCost;
  }

  return baseCost;
}

/**
 * Allocates a requested quantity across multiple stock batches using FIFO.
 *
 * Order of consumption:
 * 1. Own stock batches (no batch_code) — no settlement implications
 * 2. Shared stock batches (has batch_code) — sorted by date ascending
 *
 * Within each group, sorted by last_received_date ascending (oldest first).
 *
 * @param batches - Stock inventory rows for the same material+brand
 * @param requestedQty - Total quantity to allocate
 * @returns Array of BatchAllocation objects, one per consumed batch
 * @throws Error if insufficient total stock
 */
export function allocateFIFO(
  batches: ExtendedStockInventory[],
  requestedQty: number
): BatchAllocation[] {
  if (requestedQty <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  const totalAvailable = batches.reduce(
    (sum, b) => sum + (b.available_qty ?? b.current_qty),
    0
  );

  if (requestedQty > totalAvailable) {
    throw new Error(
      `Insufficient stock. Available: ${totalAvailable}, Requested: ${requestedQty}`
    );
  }

  // Sort: own stock first, then shared; within each group by date ascending
  const sorted = [...batches]
    .filter((b) => (b.available_qty ?? b.current_qty) > 0)
    .sort((a, b) => {
      const aShared = a.is_shared ? 1 : 0;
      const bShared = b.is_shared ? 1 : 0;
      if (aShared !== bShared) return aShared - bShared;

      const aDate = a.last_received_date || a.created_at || "";
      const bDate = b.last_received_date || b.created_at || "";
      return aDate.localeCompare(bDate);
    });

  const allocations: BatchAllocation[] = [];
  let remaining = requestedQty;

  for (const batch of sorted) {
    if (remaining <= 0) break;

    const available = batch.available_qty ?? batch.current_qty;
    if (available <= 0) continue;

    const qty = Math.min(remaining, available);
    const effectiveUnitCost = getEffectiveCostPerPiece(batch);

    allocations.push({
      inventory_id: batch.id,
      material_id: batch.material_id,
      brand_id: batch.brand_id ?? null,
      batch_code: batch.batch_code ?? null,
      is_shared: batch.is_shared,
      quantity: qty,
      unit_cost: effectiveUnitCost,
      total_cost: Math.round(effectiveUnitCost * qty * 100) / 100,
      paid_by_site_id: batch.paid_by_site_id ?? null,
      pricing_mode: (batch.pricing_mode as "per_piece" | "per_kg") || "per_piece",
      total_weight: batch.total_weight ?? null,
      current_qty: batch.current_qty,
    });

    remaining -= qty;
  }

  return allocations;
}

/**
 * Consolidate stock inventory items by material+brand.
 * Groups multiple batch rows into single consolidated items.
 */
export function consolidateStock(
  stock: ExtendedStockInventory[]
): ConsolidatedStockItem[] {
  const map = new Map<string, ConsolidatedStockItem>();

  for (const item of stock) {
    // Group by material_id only — all brands of the same material consolidate
    const key = item.material_id;

    if (!map.has(key)) {
      map.set(key, {
        key,
        material_id: item.material_id,
        material_name: item.material?.name || "Unknown",
        material_code: item.material?.code || null,
        brand_names: [],
        unit: (item.material?.unit as string) || "piece",
        category_id: item.material?.category_id ?? null,
        category_name: (item.material as any)?.category?.name ?? null,
        total_qty: 0,
        total_available_qty: 0,
        batch_count: 0,
        weighted_avg_cost: 0,
        total_value: 0,
        has_shared_batches: false,
        has_own_batches: false,
        pricing_mode:
          (item.pricing_mode as "per_piece" | "per_kg") || "per_piece",
        total_weight: null,
        batches: [],
      });
    }

    const consolidated = map.get(key)!;

    // Collect unique brand names
    const brandName = item.brand?.brand_name;
    if (brandName && !consolidated.brand_names.includes(brandName)) {
      consolidated.brand_names.push(brandName);
    }
    consolidated.total_qty += item.current_qty;
    consolidated.total_available_qty += item.available_qty ?? item.current_qty;
    consolidated.batch_count += 1;
    consolidated.batches.push(item);

    if (item.is_shared) consolidated.has_shared_batches = true;
    else consolidated.has_own_batches = true;

    // Accumulate value for weighted average
    const effectiveCost = getEffectiveCostPerPiece(item);
    consolidated.total_value += effectiveCost * item.current_qty;

    // Accumulate weight
    if (item.total_weight) {
      consolidated.total_weight =
        (consolidated.total_weight || 0) + item.total_weight;
    }

    // Detect mixed pricing
    if (consolidated.batch_count > 1) {
      const firstMode =
        (consolidated.batches[0].pricing_mode as string) || "per_piece";
      const thisMode = (item.pricing_mode as string) || "per_piece";
      if (thisMode !== firstMode) {
        consolidated.pricing_mode = "mixed";
      }
    }
  }

  // Finalize weighted averages and sort batches
  for (const item of map.values()) {
    item.weighted_avg_cost =
      item.total_qty > 0
        ? Math.round((item.total_value / item.total_qty) * 100) / 100
        : 0;

    // Sort batches by date (oldest first) for FIFO display
    item.batches.sort((a, b) => {
      const aDate = a.last_received_date || a.created_at || "";
      const bDate = b.last_received_date || b.created_at || "";
      return aDate.localeCompare(bDate);
    });
  }

  return Array.from(map.values());
}
