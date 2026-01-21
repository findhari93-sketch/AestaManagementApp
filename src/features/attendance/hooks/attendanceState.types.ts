/**
 * State management types for Attendance feature
 * Defines the centralized state structure and action types
 */

import type {
  AttendanceRecord,
  DateSummary,
  MarketLaborerRecord,
  ViewMode,
  DrawerMode,
  HolidayDialogMode,
  TeaShopData,
} from "../types";
import type { Database } from "@/types/database.types";

type DailyWorkSummary = Database["public"]["Tables"]["daily_work_summary"]["Row"];
type TeaShopAccount = Database["public"]["Tables"]["tea_shop_accounts"]["Row"];
import type { WorkUpdates } from "@/types/work-updates.types";
import type { DailyPaymentRecord } from "@/types/payment.types";
import type { UnifiedSettlementConfig } from "@/types/settlement.types";
import type { SiteHoliday } from "@/components/attendance/HolidayConfirmDialog";

/**
 * Centralized state for Attendance feature
 * Replaces 56 useState hooks with single useReducer
 */
export interface AttendanceState {
  // Data state
  loading: boolean;
  attendanceRecords: AttendanceRecord[];
  dateSummaries: DateSummary[];
  workSummaries: Map<string, DailyWorkSummary>;
  highlightedDate: string | null;
  cameFromSettlement: boolean;

  // View state
  viewMode: ViewMode;
  summaryExpanded: boolean;
  showHolidays: boolean;
  speedDialOpen: boolean;

  // Drawer state
  drawerOpen: boolean;
  drawerMode: DrawerMode;
  selectedDateForDrawer: string | undefined;

  // Edit dialog state
  editDialog: {
    open: boolean;
    record: AttendanceRecord | null;
    form: {
      work_days: number;
      daily_rate_applied: number;
    };
  };

  // Payment dialog state
  paymentDialog: {
    open: boolean;
    records: DailyPaymentRecord[];
  };

  // Tea shop state
  teaShop: {
    popoverAnchor: HTMLElement | null;
    popoverData: { date: string; data: TeaShopData } | null;
    dialogOpen: boolean;
    dialogDate: string | undefined;
    account: TeaShopAccount | null;
    editingEntry: any;
    entryModeDialogOpen: boolean;
    groupDialogOpen: boolean;
    popoverGroupAllocations: any[] | null;
    editingGroupEntryData: any;
    editingTeaShop: any;
    editingSiteGroup: any;
  };

  // Work update viewer state
  workUpdateViewer: {
    open: boolean;
    selected: {
      workUpdates: WorkUpdates | null;
      date: string;
    } | null;
  };

  // Delete dialog state
  deleteDialog: {
    open: boolean;
    data: {
      date: string;
      siteName: string;
      dailyCount: number;
      marketCount: number;
      totalAmount: number;
    } | null;
  };

  // Holiday state
  holiday: {
    dialogOpen: boolean;
    dialogMode: HolidayDialogMode;
    todayHoliday: SiteHoliday | null;
    recentHolidays: SiteHoliday[];
    selectedDate: string | null;
    selectedExisting: SiteHoliday | null;
  };

  // Unfilled dates state
  unfilledDates: {
    expandedGroups: Set<string>;
    actionDialog: {
      open: boolean;
      date: string;
      isHoliday?: boolean;
    } | null;
  };

  // Summary view state
  summaryView: {
    date: string | null;
    tableFullscreen: boolean;
    photoFullscreen: boolean;
    fullscreenPhotos: { url: string; id: string; description?: string; uploadedAt: string }[];
    photoIndex: number;
    photoPeriod: "morning" | "evening";
  };

  // Settlement dialog state
  settlement: {
    dialogOpen: boolean;
    config: UnifiedSettlementConfig | null;
  };

  // Market laborer edit state
  marketLaborerEdit: {
    open: boolean;
    record: MarketLaborerRecord | null;
    form: {
      count: number;
      day_units: number;
      rate_per_person: number;
    };
  };

  // Notification state
  notifications: {
    restorationMessage: string | null;
    paidRecordDialog: {
      open: boolean;
      record: AttendanceRecord | null;
      action: "edit" | "delete";
      date?: string;
      isBulk?: boolean;
      paidCount?: number;
    } | null;
  };
}

/**
 * Action types for state updates
 */
