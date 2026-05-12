import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SalarySliceHero } from "./SalarySliceHero";

// MobileCollapsibleHero defaults to collapsed; expand it before each assertion
// by clicking the "Expand summary" toggle button. Labels matching the current
// statusLabel can appear twice (once in the header bar, once inside the KPI
// tile grid), so we use getAllByText for those and assert length >= 1.
function expand() {
  fireEvent.click(screen.getByRole("button", { name: /expand summary/i }));
}

describe("SalarySliceHero", () => {
  const baseSummary = {
    wagesDue: 234400,
    settlementsTotal: 182400,
    advancesTotal: 43400,
    paidToWeeks: 182400,
    futureCredit: 0,
    mestriOwed: 52000,
    weeksCount: 12,
    settlementCount: 8,
    advanceCount: 5,
  };

  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  it("renders the five KPI labels with Indian-formatted values", () => {
    render(<SalarySliceHero summary={baseSummary} isLoading={false} />);
    expand();
    expect(screen.getByText("Wages Due")).toBeInTheDocument();
    expect(screen.getByText("Paid (waterfall)")).toBeInTheDocument();
    expect(screen.getByText("Advances")).toBeInTheDocument();
    expect(screen.getByText("Total Paid")).toBeInTheDocument();
    // "Mestri Owed" appears in both the collapsed header status label AND in the KPI tile
    expect(screen.getAllByText("Mestri Owed").length).toBeGreaterThan(0);
    expect(screen.getByText("₹2,34,400")).toBeInTheDocument();
  });

  it("shows 'Excess Paid' label when futureCredit > 0", () => {
    render(
      <SalarySliceHero
        summary={{ ...baseSummary, futureCredit: 4000, mestriOwed: 0 }}
        isLoading={false}
      />
    );
    expand();
    expect(screen.getAllByText("Excess Paid").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mestri Owed")).not.toBeInTheDocument();
  });

  it("shows 'Settled' label when both mestriOwed and futureCredit are zero", () => {
    render(
      <SalarySliceHero
        summary={{ ...baseSummary, mestriOwed: 0, futureCredit: 0 }}
        isLoading={false}
      />
    );
    expand();
    expect(screen.getAllByText("Settled").length).toBeGreaterThan(0);
  });

  it("renders skeleton placeholders when isLoading", () => {
    // Loading state bypasses MobileCollapsibleHero entirely and renders the
    // skeleton grid inline, so no expand() click is needed.
    render(<SalarySliceHero summary={undefined} isLoading={true} />);
    expect(screen.getAllByTestId("kpi-skeleton")).toHaveLength(5);
  });

  it("renders progress percentage from paidToWeeks/wagesDue", () => {
    render(<SalarySliceHero summary={baseSummary} isLoading={false} />);
    expand();
    // 78% appears in the collapsed header progress bar as well as in the expanded view
    expect(screen.getAllByText("78%").length).toBeGreaterThan(0);
  });
});
