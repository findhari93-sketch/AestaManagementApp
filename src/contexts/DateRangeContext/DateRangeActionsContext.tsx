"use client";

import { createContext, useContext } from "react";

/**
 * Context for date range actions
 * These are stable functions that never change
 */
interface DateRangeActionsContextType {
  setDateRange: (start: Date | null, end: Date | null) => void;
  setLastWeek: () => void;
  setLastMonth: () => void;
  setAllTime: () => void;
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
