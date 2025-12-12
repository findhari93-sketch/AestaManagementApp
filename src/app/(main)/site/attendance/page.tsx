"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Popover,
  Divider,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Snackbar,
} from "@mui/material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useFullscreen } from "@/hooks/useFullscreen";
import { getPersistedDrawerState, clearPersistedDrawerState } from "@/hooks/useDrawerPersistence";
import {
  ExpandMore,
  ExpandLess,
  Add as AddIcon,
  Edit,
  Delete,
  AccessTime,
  Restaurant,
  LocalCafe as TeaIcon,
  Fullscreen,
  FullscreenExit,
  Close as CloseIcon,
  WbSunny,
  EventNote,
  EventBusy as HolidayIcon,
  BeachAccess as BeachAccessIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import AttendanceDrawer from "@/components/attendance/AttendanceDrawer";
import HolidayConfirmDialog from "@/components/attendance/HolidayConfirmDialog";
import TeaShopEntryDialog from "@/components/tea-shop/TeaShopEntryDialog";
import PaymentDialog from "@/components/payments/PaymentDialog";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import AuditAvatarGroup from "@/components/common/AuditAvatarGroup";
import {
  PhotoBadge,
  WorkUpdateViewer,
} from "@/components/attendance/work-updates";
import type { TeaShopAccount } from "@/types/database.types";
import type { WorkUpdates } from "@/types/work-updates.types";
import type { DailyPaymentRecord } from "@/types/payment.types";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import type { LaborerType, DailyWorkSummary } from "@/types/database.types";
import dayjs from "dayjs";
import DateRangePicker from "@/components/common/DateRangePicker";

interface AttendanceRecord {
  id: string;
  date: string;
  laborer_id: string;
  laborer_name: string;
  laborer_type: LaborerType;
  category_name: string;
  role_name: string;
  team_name: string | null;
  section_name: string;
  work_days: number;
  hours_worked: number;
  daily_rate_applied: number;
  daily_earnings: number;
  is_paid: boolean;
  subcontract_title?: string | null;
  // Time tracking fields
  in_time?: string | null;
  lunch_out?: string | null;
  lunch_in?: string | null;
  out_time?: string | null;
  work_hours?: number | null;
  break_hours?: number | null;
  total_hours?: number | null;
  day_units?: number;
  snacks_amount?: number;
  // Two-phase attendance fields
  attendance_status?: "morning_entry" | "confirmed" | null;
  work_progress_percent?: number | null;
  // Audit tracking fields
  entered_by?: string | null;
  entered_by_user_id?: string | null;
  entered_by_avatar?: string | null;
  updated_by?: string | null;
  updated_by_user_id?: string | null;
  updated_by_avatar?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface TeaShopData {
  teaTotal: number;
  snacksTotal: number;
  total: number;
  workingCount: number;
  workingTotal: number;
  nonWorkingCount: number;
  nonWorkingTotal: number;
  marketCount: number;
  marketTotal: number;
}

// Expanded market laborer record (individual rows like "Mason 1", "Mason 2")
interface MarketLaborerRecord {
  id: string;
  originalDbId: string; // The actual DB record ID from market_laborer_attendance
  roleId: string; // The role_id from the DB
  date: string;
  tempName: string; // e.g., "Mason 1", "Mason 2"
  categoryName: string;
  roleName: string;
  index: number; // 1, 2, 3 within category
  workDays: number;
  dayUnits: number;
  ratePerPerson: number;
  dailyEarnings: number;
  snacksAmount: number;
  inTime: string | null;
  outTime: string | null;
  isPaid: boolean;
  paidAmount: number;
  pendingAmount: number;
  groupCount: number; // Total count in this group (for edit reference)
}

interface DateSummary {
  date: string;
  records: AttendanceRecord[];
  marketLaborers: MarketLaborerRecord[]; // Expanded market laborer rows
  // Laborer counts by type
  dailyLaborerCount: number;
  contractLaborerCount: number;
  marketLaborerCount: number;
  totalLaborerCount: number;
  // Times
  firstInTime: string | null;
  lastOutTime: string | null;
  // Amounts
  totalSalary: number;
  totalSnacks: number;
  totalExpense: number;
  // Amounts by laborer type
  dailyLaborerAmount: number;
  contractLaborerAmount: number;
  marketLaborerAmount: number;
  // Payment breakdown
  paidCount: number;
  pendingCount: number;
  paidAmount: number;
  pendingAmount: number;
  // Work description
  workDescription: string | null;
  workStatus: string | null;
  comments: string | null;
  // Work updates with photos
  workUpdates: WorkUpdates | null;
  // Category breakdown
  categoryBreakdown: { [key: string]: { count: number; amount: number } };
  isExpanded?: boolean;
  // Tea shop data
  teaShop: TeaShopData | null;
  // Two-phase attendance status
  attendanceStatus: "morning_entry" | "confirmed" | "mixed";
  workProgressPercent: number;
}

export default function AttendancePage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [dateSummaries, setDateSummaries] = useState<DateSummary[]>([]);
  const [workSummaries, setWorkSummaries] = useState<
    Map<string, DailyWorkSummary>
  >(new Map());
  const [viewMode, setViewMode] = useState<"date-wise" | "detailed">(
    "date-wise"
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"morning" | "evening" | "full">(
    "full"
  );

  // Fetch version counter to handle race conditions
  const fetchVersionRef = useRef(0);

  // Date filters in title bar - Default to last 30 days for better performance
  const [dateFrom, setDateFrom] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(dayjs().format("YYYY-MM-DD"));

  // Mobile UI states
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Fullscreen mode using native Fullscreen API
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen(
    tableContainerRef,
    { orientation: "landscape" }
  );

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(
    null
  );
  const [editForm, setEditForm] = useState({
    work_days: 1,
    daily_rate_applied: 0,
  });

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentRecords, setPaymentRecords] = useState<DailyPaymentRecord[]>(
    []
  );

  // Date-specific drawer state
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<
    string | undefined
  >(undefined);

  // Tea shop popover state
  const [teaShopPopoverAnchor, setTeaShopPopoverAnchor] =
    useState<HTMLElement | null>(null);
  const [teaShopPopoverData, setTeaShopPopoverData] = useState<{
    date: string;
    data: TeaShopData;
  } | null>(null);

  // Tea shop entry dialog state (for direct opening)
  const [teaShopDialogOpen, setTeaShopDialogOpen] = useState(false);
  const [teaShopDialogDate, setTeaShopDialogDate] = useState<
    string | undefined
  >(undefined);
  const [teaShopAccount, setTeaShopAccount] = useState<TeaShopAccount | null>(
    null
  );
  const [teaShopEditingEntry, setTeaShopEditingEntry] = useState<any>(null);

  // Work update viewer state
  const [workUpdateViewerOpen, setWorkUpdateViewerOpen] = useState(false);
  const [selectedWorkUpdate, setSelectedWorkUpdate] = useState<{
    workUpdates: WorkUpdates | null;
    date: string;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogData, setDeleteDialogData] = useState<{
    date: string;
    siteName: string;
    dailyCount: number;
    marketCount: number;
    totalAmount: number;
  } | null>(null);

  // Holiday management state
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [holidayDialogMode, setHolidayDialogMode] = useState<"mark" | "revoke" | "list">("mark");
  const [todayHoliday, setTodayHoliday] = useState<{
    id: string;
    site_id: string;
    date: string;
    reason: string | null;
    is_paid_holiday: boolean | null;
    created_at: string;
    created_by: string | null;
  } | null>(null);
  const [recentHolidays, setRecentHolidays] = useState<Array<{
    id: string;
    site_id: string;
    date: string;
    reason: string | null;
    is_paid_holiday: boolean | null;
    created_at: string;
    created_by: string | null;
  }>>([]);

  // SpeedDial controlled state (click-only, not hover)
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  // View attendance summary state (eye icon)
  const [viewSummaryDate, setViewSummaryDate] = useState<string | null>(null);

  // Restoration message state
  const [restorationMessage, setRestorationMessage] = useState<string | null>(null);

  // Market laborer edit dialog state
  const [marketLaborerEditOpen, setMarketLaborerEditOpen] = useState(false);
  const [editingMarketLaborer, setEditingMarketLaborer] = useState<MarketLaborerRecord | null>(null);
  const [marketLaborerEditForm, setMarketLaborerEditForm] = useState({
    count: 1,
    day_units: 1,
    rate_per_person: 0,
  });

  const canEdit = hasEditPermission(userProfile?.role);

  // Check for persisted drawer state on mount and restore if found
  useEffect(() => {
    const persistedState = getPersistedDrawerState();
    if (persistedState && persistedState.dirty && selectedSite?.id === persistedState.siteId) {
      // Restore the drawer state
      setDrawerOpen(true);
      setDrawerMode(persistedState.mode);
      setSelectedDateForDrawer(persistedState.date);
      setRestorationMessage("Restored your unsaved work");
      // Clear message after 5 seconds
      setTimeout(() => setRestorationMessage(null), 5000);
    } else if (persistedState && persistedState.siteId !== selectedSite?.id) {
      // Different site, clear the persisted state
      clearPersistedDrawerState();
    }
  }, [selectedSite?.id]); // Only run when site changes

  // Calculate totals for the filtered period
  const periodTotals = useMemo(() => {
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
      avgPerDay:
        dateSummaries.length > 0 ? totalExpense / dateSummaries.length : 0,
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
  }, [dateSummaries]);

  // Combined view: dateSummaries + holiday-only dates (holidays without attendance)
  // This creates a merged list sorted by date descending
  const combinedDateEntries = useMemo(() => {
    // Get set of dates that have attendance data
    const attendanceDates = new Set(dateSummaries.map((s) => s.date));

    // Filter holidays within selected date range that don't have attendance
    const holidayOnlyEntries = recentHolidays
      .filter((h) => {
        const hDate = h.date;
        return (
          hDate >= dateFrom &&
          hDate <= dateTo &&
          !attendanceDates.has(hDate)
        );
      })
      .map((h) => ({
        type: "holiday" as const,
        date: h.date,
        holiday: h,
      }));

    // Map dateSummaries and check if each date is also a holiday
    const attendanceEntries = dateSummaries.map((s) => {
      const holiday = recentHolidays.find((h) => h.date === s.date);
      return {
        type: "attendance" as const,
        date: s.date,
        summary: s,
        holiday: holiday || null,
      };
    });

    // Combine and sort by date descending
    const combined = [
      ...attendanceEntries,
      ...holidayOnlyEntries,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return combined;
  }, [dateSummaries, recentHolidays, dateFrom, dateTo]);

  const fetchAttendanceHistory = async () => {
    if (!selectedSite) return;

    // Increment version and capture current version for this fetch
    const currentVersion = ++fetchVersionRef.current;

    setLoading(true);
    try {
      // Fetch daily attendance with audit fields and two-phase status
      const { data: attendanceData, error } = await supabase
        .from("daily_attendance")
        .select(
          `
          id, date, laborer_id, work_days, hours_worked, daily_rate_applied, daily_earnings, is_paid, subcontract_id,
          in_time, lunch_out, lunch_in, out_time, work_hours, break_hours, total_hours, day_units, snacks_amount,
          attendance_status, work_progress_percent,
          entered_by, recorded_by, recorded_by_user_id, updated_by, updated_by_user_id, created_at, updated_at,
          laborers!inner(name, team_id, category_id, role_id, laborer_type, team:teams!laborers_team_id_fkey(name), labor_categories(name), labor_roles(name)),
          building_sections!inner(name),
          subcontracts(title),
          recorded_by_user:users!daily_attendance_recorded_by_user_id_fkey(avatar_url),
          updated_by_user:users!daily_attendance_updated_by_user_id_fkey(avatar_url)
        `
        )
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      if (error) throw error;

      // Fetch market laborer attendance
      const { data: marketData } = await (
        supabase.from("market_laborer_attendance") as any
      )
        .select(
          "id, role_id, date, count, work_days, rate_per_person, total_cost, day_units, snacks_per_person, total_snacks, in_time, out_time, is_paid, labor_roles(name)"
        )
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      // Fetch work summaries
      const { data: summaryData } = await (
        supabase.from("daily_work_summary") as any
      )
        .select("*")
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      // Fetch tea shop entries (using base columns - V2 migration columns may not exist yet)
      // Note: site_id exists on tea_shop_entries, V2 columns (working_laborer_count, etc.) may not
      const { data: teaShopData } = await (
        supabase.from("tea_shop_entries") as any
      )
        .select("date, tea_total, snacks_total, total_amount")
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      // Build tea shop map (by date, aggregate if multiple entries per day)
      // Note: V2 columns (working_laborer_count, etc.) may not exist yet - using defaults
      const teaShopMap = new Map<string, TeaShopData>();
      (teaShopData || []).forEach((t: any) => {
        const existing = teaShopMap.get(t.date) || {
          teaTotal: 0,
          snacksTotal: 0,
          total: 0,
          workingCount: 0,
          workingTotal: 0,
          nonWorkingCount: 0,
          nonWorkingTotal: 0,
          marketCount: 0,
          marketTotal: 0,
        };
        existing.teaTotal += t.tea_total || 0;
        existing.snacksTotal += t.snacks_total || 0;
        existing.total += t.total_amount || 0;
        // V2 columns - use 0 as default until migration is applied
        existing.workingCount += t.working_laborer_count || 0;
        existing.workingTotal += t.working_laborer_total || 0;
        existing.nonWorkingCount += t.nonworking_laborer_count || 0;
        existing.nonWorkingTotal += t.nonworking_laborer_total || 0;
        existing.marketCount += t.market_laborer_count || 0;
        existing.marketTotal += t.market_laborer_total || 0;
        teaShopMap.set(t.date, existing);
      });

      // Check if this fetch is still current (handle race conditions)
      if (currentVersion !== fetchVersionRef.current) {
        console.log("[Attendance] Ignoring stale fetch result");
        return;
      }

      // Build work summaries map
      const summaryMap = new Map<string, DailyWorkSummary>();
      (summaryData || []).forEach((s: DailyWorkSummary) => {
        summaryMap.set(s.date, s);
      });
      setWorkSummaries(summaryMap);

      // Build market data map (by date) - includes both summary and expanded individual records
      const marketMap = new Map<
        string,
        {
          count: number;
          salary: number;
          snacks: number;
          inTime: string | null;
          outTime: string | null;
          expandedRecords: MarketLaborerRecord[];
        }
      >();
      (marketData || []).forEach((m: any) => {
        const existing = marketMap.get(m.date) || {
          count: 0,
          salary: 0,
          snacks: 0,
          inTime: null,
          outTime: null,
          expandedRecords: [],
        };
        const roleName = m.labor_roles?.name || "Worker";
        const ratePerPerson = m.rate_per_person || 0;
        const dayUnits = m.day_units || m.work_days || 1;
        const perPersonEarnings = ratePerPerson * dayUnits;
        const perPersonSnacks = (m.snacks_per_person || 0) * dayUnits;

        // Expand into individual records (Mason 1, Mason 2, etc.)
        for (let i = 0; i < m.count; i++) {
          existing.expandedRecords.push({
            id: `${m.id || m.date}-${roleName}-${i}`,
            originalDbId: m.id,
            roleId: m.role_id,
            date: m.date,
            tempName: `${roleName} ${
              existing.expandedRecords.filter((r) => r.roleName === roleName)
                .length + 1
            }`,
            categoryName: "Market",
            roleName: roleName,
            index: i + 1,
            workDays: m.work_days || 1,
            dayUnits: dayUnits,
            ratePerPerson: ratePerPerson,
            dailyEarnings: perPersonEarnings,
            snacksAmount: perPersonSnacks,
            inTime: m.in_time || null,
            outTime: m.out_time || null,
            isPaid: m.is_paid || false,
            paidAmount: m.is_paid ? perPersonEarnings : 0,
            pendingAmount: m.is_paid ? 0 : perPersonEarnings,
            groupCount: m.count,
          });
        }

        existing.count += m.count;
        existing.salary += m.total_cost || m.count * ratePerPerson * dayUnits;
        existing.snacks += m.total_snacks || 0;
        if (!existing.inTime || (m.in_time && m.in_time < existing.inTime)) {
          existing.inTime = m.in_time;
        }
        if (
          !existing.outTime ||
          (m.out_time && m.out_time > existing.outTime)
        ) {
          existing.outTime = m.out_time;
        }
        marketMap.set(m.date, existing);
      });

      // Map attendance records (including audit fields)
      const records: AttendanceRecord[] = (attendanceData || []).map(
        (record: any) => ({
          id: record.id,
          date: record.date,
          laborer_id: record.laborer_id,
          laborer_name: record.laborers.name,
          laborer_type: record.laborers.laborer_type || "daily_wage",
          category_name: record.laborers.labor_categories?.name || "Unknown",
          role_name: record.laborers.labor_roles?.name || "Unknown",
          team_name: record.laborers.team?.name || null,
          section_name: record.building_sections.name,
          work_days: record.work_days,
          hours_worked: record.hours_worked,
          daily_rate_applied: record.daily_rate_applied,
          daily_earnings: record.daily_earnings,
          is_paid: record.is_paid || false,
          subcontract_title: record.subcontracts?.title || null,
          in_time: record.in_time,
          lunch_out: record.lunch_out,
          lunch_in: record.lunch_in,
          out_time: record.out_time,
          work_hours: record.work_hours,
          break_hours: record.break_hours,
          total_hours: record.total_hours,
          day_units: record.day_units,
          snacks_amount: record.snacks_amount || 0,
          // Two-phase attendance fields
          attendance_status: record.attendance_status || "confirmed",
          work_progress_percent: record.work_progress_percent ?? 100,
          // Audit fields
          entered_by: record.recorded_by || null,
          entered_by_user_id: record.recorded_by_user_id || null,
          entered_by_avatar: record.recorded_by_user?.avatar_url || null,
          updated_by: record.updated_by || null,
          updated_by_user_id: record.updated_by_user_id || null,
          updated_by_avatar: record.updated_by_user?.avatar_url || null,
          created_at: record.created_at,
          updated_at: record.updated_at,
        })
      );

      setAttendanceRecords(records);

      // Group by date for date-wise view
      const dateMap = new Map<string, DateSummary>();
      records.forEach((record) => {
        const existing = dateMap.get(record.date);

        if (existing) {
          existing.records.push(record);
          // Update counts
          if (record.laborer_type === "contract") {
            existing.contractLaborerCount++;
            existing.contractLaborerAmount += record.daily_earnings;
          } else {
            existing.dailyLaborerCount++;
            existing.dailyLaborerAmount += record.daily_earnings;
          }
          existing.totalLaborerCount =
            existing.dailyLaborerCount +
            existing.contractLaborerCount +
            existing.marketLaborerCount;
          // Update amounts
          existing.totalSalary += record.daily_earnings;
          existing.totalSnacks += record.snacks_amount || 0;
          existing.totalExpense = existing.totalSalary + existing.totalSnacks;
          // Update payment breakdown (for daily laborers only - contract laborers tracked separately)
          if (record.laborer_type !== "contract") {
            if (record.is_paid) {
              existing.paidCount++;
              existing.paidAmount += record.daily_earnings;
            } else {
              existing.pendingCount++;
              existing.pendingAmount += record.daily_earnings;
            }
          }
          // Update times
          if (
            record.in_time &&
            (!existing.firstInTime || record.in_time < existing.firstInTime)
          ) {
            existing.firstInTime = record.in_time;
          }
          if (
            record.out_time &&
            (!existing.lastOutTime || record.out_time > existing.lastOutTime)
          ) {
            existing.lastOutTime = record.out_time;
          }
          // Update category breakdown
          const cat = record.category_name;
          existing.categoryBreakdown[cat] = existing.categoryBreakdown[cat] || {
            count: 0,
            amount: 0,
          };
          existing.categoryBreakdown[cat].count += 1;
          existing.categoryBreakdown[cat].amount += record.daily_earnings;
        } else {
          const workSummary = summaryMap.get(record.date);
          const market = marketMap.get(record.date);
          const teaShop = teaShopMap.get(record.date);
          const categoryBreakdown: {
            [key: string]: { count: number; amount: number };
          } = {};
          categoryBreakdown[record.category_name] = {
            count: 1,
            amount: record.daily_earnings,
          };

          // Initial payment breakdown for this date
          const initialPaidCount =
            record.laborer_type !== "contract" && record.is_paid ? 1 : 0;
          const initialPendingCount =
            record.laborer_type !== "contract" && !record.is_paid ? 1 : 0;
          const initialPaidAmount =
            record.laborer_type !== "contract" && record.is_paid
              ? record.daily_earnings
              : 0;
          const initialPendingAmount =
            record.laborer_type !== "contract" && !record.is_paid
              ? record.daily_earnings
              : 0;

          dateMap.set(record.date, {
            date: record.date,
            records: [record],
            marketLaborers: market?.expandedRecords || [],
            dailyLaborerCount: record.laborer_type === "daily_wage" ? 1 : 0,
            contractLaborerCount: record.laborer_type === "contract" ? 1 : 0,
            marketLaborerCount: market?.count || 0,
            totalLaborerCount: 1 + (market?.count || 0),
            firstInTime: record.in_time || market?.inTime || null,
            lastOutTime: record.out_time || market?.outTime || null,
            totalSalary: record.daily_earnings + (market?.salary || 0),
            totalSnacks: (record.snacks_amount || 0) + (market?.snacks || 0),
            totalExpense:
              record.daily_earnings +
              (record.snacks_amount || 0) +
              (market?.salary || 0) +
              (market?.snacks || 0),
            // Amounts by laborer type
            dailyLaborerAmount:
              record.laborer_type === "daily_wage"
                ? record.daily_earnings
                : 0,
            contractLaborerAmount:
              record.laborer_type === "contract" ? record.daily_earnings : 0,
            marketLaborerAmount: market?.salary || 0,
            // Payment breakdown
            paidCount: initialPaidCount,
            pendingCount: initialPendingCount,
            paidAmount: initialPaidAmount,
            pendingAmount: initialPendingAmount,
            workDescription: workSummary?.work_description || null,
            workStatus: workSummary?.work_status || null,
            comments: workSummary?.comments || null,
            workUpdates:
              ((workSummary as DailyWorkSummary & { work_updates?: unknown })
                ?.work_updates as unknown as WorkUpdates) || null,
            categoryBreakdown,
            isExpanded: false,
            teaShop: teaShop || null,
            attendanceStatus: record.attendance_status || "confirmed",
            workProgressPercent: record.work_progress_percent ?? 100,
          });
        }
      });

      // Also add dates that only have market laborers (no named laborers)
      marketMap.forEach((market, date) => {
        if (!dateMap.has(date)) {
          const workSummary = summaryMap.get(date);
          const teaShop = teaShopMap.get(date);
          dateMap.set(date, {
            date,
            records: [],
            marketLaborers: market.expandedRecords || [],
            dailyLaborerCount: 0,
            contractLaborerCount: 0,
            marketLaborerCount: market.count,
            totalLaborerCount: market.count,
            firstInTime: market.inTime,
            lastOutTime: market.outTime,
            totalSalary: market.salary,
            totalSnacks: market.snacks,
            totalExpense: market.salary + market.snacks,
            // Amounts by laborer type (market only)
            dailyLaborerAmount: 0,
            contractLaborerAmount: 0,
            marketLaborerAmount: market.salary,
            // Market laborers payment tracking (pending by default)
            paidCount: 0,
            pendingCount: market.count,
            paidAmount: 0,
            pendingAmount: market.salary,
            workDescription: workSummary?.work_description || null,
            workStatus: workSummary?.work_status || null,
            comments: workSummary?.comments || null,
            workUpdates:
              ((workSummary as DailyWorkSummary & { work_updates?: unknown })
                ?.work_updates as unknown as WorkUpdates) || null,
            categoryBreakdown: {},
            isExpanded: false,
            teaShop: teaShop || null,
            attendanceStatus: "confirmed",
            workProgressPercent: 100,
          });
        }
      });

      setDateSummaries(
        Array.from(dateMap.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      );
    } catch (error: any) {
      // Only show error if this is still the current fetch
      if (currentVersion === fetchVersionRef.current) {
        console.error("Error fetching attendance history:", error);
        alert("Failed to load attendance history: " + error.message);
      }
    } finally {
      // Only set loading false if this is still the current fetch
      if (currentVersion === fetchVersionRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAttendanceHistory();
  }, [selectedSite, dateFrom, dateTo]);

  // Check if today is a holiday for the selected site
  const checkTodayHoliday = useCallback(async () => {
    if (!selectedSite?.id) {
      setTodayHoliday(null);
      setRecentHolidays([]);
      return;
    }

    const today = dayjs().format("YYYY-MM-DD");
    const thirtyDaysAgo = dayjs().subtract(30, "day").format("YYYY-MM-DD");
    const thirtyDaysLater = dayjs().add(30, "day").format("YYYY-MM-DD");

    try {
      // Check today's holiday (use maybeSingle to avoid error when no holiday exists)
      const { data: todayData, error: todayError } = await supabase
        .from("site_holidays")
        .select("*")
        .eq("site_id", selectedSite.id)
        .eq("date", today)
        .maybeSingle();

      if (todayError) {
        console.error("Error fetching today's holiday:", todayError);
      }
      setTodayHoliday(todayData || null);

      // Fetch recent and upcoming holidays (last 30 days to next 30 days)
      const { data: holidaysData, error: holidaysError } = await supabase
        .from("site_holidays")
        .select("*")
        .eq("site_id", selectedSite.id)
        .gte("date", thirtyDaysAgo)
        .lte("date", thirtyDaysLater)
        .order("date", { ascending: false });

      if (holidaysError) {
        console.error("Error fetching holidays:", holidaysError);
      }
      setRecentHolidays(holidaysData || []);
    } catch (err) {
      console.error("Error checking holidays:", err);
    }
  }, [selectedSite?.id, supabase]);

  useEffect(() => {
    checkTodayHoliday();
  }, [checkTodayHoliday]);

  const handleHolidayClick = () => {
    if (todayHoliday) {
      setHolidayDialogMode("revoke");
    } else {
      setHolidayDialogMode("mark");
    }
    setHolidayDialogOpen(true);
  };

  const handleHolidaySuccess = () => {
    checkTodayHoliday();
    fetchAttendanceHistory();
  };

  const toggleDateExpanded = (date: string) => {
    setDateSummaries((prev) =>
      prev.map((d) =>
        d.date === date ? { ...d, isExpanded: !d.isExpanded } : d
      )
    );
  };

  const handleOpenEditDialog = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditForm({
      work_days: record.work_days,
      daily_rate_applied: record.daily_rate_applied,
    });
    setEditDialogOpen(true);
  };

  // Handler to open payment dialog for a single record
  const handleOpenPaymentDialog = (record: AttendanceRecord) => {
    const paymentRecord: DailyPaymentRecord = {
      id: `daily-${record.id}`,
      sourceType: "daily",
      sourceId: record.id,
      date: record.date,
      laborerId: record.laborer_id,
      laborerName: record.laborer_name,
      laborerType: "daily",
      category: record.category_name,
      role: record.role_name,
      amount: record.daily_earnings,
      isPaid: record.is_paid,
      paidVia: null,
      paymentDate: null,
      paymentMode: null,
      engineerTransactionId: null,
      proofUrl: null,
      subcontractId: null,
      subcontractTitle: record.subcontract_title || null,
    };
    setPaymentRecords([paymentRecord]);
    setPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentDialogOpen(false);
    setPaymentRecords([]);
    fetchAttendanceHistory();
  };

  const handleEditSubmit = async () => {
    if (!editingRecord) return;

    setLoading(true);
    try {
      const daily_earnings = editForm.work_days * editForm.daily_rate_applied;

      const { error } = await (supabase.from("daily_attendance") as any)
        .update({
          work_days: editForm.work_days,
          daily_rate_applied: editForm.daily_rate_applied,
          daily_earnings,
          hours_worked: editForm.work_days * 8,
        })
        .eq("id", editingRecord.id);

      if (error) throw error;

      setEditDialogOpen(false);
      setEditingRecord(null);
      fetchAttendanceHistory();
    } catch (error: any) {
      alert("Failed to update: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrawerForDate = (
    date: string,
    mode: "morning" | "evening" | "full" = "full"
  ) => {
    setSelectedDateForDrawer(date);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  // Fetch tea shop account for site (or create one if doesn't exist)
  const fetchTeaShopAccount = async (): Promise<TeaShopAccount | null> => {
    if (!selectedSite) return null;

    try {
      // Try to get existing active shop for site
      const { data: existingShop } = await (
        supabase.from("tea_shop_accounts") as any
      )
        .select("*")
        .eq("site_id", selectedSite.id)
        .eq("is_active", true)
        .single();

      if (existingShop) {
        return existingShop;
      }

      // If no shop exists, create a default one
      const { data: newShop, error: createError } = await (
        supabase.from("tea_shop_accounts") as any
      )
        .insert({
          site_id: selectedSite.id,
          shop_name: `${selectedSite.name} Tea Shop`,
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating tea shop account:", createError);
        return null;
      }

      return newShop;
    } catch (error) {
      console.error("Error fetching/creating tea shop account:", error);
      return null;
    }
  };

  // Handler to open tea shop dialog directly
  const handleOpenTeaShopDialog = async (date: string) => {
    const shop = await fetchTeaShopAccount();
    if (shop) {
      // Check if there's an existing entry for this date
      const { data: existingEntry } = await (
        supabase.from("tea_shop_entries") as any
      )
        .select("*")
        .eq("tea_shop_id", shop.id)
        .eq("date", date)
        .single();

      setTeaShopAccount(shop);
      setTeaShopDialogDate(date);
      setTeaShopEditingEntry(existingEntry || null);
      setTeaShopDialogOpen(true);
    } else {
      alert("Could not load tea shop. Please try again.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attendance record?"))
      return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("daily_attendance")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchAttendanceHistory();
    } catch (error: any) {
      alert("Failed to delete: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Market laborer edit handlers
  const handleOpenMarketLaborerEdit = (record: MarketLaborerRecord) => {
    setEditingMarketLaborer(record);
    setMarketLaborerEditForm({
      count: record.groupCount,
      day_units: record.dayUnits,
      rate_per_person: record.ratePerPerson,
    });
    setMarketLaborerEditOpen(true);
  };

  const handleSaveMarketLaborerEdit = async () => {
    if (!editingMarketLaborer || !selectedSite) return;

    setLoading(true);
    try {
      const totalCost = marketLaborerEditForm.count * marketLaborerEditForm.rate_per_person * marketLaborerEditForm.day_units;

      const { error } = await (supabase.from("market_laborer_attendance") as any)
        .update({
          count: marketLaborerEditForm.count,
          day_units: marketLaborerEditForm.day_units,
          rate_per_person: marketLaborerEditForm.rate_per_person,
          total_cost: totalCost,
          updated_at: new Date().toISOString(),
          updated_by: userProfile?.name || "Unknown",
          updated_by_user_id: userProfile?.id,
        })
        .eq("id", editingMarketLaborer.originalDbId);

      if (error) throw error;

      setMarketLaborerEditOpen(false);
      setEditingMarketLaborer(null);
      fetchAttendanceHistory();
    } catch (error: any) {
      alert("Failed to update: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMarketLaborer = async (record: MarketLaborerRecord) => {
    const confirmMsg = record.groupCount > 1
      ? `This will delete all ${record.groupCount} ${record.roleName}(s) for this date. Continue?`
      : `Are you sure you want to delete this ${record.roleName}?`;

    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const { error } = await (supabase.from("market_laborer_attendance") as any)
        .delete()
        .eq("id", record.originalDbId);

      if (error) throw error;
      fetchAttendanceHistory();
    } catch (error: any) {
      alert("Failed to delete: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Open delete confirmation dialog
  const handleDeleteDateAttendance = (date: string) => {
    const summary = dateSummaries.find((s) => s.date === date);
    if (!summary || !selectedSite) return;

    setDeleteDialogData({
      date,
      siteName: selectedSite.name,
      dailyCount: summary.dailyLaborerCount + summary.contractLaborerCount,
      marketCount: summary.marketLaborerCount,
      totalAmount: summary.totalSalary + (summary.teaShop?.total || 0),
    });
    setDeleteDialogOpen(true);
  };

  // Perform the actual delete
  const confirmDeleteDateAttendance = async () => {
    if (!deleteDialogData || !selectedSite) return;

    const { date } = deleteDialogData;
    setDeleteDialogOpen(false);
    setLoading(true);

    try {
      // Delete daily attendance records
      const { error: dailyError } = await supabase
        .from("daily_attendance")
        .delete()
        .eq("site_id", selectedSite.id)
        .eq("date", date);
      if (dailyError) throw dailyError;

      // Delete market laborer attendance
      const { error: marketError } = await (
        supabase.from("market_laborer_attendance") as any
      )
        .delete()
        .eq("site_id", selectedSite.id)
        .eq("date", date);
      if (marketError) throw marketError;

      // Delete tea shop entries for this date
      const { error: teaError } = await (
        supabase.from("tea_shop_entries") as any
      )
        .delete()
        .eq("site_id", selectedSite.id)
        .eq("date", date);
      if (teaError) throw teaError;

      // Delete daily work summary
      const { error: summaryError } = await supabase
        .from("daily_work_summary")
        .delete()
        .eq("site_id", selectedSite.id)
        .eq("date", date);
      if (summaryError) throw summaryError;

      fetchAttendanceHistory();
    } catch (error: any) {
      alert("Failed to delete: " + error.message);
    } finally {
      setLoading(false);
      setDeleteDialogData(null);
    }
  };

  const formatTime = (time: string | null | undefined) => {
    if (!time) return "-";
    return time.substring(0, 5); // HH:MM
  };

  const detailedColumns = useMemo<MRT_ColumnDef<AttendanceRecord>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        size: 110,
        Cell: ({ cell }) => dayjs(cell.getValue<string>()).format("DD MMM"),
      },
      { accessorKey: "laborer_name", header: "Name", size: 150 },
      {
        accessorKey: "laborer_type",
        header: "Type",
        size: 80,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>() === "contract" ? "C" : "D"}
            size="small"
            color={cell.getValue<string>() === "contract" ? "info" : "warning"}
            variant="outlined"
          />
        ),
      },
      { accessorKey: "category_name", header: "Category", size: 100 },
      {
        accessorKey: "in_time",
        header: "In",
        size: 70,
        Cell: ({ cell }) => formatTime(cell.getValue<string>()),
      },
      {
        accessorKey: "out_time",
        header: "Out",
        size: 70,
        Cell: ({ cell, row }) => {
          // Hide out time for morning entries (not yet confirmed)
          if (row.original.attendance_status === "morning_entry") {
            return "-";
          }
          return formatTime(cell.getValue<string>());
        },
      },
      {
        accessorKey: "work_hours",
        header: "Work Hrs",
        size: 80,
        Cell: ({ cell }) => {
          const hours = cell.getValue<number>();
          return hours ? `${hours}h` : "-";
        },
      },
      {
        accessorKey: "day_units",
        header: "W/D Units",
        size: 90,
        Cell: ({ cell }) => {
          const units = cell.getValue<number>() || cell.row.original.work_days;
          return (
            <Chip
              label={units}
              size="small"
              color="primary"
              variant="outlined"
            />
          );
        },
      },
      {
        accessorKey: "daily_earnings",
        header: "Salary",
        size: 100,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="success.main">
            ₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "snacks_amount",
        header: "Snacks",
        size: 80,
        Cell: ({ cell }) => {
          const amount = cell.getValue<number>() || 0;
          return amount > 0 ? `₹${amount}` : "-";
        },
      },
      {
        accessorKey: "is_paid",
        header: "Payment",
        size: 100,
        Cell: ({ cell, row }) => {
          const isPaid = cell.getValue<boolean>();
          const isContract = row.original.laborer_type === "contract";
          if (isContract) {
            return (
              <Chip
                label="In Contract"
                size="small"
                color="info"
                variant="outlined"
              />
            );
          }
          if (isPaid) {
            return (
              <Chip
                label="PAID"
                size="small"
                color="success"
                variant="filled"
              />
            );
          }
          return (
            <Chip
              label="PENDING"
              size="small"
              color="warning"
              variant="outlined"
              onClick={() => canEdit && handleOpenPaymentDialog(row.original)}
              sx={{ cursor: canEdit ? "pointer" : "default" }}
            />
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 120,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {row.original.laborer_type !== "contract" &&
              !row.original.is_paid &&
              canEdit && (
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  onClick={() => handleOpenPaymentDialog(row.original)}
                  sx={{ minWidth: 50, px: 1, fontSize: 11 }}
                >
                  Pay
                </Button>
              )}
            <IconButton
              size="small"
              onClick={() => handleOpenEditDialog(row.original)}
              disabled={!canEdit}
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDelete(row.original.id)}
              disabled={!canEdit}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ],
    [canEdit]
  );

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Attendance" />
        <Alert severity="warning">
          Please select a site to view attendance
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        height: { xs: "calc(100vh - 56px)", sm: "calc(100vh - 64px)" },
        minHeight: 0,
      }}
    >
      {/* ===== HEADER ROW 1: Title + Days Count + View Toggle + Refresh ===== */}
      <PageHeader
        title="Attendance"
        subtitle={isMobile ? undefined : selectedSite.name}
        titleChip={
          dateSummaries.length > 0 ? (
            <Chip
              label={`${dateSummaries.length} days`}
              size="small"
              color="primary"
              sx={{ height: 22, fontSize: "0.7rem", fontWeight: 500 }}
            />
          ) : null
        }
        onRefresh={fetchAttendanceHistory}
        isLoading={loading}
        actions={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {/* View Mode Toggle */}
            <Select
              value={viewMode}
              onChange={(e) =>
                setViewMode(e.target.value as "date-wise" | "detailed")
              }
              size="small"
              sx={{
                minWidth: { xs: 90, sm: 120 },
                height: 32,
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                bgcolor: "background.paper",
                "& .MuiSelect-select": { py: 0.5, px: 1 },
              }}
            >
              <MenuItem value="date-wise">Date View</MenuItem>
              <MenuItem value="detailed">Detailed View</MenuItem>
            </Select>
          </Box>
        }
      />

      {/* ===== HEADER ROW 2: Date Picker + Show Last Quick Filters (Same Row) ===== */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: { xs: 0.5, sm: 2 },
          mb: { xs: 1, sm: 2 },
          flexWrap: "nowrap",
        }}
      >
        {/* Date Range Picker */}
        <Box sx={{ flexShrink: 1, minWidth: 0 }}>
          <DateRangePicker
            startDate={new Date(dateFrom)}
            endDate={new Date(dateTo)}
            onChange={(start, end) => {
              setDateFrom(dayjs(start).format("YYYY-MM-DD"));
              setDateTo(dayjs(end).format("YYYY-MM-DD"));
            }}
          />
        </Box>

        {/* Show Last: Quick Filter Tags */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontSize: { xs: "0.65rem", sm: "0.8rem" },
              whiteSpace: "nowrap",
            }}
          >
            <Box
              component="span"
              sx={{ display: { xs: "none", sm: "inline" } }}
            >
              Show Last:
            </Box>
            <Box
              component="span"
              sx={{ display: { xs: "inline", sm: "none" } }}
            >
              SL
            </Box>
          </Typography>
          <Chip
            label="Week"
            size="small"
            variant="outlined"
            onClick={() => {
              // Current week from Sunday to today
              setDateFrom(dayjs().startOf("week").format("YYYY-MM-DD"));
              setDateTo(dayjs().format("YYYY-MM-DD"));
            }}
            sx={{
              height: { xs: 22, sm: 28 },
              fontSize: { xs: "0.65rem", sm: "0.8rem" },
              cursor: "pointer",
              "&:hover": { bgcolor: "action.hover" },
              "& .MuiChip-label": { px: { xs: 0.75, sm: 1.5 } },
            }}
          />
          <Chip
            label="Month"
            size="small"
            variant="outlined"
            onClick={() => {
              // Current month from 1st to today
              setDateFrom(dayjs().startOf("month").format("YYYY-MM-DD"));
              setDateTo(dayjs().format("YYYY-MM-DD"));
            }}
            sx={{
              height: { xs: 22, sm: 28 },
              fontSize: { xs: "0.65rem", sm: "0.8rem" },
              cursor: "pointer",
              "&:hover": { bgcolor: "action.hover" },
              "& .MuiChip-label": { px: { xs: 0.75, sm: 1.5 } },
            }}
          />
        </Box>
      </Box>

      {/* Period Summary Bar - Collapsible on Mobile */}
      <Paper
        sx={{ p: { xs: 0.75, sm: 2 }, mb: { xs: 1, sm: 2 }, flexShrink: 0 }}
      >
        {/* Mobile: Collapsible Summary */}
        <Box sx={{ display: { xs: "block", sm: "none" } }}>
          {/* Collapsed Header - Always visible on mobile */}
          <Box
            onClick={() => setSummaryExpanded(!summaryExpanded)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              py: 0.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.65rem" }}
              >
                Total
              </Typography>
              <Typography
                sx={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "primary.main",
                }}
              >
                ₹{periodTotals.totalExpense.toLocaleString()}
              </Typography>
              <Chip
                label={`Paid: ₹${periodTotals.totalPaidAmount.toLocaleString()}`}
                size="small"
                color="success"
                sx={{ height: 18, fontSize: "0.55rem" }}
              />
              <Chip
                label={`Pending: ₹${periodTotals.totalPendingAmount.toLocaleString()}`}
                size="small"
                color="warning"
                sx={{ height: 18, fontSize: "0.55rem" }}
              />
            </Box>
            <IconButton size="small" sx={{ p: 0.25 }}>
              {summaryExpanded ? (
                <ExpandLess fontSize="small" />
              ) : (
                <ExpandMore fontSize="small" />
              )}
            </IconButton>
          </Box>
          {/* Expanded Content */}
          <Collapse in={summaryExpanded}>
            <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
              {/* Row 1: Salary, Tea Shop */}
              <Box sx={{ display: "flex", alignItems: "stretch", mb: 1 }}>
                <Box sx={{ flex: 1, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                    Salary
                  </Typography>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "success.main" }}>
                    ₹{periodTotals.totalSalary.toLocaleString()}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                <Box sx={{ flex: 1, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                    Tea Shop
                  </Typography>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "secondary.main" }}>
                    ₹{periodTotals.totalTeaShop.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 0.5 }} />
              {/* Row 2: Daily, Contract, Market */}
              <Box sx={{ display: "flex", alignItems: "stretch", mb: 1 }}>
                <Box sx={{ flex: 1, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                    Daily
                  </Typography>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "warning.main" }}>
                    ₹{periodTotals.totalDailyAmount.toLocaleString()}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                <Box sx={{ flex: 1, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                    Contract
                  </Typography>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "info.main" }}>
                    ₹{periodTotals.totalContractAmount.toLocaleString()}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                <Box sx={{ flex: 1, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                    Market
                  </Typography>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "secondary.main" }}>
                    ₹{periodTotals.totalMarketAmount.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 0.5 }} />
              {/* Row 3: Avg/Day */}
              <Box sx={{ display: "flex", alignItems: "stretch" }}>
                <Box sx={{ flex: 1, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                    Avg/Day
                  </Typography>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    ₹{periodTotals.avgPerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Collapse>
        </Box>

        {/* Desktop: Always expanded with vertical separators */}
        <Box
          sx={{
            display: { xs: "none", sm: "flex" },
            alignItems: "stretch",
            gap: 2,
          }}
        >
          {/* Group 1: Period Total, Salary, Tea Shop */}
          <Box sx={{ display: "flex", flex: 1, gap: 2 }}>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                Period Total
              </Typography>
              <Typography
                sx={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "primary.main",
                }}
              >
                ₹{periodTotals.totalExpense.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                Salary
              </Typography>
              <Typography
                sx={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "success.main",
                }}
              >
                ₹{periodTotals.totalSalary.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                Tea Shop
              </Typography>
              <Typography
                sx={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "secondary.main",
                }}
              >
                ₹{periodTotals.totalTeaShop.toLocaleString()}
              </Typography>
            </Box>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Group 2: Daily, Contract, Market */}
          <Box sx={{ display: "flex", flex: 1, gap: 2 }}>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                Daily
              </Typography>
              <Typography
                sx={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "warning.main",
                }}
              >
                ₹{periodTotals.totalDailyAmount.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                Contract
              </Typography>
              <Typography
                sx={{ fontSize: "1.125rem", fontWeight: 600, color: "info.main" }}
              >
                ₹{periodTotals.totalContractAmount.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                Market
              </Typography>
              <Typography
                sx={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "secondary.main",
                }}
              >
                ₹{periodTotals.totalMarketAmount.toLocaleString()}
              </Typography>
            </Box>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Group 3: Paid, Pending, Avg/Day */}
          <Box sx={{ display: "flex", flex: 1, gap: 2 }}>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                Paid
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                <Typography
                  sx={{
                    fontSize: "1.125rem",
                    fontWeight: 600,
                    color: "success.main",
                  }}
                >
                  ₹{periodTotals.totalPaidAmount.toLocaleString()}
                </Typography>
                <Chip
                  label={periodTotals.totalPaidCount}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{
                    height: 24,
                    "& .MuiChip-label": { px: 0.5, fontSize: "0.75rem" },
                  }}
                />
              </Box>
            </Box>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                Pending
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                <Typography
                  sx={{
                    fontSize: "1.125rem",
                    fontWeight: 600,
                    color: "warning.main",
                  }}
                >
                  ₹{periodTotals.totalPendingAmount.toLocaleString()}
                </Typography>
                <Chip
                  label={periodTotals.totalPendingCount}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{
                    height: 24,
                    "& .MuiChip-label": { px: 0.5, fontSize: "0.75rem" },
                  }}
                />
              </Box>
            </Box>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                Avg/Day
              </Typography>
              <Typography sx={{ fontSize: "1.125rem", fontWeight: 600 }}>
                ₹
                {periodTotals.avgPerDay.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Data Display */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : viewMode === "date-wise" ? (
        <Box
          ref={tableContainerRef}
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            width: "100%",
            // Fullscreen styling - applied when using native Fullscreen API
            ...(isFullscreen && {
              bgcolor: "background.paper",
              height: "100vh",
              width: "100vw",
            }),
          }}
        >
          {/* Fullscreen Header - Only visible in fullscreen mode */}
          {isFullscreen && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 1,
                bgcolor: "primary.main",
                color: "white",
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Attendance Table
                </Typography>
                <Chip
                  label={`${dateSummaries.length} days`}
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    color: "white",
                    height: 24,
                  }}
                />
              </Box>
              <IconButton
                size="small"
                onClick={exitFullscreen}
                sx={{ color: "white" }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          )}
          <Paper
            sx={{
              borderRadius: isFullscreen ? 0 : 2,
              overflow: "hidden",
              position: "relative",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Fullscreen toggle - top right corner overlay (Mobile Only) */}
            {!isFullscreen && (
              <Tooltip title="View fullscreen">
                <IconButton
                  size="small"
                  onClick={enterFullscreen}
                  sx={{
                    display: { xs: "flex", sm: "none" },
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 10,
                    bgcolor: "rgba(255,255,255,0.95)",
                    boxShadow: 2,
                    "&:hover": { bgcolor: "background.paper" },
                  }}
                >
                  <Fullscreen fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          <TableContainer
            sx={{
              flex: 1,
              maxHeight: isFullscreen
                ? "calc(100vh - 56px)"
                : { xs: "calc(100vh - 320px)", sm: "calc(100vh - 300px)" },
              overflowX: "auto",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              width: "100%",
              // Make scrollbar visible on mobile
              "&::-webkit-scrollbar": {
                height: 8,
                width: 8,
                display: "block",
              },
              "&::-webkit-scrollbar-track": {
                bgcolor: "action.selected",
              },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: "grey.400",
                borderRadius: 4,
              },
            }}
          >
            <Table
              stickyHeader
              size="small"
              sx={{ minWidth: { xs: 600, sm: 800 } }}
            >
              <TableHead>
                <TableRow sx={{ bgcolor: "primary.dark" }}>
                  {/* Sticky expand column */}
                  <TableCell
                    sx={{
                      width: 40,
                      minWidth: 40,
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                    }}
                  ></TableCell>
                  {/* Sticky date column */}
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      position: "sticky",
                      left: 40,
                      zIndex: 3,
                      minWidth: { xs: 60, sm: 80 },
                      "&::after": {
                        content: '""',
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        background:
                          "linear-gradient(to right, rgba(0,0,0,0.15), transparent)",
                      },
                    }}
                  >
                    Date
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: { xs: 30, sm: 50 },
                      px: { xs: 0.5, sm: 1 },
                    }}
                    align="center"
                  >
                    <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                      Daily
                    </Box>
                    <Box sx={{ display: { xs: "inline", sm: "none" } }}>D</Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: { xs: 30, sm: 55 },
                      px: { xs: 0.5, sm: 1 },
                    }}
                    align="center"
                  >
                    <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                      Contract
                    </Box>
                    <Box sx={{ display: { xs: "inline", sm: "none" } }}>C</Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: { xs: 30, sm: 50 },
                      px: { xs: 0.5, sm: 1 },
                    }}
                    align="center"
                  >
                    <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                      Market
                    </Box>
                    <Box sx={{ display: { xs: "inline", sm: "none" } }}>M</Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: { xs: 30, sm: 45 },
                      px: { xs: 0.5, sm: 1 },
                    }}
                    align="center"
                  >
                    <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                      Total
                    </Box>
                    <Box sx={{ display: { xs: "inline", sm: "none" } }}>T</Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: 45,
                      display: { xs: "none", md: "table-cell" },
                    }}
                    align="center"
                  >
                    In
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: 45,
                      display: { xs: "none", md: "table-cell" },
                    }}
                    align="center"
                  >
                    Out
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: { xs: 55, sm: 70 },
                      px: { xs: 0.5, sm: 1 },
                    }}
                    align="right"
                  >
                    <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                      Salary
                    </Box>
                    <Box sx={{ display: { xs: "inline", sm: "none" } }}>
                      Sal
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: 80,
                      display: { xs: "none", sm: "table-cell" },
                    }}
                    align="center"
                  >
                    Tea Shop
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: { xs: 55, sm: 70 },
                      px: { xs: 0.5, sm: 1 },
                    }}
                    align="right"
                  >
                    <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                      Expense
                    </Box>
                    <Box sx={{ display: { xs: "inline", sm: "none" } }}>
                      Exp
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: 120,
                      display: { xs: "none", md: "table-cell" },
                    }}
                  >
                    Work
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "primary.dark",
                      color: "primary.contrastText",
                      fontWeight: 700,
                      minWidth: { xs: 50, sm: 90 },
                      px: { xs: 0.5, sm: 1 },
                    }}
                  >
                    <Box sx={{ display: { xs: "none", sm: "inline" } }}>
                      Status
                    </Box>
                    <Box sx={{ display: { xs: "inline", sm: "none" } }}>St</Box>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {combinedDateEntries.map((entry) => (
                  <React.Fragment key={entry.date}>
                    {/* Holiday-only row (no attendance data) */}
                    {entry.type === "holiday" && (
                      <TableRow
                        sx={{
                          bgcolor: "warning.50",
                          "&:hover": { bgcolor: "warning.100" },
                        }}
                      >
                        <TableCell
                          colSpan={13}
                          sx={{
                            py: 1.5,
                            borderLeft: 4,
                            borderLeftColor: "warning.main",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              flexWrap: "wrap",
                            }}
                          >
                            <BeachAccessIcon
                              sx={{ color: "warning.main", fontSize: 24 }}
                            />
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ minWidth: 80 }}
                            >
                              {dayjs(entry.date).format("DD MMM")}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {dayjs(entry.date).format("dddd")}
                            </Typography>
                            <Chip
                              label="Holiday"
                              size="small"
                              color="warning"
                              sx={{ fontWeight: 600 }}
                            />
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontStyle: "italic" }}
                            >
                              {entry.holiday?.reason || "No reason specified"}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Attendance row (with optional holiday indicator) */}
                    {entry.type === "attendance" && (
                      <>
                    <TableRow
                      hover
                      onClick={() => toggleDateExpanded(entry.summary.date)}
                      sx={{
                        cursor: "pointer",
                        "&:hover": { bgcolor: "action.hover" },
                        // Highlight if this date is also a holiday
                        ...(entry.holiday && {
                          bgcolor: "warning.50",
                          borderLeft: 4,
                          borderLeftColor: "warning.main",
                        }),
                      }}
                    >
                      {/* Sticky expand cell */}
                      <TableCell
                        sx={{
                          position: "sticky",
                          left: 0,
                          bgcolor: entry.holiday ? "warning.50" : "background.paper",
                          zIndex: 1,
                        }}
                      >
                        <IconButton size="small">
                          {entry.summary.isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      {/* Sticky date cell */}
                      <TableCell
                        sx={{
                          position: "sticky",
                          left: 40,
                          bgcolor: entry.holiday ? "warning.50" : "background.paper",
                          zIndex: 1,
                          "&::after": {
                            content: '""',
                            position: "absolute",
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: 4,
                            background:
                              "linear-gradient(to right, rgba(0,0,0,0.08), transparent)",
                          },
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          {entry.holiday && (
                            <Tooltip title={`Holiday: ${entry.holiday.reason || "No reason"}`}>
                              <BeachAccessIcon
                                sx={{ color: "warning.main", fontSize: 16 }}
                              />
                            </Tooltip>
                          )}
                          <Box>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
                            >
                              {dayjs(entry.summary.date).format("DD MMM")}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontSize: { xs: "0.65rem", sm: "0.75rem" } }}
                            >
                              {dayjs(entry.summary.date).format("ddd")}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={entry.summary.dailyLaborerCount}
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={entry.summary.contractLaborerCount}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={entry.summary.marketLaborerCount}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={700}>
                          {entry.summary.totalLaborerCount}
                        </Typography>
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ display: { xs: "none", md: "table-cell" } }}
                      >
                        <Typography variant="caption">
                          {formatTime(entry.summary.firstInTime)}
                        </Typography>
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ display: { xs: "none", md: "table-cell" } }}
                      >
                        <Typography variant="caption">
                          {entry.summary.attendanceStatus === "morning_entry"
                            ? "-"
                            : formatTime(entry.summary.lastOutTime)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color="success.main"
                        >
                          ₹{entry.summary.totalSalary.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ display: { xs: "none", sm: "table-cell" } }}
                      >
                        {entry.summary.teaShop ? (
                          <Chip
                            icon={<TeaIcon fontSize="small" />}
                            label={`₹${entry.summary.teaShop.total.toLocaleString()}`}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTeaShopPopoverAnchor(e.currentTarget);
                              setTeaShopPopoverData({
                                date: entry.summary.date,
                                data: entry.summary.teaShop!,
                              });
                            }}
                            sx={{ cursor: "pointer" }}
                          />
                        ) : (
                          <Chip
                            icon={<TeaIcon fontSize="small" />}
                            label="Add"
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTeaShopDialog(entry.summary.date);
                            }}
                            sx={{ cursor: "pointer", opacity: 0.6 }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          color="primary.main"
                        >
                          ₹
                          {(
                            entry.summary.totalExpense + (entry.summary.teaShop?.total || 0)
                          ).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: "none", md: "table-cell" } }}
                      >
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Tooltip
                            title={
                              entry.summary.workDescription ||
                              entry.summary.workUpdates?.morning?.description ||
                              "No description"
                            }
                          >
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{ maxWidth: 100, display: "block" }}
                            >
                              {entry.summary.workDescription ||
                                entry.summary.workUpdates?.morning?.description ||
                                "-"}
                            </Typography>
                          </Tooltip>
                          {entry.summary.workUpdates && (
                            <PhotoBadge
                              photoCount={
                                (entry.summary.workUpdates.morning?.photos?.length ||
                                  0) +
                                (entry.summary.workUpdates.evening?.photos?.length ||
                                  0)
                              }
                              completionPercent={
                                entry.summary.workUpdates.evening?.completionPercent
                              }
                              onClick={() => {
                                setSelectedWorkUpdate({
                                  workUpdates: entry.summary.workUpdates,
                                  date: entry.summary.date,
                                });
                                setWorkUpdateViewerOpen(true);
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {entry.summary.attendanceStatus === "morning_entry" ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Chip
                              label="🌅 Morning"
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                            <Tooltip title="Edit morning entry">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrawerForDate(entry.summary.date, "morning");
                                }}
                                disabled={!canEdit}
                              >
                                <Edit sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Confirm attendance">
                              <Chip
                                label="Confirm"
                                size="small"
                                color="info"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrawerForDate(entry.summary.date, "evening");
                                }}
                                sx={{ cursor: canEdit ? "pointer" : "default" }}
                                disabled={!canEdit}
                              />
                            </Tooltip>
                          </Box>
                        ) : (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Chip
                              label="✓ Confirmed"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                            <Tooltip title="Edit attendance">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrawerForDate(entry.summary.date, "full");
                                }}
                                disabled={!canEdit}
                              >
                                <Edit sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={13} sx={{ py: 0, border: 0 }}>
                        <Collapse
                          in={entry.summary.isExpanded}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box sx={{ p: 2, bgcolor: "action.hover" }}>
                            {/* Header with Manage Button and Laborer Type Chips */}
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                mb: 2,
                                flexWrap: "wrap",
                                gap: 1,
                              }}
                            >
                              {/* Left side: Contract/Market chips */}
                              <Box
                                sx={{
                                  display: "flex",
                                  gap: { xs: 0.5, sm: 1 },
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                }}
                              >
                                {entry.summary.contractLaborerCount > 0 && (
                                  <Chip
                                    label={
                                      <Box
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                        }}
                                      >
                                        Contract: ₹
                                        {entry.summary.contractLaborerAmount.toLocaleString()}
                                        <Box
                                          component="span"
                                          sx={{ opacity: 0.8 }}
                                        >
                                          ({entry.summary.contractLaborerCount})
                                        </Box>
                                      </Box>
                                    }
                                    size="small"
                                    color="info"
                                    variant="filled"
                                    sx={{
                                      height: { xs: 22, sm: 24 },
                                      "& .MuiChip-label": {
                                        px: { xs: 0.75, sm: 1 },
                                        fontSize: {
                                          xs: "0.65rem",
                                          sm: "0.75rem",
                                        },
                                      },
                                    }}
                                  />
                                )}
                                {entry.summary.marketLaborerCount > 0 && (
                                  <Chip
                                    label={
                                      <Box
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                        }}
                                      >
                                        Market: ₹
                                        {entry.summary.marketLaborerAmount.toLocaleString()}
                                        <Box
                                          component="span"
                                          sx={{ opacity: 0.8 }}
                                        >
                                          ({entry.summary.marketLaborerCount})
                                        </Box>
                                      </Box>
                                    }
                                    size="small"
                                    color="secondary"
                                    variant="filled"
                                    sx={{
                                      height: { xs: 22, sm: 24 },
                                      "& .MuiChip-label": {
                                        px: { xs: 0.75, sm: 1 },
                                        fontSize: {
                                          xs: "0.65rem",
                                          sm: "0.75rem",
                                        },
                                      },
                                    }}
                                  />
                                )}
                              </Box>
                              {/* Right side: Audit Avatar and Edit Button */}
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
                                }}
                              >
                                {/* Audit Avatar - show who created/edited this entry */}
                                {entry.summary.records.length > 0 && (
                                  <AuditAvatarGroup
                                    createdByName={
                                      entry.summary.records[0]?.entered_by
                                    }
                                    createdByAvatar={
                                      entry.summary.records[0]?.entered_by_avatar
                                    }
                                    createdAt={entry.summary.records[0]?.created_at}
                                    updatedByName={
                                      entry.summary.records[0]?.updated_by
                                    }
                                    updatedByAvatar={
                                      entry.summary.records[0]?.updated_by_avatar
                                    }
                                    updatedAt={entry.summary.records[0]?.updated_at}
                                    compact
                                    size="small"
                                  />
                                )}
                                {canEdit &&
                                  entry.summary.attendanceStatus ===
                                    "morning_entry" && (
                                    <Button
                                      variant="contained"
                                      color="success"
                                      size="small"
                                      onClick={() =>
                                        handleOpenDrawerForDate(
                                          entry.summary.date,
                                          "evening"
                                        )
                                      }
                                    >
                                      🌆 Confirm Attendance
                                    </Button>
                                  )}
                                {/* View Summary Button */}
                                <Tooltip title="View attendance summary">
                                  <IconButton
                                    size="small"
                                    color="info"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewSummaryDate(entry.summary.date);
                                    }}
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {canEdit &&
                                  entry.summary.attendanceStatus !==
                                    "morning_entry" && (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      startIcon={<Edit />}
                                      onClick={() =>
                                        handleOpenDrawerForDate(
                                          entry.summary.date,
                                          "full"
                                        )
                                      }
                                    >
                                      Edit Attendance
                                    </Button>
                                  )}
                                {canEdit && (
                                  <Tooltip title="Delete all attendance for this day">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDateAttendance(
                                          entry.summary.date
                                        );
                                      }}
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>

                            {/* Work Description */}
                            {(entry.summary.workDescription || entry.summary.comments) && (
                              <Box
                                sx={{
                                  mb: 2,
                                  p: 1.5,
                                  bgcolor: "background.paper",
                                  borderRadius: 1,
                                  border: "1px solid",
                                  borderColor: "divider",
                                }}
                              >
                                {entry.summary.workDescription && (
                                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                                    <strong>Work:</strong>{" "}
                                    {entry.summary.workDescription}
                                  </Typography>
                                )}
                                {entry.summary.workStatus && (
                                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                                    <strong>Status:</strong>{" "}
                                    {entry.summary.workStatus}
                                  </Typography>
                                )}
                                {entry.summary.comments && (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    <strong>Comments:</strong>{" "}
                                    {entry.summary.comments}
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {/* Individual Records Table */}
                            {entry.summary.records.length > 0 && (
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: "primary.light" }}>
                                    <TableCell sx={{ fontWeight: 700 }}>
                                      Name
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>
                                      Type
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>
                                      Team
                                    </TableCell>
                                    <TableCell
                                      sx={{ fontWeight: 700 }}
                                      align="center"
                                    >
                                      In
                                    </TableCell>
                                    <TableCell
                                      sx={{ fontWeight: 700 }}
                                      align="center"
                                    >
                                      Out
                                    </TableCell>
                                    <TableCell
                                      sx={{ fontWeight: 700 }}
                                      align="center"
                                    >
                                      Work Hrs
                                    </TableCell>
                                    <TableCell
                                      sx={{ fontWeight: 700 }}
                                      align="center"
                                    >
                                      W/D Units
                                    </TableCell>
                                    <TableCell
                                      sx={{ fontWeight: 700 }}
                                      align="right"
                                    >
                                      Salary
                                    </TableCell>
                                    <TableCell
                                      sx={{ fontWeight: 700 }}
                                      align="right"
                                    >
                                      Snacks
                                    </TableCell>
                                    <TableCell
                                      sx={{ fontWeight: 700 }}
                                      align="center"
                                    >
                                      Payment
                                    </TableCell>
                                    <TableCell
                                      sx={{ fontWeight: 700 }}
                                      align="center"
                                    >
                                      Actions
                                    </TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {entry.summary.records.map((record) => (
                                    <TableRow key={record.id} hover>
                                      <TableCell>
                                        {record.laborer_name}
                                      </TableCell>
                                      <TableCell>
                                        <Chip
                                          label={
                                            record.laborer_type === "contract"
                                              ? "C"
                                              : "D"
                                          }
                                          size="small"
                                          color={
                                            record.laborer_type === "contract"
                                              ? "info"
                                              : "warning"
                                          }
                                          variant="outlined"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {record.team_name || "-"}
                                      </TableCell>
                                      <TableCell align="center">
                                        {formatTime(record.in_time)}
                                      </TableCell>
                                      <TableCell align="center">
                                        {record.attendance_status ===
                                        "morning_entry"
                                          ? "-"
                                          : formatTime(record.out_time)}
                                      </TableCell>
                                      <TableCell align="center">
                                        {record.work_hours
                                          ? `${record.work_hours}h`
                                          : "-"}
                                      </TableCell>
                                      <TableCell align="center">
                                        <Chip
                                          label={
                                            record.day_units || record.work_days
                                          }
                                          size="small"
                                          color="primary"
                                          variant="outlined"
                                        />
                                      </TableCell>
                                      <TableCell align="right">
                                        ₹
                                        {record.daily_earnings.toLocaleString()}
                                      </TableCell>
                                      <TableCell align="right">
                                        {record.snacks_amount
                                          ? `₹${record.snacks_amount}`
                                          : "-"}
                                      </TableCell>
                                      <TableCell align="center">
                                        {record.laborer_type === "contract" ? (
                                          <Chip
                                            label="In Contract"
                                            size="small"
                                            color="info"
                                            variant="outlined"
                                          />
                                        ) : record.is_paid ? (
                                          <Chip
                                            label="PAID"
                                            size="small"
                                            color="success"
                                            variant="filled"
                                          />
                                        ) : (
                                          <Chip
                                            label="PENDING"
                                            size="small"
                                            color="warning"
                                            variant="outlined"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (canEdit)
                                                handleOpenPaymentDialog(record);
                                            }}
                                            sx={{
                                              cursor: canEdit
                                                ? "pointer"
                                                : "default",
                                            }}
                                          />
                                        )}
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box
                                          sx={{
                                            display: "flex",
                                            gap: 0.5,
                                            justifyContent: "center",
                                          }}
                                        >
                                          {/* Record Payment button for pending daily laborers */}
                                          {record.laborer_type !== "contract" &&
                                            !record.is_paid &&
                                            canEdit && (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                color="success"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenPaymentDialog(
                                                    record
                                                  );
                                                }}
                                                sx={{
                                                  minWidth: 50,
                                                  px: 1,
                                                  fontSize: 11,
                                                }}
                                              >
                                                Pay
                                              </Button>
                                            )}
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenEditDialog(record);
                                            }}
                                            disabled={!canEdit}
                                          >
                                            <Edit fontSize="small" />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            color="error"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDelete(record.id);
                                            }}
                                            disabled={!canEdit}
                                          >
                                            <Delete fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}

                            {/* Market Laborers Section */}
                            {entry.summary.marketLaborers &&
                              entry.summary.marketLaborers.length > 0 && (
                                <Box
                                  sx={{
                                    mt: entry.summary.records.length > 0 ? 2 : 0,
                                  }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    sx={{
                                      mb: 1,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <Chip
                                      label="Market Laborers"
                                      size="small"
                                      color="secondary"
                                    />
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      ({entry.summary.marketLaborers.length} workers)
                                    </Typography>
                                  </Typography>
                                  <Table
                                    size="small"
                                    sx={{ bgcolor: "secondary.50" }}
                                  >
                                    <TableHead>
                                      <TableRow sx={{ bgcolor: "secondary.main" }}>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            color: "white",
                                          }}
                                        >
                                          Name
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            color: "white",
                                          }}
                                        >
                                          Role
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            color: "white",
                                          }}
                                          align="center"
                                        >
                                          In
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            color: "white",
                                          }}
                                          align="center"
                                        >
                                          Out
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            color: "white",
                                          }}
                                          align="center"
                                        >
                                          Units
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            color: "white",
                                          }}
                                          align="right"
                                        >
                                          Rate
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            color: "white",
                                          }}
                                          align="right"
                                        >
                                          Salary
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            color: "white",
                                          }}
                                          align="center"
                                        >
                                          Payment
                                        </TableCell>
                                        <TableCell
                                          sx={{
                                            fontWeight: 700,
                                            color: "white",
                                          }}
                                          align="center"
                                        >
                                          Actions
                                        </TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {entry.summary.marketLaborers.map((ml) => (
                                        <TableRow
                                          key={ml.id}
                                          sx={{
                                            "&:hover": {
                                              bgcolor: "secondary.100 !important",
                                            },
                                          }}
                                        >
                                          <TableCell>
                                            <Typography
                                              variant="body2"
                                              fontWeight={500}
                                            >
                                              {ml.tempName}
                                            </Typography>
                                          </TableCell>
                                          <TableCell>
                                            <Chip
                                              label={ml.roleName}
                                              size="small"
                                              variant="outlined"
                                              color="secondary"
                                              sx={{ fontSize: "0.7rem" }}
                                            />
                                          </TableCell>
                                          <TableCell align="center">
                                            {ml.inTime
                                              ? ml.inTime.substring(0, 5)
                                              : "-"}
                                          </TableCell>
                                          <TableCell align="center">
                                            {ml.outTime
                                              ? ml.outTime.substring(0, 5)
                                              : "-"}
                                          </TableCell>
                                          <TableCell align="center">
                                            {ml.dayUnits}
                                          </TableCell>
                                          <TableCell align="right">
                                            ₹{ml.ratePerPerson.toLocaleString()}
                                          </TableCell>
                                          <TableCell align="right">
                                            <Typography fontWeight={600}>
                                              ₹
                                              {ml.dailyEarnings.toLocaleString()}
                                            </Typography>
                                          </TableCell>
                                          <TableCell align="center">
                                            <Chip
                                              label={
                                                ml.isPaid ? "Paid" : "Pending"
                                              }
                                              size="small"
                                              color={
                                                ml.isPaid
                                                  ? "success"
                                                  : "warning"
                                              }
                                              variant={
                                                ml.isPaid
                                                  ? "filled"
                                                  : "outlined"
                                              }
                                              sx={{ fontSize: "0.65rem" }}
                                            />
                                          </TableCell>
                                          <TableCell align="center">
                                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                                              <Tooltip title={ml.groupCount > 1 ? `Edit all ${ml.groupCount} ${ml.roleName}(s)` : "Edit"}>
                                                <span>
                                                  <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleOpenMarketLaborerEdit(ml);
                                                    }}
                                                    disabled={!canEdit}
                                                  >
                                                    <Edit fontSize="small" />
                                                  </IconButton>
                                                </span>
                                              </Tooltip>
                                              <Tooltip title={ml.groupCount > 1 ? `Delete all ${ml.groupCount} ${ml.roleName}(s)` : "Delete"}>
                                                <span>
                                                  <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleDeleteMarketLaborer(ml);
                                                    }}
                                                    disabled={!canEdit}
                                                  >
                                                    <Delete fontSize="small" />
                                                  </IconButton>
                                                </span>
                                              </Tooltip>
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      {/* Market Laborers Total Row */}
                                      <TableRow
                                        sx={{ bgcolor: "secondary.100" }}
                                      >
                                        <TableCell colSpan={6}>
                                          <Typography
                                            variant="body2"
                                            fontWeight={700}
                                          >
                                            Market Labor Total (
                                            {entry.summary.marketLaborers.length}{" "}
                                            workers)
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography
                                            fontWeight={700}
                                            color="secondary.main"
                                          >
                                            ₹
                                            {entry.summary.marketLaborerAmount.toLocaleString()}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                          <Chip
                                            label={`Pending: ₹${entry.summary.marketLaborerAmount.toLocaleString()}`}
                                            size="small"
                                            color="warning"
                                            sx={{ fontSize: "0.65rem" }}
                                          />
                                        </TableCell>
                                        <TableCell />
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </Box>
                              )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                      </>
                    )}
                  </React.Fragment>
                ))}
                {combinedDateEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No attendance records found for the selected date range
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          </Paper>
        </Box>
      ) : (
        <DataTable
          columns={detailedColumns}
          data={attendanceRecords}
          isLoading={loading}
        />
      )}

      {/* Attendance Drawer */}
      <AttendanceDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedDateForDrawer(undefined);
          setDrawerMode("full");
        }}
        siteId={selectedSite.id}
        date={selectedDateForDrawer}
        onSuccess={() => {
          fetchAttendanceHistory();
          setSelectedDateForDrawer(undefined);
          setDrawerMode("full");
        }}
        mode={drawerMode}
      />

      {/* Tea Shop Entry Dialog (Direct) */}
      {teaShopAccount && (
        <TeaShopEntryDialog
          open={teaShopDialogOpen}
          onClose={() => {
            setTeaShopDialogOpen(false);
            setTeaShopDialogDate(undefined);
            setTeaShopEditingEntry(null);
          }}
          shop={teaShopAccount}
          entry={teaShopEditingEntry}
          initialDate={teaShopDialogDate}
          onSuccess={() => {
            fetchAttendanceHistory();
            setTeaShopDialogOpen(false);
            setTeaShopDialogDate(undefined);
            setTeaShopEditingEntry(null);
          }}
        />
      )}

      {/* Work Update Viewer Dialog */}
      <WorkUpdateViewer
        open={workUpdateViewerOpen}
        onClose={() => {
          setWorkUpdateViewerOpen(false);
          setSelectedWorkUpdate(null);
        }}
        workUpdates={selectedWorkUpdate?.workUpdates || null}
        siteName={selectedSite?.name}
        date={selectedWorkUpdate?.date || ""}
      />

      {/* Edit Attendance Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Attendance</DialogTitle>
        <DialogContent>
          {editingRecord && (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
            >
              <Alert severity="info">
                Editing attendance for{" "}
                <strong>{editingRecord.laborer_name}</strong> on{" "}
                {dayjs(editingRecord.date).format("DD MMM YYYY")}
              </Alert>

              <FormControl fullWidth size="small">
                <InputLabel>W/D Units</InputLabel>
                <Select
                  value={editForm.work_days}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      work_days: e.target.value as number,
                    })
                  }
                  label="W/D Units"
                >
                  <MenuItem value={0.5}>0.5 (Half Day)</MenuItem>
                  <MenuItem value={1}>1 (Full Day)</MenuItem>
                  <MenuItem value={1.5}>1.5</MenuItem>
                  <MenuItem value={2}>2</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Daily Rate"
                type="number"
                size="small"
                value={editForm.daily_rate_applied}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    daily_rate_applied: Number(e.target.value),
                  })
                }
                slotProps={{
                  input: {
                    startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography>,
                  },
                }}
              />

              <Box
                sx={{
                  p: 2,
                  bgcolor: "action.selected",
                  borderRadius: 1,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Total Salary:
                </Typography>
                <Typography
                  variant="body1"
                  fontWeight={700}
                  color="success.main"
                >
                  ₹
                  {(
                    editForm.work_days * editForm.daily_rate_applied
                  ).toLocaleString()}
                </Typography>
              </Box>

              {editingRecord.laborer_type !== "contract" &&
                !editingRecord.is_paid && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    To record payment, close this dialog and click the
                    &quot;Pay&quot; button or the PENDING chip.
                  </Alert>
                )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditSubmit}
            variant="contained"
            disabled={loading}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Market Laborer Edit Dialog */}
      <Dialog
        open={marketLaborerEditOpen}
        onClose={() => {
          setMarketLaborerEditOpen(false);
          setEditingMarketLaborer(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Market Laborer
          {editingMarketLaborer && editingMarketLaborer.groupCount > 1 && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (All {editingMarketLaborer.groupCount} {editingMarketLaborer.roleName}s)
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {editingMarketLaborer && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
              <Alert severity="info">
                Editing <strong>{editingMarketLaborer.roleName}</strong> on{" "}
                {dayjs(editingMarketLaborer.date).format("DD MMM YYYY")}
                {editingMarketLaborer.groupCount > 1 && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    This will update all {editingMarketLaborer.groupCount} workers in this group.
                  </Typography>
                )}
              </Alert>

              <TextField
                fullWidth
                label="Number of Workers"
                type="number"
                size="small"
                value={marketLaborerEditForm.count}
                onChange={(e) =>
                  setMarketLaborerEditForm({
                    ...marketLaborerEditForm,
                    count: Math.max(1, Number(e.target.value)),
                  })
                }
                slotProps={{
                  input: { inputProps: { min: 1 } },
                }}
              />

              <FormControl fullWidth size="small">
                <InputLabel>W/D Units</InputLabel>
                <Select
                  value={marketLaborerEditForm.day_units}
                  onChange={(e) =>
                    setMarketLaborerEditForm({
                      ...marketLaborerEditForm,
                      day_units: e.target.value as number,
                    })
                  }
                  label="W/D Units"
                >
                  <MenuItem value={0.5}>0.5 (Half Day)</MenuItem>
                  <MenuItem value={1}>1 (Full Day)</MenuItem>
                  <MenuItem value={1.5}>1.5</MenuItem>
                  <MenuItem value={2}>2</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Rate per Person"
                type="number"
                size="small"
                value={marketLaborerEditForm.rate_per_person}
                onChange={(e) =>
                  setMarketLaborerEditForm({
                    ...marketLaborerEditForm,
                    rate_per_person: Number(e.target.value),
                  })
                }
                slotProps={{
                  input: {
                    startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography>,
                  },
                }}
              />

              <Box
                sx={{
                  p: 2,
                  bgcolor: "action.selected",
                  borderRadius: 1,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Per Person:
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    ₹{(marketLaborerEditForm.rate_per_person * marketLaborerEditForm.day_units).toLocaleString()}
                  </Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body1" fontWeight={600}>
                    Total ({marketLaborerEditForm.count} workers):
                  </Typography>
                  <Typography variant="body1" fontWeight={700} color="success.main">
                    ₹{(marketLaborerEditForm.count * marketLaborerEditForm.rate_per_person * marketLaborerEditForm.day_units).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMarketLaborerEditOpen(false);
              setEditingMarketLaborer(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveMarketLaborerEdit}
            variant="contained"
            disabled={loading}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tea Shop Popover */}
      <Popover
        open={Boolean(teaShopPopoverAnchor)}
        anchorEl={teaShopPopoverAnchor}
        onClose={() => {
          setTeaShopPopoverAnchor(null);
          setTeaShopPopoverData(null);
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        {teaShopPopoverData && (
          <Box sx={{ p: 2, minWidth: 280 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Tea Shop: {dayjs(teaShopPopoverData.date).format("DD MMM YYYY")}
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}
            >
              <Typography variant="body2">Tea:</Typography>
              <Typography variant="body2" fontWeight={500}>
                ₹{teaShopPopoverData.data.teaTotal.toLocaleString()}
              </Typography>
            </Box>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}
            >
              <Typography variant="body2">Snacks:</Typography>
              <Typography variant="body2" fontWeight={500}>
                ₹{teaShopPopoverData.data.snacksTotal.toLocaleString()}
              </Typography>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.5 }}
            >
              Consumption Breakdown:
            </Typography>

            {teaShopPopoverData.data.workingCount > 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.25,
                }}
              >
                <Typography variant="caption">
                  Working ({teaShopPopoverData.data.workingCount}):
                </Typography>
                <Typography variant="caption">
                  ₹{teaShopPopoverData.data.workingTotal.toLocaleString()}
                </Typography>
              </Box>
            )}
            {teaShopPopoverData.data.nonWorkingCount > 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.25,
                }}
              >
                <Typography variant="caption">
                  Non-Working ({teaShopPopoverData.data.nonWorkingCount}):
                </Typography>
                <Typography variant="caption">
                  ₹{teaShopPopoverData.data.nonWorkingTotal.toLocaleString()}
                </Typography>
              </Box>
            )}
            {teaShopPopoverData.data.marketCount > 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.25,
                }}
              >
                <Typography variant="caption">
                  Market ({teaShopPopoverData.data.marketCount}):
                </Typography>
                <Typography variant="caption">
                  ₹{teaShopPopoverData.data.marketTotal.toLocaleString()}
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" fontWeight={700}>
                Total:
              </Typography>
              <Typography variant="body2" fontWeight={700} color="primary.main">
                ₹{teaShopPopoverData.data.total.toLocaleString()}
              </Typography>
            </Box>

            <Button
              fullWidth
              size="small"
              variant="outlined"
              sx={{ mt: 1.5 }}
              onClick={() => {
                const dateToEdit = teaShopPopoverData.date;
                setTeaShopPopoverAnchor(null);
                setTeaShopPopoverData(null);
                handleOpenTeaShopDialog(dateToEdit);
              }}
            >
              Edit
            </Button>
          </Box>
        )}
      </Popover>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => {
          setPaymentDialogOpen(false);
          setPaymentRecords([]);
        }}
        dailyRecords={paymentRecords}
        allowSubcontractLink
        onSuccess={handlePaymentSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteDialogData(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "error.main",
          }}
        >
          <Delete />
          Delete Attendance Record
        </DialogTitle>
        <DialogContent>
          {deleteDialogData && (
            <Box sx={{ mt: 1 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                You are about to delete <strong>ALL</strong> attendance records
                for this date. This action cannot be undone.
              </Alert>

              <Box sx={{ bgcolor: "action.hover", p: 2, borderRadius: 1, mb: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ minWidth: 80 }}
                  >
                    Site:
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {deleteDialogData.siteName}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ minWidth: 80 }}
                  >
                    Date:
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {dayjs(deleteDialogData.date).format("dddd, DD MMMM YYYY")}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ minWidth: 80 }}
                  >
                    Laborers:
                  </Typography>
                  <Typography variant="body1">
                    {deleteDialogData.dailyCount} daily
                    {deleteDialogData.marketCount > 0 &&
                      `, ${deleteDialogData.marketCount} market`}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ minWidth: 80 }}
                  >
                    Total:
                  </Typography>
                  <Typography
                    variant="body1"
                    fontWeight={700}
                    color="error.main"
                  >
                    ₹{deleteDialogData.totalAmount.toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="caption" color="text.secondary">
                This will also delete all tea shop entries and work summaries
                for this date.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteDialogData(null);
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteDateAttendance}
            variant="contained"
            color="error"
            startIcon={<Delete />}
            disabled={loading}
          >
            Delete All
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Attendance Summary Dialog */}
      <Dialog
        open={Boolean(viewSummaryDate)}
        onClose={() => setViewSummaryDate(null)}
        maxWidth="md"
        fullWidth
      >
        {viewSummaryDate && (() => {
          const summaryEntry = combinedDateEntries.find(
            (e) => e.type === "attendance" && e.date === viewSummaryDate
          );
          const summary = summaryEntry?.type === "attendance" ? summaryEntry.summary : null;

          if (!summary) return null;

          return (
            <>
              <DialogTitle sx={{ bgcolor: "primary.main", color: "white" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <VisibilityIcon />
                  <Box>
                    <Typography variant="h6">
                      Attendance Summary
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      {dayjs(viewSummaryDate).format("dddd, DD MMMM YYYY")}
                    </Typography>
                  </Box>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ p: 3 }}>
                {/* Summary Stats */}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
                  <Paper sx={{ p: 2, flex: "1 1 150px", textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">Total Laborers</Typography>
                    <Typography variant="h4" fontWeight={700}>{summary.totalLaborerCount}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, flex: "1 1 150px", textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">Daily/Contract</Typography>
                    <Typography variant="h4" fontWeight={700} color="info.main">
                      {summary.dailyLaborerCount + summary.contractLaborerCount}
                    </Typography>
                  </Paper>
                  <Paper sx={{ p: 2, flex: "1 1 150px", textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">Market</Typography>
                    <Typography variant="h4" fontWeight={700} color="secondary.main">
                      {summary.marketLaborerCount}
                    </Typography>
                  </Paper>
                  <Paper sx={{ p: 2, flex: "1 1 150px", textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">Total Expense</Typography>
                    <Typography variant="h4" fontWeight={700} color="success.main">
                      ₹{(summary.totalExpense + (summary.teaShop?.total || 0)).toLocaleString()}
                    </Typography>
                  </Paper>
                </Box>

                {/* Status */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Status</Typography>
                  <Chip
                    label={summary.attendanceStatus === "morning_entry" ? "🌅 Morning Only" : "✓ Confirmed"}
                    color={summary.attendanceStatus === "morning_entry" ? "warning" : "success"}
                  />
                </Box>

                {/* Timing */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Work Timing</Typography>
                  <Box sx={{ display: "flex", gap: 3 }}>
                    <Typography variant="body2">
                      <strong>First In:</strong> {formatTime(summary.firstInTime) || "N/A"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Last Out:</strong> {summary.attendanceStatus === "morning_entry" ? "Pending" : formatTime(summary.lastOutTime) || "N/A"}
                    </Typography>
                  </Box>
                </Box>

                {/* Work Description */}
                {(summary.workDescription || summary.comments) && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Work Description</Typography>
                    <Paper sx={{ p: 2, bgcolor: "action.hover" }}>
                      {summary.workDescription && (
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {summary.workDescription}
                        </Typography>
                      )}
                      {summary.comments && (
                        <Typography variant="body2" color="text.secondary">
                          Comments: {summary.comments}
                        </Typography>
                      )}
                    </Paper>
                  </Box>
                )}

                {/* Laborers List */}
                {summary.records.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Laborers ({summary.records.length})
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: "action.selected" }}>
                            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>In</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Out</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Days</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Earnings</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Payment</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {summary.records.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell>{record.laborer_name}</TableCell>
                              <TableCell>
                                <Chip
                                  label={record.laborer_type === "contract" ? "Contract" : "Daily"}
                                  size="small"
                                  color={record.laborer_type === "contract" ? "info" : "warning"}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>{record.team_name || "-"}</TableCell>
                              <TableCell align="center">{formatTime(record.in_time) || "-"}</TableCell>
                              <TableCell align="center">{formatTime(record.out_time) || "-"}</TableCell>
                              <TableCell align="center">{record.work_days}</TableCell>
                              <TableCell align="right">₹{record.daily_earnings.toLocaleString()}</TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={record.is_paid ? "Paid" : "Pending"}
                                  size="small"
                                  color={record.is_paid ? "success" : "warning"}
                                  variant={record.is_paid ? "filled" : "outlined"}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

                {/* Market Laborers */}
                {summary.marketLaborers && summary.marketLaborers.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Market Laborers ({summary.marketLaborers.length})
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: "secondary.50" }}>
                            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>In</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Out</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Days</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Earnings</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {summary.marketLaborers.map((ml) => (
                            <TableRow key={ml.id}>
                              <TableCell>{ml.tempName}</TableCell>
                              <TableCell>
                                <Chip
                                  label={ml.roleName}
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell align="center">{ml.inTime?.substring(0, 5) || "-"}</TableCell>
                              <TableCell align="center">{ml.outTime?.substring(0, 5) || "-"}</TableCell>
                              <TableCell align="center">{ml.dayUnits}</TableCell>
                              <TableCell align="right">₹{ml.dailyEarnings.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

                {/* Tea Shop */}
                {summary.teaShop && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Tea Shop</Typography>
                    <Paper sx={{ p: 2, bgcolor: "action.hover" }}>
                      <Box sx={{ display: "flex", gap: 3 }}>
                        <Typography variant="body2">
                          <strong>Tea:</strong> ₹{summary.teaShop.teaTotal.toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Snacks:</strong> ₹{summary.teaShop.snacksTotal.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          <strong>Total:</strong> ₹{summary.teaShop.total.toLocaleString()}
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button
                  onClick={() => setViewSummaryDate(null)}
                  variant="contained"
                >
                  Close
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* SpeedDial for Add Attendance - Click-only (not hover) */}
      {canEdit && (
        <SpeedDial
          ariaLabel="Add Attendance"
          open={speedDialOpen}
          onOpen={() => {}} // Disable hover open
          onClose={() => setSpeedDialOpen(false)}
          FabProps={{
            onClick: () => setSpeedDialOpen(!speedDialOpen),
          }}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            "& .MuiFab-primary": {
              bgcolor: "primary.main",
              "&:hover": { bgcolor: "primary.dark" },
            },
          }}
          icon={<SpeedDialIcon openIcon={<CloseIcon />} />}
        >
          <SpeedDialAction
            icon={<WbSunny />}
            tooltipTitle="Start Day Attendance"
            tooltipOpen
            onClick={() => {
              setSpeedDialOpen(false);
              setSelectedDateForDrawer(undefined);
              setDrawerMode("morning");
              setDrawerOpen(true);
            }}
            sx={{
              "& .MuiSpeedDialAction-staticTooltipLabel": {
                whiteSpace: "nowrap",
                bgcolor: "warning.main",
                color: "warning.contrastText",
              },
            }}
          />
          <SpeedDialAction
            icon={<EventNote />}
            tooltipTitle="Full Day Attendance"
            tooltipOpen
            onClick={() => {
              setSpeedDialOpen(false);
              setSelectedDateForDrawer(undefined);
              setDrawerMode("full");
              setDrawerOpen(true);
            }}
            sx={{
              "& .MuiSpeedDialAction-staticTooltipLabel": {
                whiteSpace: "nowrap",
                bgcolor: "primary.main",
                color: "primary.contrastText",
              },
            }}
          />
          <SpeedDialAction
            icon={<HolidayIcon />}
            tooltipTitle={todayHoliday ? "Revoke Holiday" : "Mark as Holiday"}
            tooltipOpen
            onClick={() => {
              setSpeedDialOpen(false);
              handleHolidayClick();
            }}
            sx={{
              "& .MuiSpeedDialAction-staticTooltipLabel": {
                whiteSpace: "nowrap",
                bgcolor: todayHoliday ? "error.main" : "success.main",
                color: todayHoliday ? "error.contrastText" : "success.contrastText",
              },
            }}
          />
        </SpeedDial>
      )}

      {/* Holiday Confirm Dialog */}
      {selectedSite && (
        <HolidayConfirmDialog
          open={holidayDialogOpen}
          onClose={() => setHolidayDialogOpen(false)}
          mode={holidayDialogMode}
          site={{ id: selectedSite.id, name: selectedSite.name }}
          existingHoliday={todayHoliday}
          recentHolidays={recentHolidays}
          onSuccess={handleHolidaySuccess}
        />
      )}

      {/* Restoration message snackbar */}
      <Snackbar
        open={!!restorationMessage}
        autoHideDuration={5000}
        onClose={() => setRestorationMessage(null)}
        message={restorationMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
