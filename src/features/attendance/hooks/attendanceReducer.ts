/**
 * Reducer function for Attendance state management
 * Handles all state updates in a centralized, predictable way
 */

import type { AttendanceState, AttendanceAction } from "./attendanceState.types";

/**
 * Initial state for attendance feature
 */
export const initialAttendanceState: AttendanceState = {
  // Data state
  loading: false,
  attendanceRecords: [],
  dateSummaries: [],
  workSummaries: new Map(),
  highlightedDate: null,
  cameFromSettlement: false,

  // View state
  viewMode: "date-wise",
  summaryExpanded: false,
  showHolidays: true,
  speedDialOpen: false,

  // Drawer state
  drawerOpen: false,
  drawerMode: "full",
  selectedDateForDrawer: undefined,

  // Edit dialog state
  editDialog: {
    open: false,
    record: null,
    form: {
      work_days: 1,
      daily_rate_applied: 0,
    },
  },

  // Payment dialog state
  paymentDialog: {
    open: false,
    records: [],
  },

  // Tea shop state
  teaShop: {
    popoverAnchor: null,
    popoverData: null,
    dialogOpen: false,
    dialogDate: undefined,
    account: null,
    editingEntry: null,
    entryModeDialogOpen: false,
    groupDialogOpen: false,
    popoverGroupAllocations: null,
    editingGroupEntryData: null,
    editingTeaShop: null,
    editingSiteGroup: null,
  },

  // Work update viewer state
  workUpdateViewer: {
    open: false,
    selected: null,
  },

  // Delete dialog state
  deleteDialog: {
    open: false,
    data: null,
  },

  // Holiday state
  holiday: {
    dialogOpen: false,
    dialogMode: "add",
    todayHoliday: null,
    recentHolidays: [],
    selectedDate: null,
    selectedExisting: null,
  },

  // Unfilled dates state
  unfilledDates: {
    expandedGroups: new Set(),
    actionDialog: null,
  },

  // Summary view state
  summaryView: {
    date: null,
    tableFullscreen: false,
    photoFullscreen: false,
    fullscreenPhotos: [],
    photoIndex: 0,
    photoPeriod: "morning",
  },

  // Settlement dialog state
  settlement: {
    dialogOpen: false,
    config: null,
  },

  // Market laborer edit state
  marketLaborerEdit: {
    open: false,
    record: null,
    form: {
      count: 1,
      day_units: 1,
      rate_per_person: 0,
    },
  },

  // Notification state
  notifications: {
    restorationMessage: null,
    paidRecordDialog: null,
  },
};

/**
 * Attendance state reducer
 * Pure function that returns new state based on action
 */
