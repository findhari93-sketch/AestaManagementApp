import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScopeChip from "./ScopeChip";
import * as DateRangeModule from "@/contexts/DateRangeContext";

function mockUseDateRange(overrides: Partial<ReturnType<typeof DateRangeModule.useDateRange>>) {
  vi.spyOn(DateRangeModule, "useDateRange").mockReturnValue({
    startDate: null,
    endDate: null,
    label: "All Time",
    isAllTime: true,
    days: null,
    pickerOpen: false,
    setAllTime: vi.fn(),
    setDateRange: vi.fn(),
    setToday: vi.fn(),
    setLastWeek: vi.fn(),
    setLastMonth: vi.fn(),
    setMonth: vi.fn(),
    stepBackward: vi.fn(),
    stepForward: vi.fn(),
    openPicker: vi.fn(),
    closePicker: vi.fn(),
    formatForApi: () => ({ dateFrom: null, dateTo: null }),
    ...overrides,
  } as ReturnType<typeof DateRangeModule.useDateRange>);
}

describe("ScopeChip", () => {
  it("renders 'All Time' with no clear button when isAllTime is true", () => {
    mockUseDateRange({ isAllTime: true, label: "All Time" });
    render(<ScopeChip />);
    expect(screen.getByText(/All Time/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/clear date filter/i)).toBeNull();
  });

  it("renders the range, day count, and clear button when a filter is active", () => {
    mockUseDateRange({
      isAllTime: false,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-25"),
      label: "This Month",
      days: 25,
    });
    render(<ScopeChip />);
    expect(screen.getByText(/Apr 1.*Apr 25/i)).toBeInTheDocument();
    expect(screen.getByText(/25 days/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/clear date filter and show all time/i)
    ).toBeInTheDocument();
  });

  it("renders single-day labels without a date range dash", () => {
    mockUseDateRange({
      isAllTime: false,
      startDate: new Date("2026-04-24"),
      endDate: new Date("2026-04-24"),
      label: "Today",
      days: 1,
    });
    render(<ScopeChip />);
    expect(screen.queryByText("–")).toBeNull();
    expect(screen.getByText(/1 day/i)).toBeInTheDocument();
  });

  it("calls setAllTime when the clear button is clicked", () => {
    const setAllTime = vi.fn();
    mockUseDateRange({
      isAllTime: false,
      startDate: new Date("2026-04-17"),
      endDate: new Date("2026-04-24"),
      label: "Last 7 days",
      days: 8,
      setAllTime,
    });
    render(<ScopeChip />);
    fireEvent.click(
      screen.getByLabelText(/clear date filter and show all time/i)
    );
    expect(setAllTime).toHaveBeenCalledTimes(1);
  });

  it("crosses-year ranges include both years", () => {
    mockUseDateRange({
      isAllTime: false,
      startDate: new Date("2025-12-20"),
      endDate: new Date("2026-01-05"),
      label: "Custom range",
      days: 17,
    });
    render(<ScopeChip />);
    expect(screen.getByText(/Dec 20, 2025/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 5, 2026/)).toBeInTheDocument();
  });

  it("calls openPicker when the chip body is clicked", () => {
    const openPicker = vi.fn();
    mockUseDateRange({
      isAllTime: false,
      startDate: new Date("2026-04-17"),
      endDate: new Date("2026-04-24"),
      label: "Last 7 days",
      days: 8,
      openPicker,
    });
    render(<ScopeChip />);
    fireEvent.click(screen.getByRole("status"));
    expect(openPicker).toHaveBeenCalledTimes(1);
  });

  it("calls openPicker when the All Time chip is clicked", () => {
    const openPicker = vi.fn();
    mockUseDateRange({ isAllTime: true, label: "All Time", openPicker });
    render(<ScopeChip />);
    fireEvent.click(screen.getByRole("status"));
    expect(openPicker).toHaveBeenCalledTimes(1);
  });
});
