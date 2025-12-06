"use client";

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
  Skeleton,
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
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import dayjs from "dayjs";
import {
  useDashboardStats,
  useRecentAttendance,
  usePendingSalaries,
  useWeeklyTrendData,
  useExpenseBreakdown,
} from "@/hooks/queries/useDashboardData";
import { useQueryClient } from "@tanstack/react-query";

export default function SiteDashboardPage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const siteId = selectedSite?.id;

  // Use React Query hooks for data fetching with caching
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useDashboardStats(siteId);

  const { data: recentAttendance = [], isLoading: attendanceLoading } =
    useRecentAttendance(siteId);

  const { data: pendingSalaries = [], isLoading: salariesLoading } =
    usePendingSalaries(siteId);

  const { data: weeklyTrendData = [], isLoading: trendLoading } =
    useWeeklyTrendData(siteId);

  const { data: expenseBreakdown = [], isLoading: expenseLoading } =
    useExpenseBreakdown(siteId);

  const loading =
    statsLoading ||
    attendanceLoading ||
    salariesLoading ||
    trendLoading ||
    expenseLoading;

  // Refresh all dashboard data
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboardStats", siteId] });
    queryClient.invalidateQueries({ queryKey: ["recentAttendance", siteId] });
    queryClient.invalidateQueries({ queryKey: ["pendingSalaries", siteId] });
    queryClient.invalidateQueries({ queryKey: ["weeklyTrendData", siteId] });
    queryClient.invalidateQueries({ queryKey: ["expenseBreakdown", siteId] });
  };

  const statsCards = [
    {
      title: "Today's Laborers",
      value: loading ? "..." : (stats?.todayLaborers || 0).toString(),
      subtitle: `${stats?.activeLaborers || 0} total active`,
      icon: <People sx={{ fontSize: 40 }} />,
      color: "#1976d2",
      bgColor: "#e3f2fd",
    },
    {
      title: "Today's Cost",
      value: loading ? "..." : `₹${(stats?.todayCost || 0).toLocaleString()}`,
      subtitle: "Labor expenses",
      icon: <AccountBalanceWallet sx={{ fontSize: 40 }} />,
      color: "#2e7d32",
      bgColor: "#e8f5e9",
    },
    {
      title: "Week Total",
      value: loading ? "..." : `₹${(stats?.weekTotal || 0).toLocaleString()}`,
      subtitle: "Last 7 days",
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: "#9c27b0",
      bgColor: "#f3e5f5",
    },
    {
      title: "Pending Payments",
      value: loading
        ? "..."
        : `₹${(stats?.pendingPaymentAmount || 0).toLocaleString()}`,
      subtitle: `${stats?.pendingSalaries || 0} salary periods`,
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
        onRefresh={handleRefresh}
        isLoading={loading}
        showBack={false}
      />

      {statsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {(statsError as Error).message}
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
            {attendanceLoading ? (
              <Box>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={60} sx={{ mb: 1 }} />
                ))}
              </Box>
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
            {salariesLoading ? (
              <Box>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={60} sx={{ mb: 1 }} />
                ))}
              </Box>
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
            {trendLoading ? (
              <Skeleton variant="rectangular" height={300} />
            ) : weeklyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => `₹${value.toLocaleString()}`}
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
            {expenseLoading ? (
              <Skeleton variant="circular" width={200} height={200} sx={{ mx: "auto" }} />
            ) : expenseBreakdown.length > 0 ? (
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
                    label={({ name, percent }) =>
                      `${name || ''}: ${((percent || 0) * 100).toFixed(0)}%`
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
                    formatter={(value: number) => `₹${value.toLocaleString()}`}
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