export function attendanceReducer(
  state: AttendanceState,
  action: AttendanceAction
): AttendanceState {
  switch (action.type) {
    // Data actions
    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ATTENDANCE_RECORDS":
      return { ...state, attendanceRecords: action.payload };

    case "SET_DATE_SUMMARIES":
      return { ...state, dateSummaries: action.payload };

    case "SET_WORK_SUMMARIES":
      return { ...state, workSummaries: action.payload };

    case "SET_HIGHLIGHTED_DATE":
      return { ...state, highlightedDate: action.payload };

    case "SET_CAME_FROM_SETTLEMENT":
      return { ...state, cameFromSettlement: action.payload };

    case "CLEAR_ATTENDANCE_DATA":
      return {
        ...state,
        attendanceRecords: [],
        dateSummaries: [],
        workSummaries: new Map(),
        highlightedDate: null,
      };

    // View actions
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload };

    case "TOGGLE_SUMMARY_EXPANDED":
      return { ...state, summaryExpanded: !state.summaryExpanded };

    case "SET_SHOW_HOLIDAYS":
      return { ...state, showHolidays: action.payload };

    case "SET_SPEED_DIAL_OPEN":
      return { ...state, speedDialOpen: action.payload };

    // Drawer actions
    case "OPEN_DRAWER":
      return {
        ...state,
        drawerOpen: true,
        drawerMode: action.payload.mode,
        selectedDateForDrawer: action.payload.date,
      };

    case "CLOSE_DRAWER":
      return {
        ...state,
        drawerOpen: false,
        selectedDateForDrawer: undefined,
      };

    case "SET_DRAWER_MODE":
      return { ...state, drawerMode: action.payload };

    // Edit dialog actions
    case "OPEN_EDIT_DIALOG":
      return {
        ...state,
        editDialog: {
          open: true,
          record: action.payload,
          form: {
            work_days: action.payload.work_days,
            daily_rate_applied: action.payload.daily_rate_applied,
          },
        },
      };

    case "CLOSE_EDIT_DIALOG":
      return {
        ...state,
        editDialog: {
          ...state.editDialog,
          open: false,
          record: null,
        },
      };

    case "UPDATE_EDIT_FORM":
      return {
        ...state,
        editDialog: {
          ...state.editDialog,
          form: {
            ...state.editDialog.form,
            ...action.payload,
          },
        },
      };

    // Payment dialog actions
    case "OPEN_PAYMENT_DIALOG":
      return {
        ...state,
        paymentDialog: {
          open: true,
          records: action.payload,
        },
      };

    case "CLOSE_PAYMENT_DIALOG":
      return {
        ...state,
        paymentDialog: {
          ...state.paymentDialog,
          open: false,
          records: [],
        },
      };

    // Tea shop actions
    case "OPEN_TEA_SHOP_POPOVER":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          popoverAnchor: action.payload.anchor,
          popoverData: {
            date: action.payload.date,
            data: action.payload.data,
          },
        },
      };

    case "CLOSE_TEA_SHOP_POPOVER":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          popoverAnchor: null,
          popoverData: null,
        },
      };

    case "OPEN_TEA_SHOP_DIALOG":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          dialogOpen: true,
          dialogDate: action.payload.date,
          account: action.payload.account,
        },
      };

    case "CLOSE_TEA_SHOP_DIALOG":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          dialogOpen: false,
          dialogDate: undefined,
          account: null,
          editingEntry: null,
        },
      };

    case "SET_TEA_SHOP_EDITING_ENTRY":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          editingEntry: action.payload,
        },
      };

    case "OPEN_TEA_SHOP_ENTRY_MODE_DIALOG":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          entryModeDialogOpen: true,
        },
      };

    case "CLOSE_TEA_SHOP_ENTRY_MODE_DIALOG":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          entryModeDialogOpen: false,
        },
      };

    case "OPEN_GROUP_TEA_SHOP_DIALOG":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          groupDialogOpen: true,
          editingGroupEntryData: action.payload.groupData,
          editingTeaShop: action.payload.teaShop,
          editingSiteGroup: action.payload.siteGroup,
        },
      };

    case "CLOSE_GROUP_TEA_SHOP_DIALOG":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          groupDialogOpen: false,
          editingGroupEntryData: null,
          editingTeaShop: null,
          editingSiteGroup: null,
        },
      };

    case "SET_POPOVER_GROUP_ALLOCATIONS":
      return {
        ...state,
        teaShop: {
          ...state.teaShop,
          popoverGroupAllocations: action.payload,
        },
      };

    // Work update viewer actions
    case "OPEN_WORK_UPDATE_VIEWER":
      return {
        ...state,
        workUpdateViewer: {
          open: true,
          selected: action.payload,
        },
      };

    case "CLOSE_WORK_UPDATE_VIEWER":
      return {
        ...state,
        workUpdateViewer: {
          ...state.workUpdateViewer,
          open: false,
          selected: null,
        },
      };

    // Delete dialog actions
    case "OPEN_DELETE_DIALOG":
      return {
        ...state,
        deleteDialog: {
          open: true,
          data: action.payload,
        },
      };

    case "CLOSE_DELETE_DIALOG":
      return {
        ...state,
        deleteDialog: {
          ...state.deleteDialog,
          open: false,
          data: null,
        },
      };

    // Holiday actions
    case "OPEN_HOLIDAY_DIALOG":
      return {
        ...state,
        holiday: {
          ...state.holiday,
          dialogOpen: true,
          dialogMode: action.payload.mode,
          selectedDate: action.payload.date || null,
          selectedExisting: action.payload.holiday || null,
        },
      };

    case "CLOSE_HOLIDAY_DIALOG":
      return {
        ...state,
        holiday: {
          ...state.holiday,
          dialogOpen: false,
          selectedDate: null,
          selectedExisting: null,
        },
      };

    case "SET_TODAY_HOLIDAY":
      return {
        ...state,
        holiday: {
          ...state.holiday,
          todayHoliday: action.payload,
        },
      };

    case "SET_RECENT_HOLIDAYS":
      return {
        ...state,
        holiday: {
          ...state.holiday,
          recentHolidays: action.payload,
        },
      };

    // Unfilled dates actions
    case "TOGGLE_UNFILLED_GROUP":
      const newExpandedGroups = new Set(state.unfilledDates.expandedGroups);
      if (newExpandedGroups.has(action.payload)) {
        newExpandedGroups.delete(action.payload);
      } else {
        newExpandedGroups.add(action.payload);
      }
      return {
        ...state,
        unfilledDates: {
          ...state.unfilledDates,
          expandedGroups: newExpandedGroups,
        },
      };

    case "OPEN_UNFILLED_ACTION_DIALOG":
      return {
        ...state,
        unfilledDates: {
          ...state.unfilledDates,
          actionDialog: {
            open: true,
            date: action.payload.date,
            isHoliday: action.payload.isHoliday,
          },
        },
      };

    case "CLOSE_UNFILLED_ACTION_DIALOG":
      return {
        ...state,
        unfilledDates: {
          ...state.unfilledDates,
          actionDialog: null,
        },
      };

    // Summary view actions
    case "OPEN_SUMMARY_VIEW":
      return {
        ...state,
        summaryView: {
          ...state.summaryView,
          date: action.payload,
        },
      };

    case "CLOSE_SUMMARY_VIEW":
      return {
        ...state,
        summaryView: {
          ...state.summaryView,
          date: null,
          tableFullscreen: false,
        },
      };

    case "TOGGLE_SUMMARY_TABLE_FULLSCREEN":
      return {
        ...state,
        summaryView: {
          ...state.summaryView,
          tableFullscreen: !state.summaryView.tableFullscreen,
        },
      };

    case "OPEN_SUMMARY_PHOTO_FULLSCREEN":
      return {
        ...state,
        summaryView: {
          ...state.summaryView,
          photoFullscreen: true,
          fullscreenPhotos: action.payload.photos,
          photoIndex: action.payload.index,
          photoPeriod: action.payload.period,
        },
      };

    case "CLOSE_SUMMARY_PHOTO_FULLSCREEN":
      return {
        ...state,
        summaryView: {
          ...state.summaryView,
          photoFullscreen: false,
          fullscreenPhotos: [],
        },
      };

    case "SET_SUMMARY_PHOTO_INDEX":
      return {
        ...state,
        summaryView: {
          ...state.summaryView,
          photoIndex: action.payload,
        },
      };

    // Settlement actions
    case "OPEN_SETTLEMENT_DIALOG":
      return {
        ...state,
        settlement: {
          dialogOpen: true,
          config: action.payload,
        },
      };

    case "CLOSE_SETTLEMENT_DIALOG":
      return {
        ...state,
        settlement: {
          ...state.settlement,
          dialogOpen: false,
          config: null,
        },
      };

    // Market laborer edit actions
    case "OPEN_MARKET_LABORER_EDIT":
      return {
        ...state,
        marketLaborerEdit: {
          open: true,
          record: action.payload,
          form: {
            count: action.payload.groupCount,
            day_units: action.payload.dayUnits,
            rate_per_person: action.payload.ratePerPerson,
          },
        },
      };

    case "CLOSE_MARKET_LABORER_EDIT":
      return {
        ...state,
        marketLaborerEdit: {
          ...state.marketLaborerEdit,
          open: false,
          record: null,
        },
      };

    case "UPDATE_MARKET_LABORER_FORM":
      return {
        ...state,
        marketLaborerEdit: {
          ...state.marketLaborerEdit,
          form: {
            ...state.marketLaborerEdit.form,
            ...action.payload,
          },
        },
      };

    // Notification actions
    case "SET_RESTORATION_MESSAGE":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          restorationMessage: action.payload,
        },
      };

    case "OPEN_PAID_RECORD_DIALOG":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          paidRecordDialog: action.payload,
        },
      };

    case "CLOSE_PAID_RECORD_DIALOG":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          paidRecordDialog: null,
        },
      };

    default:
      return state;
  }
}
