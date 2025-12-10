"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Fab,
} from "@mui/material";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  ExpandMore,
  ExpandLess,
  Add as AddIcon,
  Edit,
  Delete,
  AccessTime,
  Restaurant,
  LocalCafe as TeaIcon,
} from "@mui/icons-material";
import AttendanceDrawer from "@/components/attendance/AttendanceDrawer";
import TeaShopEntryDialog from "@/components/tea-shop/TeaShopEntryDialog";
import PaymentDialog from "@/components/payments/PaymentDialog";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import AuditAvatarGroup from "@/components/common/AuditAvatarGroup";
import { PhotoBadge, WorkUpdateViewer } from "@/components/attendance/work-updates";
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

interface DateSummary {
  date: string;
  records: AttendanceRecord[];
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
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [dateSummaries, setDateSummaries] = useState<DateSummary[]>([]);
  const [workSummaries, setWorkSummaries] = useState<Map<string, DailyWorkSummary>>(new Map());
  const [viewMode, setViewMode] = useState<"date-wise" | "detailed">("date-wise");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"morning" | "evening" | "full">("full");

  // Date filters in title bar
  const [dateFrom, setDateFrom] = useState(dayjs().subtract(7, "days").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(dayjs().format("YYYY-MM-DD"));

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({
    work_days: 1,
    daily_rate_applied: 0,
  });

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentRecords, setPaymentRecords] = useState<DailyPaymentRecord[]>([]);

  // Date-specific drawer state
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<string | undefined>(undefined);

  // Tea shop popover state
  const [teaShopPopoverAnchor, setTeaShopPopoverAnchor] = useState<HTMLElement | null>(null);
  const [teaShopPopoverData, setTeaShopPopoverData] = useState<{ date: string; data: TeaShopData } | null>(null);

  // Tea shop entry dialog state (for direct opening)
  const [teaShopDialogOpen, setTeaShopDialogOpen] = useState(false);
  const [teaShopDialogDate, setTeaShopDialogDate] = useState<string | undefined>(undefined);
  const [teaShopAccount, setTeaShopAccount] = useState<TeaShopAccount | null>(null);
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

