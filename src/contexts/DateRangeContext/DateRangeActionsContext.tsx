"use client";

import { createContext, useContext } from "react";

/**
 * Context for date range actions
 * These are stable functions that never change
 */
interface DateRangeActionsContextType {
  setDateRange: (start: Date | null, end: Date | null) => void;
  setToday: () => void;
  setLastWeek: () => void;
  setLastMonth: () => void;
  setAllTime: () => void;
  /** Set date range to a specific month (0-indexed month, e.g. 0=January) */
  setMonth: (year: number, month: number) => void;
  /** Step backward using hybrid semantics (week-aligned → 7 days, calendar-month → 1 month, else → 1 month) */
  stepBackward: (minDate: Date | null) => void;
  /** Step forward using hybrid semantics (week-aligned → 7 days, calendar-month → 1 month, else → 1 month) */
  stepForward: (minDate: Date | null) => void;
  /** Open the date range picker popover */
  openPicker: () => void;
  /** Close the date range picker popover */
  closePicker: () => void;
  /**
   * Register a DOM element as the picker popover's portal container, or pass
   * null to clear it. Used by pages that put the picker inside a fullscreened
   * DOM subtree so the popover stays visible. Pages MUST clear it on unmount.
   */
  setPickerContainer: (el: HTMLElement | null) => void;
}

export const DateRangeActionsContext = createContext<
  DateRangeActionsContextType | undefined
>(undefined);

export function useDateRangeActions() {
  const context = useContext(DateRangeActionsContext);
  if (context === undefined) {
    throw new Error(
      "useDateRangeActions must be used within a DateRangeProvider"
    );
  }
  return context;
}
