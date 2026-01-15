"use client";

import { createContext, useContext } from "react";

/**
 * Context for date range data
 * This changes when user selects different date ranges
 */
interface DateRangeDataContextType {
  startDate: Date | null;
  endDate: Date | null;
  formatForApi: () => { dateFrom: string | null; dateTo: string | null };
  isAllTime: boolean;
  label: string;
}

export const DateRangeDataContext = createContext<
  DateRangeDataContextType | undefined
>(undefined);

export function useDateRangeData() {
  const context = useContext(DateRangeDataContext);
  if (context === undefined) {
    throw new Error("useDateRangeData must be used within a DateRangeProvider");
  }
  return context;
}
