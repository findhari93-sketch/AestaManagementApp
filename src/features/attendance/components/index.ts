/**
 * Attendance Components
 *
 * Extracted from the 6779-line attendance-content.tsx file
 * for better maintainability and performance.
 */

// Period summary stats bar
export { default as PeriodSummary } from "./PeriodSummary";
export type { PeriodTotals } from "./PeriodSummary";

// Floating action button for adding attendance
export { default as AttendanceSpeedDial } from "./AttendanceSpeedDial";

// Tea shop expense popover
export { default as TeaShopPopover } from "./TeaShopPopover";
export type { TeaShopPopoverData } from "./TeaShopPopover";

// Table row components
export { default as HolidayGroupRow } from "./HolidayGroupRow";
export { default as UnfilledGroupRow } from "./UnfilledGroupRow";
export { default as WeeklySeparatorRow } from "./WeeklySeparatorRow";
export type { WeeklySummary } from "./WeeklySeparatorRow";

// Dialog components
export { default as EditAttendanceDialog } from "./EditAttendanceDialog";
export { default as EditMarketLaborerDialog } from "./EditMarketLaborerDialog";
export { default as DeleteConfirmDialog } from "./DeleteConfirmDialog";
export type { DeleteDialogData } from "./DeleteConfirmDialog";

// UI components
export { default as StatCard } from "./StatCard";
