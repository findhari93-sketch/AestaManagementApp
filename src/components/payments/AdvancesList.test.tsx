import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdvancesList } from "./AdvancesList";

const advances = [
  {
    id: "1",
    settlementRef: "SET-260403-001",
    date: "2026-04-03",
    forLabel: "Krishnan · medical advance",
    amount: 15000,
    laborerId: "lab-1",
  },
  {
    id: "2",
    settlementRef: "SET-260411-001",
    date: "2026-04-11",
    forLabel: "Murugan · personal",
    amount: 12000,
    laborerId: "lab-2",
  },
];

describe("AdvancesList", () => {
  it("renders one row per advance with formatted amount", () => {
    render(<AdvancesList advances={advances} isLoading={false} onRowClick={vi.fn()} />);
    expect(screen.getByText("SET-260403-001")).toBeInTheDocument();
    expect(screen.getByText("₹15,000")).toBeInTheDocument();
    expect(screen.getByText("Krishnan · medical advance")).toBeInTheDocument();
  });

  it("renders footer total summing all advances", () => {
    render(<AdvancesList advances={advances} isLoading={false} onRowClick={vi.fn()} />);
    expect(screen.getByText(/Total/i)).toBeInTheDocument();
    expect(screen.getByText("₹27,000")).toBeInTheDocument();
  });

  it("renders empty state when no advances", () => {
    render(<AdvancesList advances={[]} isLoading={false} onRowClick={vi.fn()} />);
    expect(screen.getByText(/No outside-waterfall advances/i)).toBeInTheDocument();
  });

  it("clicking a row calls onRowClick with that advance", () => {
    const onRow = vi.fn();
    render(<AdvancesList advances={advances} isLoading={false} onRowClick={onRow} />);
    fireEvent.click(screen.getByText("Krishnan · medical advance"));
    expect(onRow).toHaveBeenCalledWith(advances[0]);
  });
});
