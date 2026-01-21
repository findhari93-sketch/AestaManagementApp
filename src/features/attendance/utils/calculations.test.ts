import { describe, it, expect } from 'vitest';
import {
  calculatePeriodTotals,
  calculateDayUnits,
  calculateEarnings,
  type PeriodTotals,
} from './calculations';
import type { DateSummary } from '../types';

describe('Attendance Calculations', () => {
  describe('calculateDayUnits', () => {
    it('returns 0 for null work hours', () => {
      expect(calculateDayUnits(null)).toBe(0);
    });

    it('returns 0 for 0 work hours', () => {
      expect(calculateDayUnits(0)).toBe(0);
    });

    it('returns 0 for less than 4 hours', () => {
      expect(calculateDayUnits(3)).toBe(0);
      expect(calculateDayUnits(3.9)).toBe(0);
    });

    it('returns 0.5 for 4-7.9 hours (half day)', () => {
      expect(calculateDayUnits(4)).toBe(0.5);
      expect(calculateDayUnits(6)).toBe(0.5);
      expect(calculateDayUnits(7.9)).toBe(0.5);
    });

    it('returns 1 for 8+ hours (full day)', () => {
      expect(calculateDayUnits(8)).toBe(1);
      expect(calculateDayUnits(10)).toBe(1);
      expect(calculateDayUnits(12)).toBe(1);
    });
  });

  describe('calculateEarnings', () => {
    const DAILY_RATE = 800;

    it('returns 0 for 0 day units', () => {
      expect(calculateEarnings(0, DAILY_RATE)).toBe(0);
    });

    it('returns half rate for 0.5 day units', () => {
      expect(calculateEarnings(0.5, DAILY_RATE)).toBe(400);
    });

    it('returns full rate for 1 day unit', () => {
      expect(calculateEarnings(1, DAILY_RATE)).toBe(800);
    });

    it('handles decimal day units correctly', () => {
      expect(calculateEarnings(0.25, 1000)).toBe(250);
    });
  });

  describe('calculatePeriodTotals', () => {
    const createMockDateSummary = (overrides: Partial<DateSummary> = {}): DateSummary => ({
      date: '2024-01-15',
      records: [],
      marketLaborers: [],
      dailyLaborerCount: 5,
      contractLaborerCount: 2,
      marketLaborerCount: 3,
      totalLaborerCount: 10,
      firstInTime: '08:00',
      lastOutTime: '17:00',
      totalSalary: 5000,
      totalSnacks: 500,
      totalExpense: 5500,
      dailyLaborerAmount: 2500,
      contractLaborerAmount: 1500,
      marketLaborerAmount: 1000,
      paidCount: 6,
      pendingCount: 4,
      paidAmount: 3000,
      pendingAmount: 2000,
      teaShop: {
        teaTotal: 200,
        snacksTotal: 300,
        total: 500,
        workingCount: 8,
        workingTotal: 400,
        nonWorkingCount: 2,
        nonWorkingTotal: 100,
        marketCount: 0,
        marketTotal: 0,
      },
      ...overrides,
    } as DateSummary);

    it('returns zero totals for empty array', () => {
      const result = calculatePeriodTotals([]);

      expect(result.totalSalary).toBe(0);
      expect(result.totalTeaShop).toBe(0);
      expect(result.totalExpense).toBe(0);
      expect(result.totalLaborers).toBe(0);
      expect(result.avgPerDay).toBe(0);
    });

    it('calculates totals correctly for single day', () => {
      const dateSummaries = [createMockDateSummary()];
      const result = calculatePeriodTotals(dateSummaries);

      expect(result.totalSalary).toBe(5000);
      expect(result.totalTeaShop).toBe(500);
      expect(result.totalExpense).toBe(5500);
      expect(result.totalLaborers).toBe(10);
      expect(result.avgPerDay).toBe(5500);
    });

    it('aggregates totals across multiple days', () => {
      const dateSummaries = [
        createMockDateSummary({ totalSalary: 5000, totalLaborerCount: 10 }),
        createMockDateSummary({ totalSalary: 6000, totalLaborerCount: 12 }),
        createMockDateSummary({ totalSalary: 4000, totalLaborerCount: 8 }),
      ];
      const result = calculatePeriodTotals(dateSummaries);

      expect(result.totalSalary).toBe(15000);
      expect(result.totalLaborers).toBe(30);
    });

    it('calculates payment breakdown correctly', () => {
      const dateSummaries = [
        createMockDateSummary({ paidCount: 5, pendingCount: 3, paidAmount: 2500, pendingAmount: 1500 }),
        createMockDateSummary({ paidCount: 7, pendingCount: 2, paidAmount: 3500, pendingAmount: 1000 }),
      ];
      const result = calculatePeriodTotals(dateSummaries);

      expect(result.totalPaidCount).toBe(12);
      expect(result.totalPendingCount).toBe(5);
      expect(result.totalPaidAmount).toBe(6000);
      expect(result.totalPendingAmount).toBe(2500);
    });

    it('calculates laborer type totals correctly', () => {
      const dateSummaries = [
        createMockDateSummary({ dailyLaborerAmount: 2000, contractLaborerAmount: 1500, marketLaborerAmount: 1000 }),
        createMockDateSummary({ dailyLaborerAmount: 2500, contractLaborerAmount: 2000, marketLaborerAmount: 500 }),
      ];
      const result = calculatePeriodTotals(dateSummaries);

      expect(result.totalDailyAmount).toBe(4500);
      expect(result.totalContractAmount).toBe(3500);
      expect(result.totalMarketAmount).toBe(1500);
    });

    it('handles null teaShop gracefully', () => {
      const dateSummaries = [
        createMockDateSummary({ teaShop: null as unknown as DateSummary['teaShop'] }),
      ];
      const result = calculatePeriodTotals(dateSummaries);

      expect(result.totalTeaShop).toBe(0);
    });

    it('calculates average per day correctly', () => {
      const dateSummaries = [
        createMockDateSummary({
          totalSalary: 5000,
          teaShop: { teaTotal: 200, snacksTotal: 300, total: 500, workingCount: 8, workingTotal: 400, nonWorkingCount: 2, nonWorkingTotal: 100, marketCount: 0, marketTotal: 0 },
        }),
        createMockDateSummary({
          totalSalary: 6000,
          teaShop: { teaTotal: 250, snacksTotal: 350, total: 600, workingCount: 10, workingTotal: 500, nonWorkingCount: 2, nonWorkingTotal: 100, marketCount: 0, marketTotal: 0 },
        }),
      ];
      const result = calculatePeriodTotals(dateSummaries);

      // Total expense = (5000 + 500) + (6000 + 600) = 12100
      // Avg = 12100 / 2 = 6050
      expect(result.avgPerDay).toBe(6050);
    });
  });
});
