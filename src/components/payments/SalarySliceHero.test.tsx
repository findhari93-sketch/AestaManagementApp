import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SalarySliceHero } from "./SalarySliceHero";

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

  it("renders the five KPI labels with Indian-formatted values", () => {
    render(<SalarySliceHero summary={baseSummary} isLoading={false} />);
    expect(screen.getByText("Wages Due")).toBeInTheDocument();
    expect(screen.getByText("Paid (waterfall)")).toBeInTheDocument();
    expect(screen.getByText("Advances")).toBeInTheDocument();
    expect(screen.getByText("Total Paid")).toBeInTheDocument();
    expect(screen.getByText("Mestri Owed")).toBeInTheDocument();
    expect(screen.getByText("₹2,34,400")).toBeInTheDocument();
  });

  it("shows 'Excess Paid' label when futureCredit > 0", () => {
    render(
      <SalarySliceHero
        summary={{ ...baseSummary, futureCredit: 4000, mestriOwed: 0 }}
        isLoading={false}
      />
    );
    expect(screen.getByText("Excess Paid")).toBeInTheDocument();
    expect(screen.queryByText("Mestri Owed")).not.toBeInTheDocument();
  });

  it("shows 'Settled' label when both mestriOwed and futureCredit are zero", () => {
    render(
      <SalarySliceHero
        summary={{ ...baseSummary, mestriOwed: 0, futureCredit: 0 }}
        isLoading={false}
      />
    );
    expect(screen.getByText("Settled")).toBeInTheDocument();
  });

  it("renders skeleton placeholders when isLoading", () => {
    render(<SalarySliceHero summary={undefined} isLoading={true} />);
    expect(screen.getAllByTestId("kpi-skeleton")).toHaveLength(5);
  });

  it("renders progress percentage from paidToWeeks/wagesDue", () => {
    render(<SalarySliceHero summary={baseSummary} isLoading={false} />);
    expect(screen.getByText("78%")).toBeInTheDocument();
  });
});