export type AttendanceAction =
  // Data actions
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ATTENDANCE_RECORDS"; payload: AttendanceRecord[] }
  | { type: "SET_DATE_SUMMARIES"; payload: DateSummary[] }
  | { type: "SET_WORK_SUMMARIES"; payload: Map<string, DailyWorkSummary> }
  | { type: "SET_HIGHLIGHTED_DATE"; payload: string | null }
  | { type: "SET_CAME_FROM_SETTLEMENT"; payload: boolean }
  | { type: "CLEAR_ATTENDANCE_DATA" }

  // View actions
  | { type: "SET_VIEW_MODE"; payload: ViewMode }
  | { type: "TOGGLE_SUMMARY_EXPANDED" }
  | { type: "SET_SHOW_HOLIDAYS"; payload: boolean }
  | { type: "SET_SPEED_DIAL_OPEN"; payload: boolean }

  // Drawer actions
  | { type: "OPEN_DRAWER"; payload: { mode: DrawerMode; date?: string } }
  | { type: "CLOSE_DRAWER" }
  | { type: "SET_DRAWER_MODE"; payload: DrawerMode }

  // Edit dialog actions
  | { type: "OPEN_EDIT_DIALOG"; payload: AttendanceRecord }
  | { type: "CLOSE_EDIT_DIALOG" }
  | { type: "UPDATE_EDIT_FORM"; payload: Partial<AttendanceState["editDialog"]["form"]> }

  // Payment dialog actions
  | { type: "OPEN_PAYMENT_DIALOG"; payload: DailyPaymentRecord[] }
  | { type: "CLOSE_PAYMENT_DIALOG" }

  // Tea shop actions
  | { type: "OPEN_TEA_SHOP_POPOVER"; payload: { anchor: HTMLElement; date: string; data: TeaShopData } }
  | { type: "CLOSE_TEA_SHOP_POPOVER" }
  | { type: "OPEN_TEA_SHOP_DIALOG"; payload: { date: string; account: TeaShopAccount } }
  | { type: "CLOSE_TEA_SHOP_DIALOG" }
  | { type: "SET_TEA_SHOP_EDITING_ENTRY"; payload: any }
  | { type: "OPEN_TEA_SHOP_ENTRY_MODE_DIALOG" }
  | { type: "CLOSE_TEA_SHOP_ENTRY_MODE_DIALOG" }
  | { type: "OPEN_GROUP_TEA_SHOP_DIALOG"; payload: { groupData: any; teaShop: any; siteGroup: any } }
  | { type: "CLOSE_GROUP_TEA_SHOP_DIALOG" }
  | { type: "SET_POPOVER_GROUP_ALLOCATIONS"; payload: any[] | null }

  // Work update viewer actions
  | { type: "OPEN_WORK_UPDATE_VIEWER"; payload: { workUpdates: WorkUpdates | null; date: string } }
  | { type: "CLOSE_WORK_UPDATE_VIEWER" }

  // Delete dialog actions
  | { type: "OPEN_DELETE_DIALOG"; payload: AttendanceState["deleteDialog"]["data"] }
  | { type: "CLOSE_DELETE_DIALOG" }

  // Holiday actions
  | { type: "OPEN_HOLIDAY_DIALOG"; payload: { mode: HolidayDialogMode; date?: string; holiday?: SiteHoliday } }
  | { type: "CLOSE_HOLIDAY_DIALOG" }
  | { type: "SET_TODAY_HOLIDAY"; payload: SiteHoliday | null }
  | { type: "SET_RECENT_HOLIDAYS"; payload: SiteHoliday[] }

  // Unfilled dates actions
  | { type: "TOGGLE_UNFILLED_GROUP"; payload: string }
  | { type: "OPEN_UNFILLED_ACTION_DIALOG"; payload: { date: string; isHoliday?: boolean } }
  | { type: "CLOSE_UNFILLED_ACTION_DIALOG" }

  // Summary view actions
  | { type: "OPEN_SUMMARY_VIEW"; payload: string }
  | { type: "CLOSE_SUMMARY_VIEW" }
  | { type: "TOGGLE_SUMMARY_TABLE_FULLSCREEN" }
  | { type: "OPEN_SUMMARY_PHOTO_FULLSCREEN"; payload: { photos: any[]; index: number; period: "morning" | "evening" } }
  | { type: "CLOSE_SUMMARY_PHOTO_FULLSCREEN" }
  | { type: "SET_SUMMARY_PHOTO_INDEX"; payload: number }

  // Settlement actions
  | { type: "OPEN_SETTLEMENT_DIALOG"; payload: UnifiedSettlementConfig }
  | { type: "CLOSE_SETTLEMENT_DIALOG" }

  // Market laborer edit actions
  | { type: "OPEN_MARKET_LABORER_EDIT"; payload: MarketLaborerRecord }
  | { type: "CLOSE_MARKET_LABORER_EDIT" }
  | { type: "UPDATE_MARKET_LABORER_FORM"; payload: Partial<AttendanceState["marketLaborerEdit"]["form"]> }

  // Notification actions
  | { type: "SET_RESTORATION_MESSAGE"; payload: string | null }
  | { type: "OPEN_PAID_RECORD_DIALOG"; payload: AttendanceState["notifications"]["paidRecordDialog"] }
  | { type: "CLOSE_PAID_RECORD_DIALOG" };
