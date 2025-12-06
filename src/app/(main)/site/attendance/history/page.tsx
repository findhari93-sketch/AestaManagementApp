"use client";

export const dynamic = "force-dynamic";

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
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import dayjs from "dayjs";

interface AttendanceRecord {
  id: string;
  date: string;
  laborer_id: string;
  laborer_name: string;
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

export default function AttendanceHistoryPage() {
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

  // Filters
  const [dateFrom, setDateFrom] = useState(
    dayjs().subtract(30, "days").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [selectedLaborer, setSelectedLaborer] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");

  const [laborers, setLaborers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

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
          laborers!inner(name, team_id, category_id, role_id, teams(name), labor_categories(name), labor_roles(name)),
          building_sections!inner(name)
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
            category_name: record.laborers.labor_categories?.name || "Unknown",
            role_name: record.laborers.labor_roles?.name || "Unknown",
            team_name: record.laborers.teams?.name || null,
            section_name: record.building_sections.name,
            work_days: record.work_days,
            hours_worked: record.hours_worked,
            daily_rate_applied: record.daily_rate_applied,
            daily_earnings: record.daily_earnings,
            advance_given: advances.advance,
            extra_given: advances.extra,
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
  }, [selectedSite, dateFrom, dateTo, selectedLaborer, selectedTeam]);

  const toggleDateExpanded = (date: string) => {
    setDateSummaries((prev) =>
      prev.map((d) =>
        d.date === date ? { ...d, isExpanded: !d.isExpanded } : d
      )
    );
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
        accessorKey: "advance_given",
        header: "Advance",
        size: 100,
        Cell: ({ cell }) => {
          const amount = cell.getValue<number>() || 0;
          return amount > 0 ? `₹${amount.toLocaleString()}` : "-";
        },
      },
    ],
    []
  );

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Attendance History" />
        <Alert severity="warning">
          Please select a site to view attendance history
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Attendance History"
        subtitle={`View attendance records for ${selectedSite.name}`}
        onRefresh={fetchAttendanceHistory}
        isLoading={loading}
        actions={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant={viewMode === "date-wise" ? "contained" : "outlined"}
              onClick={() => setViewMode("date-wise")}
              size="small"
            >
              Date-wise
            </Button>
            <Button
              variant={viewMode === "detailed" ? "contained" : "outlined"}
              onClick={() => setViewMode("detailed")}
              size="small"
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
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth>
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
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth>
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
                <TableRow sx={{ bgcolor: "primary.main" }}>
                  <TableCell sx={{ color: "white", width: 50 }}></TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 600 }}>
                    Date
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 600 }}
                    align="center"
                  >
                    Laborers
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 600 }}
                    align="center"
                  >
                    Work Days
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 600 }}
                    align="right"
                  >
                    Earnings
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 600 }}
                    align="right"
                  >
                    Advances
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 600 }}
                    align="right"
                  >
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
                            <Grid container spacing={1} sx={{ mb: 2 }}>
                              {Object.entries(summary.categoryBreakdown).map(
                                ([cat, data]) => (
                                  <Grid key={cat} size={{ xs: 6, sm: 3 }}>
                                    <Chip
                                      label={`${cat}: ${
                                        data.count
                                      } (₹${data.amount.toLocaleString()})`}
                                      size="small"
                                      variant="outlined"
                                      color="primary"
                                    />
                                  </Grid>
                                )
                              )}
                            </Grid>

                            {/* Individual records */}
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Individual Records
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: "action.hover" }}>
                                  <TableCell>Name</TableCell>
                                  <TableCell>Category</TableCell>
                                  <TableCell>Team</TableCell>
                                  <TableCell align="center">Days</TableCell>
                                  <TableCell align="right">Earnings</TableCell>
                                  <TableCell align="right">Advance</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {summary.records.map((record) => (
                                  <TableRow key={record.id}>
                                    <TableCell>{record.laborer_name}</TableCell>
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
                                    <TableCell align="right">
                                      {record.advance_given
                                        ? `₹${record.advance_given.toLocaleString()}`
                                        : "-"}
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
    </Box>
  );
}
