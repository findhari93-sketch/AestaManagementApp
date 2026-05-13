"use client";

import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useSiteFinancialSummary } from "./useSiteFinancialSummary";
import type { ExpenseRow } from "./useExpensesData";

dayjs.extend(isoWeek);

export interface BurnRateResult {
  burnPerWeek: number;
  burnTrend: number[]; // 8 values, oldest → newest
  runwayWeeks: number | null;
}

/** Client-side burn rate from already-loaded expense rows. */
export function computeBurnRate(
  expenses: ExpenseRow[],
  totalRemaining?: number,
): BurnRateResult {
  if (expenses.length === 0) {
    return { burnPerWeek: 0, burnTrend: new Array(8).fill(0), runwayWeeks: null };
  }

  const now = dayjs();
  const weeklyTotals: number[] = [];

  for (let i = 7; i >= 0; i--) {
    const weekStart = now.subtract(i, "week").startOf("isoWeek");
    const weekEnd = weekStart.endOf("isoWeek");
    const weekTotal = expenses
      .filter((e) => {
        const d = dayjs(e.date);
        return (
          d.isAfter(weekStart.subtract(1, "day")) &&
          d.isBefore(weekEnd.add(1, "day"))
        );
      })
      .reduce((sum, e) => sum + e.amount, 0);
    weeklyTotals.push(weekTotal);
  }

  // 4-week average over the most recent 4 weeks
  const last4 = weeklyTotals.slice(-4);
  const nonZero = last4.filter((w) => w > 0);
  const burnPerWeek =
    nonZero.length > 0
      ? Math.round(nonZero.reduce((s, w) => s + w, 0) / nonZero.length)
      : 0;

  const runwayWeeks =
    burnPerWeek > 0 && totalRemaining != null && totalRemaining > 0
      ? Math.round(totalRemaining / burnPerWeek)
      : null;

  return { burnPerWeek, burnTrend: weeklyTotals, runwayWeeks };
}

/** Thin wrapper around useSiteFinancialSummary for use in the expenses page. */
export function useExpensePageKPIs(siteId: string | undefined) {
  return useSiteFinancialSummary(siteId);
}
