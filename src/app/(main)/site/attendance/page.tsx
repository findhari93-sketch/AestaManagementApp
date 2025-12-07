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
} from "@mui/material";
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
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import type { TeaShopAccount } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
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
  // New fields
  in_time?: string | null;
  lunch_out?: string | null;
  lunch_in?: string | null;
  out_time?: string | null;
  work_hours?: number | null;
  break_hours?: number | null;
  total_hours?: number | null;
  day_units?: number;
  snacks_amount?: number;
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
  // Work description
  workDescription: string | null;
  workStatus: string | null;
  comments: string | null;
  // Category breakdown
  categoryBreakdown: { [key: string]: { count: number; amount: number } };
  isExpanded?: boolean;
  // Tea shop data
  teaShop: TeaShopData | null;
}

export default function AttendancePage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [dateSummaries, setDateSummaries] = useState<DateSummary[]>([]);
  const [workSummaries, setWorkSummaries] = useState<Map<string, DailyWorkSummary>>(new Map());
  const [viewMode, setViewMode] = useState<"date-wise" | "detailed">("date-wise");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Date filters in title bar
  const [dateFrom, setDateFrom] = useState(dayjs().subtract(7, "days").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(dayjs().format("YYYY-MM-DD"));

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({
    work_days: 1,
    daily_rate_applied: 0,
    is_paid: false,
  });

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

  const canEdit = userProfile?.role === "admin" || userProfile?.role === "office";

  // Calculate totals for the filtered period
  const periodTotals = useMemo(() => {
    let totalSalary = 0;
    let totalTeaShop = 0;
    let totalLaborers = 0;

    dateSummaries.forEach((s) => {
      totalSalary += s.totalSalary;
      totalTeaShop += s.teaShop?.total || 0;
      totalLaborers += s.totalLaborerCount;
    });

    const totalExpense = totalSalary + totalTeaShop;

    return {
      totalSalary,
      totalTeaShop,
      totalExpense,
      totalLaborers,
      avgPerDay: dateSummaries.length > 0 ? totalExpense / dateSummaries.length : 0,
    };
  }, [dateSummaries]);

  const fetchAttendanceHistory = async () => {
    if (!selectedSite) return;

    setLoading(true);
    try {
      // Fetch daily attendance with new fields
      const { data: attendanceData, error } = await supabase
        .from("daily_attendance")
        .select(`
          id, date, laborer_id, work_days, hours_worked, daily_rate_applied, daily_earnings, is_paid, subcontract_id,
          in_time, lunch_out, lunch_in, out_time, work_hours, break_hours, total_hours, day_units, snacks_amount,
          laborers!inner(name, team_id, category_id, role_id, laborer_type, team:teams!laborers_team_id_fkey(name), labor_categories(name), labor_roles(name)),
          building_sections!inner(name),
          subcontracts(title)
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

      // Map attendance records
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
          } else {
            existing.dailyLaborerCount++;
          }
          existing.totalLaborerCount = existing.dailyLaborerCount + existing.contractLaborerCount + existing.marketLaborerCount;
          // Update amounts
          existing.totalSalary += record.daily_earnings;
          existing.totalSnacks += record.snacks_amount || 0;
          existing.totalExpense = existing.totalSalary + existing.totalSnacks;
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
            workDescription: workSummary?.work_description || null,
            workStatus: workSummary?.work_status || null,
            comments: workSummary?.comments || null,
            categoryBreakdown,
            isExpanded: false,
            teaShop: teaShop || null,
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
            workDescription: workSummary?.work_description || null,
            workStatus: workSummary?.work_status || null,
            comments: workSummary?.comments || null,
            categoryBreakdown: {},
            isExpanded: false,
            teaShop: teaShop || null,
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
      is_paid: record.is_paid,
    });
    setEditDialogOpen(true);
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
          is_paid: editForm.is_paid,
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

  const handleOpenDrawerForDate = (date: string) => {
    setSelectedDateForDrawer(date);
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
        Cell: ({ cell }) => formatTime(cell.getValue<string>()),
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
          return (
            <Chip
              label={isPaid ? "PAID" : "PENDING"}
              size="small"
              color={isPaid ? "success" : "default"}
              variant={isPaid ? "filled" : "outlined"}
            />
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 90,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
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
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {/* Date Filters in Header */}
            <TextField
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
              sx={{ width: 150, bgcolor: "white" }}
            />
            <TextField
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
              sx={{ width: 150, bgcolor: "white" }}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => {
                setSelectedDateForDrawer(undefined);
                setDrawerOpen(true);
              }}
            >
              Add Attendance
            </Button>
            <Button
              variant={viewMode === "date-wise" ? "contained" : "outlined"}
              onClick={() => setViewMode("date-wise")}
              size="small"
              color="inherit"
            >
              Date-wise
            </Button>
            <Button
              variant={viewMode === "detailed" ? "contained" : "outlined"}
              onClick={() => setViewMode("detailed")}
              size="small"
              color="inherit"
            >
              Detailed
            </Button>
          </Box>
        }
      />

      {/* Period Summary Bar */}
      <Paper sx={{ p: 2, mb: 2, display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Period Total</Typography>
          <Typography variant="h5" fontWeight={700} color="primary.main">
            ₹{periodTotals.totalExpense.toLocaleString()}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Salary</Typography>
          <Typography variant="h6" fontWeight={600} color="success.main">
            ₹{periodTotals.totalSalary.toLocaleString()}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Tea Shop</Typography>
          <Typography variant="h6" fontWeight={600} color="secondary.main">
            ₹{periodTotals.totalTeaShop.toLocaleString()}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Avg/Day</Typography>
          <Typography variant="h6" fontWeight={600}>
            ₹{periodTotals.avgPerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Days</Typography>
          <Typography variant="h6" fontWeight={600}>
            {dateSummaries.length}
          </Typography>
        </Box>
      </Paper>

      {/* Data Display */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : viewMode === "date-wise" ? (
        <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
          <TableContainer sx={{ maxHeight: "calc(100vh - 350px)" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#1565c0" }}>
                  <TableCell sx={{ width: 40, bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }}></TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }} align="center">Daily</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }} align="center">Contract</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }} align="center">Market</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }} align="center">Total</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }} align="center">In</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }} align="center">Out</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }} align="right">Salary</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }} align="center">Tea Shop</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700 }} align="right">Expense</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 150 }}>Work</TableCell>
                  <TableCell sx={{ bgcolor: "#1565c0", color: "#fff", fontWeight: 700, minWidth: 100 }}>Status</TableCell>
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
                      <TableCell>
                        <IconButton size="small">
                          {summary.isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {dayjs(summary.date).format("DD MMM")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
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
                        <Typography variant="caption">{formatTime(summary.lastOutTime)}</Typography>
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
                        <Tooltip title={summary.workDescription || "No description"}>
                          <Typography variant="caption" noWrap sx={{ maxWidth: 150, display: "block" }}>
                            {summary.workDescription || "-"}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" noWrap sx={{ maxWidth: 100, display: "block" }}>
                          {summary.workStatus || "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={13} sx={{ py: 0, border: 0 }}>
                        <Collapse in={summary.isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: "grey.50" }}>
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
                              {canEdit && (
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<Edit />}
                                  onClick={() => handleOpenDrawerForDate(summary.date)}
                                >
                                  Edit Attendance
                                </Button>
                              )}
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
                                      <TableCell align="center">{formatTime(record.out_time)}</TableCell>
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
                                        ) : (
                                          <Chip
                                            label={record.is_paid ? "PAID" : "PENDING"}
                                            size="small"
                                            color={record.is_paid ? "success" : "default"}
                                            variant={record.is_paid ? "filled" : "outlined"}
                                          />
                                        )}
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
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
        }}
        siteId={selectedSite.id}
        date={selectedDateForDrawer}
        onSuccess={() => {
          fetchAttendanceHistory();
          setSelectedDateForDrawer(undefined);
        }}
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

              {editingRecord.laborer_type !== "contract" && (
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Status</InputLabel>
                  <Select
                    value={editForm.is_paid ? "paid" : "pending"}
                    onChange={(e) => setEditForm({ ...editForm, is_paid: e.target.value === "paid" })}
                    label="Payment Status"
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="paid">Paid</MenuItem>
                  </Select>
                </FormControl>
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
    </Box>
  );
}
