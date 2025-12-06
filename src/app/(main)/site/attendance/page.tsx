"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Grid,
  Card,
  CardContent,
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
} from "@mui/material";
import {
  CalendarToday,
  Person,
  TrendingUp,
  AttachMoney,
  Download,
  ExpandMore,
  ExpandLess,
  Refresh,
  Add as AddIcon,
  Edit,
  Delete,
} from "@mui/icons-material";
import AttendanceDrawer from "@/components/attendance/AttendanceDrawer";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import type { LaborerType } from "@/types/database.types";
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
  advance_given?: number;
  extra_given?: number;
  is_paid: boolean;
  subcontract_title?: string | null;
}

interface DateSummary {
  date: string;
  records: AttendanceRecord[];
  totalLaborers: number;
  totalWorkDays: number;
  totalEarnings: number;
  totalAdvances: number;
  totalExtras: number;
  categoryBreakdown: { [key: string]: { count: number; amount: number } };
  isExpanded?: boolean;
}

interface CategorySummary {
  category: string;
  count: number;
  workDays: number;
  totalAmount: number;
}

export default function AttendancePage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [dateSummaries, setDateSummaries] = useState<DateSummary[]>([]);
  const [viewMode, setViewMode] = useState<"date-wise" | "detailed">(
    "date-wise"
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState(
    dayjs().subtract(30, "days").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [selectedLaborer, setSelectedLaborer] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">(
    "all"
  );
  const [laborerTypeFilter, setLaborerTypeFilter] = useState<
    "all" | "contract" | "daily_market"
  >("all");

  const [laborers, setLaborers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(
    null
  );
  const [editForm, setEditForm] = useState({
    work_days: 1,
    daily_rate_applied: 0,
    is_paid: false,
  });

  // Date-specific drawer state
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<
    string | undefined
  >(undefined);

  const canEdit =
    userProfile?.role === "admin" || userProfile?.role === "office";

  // Category counts for top summary
  const categoryCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    attendanceRecords.forEach((r) => {
      if (r.work_days > 0) {
        counts[r.category_name] = (counts[r.category_name] || 0) + 1;
      }
    });
    return counts;
  }, [attendanceRecords]);

  const stats = useMemo(() => {
    const totalDays = attendanceRecords.reduce(
      (sum, r) => sum + r.work_days,
      0
    );
    const totalEarnings = attendanceRecords.reduce(
      (sum, r) => sum + r.daily_earnings,
      0
    );
    const uniqueLaborers = new Set(attendanceRecords.map((r) => r.laborer_id))
      .size;
    const avgDailyRate =
      attendanceRecords.length > 0
        ? attendanceRecords.reduce((sum, r) => sum + r.daily_rate_applied, 0) /
          attendanceRecords.length
        : 0;

    return { totalDays, totalEarnings, uniqueLaborers, avgDailyRate };
  }, [attendanceRecords]);

  useEffect(() => {
    if (!selectedSite) return;

    const fetchOptions = async () => {
      const { data: laborersData } = await supabase
        .from("laborers")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      setLaborers(laborersData || []);
      setTeams(teamsData || []);
    };

    fetchOptions();
  }, [selectedSite]);

  const fetchAttendanceHistory = async () => {
    if (!selectedSite) return;

    setLoading(true);
    try {
      let query = supabase
        .from("daily_attendance")
        .select(
          `
          id,
          date,
          laborer_id,
          work_days,
          hours_worked,
          daily_rate_applied,
          daily_earnings,
          is_paid,
          subcontract_id,
          laborers!inner(name, team_id, category_id, role_id, laborer_type, team:teams!laborers_team_id_fkey(name), labor_categories(name), labor_roles(name)),
          building_sections!inner(name),
          subcontracts(title)
        `
        )
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      if (selectedLaborer !== "all") {
        query = query.eq("laborer_id", selectedLaborer);
      }

      if (selectedTeam !== "all") {
        query = query.eq("laborers.team_id", selectedTeam);
      }

      // Apply payment filter at query level if possible
      if (paymentFilter === "paid") {
        query = query.eq("is_paid", true);
      } else if (paymentFilter === "unpaid") {
        query = query.or("is_paid.eq.false,is_paid.is.null");
      }

      // Apply laborer type filter
      if (laborerTypeFilter !== "all") {
        query = query.eq("laborers.laborer_type", laborerTypeFilter);
      }

      const { data: attendanceData, error } = await query;

      if (error) throw error;

      // Fetch advances
      let advancesQuery = supabase
        .from("advances")
        .select("laborer_id, date, amount, transaction_type")
        .gte("date", dateFrom)
        .lte("date", dateTo);

      if (selectedLaborer !== "all") {
        advancesQuery = advancesQuery.eq("laborer_id", selectedLaborer);
      }

      const { data: advancesData } = await (advancesQuery as any);

      const advancesMap = new Map<string, { advance: number; extra: number }>();
      (
        advancesData as
          | {
              laborer_id: string;
              date: string;
              amount: number;
              transaction_type: string;
            }[]
          | null
      )?.forEach((adv) => {
        const key = `${adv.laborer_id}_${adv.date}`;
        const existing = advancesMap.get(key) || { advance: 0, extra: 0 };
        if (adv.transaction_type === "advance") {
          existing.advance += adv.amount;
        } else if (adv.transaction_type === "extra") {
          existing.extra += adv.amount;
        }
        advancesMap.set(key, existing);
      });

      const records: AttendanceRecord[] = (attendanceData || []).map(
        (record: any) => {
          const key = `${record.laborer_id}_${record.date}`;
          const advances = advancesMap.get(key) || { advance: 0, extra: 0 };

          return {
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
            advance_given: advances.advance,
            extra_given: advances.extra,
            is_paid: record.is_paid || false,
            subcontract_title: record.subcontracts?.title || null,
          };
        }
      );

      setAttendanceRecords(records);

      // Group by date for date-wise view
      const dateMap = new Map<string, DateSummary>();
      records.forEach((record) => {
        const existing = dateMap.get(record.date);
        if (existing) {
          existing.records.push(record);
          existing.totalLaborers = new Set(
            existing.records.map((r) => r.laborer_id)
          ).size;
          existing.totalWorkDays += record.work_days;
          existing.totalEarnings += record.daily_earnings;
          existing.totalAdvances += record.advance_given || 0;
          existing.totalExtras += record.extra_given || 0;

          // Update category breakdown
          const cat = record.category_name;
          existing.categoryBreakdown[cat] = existing.categoryBreakdown[cat] || {
            count: 0,
            amount: 0,
          };
          existing.categoryBreakdown[cat].count += 1;
          existing.categoryBreakdown[cat].amount += record.daily_earnings;
        } else {
          const categoryBreakdown: {
            [key: string]: { count: number; amount: number };
          } = {};
          categoryBreakdown[record.category_name] = {
            count: 1,
            amount: record.daily_earnings,
          };

          dateMap.set(record.date, {
            date: record.date,
            records: [record],
            totalLaborers: 1,
            totalWorkDays: record.work_days,
            totalEarnings: record.daily_earnings,
            totalAdvances: record.advance_given || 0,
            totalExtras: record.extra_given || 0,
            categoryBreakdown,
            isExpanded: false,
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
  }, [
    selectedSite,
    dateFrom,
    dateTo,
    selectedLaborer,
    selectedTeam,
    paymentFilter,
    laborerTypeFilter,
  ]);

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

  const detailedColumns = useMemo<MRT_ColumnDef<AttendanceRecord>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        size: 120,
        Cell: ({ cell }) =>
          dayjs(cell.getValue<string>()).format("DD MMM YYYY"),
      },
      {
        accessorKey: "laborer_name",
        header: "Laborer",
        size: 180,
      },
      {
        accessorKey: "laborer_type",
        header: "Type",
        size: 120,
        Cell: ({ cell }) => {
          const type = cell.getValue<string>();
          return (
            <Chip
              label={type === "contract" ? "CONTRACT" : "DAILY"}
              size="small"
              color={type === "contract" ? "primary" : "warning"}
              variant="outlined"
            />
          );
        },
      },
      {
        accessorKey: "category_name",
        header: "Category",
        size: 120,
      },
      {
        accessorKey: "team_name",
        header: "Team",
        size: 150,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "subcontract_title",
        header: "Subcontract",
        size: 150,
        Cell: ({ cell }) => cell.getValue<string>() || "General Work",
      },
      {
        accessorKey: "work_days",
        header: "Work Days",
        size: 100,
      },
      {
        accessorKey: "daily_earnings",
        header: "Earnings",
        size: 120,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="success.main">
            ₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "is_paid",
        header: "Payment",
        size: 100,
        Cell: ({ cell }) => {
          const isPaid = cell.getValue<boolean>();
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
        accessorKey: "advance_given",
        header: "Advance",
        size: 100,
        Cell: ({ cell }) => {
          const amount = cell.getValue<number>() || 0;
          return amount > 0 ? `₹${amount.toLocaleString()}` : "-";
        },
      },
      {
        id: "mrt-row-actions",
        header: "Actions",
        size: 100,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
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
    <Box>
      <PageHeader
        title="Attendance"
        subtitle={`Manage attendance for ${selectedSite.name}`}
        onRefresh={fetchAttendanceHistory}
        isLoading={loading}
        actions={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setDrawerOpen(true)}
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

      {/* Category Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.entries(categoryCounts).map(([category, count]) => (
          <Grid key={category} size={{ xs: 6, sm: 4, md: 2 }}>
            <Card>
              <CardContent sx={{ py: 1.5, px: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {category}
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {count}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <Person color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Unique Laborers
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700}>
                {stats.uniqueLaborers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <CalendarToday color="success" />
                <Typography variant="body2" color="text.secondary">
                  Total Work Days
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700}>
                {stats.totalDays.toFixed(1)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <AttachMoney color="error" />
                <Typography variant="body2" color="text.secondary">
                  Total Earnings
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700}>
                ₹{stats.totalEarnings.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <TrendingUp color="warning" />
                <Typography variant="body2" color="text.secondary">
                  Avg Daily Rate
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700}>
                ₹{stats.avgDailyRate.toFixed(0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              fullWidth
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              fullWidth
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Laborer</InputLabel>
              <Select
                value={selectedLaborer}
                onChange={(e) => setSelectedLaborer(e.target.value)}
                label="Laborer"
              >
                <MenuItem value="all">All Laborers</MenuItem>
                {laborers.map((laborer) => (
                  <MenuItem key={laborer.id} value={laborer.id}>
                    {laborer.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Team</InputLabel>
              <Select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                label="Team"
              >
                <MenuItem value="all">All Teams</MenuItem>
                {teams.map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Payment Status</InputLabel>
              <Select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                label="Payment Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="paid">Paid Only</MenuItem>
                <MenuItem value="unpaid">Unpaid Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Laborer Type</InputLabel>
              <Select
                value={laborerTypeFilter}
                onChange={(e) => setLaborerTypeFilter(e.target.value as any)}
                label="Laborer Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="contract">Contract Only</MenuItem>
                <MenuItem value="daily_market">Daily Market Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Display */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : viewMode === "date-wise" ? (
        <Paper sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50, fontWeight: 700 }}></TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">
                    Laborers
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">
                    Work Days
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Earnings
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Advances
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Net
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dateSummaries.map((summary) => (
                  <React.Fragment key={summary.date}>
                    <TableRow
                      hover
                      onClick={() => toggleDateExpanded(summary.date)}
                      sx={{
                        cursor: "pointer",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <TableCell>
                        <IconButton size="small">
                          {summary.isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {dayjs(summary.date).format("DD MMM YYYY")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(summary.date).format("dddd")}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={600}>
                          {summary.totalLaborers}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {summary.totalWorkDays}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color="success.main"
                        >
                          ₹{summary.totalEarnings.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main">
                          ₹{summary.totalAdvances.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          color="primary.main"
                        >
                          ₹
                          {(
                            summary.totalEarnings -
                            summary.totalAdvances +
                            summary.totalExtras
                          ).toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                        <Collapse
                          in={summary.isExpanded}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box sx={{ p: 2, bgcolor: "grey.50" }}>
                            {/* Category breakdown */}
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Category Breakdown
                            </Typography>
                            <Box
                              sx={{
                                mb: 2,
                                display: "flex",
                                gap: 1,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              {Object.entries(summary.categoryBreakdown).map(
                                ([cat, data]) => (
                                  <Chip
                                    key={cat}
                                    label={`${cat}: ${
                                      data.count
                                    } (₹${data.amount.toLocaleString()})`}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                  />
                                )
                              )}

                              {/* Add/Edit Laborers Button */}
                              {canEdit && (
                                <Button
                                  variant="contained"
                                  size="small"
                                  color="primary"
                                  startIcon={<Edit />}
                                  onClick={() =>
                                    handleOpenDrawerForDate(summary.date)
                                  }
                                  sx={{
                                    ml: "auto",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    boxShadow: 1,
                                    "&:hover": {
                                      boxShadow: 2,
                                    },
                                  }}
                                >
                                  Manage Laborers
                                </Button>
                              )}
                            </Box>

                            {/* Individual records */}
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Individual Records
                            </Typography>
                            <Table size="small">
                              <TableHead
                                sx={{ position: "sticky", top: 0, zIndex: 1 }}
                              >
                                <TableRow >
                                  <TableCell
                                    sx={{ fontWeight: 700  }}
                                  >
                                    Name
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontWeight: 700 }}
                                  >
                                    Type
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontWeight: 700 }}
                                  >
                                    Category
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontWeight: 700 }}
                                  >
                                    Team
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontWeight: 700 }}
                                    align="center"
                                  >
                                    Days
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontWeight: 700 }}
                                    align="right"
                                  >
                                    Earnings
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
                                {summary.records.map((record) => (
                                  <TableRow key={record.id}>
                                    <TableCell>{record.laborer_name}</TableCell>
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
                                            ? "primary"
                                            : "warning"
                                        }
                                        variant="outlined"
                                        sx={{ minWidth: 30 }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {record.category_name}
                                    </TableCell>
                                    <TableCell>
                                      {record.team_name || "-"}
                                    </TableCell>
                                    <TableCell align="center">
                                      {record.work_days}
                                    </TableCell>
                                    <TableCell align="right">
                                      ₹{record.daily_earnings.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="center">
                                      <Chip
                                        label={
                                          record.is_paid ? "PAID" : "PENDING"
                                        }
                                        size="small"
                                        color={
                                          record.is_paid ? "success" : "default"
                                        }
                                        variant={
                                          record.is_paid ? "filled" : "outlined"
                                        }
                                      />
                                    </TableCell>
                                    <TableCell align="center">
                                      <Box
                                        sx={{
                                          display: "flex",
                                          gap: 0.5,
                                          justifyContent: "center",
                                        }}
                                      >
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
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
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
        }}
        siteId={selectedSite.id}
        date={selectedDateForDrawer}
        onSuccess={() => {
          fetchAttendanceHistory();
          setSelectedDateForDrawer(undefined);
        }}
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
              <Alert severity="info" sx={{ mb: 1 }}>
                Editing attendance for{" "}
                <strong>{editingRecord.laborer_name}</strong> on{" "}
                {dayjs(editingRecord.date).format("DD MMM YYYY")}
              </Alert>

              <FormControl fullWidth size="small">
                <InputLabel>Work Days</InputLabel>
                <Select
                  value={editForm.work_days}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      work_days: e.target.value as number,
                    })
                  }
                  label="Work Days"
                >
                  <MenuItem value={0.5}>Half Day (0.5)</MenuItem>
                  <MenuItem value={1}>Full Day (1)</MenuItem>
                  <MenuItem value={1.5}>1.5 Days</MenuItem>
                  <MenuItem value={2}>2 Days</MenuItem>
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
                  bgcolor: "grey.100",
                  borderRadius: 1,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Total Earnings:
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

              <FormControl fullWidth size="small">
                <InputLabel>Payment Status</InputLabel>
                <Select
                  value={editForm.is_paid ? "paid" : "pending"}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      is_paid: e.target.value === "paid",
                    })
                  }
                  label="Payment Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                </Select>
              </FormControl>
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
    </Box>
  );
}
