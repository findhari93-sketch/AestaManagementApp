"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Divider,
  Alert,
} from "@mui/material";
import {
  People,
  AccountBalanceWallet,
  TrendingUp,
  CalendarToday,
  Payment,
  ArrowForward,
} from "@mui/icons-material";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import dayjs from "dayjs";

interface DashboardStats {
  todayLaborers: number;
  todayCost: number;
  weekTotal: number;
  pendingSalaries: number;
  activeLaborers: number;
  pendingPaymentAmount: number;
}

interface RecentAttendance {
  date: string;
  laborer_name: string;
  work_days: number;
  daily_earnings: number;
}

interface PendingSalary {
  laborer_name: string;
  week_ending: string;
  balance_due: number;
  status: string;
}

export default function SiteDashboardPage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<DashboardStats>({
    todayLaborers: 0,
    todayCost: 0,
    weekTotal: 0,
    pendingSalaries: 0,
    activeLaborers: 0,
    pendingPaymentAmount: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>(
    []
  );
  const [pendingSalaries, setPendingSalaries] = useState<PendingSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [weeklyTrendData, setWeeklyTrendData] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);

  useEffect(() => {
    if (selectedSite) {
      fetchDashboardData();
    }
  }, [selectedSite]);

  const fetchDashboardData = async () => {
    if (!selectedSite) return;

    try {
      setLoading(true);
      setError("");

      const today = dayjs().format("YYYY-MM-DD");
      const weekStart = dayjs().subtract(7, "days").format("YYYY-MM-DD");

      // Fetch today's attendance
      const { data: todayAttendance, error: todayError } = await supabase
        .from("daily_attendance")
        .select("work_days, daily_earnings")
        .eq("site_id", selectedSite.id)
        .eq("date", today);

      if (todayError) throw todayError;

      const typedTodayAttendance = todayAttendance as
        | { work_days: number; daily_earnings: number }[]
        | null;

      const todayLaborers = typedTodayAttendance?.length || 0;
      const todayCost =
        typedTodayAttendance?.reduce(
          (sum, a) => sum + (a.daily_earnings || 0),
          0
        ) || 0;

      // Fetch week's total
      const { data: weekAttendance, error: weekError } = await supabase
        .from("daily_attendance")
        .select("daily_earnings")
        .eq("site_id", selectedSite.id)
        .gte("date", weekStart)
        .lte("date", today);

      if (weekError) throw weekError;

      const typedWeekAttendance = weekAttendance as
        | { daily_earnings: number }[]
        | null;

      const weekTotal =
        typedWeekAttendance?.reduce(
          (sum, a) => sum + (a.daily_earnings || 0),
          0
        ) || 0;

      // Fetch active laborers count
      const { count: activeLaborers, error: laborersError } = await supabase
        .from("laborers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      if (laborersError) throw laborersError;

      // Fetch pending salaries
      const { data: pendingSalaryData, error: salaryError } = await supabase
        .from("salary_periods")
        .select("balance_due, status")
        .in("status", ["calculated", "partial"]);

      if (salaryError) throw salaryError;

      const typedPendingSalaryData = pendingSalaryData as
        | { balance_due: number; status: string }[]
        | null;

      const pendingSalaries = typedPendingSalaryData?.length || 0;
      const pendingPaymentAmount =
        typedPendingSalaryData?.reduce(
          (sum, s) => sum + (s.balance_due || 0),
          0
        ) || 0;

      setStats({
        todayLaborers,
        todayCost,
        weekTotal,
        pendingSalaries,
        activeLaborers: activeLaborers || 0,
        pendingPaymentAmount,
      });

      // Fetch recent attendance
      const { data: recentData, error: recentError } = await supabase
        .from("v_active_attendance")
        .select("date, laborer_name, work_days, daily_earnings")
        .eq("site_id", selectedSite.id)
        .order("date", { ascending: false })
        .limit(5);

      if (recentError) throw recentError;
      setRecentAttendance(recentData || []);

      // Fetch pending salary details
      const { data: pendingSalaryDetails, error: pendingError } = await supabase
        .from("v_salary_periods_detailed")
        .select("laborer_name, week_ending, balance_due, status")
        .in("status", ["calculated", "partial"])
        .order("week_ending", { ascending: false })
        .limit(5);

      if (pendingError) throw pendingError;
      setPendingSalaries(pendingSalaryDetails || []);

      // Fetch weekly trend data
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = dayjs().subtract(6 - i, "days");
        return date.format("YYYY-MM-DD");
      });

      const trendData = await Promise.all(
        last7Days.map(async (date) => {
          const { data: dayAttendance } = await supabase
            .from("daily_attendance")
            .select("daily_earnings")
            .eq("site_id", selectedSite.id)
            .eq("date", date);

          const { data: dayExpenses } = await supabase
            .from("expenses")
            .select("amount")
            .eq("site_id", selectedSite.id)
            .eq("date", date);

          const typedDayAttendance = dayAttendance as
            | { daily_earnings: number }[]
            | null;
          const typedDayExpenses = dayExpenses as { amount: number }[] | null;

          return {
            date: dayjs(date).format("DD MMM"),
            labor:
              typedDayAttendance?.reduce(
                (sum, a) => sum + (a.daily_earnings || 0),
                0
              ) || 0,
            expenses:
              typedDayExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) ||
              0,
          };
        })
      );
      setWeeklyTrendData(trendData);

      // Fetch expense breakdown
      const { data: expensesData } = await supabase
        .from("expenses")
        .select("module, amount")
        .eq("site_id", selectedSite.id)
        .gte("date", dayjs().subtract(30, "days").format("YYYY-MM-DD"));

      const typedExpensesData = expensesData as
        | { module: string; amount: number }[]
        | null;

      const expensesByModule =
        typedExpensesData?.reduce((acc: any, exp) => {
          acc[exp.module] = (acc[exp.module] || 0) + exp.amount;
          return acc;
        }, {}) || {};

      const expenseBreakdownData = Object.entries(expensesByModule).map(
        ([module, amount]) => ({
          name: module.charAt(0).toUpperCase() + module.slice(1),
          value: amount as number,
        })
      );
      setExpenseBreakdown(expenseBreakdownData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: "Today's Laborers",
      value: loading ? "..." : stats.todayLaborers.toString(),
      subtitle: `${stats.activeLaborers} total active`,
      icon: <People sx={{ fontSize: 40 }} />,
      color: "#1976d2",
      bgColor: "#e3f2fd",
    },
    {
      title: "Today's Cost",
      value: loading ? "..." : `₹${stats.todayCost.toLocaleString()}`,
      subtitle: "Labor expenses",
      icon: <AccountBalanceWallet sx={{ fontSize: 40 }} />,
      color: "#2e7d32",
      bgColor: "#e8f5e9",
    },
    {
      title: "Week Total",
      value: loading ? "..." : `₹${stats.weekTotal.toLocaleString()}`,
      subtitle: "Last 7 days",
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: "#9c27b0",
      bgColor: "#f3e5f5",
    },
    {
      title: "Pending Payments",
      value: loading
        ? "..."
        : `₹${stats.pendingPaymentAmount.toLocaleString()}`,
      subtitle: `${stats.pendingSalaries} salary periods`,
      icon: <Payment sx={{ fontSize: 40 }} />,
      color: "#d32f2f",
      bgColor: "#ffebee",
    },
  ];

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader
          title="Site Dashboard"
          subtitle={`Welcome back, ${userProfile?.name}`}
          showBack={false}
        />
        <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
          <Typography variant="h6" color="text.secondary">
            Please select a site to view dashboard
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Site Dashboard"
        subtitle={`${selectedSite.name} • Welcome back, ${userProfile?.name}`}
        onRefresh={fetchDashboardData}
        isLoading={loading}
        showBack={false}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statsCards.map((stat, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                height: "100%",
                borderRadius: 3,
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
                },
              }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" fontWeight={600} sx={{ mb: 0.5 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stat.subtitle}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: stat.bgColor,
                      color: stat.color,
                      p: 1.5,
                      borderRadius: 2,
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Content Grid */}
      <Grid container spacing={3}>
        {/* Recent Attendance */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6" fontWeight={600}>
                Recent Attendance
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForward />}
                onClick={() => router.push("/site/attendance")}
              >
                View All
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {loading ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                Loading...
              </Typography>
            ) : recentAttendance.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                No recent attendance records
              </Typography>
            ) : (
              <List>
                {recentAttendance.map((record, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      px: 0,
                      borderBottom:
                        index < recentAttendance.length - 1
                          ? "1px solid"
                          : "none",
                      borderColor: "divider",
                    }}
                  >
                    <ListItemText
                      primary={record.laborer_name}
                      secondary={dayjs(record.date).format("DD MMM YYYY")}
                    />
                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="body2" fontWeight={600}>
                        ₹{record.daily_earnings.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {record.work_days} day(s)
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Pending Salaries */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6" fontWeight={600}>
                Pending Salary Payments
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForward />}
                onClick={() => router.push("/company/salary")}
              >
                View All
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {loading ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                Loading...
              </Typography>
            ) : pendingSalaries.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                No pending salary payments
              </Typography>
            ) : (
              <List>
                {pendingSalaries.map((salary, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      px: 0,
                      borderBottom:
                        index < pendingSalaries.length - 1
                          ? "1px solid"
                          : "none",
                      borderColor: "divider",
                    }}
                  >
                    <ListItemText
                      primary={salary.laborer_name}
                      secondary={`Week ending ${dayjs(
                        salary.week_ending
                      ).format("DD MMM")}`}
                    />
                    <Box sx={{ textAlign: "right" }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color="error.main"
                      >
                        ₹{salary.balance_due.toLocaleString()}
                      </Typography>
                      <Chip
                        label={salary.status.toUpperCase()}
                        size="small"
                        color={
                          salary.status === "calculated" ? "error" : "warning"
                        }
                        sx={{ height: 20, fontSize: "0.7rem" }}
                      />
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Weekly Trend Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Weekly Cost Trend
            </Typography>
            {weeklyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: any) => `₹${value.toLocaleString()}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="labor"
                    stroke="#1976d2"
                    strokeWidth={2}
                    name="Labor Cost"
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#d32f2f"
                    strokeWidth={2}
                    name="Expenses"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No data available for the last 7 days
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Expense Breakdown */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Expense Breakdown (30 days)
            </Typography>
            {expenseBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }: any) =>
                      `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                    }
                  >
                    {expenseBreakdown.map((entry, index) => {
                      const colors = [
                        "#1976d2",
                        "#2e7d32",
                        "#ed6c02",
                        "#9c27b0",
                      ];
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={colors[index % colors.length]}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => `₹${value.toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No expenses recorded
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<CalendarToday />}
                  onClick={() => router.push("/site/attendance")}
                  sx={{ py: 1.5 }}
                >
                  Record Attendance
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AccountBalanceWallet />}
                  onClick={() => router.push("/site/expenses")}
                  sx={{ py: 1.5 }}
                >
                  Add Expense
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<People />}
                  onClick={() => router.push("/company/laborers")}
                  sx={{ py: 1.5 }}
                >
                  Manage Laborers
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<TrendingUp />}
                  onClick={() => router.push("/site/reports")}
                  sx={{ py: 1.5 }}
                >
                  View Reports
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
