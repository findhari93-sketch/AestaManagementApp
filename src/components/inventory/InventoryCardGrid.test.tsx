import { describe, it, expect } from "vitest";
import { groupByCategory, filterByCategory } from "./InventoryCardGrid";
import type { ConsolidatedStockItem } from "@/lib/utils/fifoAllocator";

const makeItem = (
  name: string,
  categoryCode: string | null,
): ConsolidatedStockItem => ({
  key: name,
  material_id: name,
  material_name: name,
  material_code: categoryCode,
  category_id: categoryCode ? `cat-${categoryCode.toLowerCase()}` : null,
  category_name: null,
  total_available_qty: 10,
  total_purchased: 20,
  has_shared_batches: false,
  has_own_batches: true,
  batches: [],
  unit: "Nos",
  batch_count: 1,
  weighted_avg_cost: 0,
  total_value: 0,
  total_qty: 10,
  total_weight: null,
  pricing_mode: "per_piece",
  brand_names: [],
});

const cement = makeItem("PPC Cement", "CEM-001");
const wire = makeItem("Wire 1.5mm", "ELC-001");
const tile = makeItem("Floor Tile", "TIL-001");
const unknown = makeItem("Misc Item", null);

describe("filterByCategory", () => {
  const items = [cement, wire, tile, unknown];

  it("'all' returns all items", () => {
    expect(filterByCategory(items, "all")).toHaveLength(4);
  });

  it("'civil' returns only CEM items", () => {
    const result = filterByCategory(items, "civil");
    expect(result).toHaveLength(1);
    expect(result[0].material_name).toBe("PPC Cement");
  });

  it("'electrical' returns only ELC items", () => {
    const result = filterByCategory(items, "electrical");
    expect(result).toHaveLength(1);
    expect(result[0].material_name).toBe("Wire 1.5mm");
  });
});

describe("groupByCategory", () => {
  const items = [cement, wire, unknown];

  it("groups items under correct category keys", () => {
    const groups = groupByCategory(items);
    expect(groups.civil).toHaveLength(1);
    expect(groups.electrical).toHaveLength(1);
    expect(groups.general).toHaveLength(1);
  });

  it("does not include empty category groups", () => {
    const groups = groupByCategory(items);
    expect(groups.tiles).toBeUndefined();
    expect(groups.painting).toBeUndefined();
  });
});
