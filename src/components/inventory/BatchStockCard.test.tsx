import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BatchStockCard } from "./BatchStockCard";
import type { ExtendedStockInventory } from "@/hooks/queries/useStockInventory";

const makeItem = (overrides: Partial<ExtendedStockInventory> = {}): ExtendedStockInventory => ({
  id: "stock-1",
  site_id: "site-1",
  location_id: null,
  material_id: "mat-1",
  brand_id: null,
  current_qty: 25,
  reserved_qty: 0,
  available_qty: 25,
  avg_unit_cost: 290,
  last_received_date: null,
  last_issued_date: null,
  reorder_level: null,
  reorder_qty: null,
  created_at: "2026-05-12T00:00:00Z",
  updated_at: "2026-05-12T00:00:00Z",
  material: {
    id: "mat-1",
    name: "PPC Cement",
    code: "MAT-CEM-001",
    unit: "bag",
  } as ExtendedStockInventory["material"],
  brand: null,
  location: null,
  is_shared: true,
  batch_code: "BATCH-2026-04-12-001",
  pricing_mode: "per_piece",
  total_weight: null,
  is_vendor_paid: true,
  settlement_state: null,
  ...overrides,
});

describe("BatchStockCard", () => {
  it("renders material name, code, batch code and qty", () => {
    render(<BatchStockCard item={makeItem()} onRecordUsage={vi.fn()} />);
    expect(screen.getByText("PPC Cement")).toBeInTheDocument();
    expect(screen.getByText("MAT-CEM-001")).toBeInTheDocument();
    expect(screen.getByText("BATCH-2026-04-12-001")).toBeInTheDocument();
    expect(screen.getByText(/25\s+bag/)).toBeInTheDocument();
  });

  it("shows Shared chip for shared batch", () => {
    render(<BatchStockCard item={makeItem({ is_shared: true })} onRecordUsage={vi.fn()} />);
    expect(screen.getByText("Shared")).toBeInTheDocument();
  });

  it("shows Own chip for non-shared batch", () => {
    render(<BatchStockCard item={makeItem({ is_shared: false })} onRecordUsage={vi.fn()} />);
    expect(screen.getByText("Own")).toBeInTheDocument();
  });

  it("shows ✓ Settled chip when settlement_state is settled", () => {
    render(<BatchStockCard item={makeItem({ settlement_state: "settled" })} onRecordUsage={vi.fn()} />);
    expect(screen.getByText("✓ Settled")).toBeInTheDocument();
  });

  it("shows ⏳ Pending chip when settlement_state is pending", () => {
    render(<BatchStockCard item={makeItem({ settlement_state: "pending" })} onRecordUsage={vi.fn()} />);
    expect(screen.getByText("⏳ Pending")).toBeInTheDocument();
  });

  it("shows no settlement chip when settlement_state is null", () => {
    render(<BatchStockCard item={makeItem({ settlement_state: null })} onRecordUsage={vi.fn()} />);
    expect(screen.queryByText(/Settled|Pending/)).not.toBeInTheDocument();
  });

  it("shows Vendor Unpaid chip when is_vendor_paid is false", () => {
    render(<BatchStockCard item={makeItem({ is_vendor_paid: false })} onRecordUsage={vi.fn()} />);
    expect(screen.getByText("Vendor Unpaid")).toBeInTheDocument();
  });

  it("calls onRecordUsage with item when Record Usage clicked", () => {
    const onRecord = vi.fn();
    const item = makeItem();
    render(<BatchStockCard item={item} onRecordUsage={onRecord} />);
    fireEvent.click(screen.getByRole("button", { name: /record usage/i }));
    expect(onRecord).toHaveBeenCalledWith(item);
  });
});