  const canEdit = hasEditPermission(userProfile?.role);

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
  }, [dateSummaries]);

  const fetchAttendanceHistory = async () => {
    if (!selectedSite) return;

    setLoading(true);
    try {
      // Fetch daily attendance with audit fields and two-phase status
      const { data: attendanceData, error } = await supabase
        .from("daily_attendance")
        .select(`
          id, date, laborer_id, work_days, hours_worked, daily_rate_applied, daily_earnings, is_paid, subcontract_id,
          in_time, lunch_out, lunch_in, out_time, work_hours, break_hours, total_hours, day_units, snacks_amount,
          attendance_status, work_progress_percent,
          entered_by, recorded_by, recorded_by_user_id, updated_by, updated_by_user_id, created_at, updated_at,
          laborers!inner(name, team_id, category_id, role_id, laborer_type, team:teams!laborers_team_id_fkey(name), labor_categories(name), labor_roles(name)),
          building_sections!inner(name),
          subcontracts(title),
          recorded_by_user:users!daily_attendance_recorded_by_user_id_fkey(avatar_url),
          updated_by_user:users!daily_attendance_updated_by_user_id_fkey(avatar_url)
        `)
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      if (error) throw error;

      // Fetch market laborer attendance
      const { data: marketData } = await (supabase.from("market_laborer_attendance") as any)
        .select("date, count, work_days, rate_per_person, total_cost, day_units, snacks_per_person, total_snacks, in_time, out_time, labor_roles(name)")
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      // Fetch work summaries
      const { data: summaryData } = await (supabase.from("daily_work_summary") as any)
        .select("*")
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      // Fetch tea shop entries (using base columns - V2 migration columns may not exist yet)
      // Note: site_id exists on tea_shop_entries, V2 columns (working_laborer_count, etc.) may not
      const { data: teaShopData } = await (supabase.from("tea_shop_entries") as any)
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

      // Build work summaries map
      const summaryMap = new Map<string, DailyWorkSummary>();
      (summaryData || []).forEach((s: DailyWorkSummary) => {
        summaryMap.set(s.date, s);
      });
      setWorkSummaries(summaryMap);

      // Build market data map (by date)
      const marketMap = new Map<string, { count: number; salary: number; snacks: number; inTime: string | null; outTime: string | null }>();
      (marketData || []).forEach((m: any) => {
        const existing = marketMap.get(m.date) || { count: 0, salary: 0, snacks: 0, inTime: null, outTime: null };
        existing.count += m.count;
        existing.salary += m.total_cost || (m.count * m.rate_per_person * (m.day_units || m.work_days));
        existing.snacks += m.total_snacks || 0;
        if (!existing.inTime || (m.in_time && m.in_time < existing.inTime)) {
          existing.inTime = m.in_time;
        }
        if (!existing.outTime || (m.out_time && m.out_time > existing.outTime)) {
          existing.outTime = m.out_time;
        }
        marketMap.set(m.date, existing);
      });

      // Map attendance records (including audit fields)
      const records: AttendanceRecord[] = (attendanceData || []).map((record: any) => ({
        id: record.id,
        date: record.date,
        laborer_id: record.laborer_id,
        laborer_name: record.laborers.name,
        laborer_type: record.laborers.laborer_type || "daily_market",
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
      }));

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
          existing.totalLaborerCount = existing.dailyLaborerCount + existing.contractLaborerCount + existing.marketLaborerCount;
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
          if (record.in_time && (!existing.firstInTime || record.in_time < existing.firstInTime)) {
            existing.firstInTime = record.in_time;
          }
          if (record.out_time && (!existing.lastOutTime || record.out_time > existing.lastOutTime)) {
            existing.lastOutTime = record.out_time;
          }
          // Update category breakdown
          const cat = record.category_name;
          existing.categoryBreakdown[cat] = existing.categoryBreakdown[cat] || { count: 0, amount: 0 };
          existing.categoryBreakdown[cat].count += 1;
          existing.categoryBreakdown[cat].amount += record.daily_earnings;
        } else {
          const workSummary = summaryMap.get(record.date);
          const market = marketMap.get(record.date);
          const teaShop = teaShopMap.get(record.date);
          const categoryBreakdown: { [key: string]: { count: number; amount: number } } = {};
          categoryBreakdown[record.category_name] = { count: 1, amount: record.daily_earnings };

          // Initial payment breakdown for this date
          const initialPaidCount = record.laborer_type !== "contract" && record.is_paid ? 1 : 0;
          const initialPendingCount = record.laborer_type !== "contract" && !record.is_paid ? 1 : 0;
          const initialPaidAmount = record.laborer_type !== "contract" && record.is_paid ? record.daily_earnings : 0;
          const initialPendingAmount = record.laborer_type !== "contract" && !record.is_paid ? record.daily_earnings : 0;

          dateMap.set(record.date, {
            date: record.date,
            records: [record],
            dailyLaborerCount: record.laborer_type === "daily_market" ? 1 : 0,
            contractLaborerCount: record.laborer_type === "contract" ? 1 : 0,
            marketLaborerCount: market?.count || 0,
            totalLaborerCount: 1 + (market?.count || 0),
            firstInTime: record.in_time || market?.inTime || null,
            lastOutTime: record.out_time || market?.outTime || null,
            totalSalary: record.daily_earnings + (market?.salary || 0),
            totalSnacks: (record.snacks_amount || 0) + (market?.snacks || 0),
            totalExpense: record.daily_earnings + (record.snacks_amount || 0) + (market?.salary || 0) + (market?.snacks || 0),
            // Amounts by laborer type
            dailyLaborerAmount: record.laborer_type === "daily_market" ? record.daily_earnings : 0,
            contractLaborerAmount: record.laborer_type === "contract" ? record.daily_earnings : 0,
            marketLaborerAmount: market?.salary || 0,
            // Payment breakdown
            paidCount: initialPaidCount,
            pendingCount: initialPendingCount,
            paidAmount: initialPaidAmount,
            pendingAmount: initialPendingAmount,
            workDescription: workSummary?.work_description || null,
            workStatus: workSummary?.work_status || null,
            comments: workSummary?.comments || null,
            workUpdates: ((workSummary as DailyWorkSummary & { work_updates?: unknown })?.work_updates as WorkUpdates) || null,
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
            workUpdates: ((workSummary as DailyWorkSummary & { work_updates?: unknown })?.work_updates as WorkUpdates) || null,
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
      console.error("Error fetching attendance history:", error);
      alert("Failed to load attendance history: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceHistory();
  }, [selectedSite, dateFrom, dateTo]);

  const toggleDateExpanded = (date: string) => {
    setDateSummaries((prev) =>
      prev.map((d) => (d.date === date ? { ...d, isExpanded: !d.isExpanded } : d))
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

  const handleOpenDrawerForDate = (date: string, mode: "morning" | "evening" | "full" = "full") => {
    setSelectedDateForDrawer(date);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  // Fetch tea shop account for site (or create one if doesn't exist)
  const fetchTeaShopAccount = async (): Promise<TeaShopAccount | null> => {
    if (!selectedSite) return null;

    try {
      // Try to get existing active shop for site
      const { data: existingShop } = await (supabase
        .from("tea_shop_accounts") as any)
        .select("*")
        .eq("site_id", selectedSite.id)
        .eq("is_active", true)
        .single();

      if (existingShop) {
        return existingShop;
      }

      // If no shop exists, create a default one
      const { data: newShop, error: createError } = await (supabase
        .from("tea_shop_accounts") as any)
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
      const { data: existingEntry } = await (supabase
        .from("tea_shop_entries") as any)
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
    if (!confirm("Are you sure you want to delete this attendance record?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("daily_attendance").delete().eq("id", id);
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
      const { error: marketError } = await (supabase.from("market_laborer_attendance") as any)
        .delete()
        .eq("site_id", selectedSite.id)
        .eq("date", date);
      if (marketError) throw marketError;

      // Delete tea shop entries for this date
      const { error: teaError } = await (supabase.from("tea_shop_entries") as any)
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
            <Chip label={units} size="small" color="primary" variant="outlined" />
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
            return <Chip label="In Contract" size="small" color="info" variant="outlined" />;
          }
          if (isPaid) {
            return <Chip label="PAID" size="small" color="success" variant="filled" />;
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
            {row.original.laborer_type !== "contract" && !row.original.is_paid && canEdit && (
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
            <IconButton size="small" onClick={() => handleOpenEditDialog(row.original)} disabled={!canEdit}>
              <Edit fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => handleDelete(row.original.id)} disabled={!canEdit}>
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
        <Alert severity="warning">Please select a site to view attendance</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Date Filters */}
      <PageHeader
        title="Attendance"
        subtitle={`${selectedSite.name}`}
        onRefresh={fetchAttendanceHistory}
        isLoading={loading}
        actions={
          <Box sx={{
            display: "flex",
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 2 },
            alignItems: { xs: 'stretch', sm: 'center' },
            width: { xs: '100%', sm: 'auto' }
          }}>
            {/* Date Filters - Row 1 on mobile */}
            <Box sx={{ display: 'flex', gap: 1, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
              <TextField
                label="From"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                size="small"
                sx={{ width: { xs: '50%', sm: 130 }, bgcolor: "white" }}
              />
              <TextField
                label="To"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                size="small"
                sx={{ width: { xs: '50%', sm: 130 }, bgcolor: "white" }}
              />
            </Box>
            {/* Buttons - Row 2 on mobile */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'space-between', sm: 'flex-start' } }}>
              <Button
                variant="contained"
                color="warning"
                startIcon={<AccessTime sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
                onClick={() => {
                  setSelectedDateForDrawer(undefined);
                  setDrawerMode("morning");
                  setDrawerOpen(true);
                }}
                size="small"
                sx={{ flex: { xs: 1, sm: 'none' }, minWidth: { xs: 'auto', sm: 'auto' } }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>🌅 Start Day</Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>🌅 Start</Box>
              </Button>
              <Button
                variant={viewMode === "date-wise" ? "contained" : "outlined"}
                onClick={() => setViewMode("date-wise")}
                size="small"
                color="inherit"
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Date-wise</Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Date</Box>
              </Button>
              <Button
                variant={viewMode === "detailed" ? "contained" : "outlined"}
                onClick={() => setViewMode("detailed")}
                size="small"
                color="inherit"
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Detailed</Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Detail</Box>
              </Button>
            </Box>
          </Box>
        }
      />

      {/* Period Summary Bar */}
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(4, 1fr)',
            md: 'repeat(5, 1fr)',
            lg: 'repeat(10, 1fr)'
          },
          gap: { xs: 1.5, sm: 2 }
        }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Period Total
            </Typography>
            <Typography sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, fontWeight: 700, color: 'primary.main' }}>
              ₹{periodTotals.totalExpense.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Salary
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1.125rem' }, fontWeight: 600, color: 'success.main' }}>
              ₹{periodTotals.totalSalary.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Tea Shop
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1.125rem' }, fontWeight: 600, color: 'secondary.main' }}>
              ₹{periodTotals.totalTeaShop.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Daily
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1.125rem' }, fontWeight: 600, color: 'warning.main' }}>
              ₹{periodTotals.totalDailyAmount.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Contract
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1.125rem' }, fontWeight: 600, color: 'info.main' }}>
              ₹{periodTotals.totalContractAmount.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Market
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1.125rem' }, fontWeight: 600, color: 'secondary.main' }}>
              ₹{periodTotals.totalMarketAmount.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Paid
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1.125rem' }, fontWeight: 600, color: 'success.main' }}>
                ₹{periodTotals.totalPaidAmount.toLocaleString()}
              </Typography>
              <Chip label={periodTotals.totalPaidCount} size="small" color="success" variant="outlined" sx={{ height: { xs: 18, sm: 24 }, '& .MuiChip-label': { px: 0.5, fontSize: { xs: '0.6rem', sm: '0.75rem' } } }} />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Pending
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1.125rem' }, fontWeight: 600, color: 'warning.main' }}>
                ₹{periodTotals.totalPendingAmount.toLocaleString()}
              </Typography>
              <Chip label={periodTotals.totalPendingCount} size="small" color="warning" variant="outlined" sx={{ height: { xs: 18, sm: 24 }, '& .MuiChip-label': { px: 0.5, fontSize: { xs: '0.6rem', sm: '0.75rem' } } }} />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Avg/Day
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1.125rem' }, fontWeight: 600 }}>
              ₹{periodTotals.avgPerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
              Days
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1.125rem' }, fontWeight: 600 }}>
              {dateSummaries.length}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Data Display */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : viewMode === "date-wise" ? (
        <Paper sx={{ borderRadius: 2, overflow: "hidden", position: 'relative' }}>
          <TableContainer
            sx={{
              maxHeight: { xs: "calc(100vh - 400px)", sm: "calc(100vh - 350px)" },
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <Table stickyHeader size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#1565c0" }}>
                  {/* Sticky expand column */}
                  <TableCell sx={{
                    width: 40,
                    minWidth: 40,
                    bgcolor: "#1565c0",
                    color: "#fff",
                    fontWeight: 700,
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                  }}></TableCell>
                  {/* Sticky date column */}
                  <TableCell sx={{
                    bgcolor: "#1565c0",
                    color: "#fff",
                    fontWeight: 700,
                    position: 'sticky',
                    left: 40,
                    zIndex: 3,
                    minWidth: { xs: 60, sm: 80 },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      background: 'linear-gradient(to right, rgba(0,0,0,0.15), transparent)',
                    }
                  }}>Date</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 50 }} align="center">Daily</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 55 }} align="center">Contract</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 50 }} align="center">Market</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 45 }} align="center">Total</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 45 }} align="center">In</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 45 }} align="center">Out</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 70 }} align="right">Salary</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 80 }} align="center">Tea Shop</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 70 }} align="right">Expense</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 120 }}>Work</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 90 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dateSummaries.map((summary) => (
                  <React.Fragment key={summary.date}>
                    <TableRow
                      hover
                      onClick={() => toggleDateExpanded(summary.date)}
                      sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                    >
                      {/* Sticky expand cell */}
                      <TableCell sx={{
                        position: 'sticky',
                        left: 0,
                        bgcolor: 'background.paper',
                        zIndex: 1,
                      }}>
                        <IconButton size="small">
                          {summary.isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      {/* Sticky date cell */}
                      <TableCell sx={{
                        position: 'sticky',
                        left: 40,
                        bgcolor: 'background.paper',
                        zIndex: 1,
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          background: 'linear-gradient(to right, rgba(0,0,0,0.08), transparent)',
                        }
                      }}>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                          {dayjs(summary.date).format("DD MMM")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                          {dayjs(summary.date).format("ddd")}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={summary.dailyLaborerCount} size="small" color="warning" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={summary.contractLaborerCount} size="small" color="info" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={summary.marketLaborerCount} size="small" color="secondary" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={700}>
                          {summary.totalLaborerCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">{formatTime(summary.firstInTime)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">
                          {summary.attendanceStatus === "morning_entry" ? "-" : formatTime(summary.lastOutTime)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600} color="success.main">
                          ₹{summary.totalSalary.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {summary.teaShop ? (
                          <Chip
                            icon={<TeaIcon fontSize="small" />}
                            label={`₹${summary.teaShop.total.toLocaleString()}`}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTeaShopPopoverAnchor(e.currentTarget);
                              setTeaShopPopoverData({ date: summary.date, data: summary.teaShop! });
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
                              handleOpenTeaShopDialog(summary.date);
                            }}
                            sx={{ cursor: "pointer", opacity: 0.6 }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          ₹{(summary.totalExpense + (summary.teaShop?.total || 0)).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Tooltip title={summary.workDescription || summary.workUpdates?.morning?.description || "No description"}>
                            <Typography variant="caption" noWrap sx={{ maxWidth: 100, display: "block" }}>
                              {summary.workDescription || summary.workUpdates?.morning?.description || "-"}
                            </Typography>
                          </Tooltip>
                          {summary.workUpdates && (
                            <PhotoBadge
                              photoCount={
                                (summary.workUpdates.morning?.photos?.length || 0) +
                                (summary.workUpdates.evening?.photos?.length || 0)
                              }
                              completionPercent={summary.workUpdates.evening?.completionPercent}
                              onClick={() => {
                                setSelectedWorkUpdate({
                                  workUpdates: summary.workUpdates,
                                  date: summary.date,
                                });
                                setWorkUpdateViewerOpen(true);
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {summary.attendanceStatus === "morning_entry" ? (
                          <Chip
                            label="🌅 Morning Only"
                            size="small"
                            color="warning"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawerForDate(summary.date, "evening");
                            }}
                            sx={{ cursor: "pointer" }}
                          />
                        ) : (
                          <Chip
                            label="✓ Confirmed"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={13} sx={{ py: 0, border: 0 }}>
                        <Collapse in={summary.isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: "grey.50" }}>
                            {/* Laborer Type Breakdown */}
                            <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                              {summary.dailyLaborerCount > 0 && (
                                <Chip
                                  label={`Daily: ₹${summary.dailyLaborerAmount.toLocaleString()} (${summary.dailyLaborerCount})`}
                                  size="small"
                                  color="warning"
                                  variant="filled"
                                />
                              )}
                              {summary.contractLaborerCount > 0 && (
                                <Chip
                                  label={`Contract: ₹${summary.contractLaborerAmount.toLocaleString()} (${summary.contractLaborerCount})`}
                                  size="small"
                                  color="info"
                                  variant="filled"
                                />
                              )}
                              {summary.marketLaborerCount > 0 && (
                                <Chip
                                  label={`Market: ₹${summary.marketLaborerAmount.toLocaleString()} (${summary.marketLaborerCount})`}
                                  size="small"
                                  color="secondary"
                                  variant="filled"
                                />
                              )}
                            </Box>

                            {/* Header with Manage Button */}
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                {Object.entries(summary.categoryBreakdown).map(([cat, data]) => (
                                  <Chip
                                    key={cat}
                                    label={`${cat}: ${data.count} (₹${data.amount.toLocaleString()})`}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                  />
                                ))}
                              </Box>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                {/* Audit Avatar - show who created/edited this entry */}
                                {summary.records.length > 0 && (
                                  <AuditAvatarGroup
                                    createdByName={summary.records[0]?.entered_by}
                                    createdByAvatar={summary.records[0]?.entered_by_avatar}
                                    createdAt={summary.records[0]?.created_at}
                                    updatedByName={summary.records[0]?.updated_by}
                                    updatedByAvatar={summary.records[0]?.updated_by_avatar}
                                    updatedAt={summary.records[0]?.updated_at}
                                    compact
                                    size="small"
                                  />
                                )}
                                {canEdit && summary.attendanceStatus === "morning_entry" && (
                                  <Button
                                    variant="contained"
                                    color="success"
                                    size="small"
                                    onClick={() => handleOpenDrawerForDate(summary.date, "evening")}
                                  >
                                    🌆 Confirm Attendance
                                  </Button>
                                )}
                                {canEdit && summary.attendanceStatus !== "morning_entry" && (
                                  <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<Edit />}
                                    onClick={() => handleOpenDrawerForDate(summary.date, "full")}
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
                                        handleDeleteDateAttendance(summary.date);
                                      }}
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>

                            {/* Work Description */}
                            {(summary.workDescription || summary.comments) && (
                              <Box sx={{ mb: 2, p: 1.5, bgcolor: "white", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                                {summary.workDescription && (
                                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                                    <strong>Work:</strong> {summary.workDescription}
                                  </Typography>
                                )}
                                {summary.workStatus && (
                                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                                    <strong>Status:</strong> {summary.workStatus}
                                  </Typography>
                                )}
                                {summary.comments && (
                                  <Typography variant="body2" color="text.secondary">
                                    <strong>Comments:</strong> {summary.comments}
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {/* Individual Records Table */}
                            {summary.records.length > 0 && (
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: "#e3f2fd" }}>
                                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">In</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">Out</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">Work Hrs</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">W/D Units</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Salary</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Snacks</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">Payment</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {summary.records.map((record) => (
                                    <TableRow key={record.id} hover>
                                      <TableCell>{record.laborer_name}</TableCell>
                                      <TableCell>
                                        <Chip
                                          label={record.laborer_type === "contract" ? "C" : "D"}
                                          size="small"
                                          color={record.laborer_type === "contract" ? "info" : "warning"}
                                          variant="outlined"
                                        />
                                      </TableCell>
                                      <TableCell>{record.category_name}</TableCell>
                                      <TableCell>{record.team_name || "-"}</TableCell>
                                      <TableCell align="center">{formatTime(record.in_time)}</TableCell>
                                      <TableCell align="center">
                                        {record.attendance_status === "morning_entry" ? "-" : formatTime(record.out_time)}
                                      </TableCell>
                                      <TableCell align="center">
                                        {record.work_hours ? `${record.work_hours}h` : "-"}
                                      </TableCell>
                                      <TableCell align="center">
                                        <Chip
                                          label={record.day_units || record.work_days}
                                          size="small"
                                          color="primary"
                                          variant="outlined"
                                        />
                                      </TableCell>
                                      <TableCell align="right">
                                        ₹{record.daily_earnings.toLocaleString()}
                                      </TableCell>
                                      <TableCell align="right">
                                        {record.snacks_amount ? `₹${record.snacks_amount}` : "-"}
                                      </TableCell>
                                      <TableCell align="center">
                                        {record.laborer_type === "contract" ? (
                                          <Chip label="In Contract" size="small" color="info" variant="outlined" />
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
                                              if (canEdit) handleOpenPaymentDialog(record);
                                            }}
                                            sx={{ cursor: canEdit ? "pointer" : "default" }}
                                          />
                                        )}
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                                          {/* Record Payment button for pending daily laborers */}
                                          {record.laborer_type !== "contract" && !record.is_paid && canEdit && (
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              color="success"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenPaymentDialog(record);
                                              }}
                                              sx={{ minWidth: 50, px: 1, fontSize: 11 }}
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

                            {summary.records.length === 0 && summary.marketLaborerCount > 0 && (
                              <Alert severity="info" sx={{ mt: 1 }}>
                                This date has {summary.marketLaborerCount} market laborers only. Click &quot;Manage Laborers&quot; to view details.
                              </Alert>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
                {dateSummaries.length === 0 && (
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
      ) : (
        <DataTable columns={detailedColumns} data={attendanceRecords} isLoading={loading} />
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
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Attendance</DialogTitle>
        <DialogContent>
          {editingRecord && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
              <Alert severity="info">
                Editing attendance for <strong>{editingRecord.laborer_name}</strong> on{" "}
                {dayjs(editingRecord.date).format("DD MMM YYYY")}
              </Alert>

              <FormControl fullWidth size="small">
                <InputLabel>W/D Units</InputLabel>
                <Select
                  value={editForm.work_days}
                  onChange={(e) => setEditForm({ ...editForm, work_days: e.target.value as number })}
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
                onChange={(e) => setEditForm({ ...editForm, daily_rate_applied: Number(e.target.value) })}
                slotProps={{
                  input: { startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> },
                }}
              />

              <Box sx={{ p: 2, bgcolor: "grey.100", borderRadius: 1, display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">Total Salary:</Typography>
                <Typography variant="body1" fontWeight={700} color="success.main">
                  ₹{(editForm.work_days * editForm.daily_rate_applied).toLocaleString()}
                </Typography>
              </Box>

              {editingRecord.laborer_type !== "contract" && !editingRecord.is_paid && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  To record payment, close this dialog and click the &quot;Pay&quot; button or the PENDING chip.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained" disabled={loading}>
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

            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2">Tea:</Typography>
              <Typography variant="body2" fontWeight={500}>₹{teaShopPopoverData.data.teaTotal.toLocaleString()}</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2">Snacks:</Typography>
              <Typography variant="body2" fontWeight={500}>₹{teaShopPopoverData.data.snacksTotal.toLocaleString()}</Typography>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              Consumption Breakdown:
            </Typography>

            {teaShopPopoverData.data.workingCount > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                <Typography variant="caption">Working ({teaShopPopoverData.data.workingCount}):</Typography>
                <Typography variant="caption">₹{teaShopPopoverData.data.workingTotal.toLocaleString()}</Typography>
              </Box>
            )}
            {teaShopPopoverData.data.nonWorkingCount > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                <Typography variant="caption">Non-Working ({teaShopPopoverData.data.nonWorkingCount}):</Typography>
                <Typography variant="caption">₹{teaShopPopoverData.data.nonWorkingTotal.toLocaleString()}</Typography>
              </Box>
            )}
            {teaShopPopoverData.data.marketCount > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                <Typography variant="caption">Market ({teaShopPopoverData.data.marketCount}):</Typography>
                <Typography variant="caption">₹{teaShopPopoverData.data.marketTotal.toLocaleString()}</Typography>
              </Box>
            )}

            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" fontWeight={700}>Total:</Typography>
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
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "error.main" }}>
          <Delete />
          Delete Attendance Record
        </DialogTitle>
        <DialogContent>
          {deleteDialogData && (
            <Box sx={{ mt: 1 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                You are about to delete <strong>ALL</strong> attendance records for this date.
                This action cannot be undone.
              </Alert>

              <Box sx={{ bgcolor: "grey.50", p: 2, borderRadius: 1, mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                    Site:
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {deleteDialogData.siteName}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                    Date:
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {dayjs(deleteDialogData.date).format("dddd, DD MMMM YYYY")}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                    Laborers:
                  </Typography>
                  <Typography variant="body1">
                    {deleteDialogData.dailyCount} daily
                    {deleteDialogData.marketCount > 0 && `, ${deleteDialogData.marketCount} market`}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                    Total:
                  </Typography>
                  <Typography variant="body1" fontWeight={700} color="error.main">
                    ₹{deleteDialogData.totalAmount.toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="caption" color="text.secondary">
                This will also delete all tea shop entries and work summaries for this date.
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

      {/* Floating Action Button for Add Attendance */}
      {canEdit && (
        <Fab
          color="primary"
          onClick={() => {
            setSelectedDateForDrawer(undefined);
            setDrawerMode("full");
            setDrawerOpen(true);
          }}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            opacity: 0.7,
            transition: "all 0.2s ease",
            "&:hover": {
              opacity: 1,
              transform: "scale(1.1)",
            },
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
}
