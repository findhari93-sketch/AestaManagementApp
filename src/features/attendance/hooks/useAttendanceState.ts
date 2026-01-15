/**
 * Main hook for Attendance state management
 * Provides centralized state using useReducer
 */

import { useReducer, useCallback, useEffect } from "react";
import { attendanceReducer, initialAttendanceState } from "./attendanceReducer";
import type { AttendanceState, AttendanceAction } from "./attendanceState.types";

/**
 * Custom hook for attendance state management
 * Replaces 56 useState hooks with single useReducer + action helpers
 *
 * @returns State and dispatch function with helper methods
 */
export function useAttendanceState() {
  const [state, dispatch] = useReducer(attendanceReducer, initialAttendanceState);

  // Initialize showHolidays from sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("attendance_showHolidays");
        if (stored !== null) {
          dispatch({ type: "SET_SHOW_HOLIDAYS", payload: stored === "true" });
        }
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  // Persist showHolidays to sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("attendance_showHolidays", String(state.showHolidays));
      } catch {
        // Ignore storage errors
      }
    }
  }, [state.showHolidays]);

  // Action helper methods (memoized to prevent unnecessary re-renders)
  const actions = {
    // Data actions
    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: "SET_LOADING", payload: loading });
    }, []),

    setAttendanceRecords: useCallback((records: AttendanceState["attendanceRecords"]) => {
      dispatch({ type: "SET_ATTENDANCE_RECORDS", payload: records });
    }, []),

    setDateSummaries: useCallback((summaries: AttendanceState["dateSummaries"]) => {
      dispatch({ type: "SET_DATE_SUMMARIES", payload: summaries });
    }, []),

    setWorkSummaries: useCallback((summaries: AttendanceState["workSummaries"]) => {
      dispatch({ type: "SET_WORK_SUMMARIES", payload: summaries });
    }, []),

    setHighlightedDate: useCallback((date: string | null) => {
      dispatch({ type: "SET_HIGHLIGHTED_DATE", payload: date });
    }, []),

    setCameFromSettlement: useCallback((value: boolean) => {
      dispatch({ type: "SET_CAME_FROM_SETTLEMENT", payload: value });
    }, []),

    clearAttendanceData: useCallback(() => {
      dispatch({ type: "CLEAR_ATTENDANCE_DATA" });
    }, []),

    // View actions
    setViewMode: useCallback((mode: AttendanceState["viewMode"]) => {
      dispatch({ type: "SET_VIEW_MODE", payload: mode });
    }, []),

    toggleSummaryExpanded: useCallback(() => {
      dispatch({ type: "TOGGLE_SUMMARY_EXPANDED" });
    }, []),

    setShowHolidays: useCallback((show: boolean) => {
      dispatch({ type: "SET_SHOW_HOLIDAYS", payload: show });
    }, []),

    setSpeedDialOpen: useCallback((open: boolean) => {
      dispatch({ type: "SET_SPEED_DIAL_OPEN", payload: open });
    }, []),

    // Drawer actions
    openDrawer: useCallback((mode: AttendanceState["drawerMode"], date?: string) => {
      dispatch({ type: "OPEN_DRAWER", payload: { mode, date } });
    }, []),

    closeDrawer: useCallback(() => {
      dispatch({ type: "CLOSE_DRAWER" });
    }, []),

    setDrawerMode: useCallback((mode: AttendanceState["drawerMode"]) => {
      dispatch({ type: "SET_DRAWER_MODE", payload: mode });
    }, []),

    // Edit dialog actions
    openEditDialog: useCallback((record: AttendanceState["attendanceRecords"][0]) => {
      dispatch({ type: "OPEN_EDIT_DIALOG", payload: record });
    }, []),

    closeEditDialog: useCallback(() => {
      dispatch({ type: "CLOSE_EDIT_DIALOG" });
    }, []),

    updateEditForm: useCallback((updates: Partial<AttendanceState["editDialog"]["form"]>) => {
      dispatch({ type: "UPDATE_EDIT_FORM", payload: updates });
    }, []),

    // Payment dialog actions
    openPaymentDialog: useCallback((records: AttendanceState["paymentDialog"]["records"]) => {
      dispatch({ type: "OPEN_PAYMENT_DIALOG", payload: records });
    }, []),

    closePaymentDialog: useCallback(() => {
      dispatch({ type: "CLOSE_PAYMENT_DIALOG" });
    }, []),

    // Tea shop actions (simplified interface)
    openTeaShopPopover: useCallback((anchor: HTMLElement, date: string, data: any) => {
      dispatch({ type: "OPEN_TEA_SHOP_POPOVER", payload: { anchor, date, data } });
    }, []),

    closeTeaShopPopover: useCallback(() => {
      dispatch({ type: "CLOSE_TEA_SHOP_POPOVER" });
    }, []),

    openTeaShopDialog: useCallback((date: string, account: any) => {
      dispatch({ type: "OPEN_TEA_SHOP_DIALOG", payload: { date, account } });
    }, []),

    closeTeaShopDialog: useCallback(() => {
      dispatch({ type: "CLOSE_TEA_SHOP_DIALOG" });
    }, []),

    // Work update viewer actions
    openWorkUpdateViewer: useCallback((workUpdates: any, date: string) => {
      dispatch({ type: "OPEN_WORK_UPDATE_VIEWER", payload: { workUpdates, date } });
    }, []),

    closeWorkUpdateViewer: useCallback(() => {
      dispatch({ type: "CLOSE_WORK_UPDATE_VIEWER" });
    }, []),

    // Delete dialog actions
    openDeleteDialog: useCallback((data: NonNullable<AttendanceState["deleteDialog"]["data"]>) => {
      dispatch({ type: "OPEN_DELETE_DIALOG", payload: data });
    }, []),

    closeDeleteDialog: useCallback(() => {
      dispatch({ type: "CLOSE_DELETE_DIALOG" });
    }, []),

    // Holiday actions
    openHolidayDialog: useCallback((mode: AttendanceState["holiday"]["dialogMode"], date?: string, holiday?: any) => {
      dispatch({ type: "OPEN_HOLIDAY_DIALOG", payload: { mode, date, holiday } });
    }, []),

    closeHolidayDialog: useCallback(() => {
      dispatch({ type: "CLOSE_HOLIDAY_DIALOG" });
    }, []),

    setTodayHoliday: useCallback((holiday: AttendanceState["holiday"]["todayHoliday"]) => {
      dispatch({ type: "SET_TODAY_HOLIDAY", payload: holiday });
    }, []),

    setRecentHolidays: useCallback((holidays: AttendanceState["holiday"]["recentHolidays"]) => {
      dispatch({ type: "SET_RECENT_HOLIDAYS", payload: holidays });
    }, []),

    // Summary view actions
    openSummaryView: useCallback((date: string) => {
      dispatch({ type: "OPEN_SUMMARY_VIEW", payload: date });
    }, []),

    closeSummaryView: useCallback(() => {
      dispatch({ type: "CLOSE_SUMMARY_VIEW" });
    }, []),

    toggleSummaryTableFullscreen: useCallback(() => {
      dispatch({ type: "TOGGLE_SUMMARY_TABLE_FULLSCREEN" });
    }, []),

    openSummaryPhotoFullscreen: useCallback((photos: any[], index: number, period: "morning" | "evening") => {
      dispatch({ type: "OPEN_SUMMARY_PHOTO_FULLSCREEN", payload: { photos, index, period } });
    }, []),

    closeSummaryPhotoFullscreen: useCallback(() => {
      dispatch({ type: "CLOSE_SUMMARY_PHOTO_FULLSCREEN" });
    }, []),

    // Settlement actions
    openSettlementDialog: useCallback((config: any) => {
      dispatch({ type: "OPEN_SETTLEMENT_DIALOG", payload: config });
    }, []),

    closeSettlementDialog: useCallback(() => {
      dispatch({ type: "CLOSE_SETTLEMENT_DIALOG" });
    }, []),

    // Market laborer edit actions
    openMarketLaborerEdit: useCallback((record: any) => {
      dispatch({ type: "OPEN_MARKET_LABORER_EDIT", payload: record });
    }, []),

    closeMarketLaborerEdit: useCallback(() => {
      dispatch({ type: "CLOSE_MARKET_LABORER_EDIT" });
    }, []),

    updateMarketLaborerForm: useCallback((updates: Partial<AttendanceState["marketLaborerEdit"]["form"]>) => {
      dispatch({ type: "UPDATE_MARKET_LABORER_FORM", payload: updates });
    }, []),

    // Notification actions
    setRestorationMessage: useCallback((message: string | null) => {
      dispatch({ type: "SET_RESTORATION_MESSAGE", payload: message });
    }, []),

    openPaidRecordDialog: useCallback((data: NonNullable<AttendanceState["notifications"]["paidRecordDialog"]>) => {
      dispatch({ type: "OPEN_PAID_RECORD_DIALOG", payload: data });
    }, []),

    closePaidRecordDialog: useCallback(() => {
      dispatch({ type: "CLOSE_PAID_RECORD_DIALOG" });
    }, []),

    // Unfilled dates actions
    toggleUnfilledGroup: useCallback((groupId: string) => {
      dispatch({ type: "TOGGLE_UNFILLED_GROUP", payload: groupId });
    }, []),

    openUnfilledActionDialog: useCallback((date: string, isHoliday?: boolean) => {
      dispatch({ type: "OPEN_UNFILLED_ACTION_DIALOG", payload: { date, isHoliday } });
    }, []),

    closeUnfilledActionDialog: useCallback(() => {
      dispatch({ type: "CLOSE_UNFILLED_ACTION_DIALOG" });
    }, []),
  };

  return {
    state,
    dispatch,
    actions,
  };
}

// Type exports for convenience
export type { AttendanceState, AttendanceAction };
