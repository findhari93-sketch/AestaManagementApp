/**
 * Calculation utility functions for the Attendance feature
 */

import type { DateSummary } from "../types";

export interface PeriodTotals {
  totalSalary: number;
  totalTeaShop: number;
  totalExpense: number;
  totalLaborers: number;
  avgPerDay: number;
  totalPaidCount: number;
  totalPendingCount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
  totalDailyAmount: number;
  totalContractAmount: number;
  totalMarketAmount: number;
}

/**
 * Calculate aggregate totals for a period from date summaries
 * @param dateSummaries - Array of daily summaries
 * @returns Aggregated totals for the period
 */
export function calculatePeriodTotals(dateSummaries: DateSummary[]): PeriodTotals {
  let totalSalary = 0;
  let totalTeaShop = 0;
  let totalLaborers = 0;
  let totalPaidCount = 0;
  let totalPendingCount = 0;
  let totalPaidAmount = 0;
  let totalPendingAmount = 0;
  // Laborer type amounts
  let totalDailyAmount = 0;
  let totalContractAmount = 0;
  let totalMarketAmount = 0;

  dateSummaries.forEach((s) => {
    totalSalary += s.totalSalary;
    totalTeaShop += s.teaShop?.total || 0;
    totalLaborers += s.totalLaborerCount;
    totalPaidCount += s.paidCount;
    totalPendingCount += s.pendingCount;
    totalPaidAmount += s.paidAmount;
    totalPendingAmount += s.pendingAmount;
    // Laborer type amounts
    totalDailyAmount += s.dailyLaborerAmount;
    totalContractAmount += s.contractLaborerAmount;
    totalMarketAmount += s.marketLaborerAmount;
  });

  const totalExpense = totalSalary + totalTeaShop;

  return {
    totalSalary,
    totalTeaShop,
    totalExpense,
    totalLaborers,
    avgPerDay: dateSummaries.length > 0 ? totalExpense / dateSummaries.length : 0,
    // Payment breakdown
    totalPaidCount,
    totalPendingCount,
    totalPaidAmount,
    totalPendingAmount,
    // Laborer type totals
    totalDailyAmount,
    totalContractAmount,
    totalMarketAmount,
  };
}

/**
 * Calculate day units based on work hours
 * @param workHours - Number of hours worked
 * @returns Day units (0, 0.5, or 1)
 */
export function calculateDayUnits(workHours: number | null): number {
  if (!workHours) return 0;
  if (workHours >= 8) return 1;
  if (workHours >= 4) return 0.5;
  return 0;
}

/**
 * Calculate earnings based on day units and rate
 * @param dayUnits - Number of day units (0, 0.5, or 1)
 * @param dailyRate - Daily rate amount
 * @returns Calculated earnings
 */
export function calculateEarnings(dayUnits: number, dailyRate: number): number {
  return dayUnits * dailyRate;
}
