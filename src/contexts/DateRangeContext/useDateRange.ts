/**
 * Backwards compatibility hook
 *
 * Returns all date range context data in one object.
 * Components using this will re-render whenever the date range changes.
 *
 * For better performance with actions-only, use:
 * - useDateRangeActions() - never re-renders
 */

import { useDateRangeData } from "./DateRangeDataContext";
import { useDateRangeActions } from "./DateRangeActionsContext";

export function useDateRange() {
  const { startDate, endDate, formatForApi, isAllTime, label, days, pickerOpen } =
    useDateRangeData();
  const { setDateRange, setToday, setLastWeek, setLastMonth, setAllTime, setMonth, stepBackward, stepForward, openPicker, closePicker } =
    useDateRangeActions();

  return {
    startDate,
    endDate,
    setDateRange,
    setToday,
    setLastWeek,
    setLastMonth,
    setAllTime,
    setMonth,
    stepBackward,
    stepForward,
    openPicker,
    closePicker,
    formatForApi,
    isAllTime,
    label,
    days,
    pickerOpen,
  };
}
