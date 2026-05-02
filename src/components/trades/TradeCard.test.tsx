import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradeCard } from "./TradeCard";
import type { Trade, TradeCategory } from "@/types/trade.types";

const baseCat: TradeCategory = {
  id: "p1",
  name: "Painting",
  isSystemSeed: true,
  isActive: true,
};

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    category: baseCat,
    contracts: [],
    ...overrides,
  };
}

describe("TradeCard", () => {
  it("shows trade name", () => {
    render(
      <TradeCard
        trade={makeTrade()}
        onContractClick={() => {}}
        onAddClick={() => {}}
      />
    );
    expect(screen.getByText("Painting")).toBeInTheDocument();
  });

  it("shows 'Add contract' CTA when no contracts and fires onAddClick", () => {
    const onAddClick = vi.fn();
    render(
      <TradeCard
        trade={makeTrade()}
        onContractClick={() => {}}
        onAddClick={onAddClick}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /add contract/i }));
    expect(onAddClick).toHaveBeenCalledWith("p1");
  });

  it("renders the active contract's mesthri name + quoted total", () => {
    const trade = makeTrade({
      contracts: [
        {
          id: "k1",
          siteId: "s1",
          tradeCategoryId: "p1",
          title: "Asis Painting",
          laborTrackingMode: "mesthri_only",
          isInHouse: false,
          contractType: "mesthri",
          status: "active",
          totalValue: 250000,
          mesthriOrSpecialistName: "Asis Mesthri",
          createdAt: "2026-05-02T00:00:00Z",
        },
      ],
    });
    render(
      <TradeCard
        trade={trade}
        onContractClick={() => {}}
        onAddClick={() => {}}
      />
    );
    expect(screen.getByText("Asis Mesthri")).toBeInTheDocument();
    // Quoted figure appears in the row's Quoted column
    expect(screen.getAllByText(/2,50,000/).length).toBeGreaterThan(0);
  });

  it("shows Paid and Balance from reconciliation map", () => {
    const trade = makeTrade({
      contracts: [
        {
          id: "k1",
          siteId: "s1",
          tradeCategoryId: "p1",
          title: "Asis Painting",
          laborTrackingMode: "mesthri_only",
          isInHouse: false,
          contractType: "mesthri",
          status: "active",
          totalValue: 200000,
          mesthriOrSpecialistName: "Asis Mesthri",
          createdAt: "2026-05-02T00:00:00Z",
        },
      ],
    });
    const reconciliations = new Map([
      [
        "k1",
        {
          subcontractId: "k1",
          quotedAmount: 200000,
          amountPaid: 50000,
          amountPaidSubcontractPayments: 50000,
          amountPaidSettlements: 0,
          impliedLaborValueDetailed: 0,
          impliedLaborValueHeadcount: 0,
        },
      ],
    ]);
    render(
      <TradeCard
        trade={trade}
        reconciliations={reconciliations}
        onContractClick={() => {}}
        onAddClick={() => {}}
      />
    );
    // Both "₹50,000" (Paid) and "₹1,50,000" (Balance) appear; use getAllByText
    // since "50,000" matches both. Distinct rendering is the visual guarantee.
    expect(screen.getAllByText(/50,000/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/1,50,000/)).toBeInTheDocument();  // Balance
  });

  it("fires onContractClick when an active contract row is clicked", () => {
    const onContractClick = vi.fn();
    const trade = makeTrade({
      contracts: [
        {
          id: "k1",
          siteId: "s1",
          tradeCategoryId: "p1",
          title: "Asis Painting",
          laborTrackingMode: "mesthri_only",
          isInHouse: false,
          contractType: "mesthri",
          status: "active",
          totalValue: 250000,
          mesthriOrSpecialistName: "Asis Mesthri",
          createdAt: "2026-05-02T00:00:00Z",
        },
      ],
    });
    render(
      <TradeCard
        trade={trade}
        onContractClick={onContractClick}
        onAddClick={() => {}}
      />
    );
    fireEvent.click(screen.getByText(/asis mesthri/i));
    expect(onContractClick).toHaveBeenCalledWith("k1");
  });

  it("labels in-house Civil contracts as 'In-house' rather than a mesthri name", () => {
    const trade = makeTrade({
      category: {
        id: "c1",
        name: "Civil",
        isSystemSeed: true,
        isActive: true,
      },
      contracts: [
        {
          id: "k0",
          siteId: "s1",
          tradeCategoryId: "c1",
          title: "Civil — In-house",
          laborTrackingMode: "detailed",
          isInHouse: true,
          contractType: "mesthri",
          status: "active",
          totalValue: 0,
          mesthriOrSpecialistName: null,
          createdAt: "2026-05-02T00:00:00Z",
        },
      ],
    });
    render(
      <TradeCard
        trade={trade}
        onContractClick={() => {}}
        onAddClick={() => {}}
      />
    );
    expect(screen.getByText(/in-house/i)).toBeInTheDocument();
  });
});
