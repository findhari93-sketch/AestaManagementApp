import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MaterialStockCard, getProgressColor } from "./MaterialStockCard";
import type { ConsolidatedStockItem } from "@/lib/utils/fifoAllocator";

const makeItem = (overrides: Partial<ConsolidatedStockItem> = {}): ConsolidatedStockItem => ({
  key: "mat-1",
  material_id: "mat-1",
  material_name: "PPC Cement",
  material_code: "MAT-CEM-001",
  brand_names: [],
  unit: "Bag",
  category_id: "cat-1",
  category_name: "Civil",
  image_url: null,
  total_qty: 3.5,
  total_available_qty: 3.5,
  batch_count: 1,
  weighted_avg_cost: 290,
  total_value: 1015,
  total_purchased: 30,
  has_shared_batches: true,
  has_own_batches: false,
  pricing_mode: "per_piece",
  total_weight: null,
  batches: [],
  ...overrides,
});

describe("getProgressColor", () => {
  it("returns red for < 20%", () => {
    expect(getProgressColor(0.1)).toBe("#f44336");
    expect(getProgressColor(0.19)).toBe("#f44336");
  });
  it("returns orange for 20–50%", () => {
    expect(getProgressColor(0.2)).toBe("#ff9800");
    expect(getProgressColor(0.49)).toBe("#ff9800");
  });
  it("returns green for > 50%", () => {
    expect(getProgressColor(0.5)).toBe("#4caf50");
    expect(getProgressColor(1)).toBe("#4caf50");
  });
});

describe("MaterialStockCard", () => {
  it("renders material name, code and unit", () => {
    render(<MaterialStockCard item={makeItem()} isLowStock={false} onRecordUsage={vi.fn()} />);
    expect(screen.getByText("PPC Cement")).toBeInTheDocument();
    expect(screen.getByText(/MAT-CEM-001/)).toBeInTheDocument();
  });

  it("renders banner image when image_url is set", () => {
    render(
      <MaterialStockCard
        item={makeItem({ image_url: "https://example.com/ppc.jpg" })}
        isLowStock={false}
        onRecordUsage={vi.fn()}
      />
    );
    const img = screen.getByAltText("PPC Cement") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain("https://example.com/ppc.jpg");
  });

  it("renders fallback (no <img>) when image_url is null", () => {
    render(
      <MaterialStockCard item={makeItem({ image_url: null })} isLowStock={false} onRecordUsage={vi.fn()} />
    );
    expect(screen.queryByAltText("PPC Cement")).not.toBeInTheDocument();
  });

  it("shows Low overlay chip when isLowStock", () => {
    render(<MaterialStockCard item={makeItem()} isLowStock={true} onRecordUsage={vi.fn()} />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("does NOT show Low chip when isLowStock=false", () => {
    render(<MaterialStockCard item={makeItem()} isLowStock={false} onRecordUsage={vi.fn()} />);
    expect(screen.queryByText("Low")).not.toBeInTheDocument();
  });

  it("calls onRecordUsage with item when Record Usage clicked", () => {
    const onRecord = vi.fn();
    const item = makeItem();
    render(<MaterialStockCard item={item} isLowStock={false} onRecordUsage={onRecord} />);
    fireEvent.click(screen.getByRole("button", { name: /record usage/i }));
    expect(onRecord).toHaveBeenCalledWith(item);
  });
});
