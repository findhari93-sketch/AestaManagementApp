"use client";

/**
 * Attendance Feature Module
 *
 * This is the main entry point for the refactored attendance feature.
 * It exports all components, hooks, types, and utilities for use in the application.
 *
 * Usage:
 * import { PeriodSummary, useAttendanceState } from '@/features/attendance';
 *
 * Phase 4 Integration Status:
 * - Components: 10 extracted, ready for use
 * - Hooks: useAttendanceState created (not yet integrated)
 * - Types: Extracted to separate files
 * - Utils: Formatters and calculations extracted
 */

// Re-export all components (includes component-specific types)
export * from "./components";

// Re-export hooks
export { useAttendanceState } from "./hooks/useAttendanceState";
export { attendanceReducer, initialAttendanceState } from "./hooks/attendanceReducer";

// Re-export types explicitly to avoid conflicts with component exports
export type {
  AttendanceContentProps,
  AttendanceRecord,
  TeaShopData,
  MarketLaborerRecord,
  DateSummary,
  // Note: WeeklySummary is already exported from components/WeeklySeparatorRow
  ViewMode,
  DrawerMode,
  HolidayDialogMode,
} from "./types";
export type { AttendanceState, AttendanceAction } from "./hooks/attendanceState.types";

// Re-export utilities explicitly to avoid conflicts
export {
  formatCurrency,
  formatTime,
  formatLaborerCount,
  getProgressColor,
} from "./utils/formatters";
export {
  calculatePeriodTotals,
  // Note: PeriodTotals type is already exported from components/PeriodSummary
} from "./utils/calculations";
