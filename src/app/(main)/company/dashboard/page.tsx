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
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  Divider,
  Alert,
  LinearProgress,
} from "@mui/material";
import {
  People,
  AccountBalanceWallet,
  Domain,
  Groups,
  TrendingUp,
  Payment,
  ArrowForward,
  Business,
} from "@mui/icons-material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import dayjs from "dayjs";

interface CompanyStats {
  totalSites: number;
  activeSites: number;
  totalLaborers: number;
  activeLaborers: number;
  totalTeams: number;
  pendingPayments: number;
  pendingPaymentAmount: number;
  monthlyExpenses: number;
}

interface SiteSummary {
  id: string;
  name: string;
  status: string;
  todayLaborers: number;
  todayCost: number;
  weekCost: number;
}

export default function CompanyDashboardPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<CompanyStats>({
    totalSites: 0,
    activeSites: 0,
    totalLaborers: 0,
    activeLaborers: 0,
    totalTeams: 0,
    pendingPayments: 0,
    pendingPaymentAmount: 0,
    monthlyExpenses: 0,
  });
  const [siteSummaries, setSiteSummaries] = useState<SiteSummary[]>([]);
  const [siteComparisonData, setSiteComparisonData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      setLoading(true);
      setError("");

      const today = dayjs().format("YYYY-MM-DD");
      const weekStart = dayjs().subtract(7, "days").format("YYYY-MM-DD");
      const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");

      // Fetch sites
      const { data: sites, error: sitesError } = await supabase
        .from("sites")
        .select("id, name, status");

      if (sitesError) throw sitesError;

      const totalSites = sites?.length || 0;
      const activeSites =
        sites?.filter((s) => s.status === "active").length || 0;

      // Fetch laborers
      const { data: laborers, error: laborersError } = await supabase
        .from("laborers")
        .select("id, status");

      if (laborersError) throw laborersError;

      const totalLaborers = laborers?.length || 0;
      const activeLaborers =
        laborers?.filter((l) => l.status === "active").length || 0;

      // Fetch teams
      const { count: totalTeams, error: teamsError } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true });

      if (teamsError) throw teamsError;

      // Fetch pending payments
      const { data: pendingData, error: pendingError } = await supabase
        .from("salary_periods")
        .select("balance_due")
        .in("status", ["calculated", "partial"]);

      if (pendingError) throw pendingError;

      const pendingPayments = pendingData?.length || 0;
      const pendingPaymentAmount =
        pendingData?.reduce((sum, p) => sum + (p.balance_due || 0), 0) || 0;

      // Fetch monthly expenses
      const { data: monthlyExpData, error: monthlyError } = await supabase
        .from("daily_attendance")
        .select("daily_earnings")
        .gte("date", monthStart)
        .lte("date", today);

      if (monthlyError) throw monthlyError;

      const monthlyExpenses =
        monthlyExpData?.reduce((sum, a) => sum + (a.daily_earnings || 0), 0) ||
        0;

      setStats({
        totalSites,
        activeSites,
        totalLaborers,
        activeLaborers,
        totalTeams: totalTeams || 0,
        pendingPayments,
        pendingPaymentAmount,
        monthlyExpenses,
      });

      // Fetch site-wise summaries
      const summaries: SiteSummary[] = await Promise.all(
        (sites || [])
          .filter((s) => s.status === "active")
          .map(async (site) => {
            const { data: todayAtt } = await supabase
              .from("daily_attendance")
              .select("daily_earnings")
              .eq("site_id", site.id)
              .eq("date", today);

            const { data: weekAtt } = await supabase
              .from("daily_attendance")
              .select("daily_earnings")
              .eq("site_id", site.id)
              .gte("date", weekStart)
              .lte("date", today);

            return {
              id: site.id,
              name: site.name,
              status: site.status,
              todayLaborers: todayAtt?.length || 0,
              todayCost:
                todayAtt?.reduce(
                  (sum, a) => sum + (a.daily_earnings || 0),
                  0
                ) || 0,
              weekCost:
                weekAtt?.reduce((sum, a) => sum + (a.daily_earnings || 0), 0) ||
                0,
            };
          })
      );
      setSiteSummaries(summaries);

      // Create comparison chart data
      const comparisonData = summaries.map((s) => ({
        name: s.name.length > 15 ? s.name.substring(0, 15) + "..." : s.name,
        Today: s.todayCost,
        "This Week": s.weekCost,
      }));
      setSiteComparisonData(comparisonData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: "Active Sites",
      value: loading ? "..." : stats.activeSites.toString(),
      subtitle: `${stats.totalSites} total sites`,
      icon: <Domain sx={{ fontSize: 40 }} />,
      color: "#1976d2",
      bgColor: "#e3f2fd",
    },
    {
      title: "Active Laborers",
      value: loading ? "..." : stats.activeLaborers.toString(),
      subtitle: `${stats.totalLaborers} total registered`,
      icon: <People sx={{ fontSize: 40 }} />,
      color: "#2e7d32",
      bgColor: "#e8f5e9",
    },
    {
      title: "Teams",
      value: loading ? "..." : stats.totalTeams.toString(),
      subtitle: "Contractor teams",
      icon: <Groups sx={{ fontSize: 40 }} />,
      color: "#9c27b0",
      bgColor: "#f3e5f5",
    },
    {
      title: "Pending Payments",
      value: loading
        ? "..."
        : `₹${stats.pendingPaymentAmount.toLocaleString()}`,
      subtitle: `${stats.pendingPayments} pending`,
      icon: <Payment sx={{ fontSize: 40 }} />,
      color: "#d32f2f",
      bgColor: "#ffebee",
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Company Dashboard"
        subtitle={`Overview of all sites and resources • Welcome, ${userProfile?.name}`}
        onRefresh={fetchCompanyData}
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

      {/* Monthly Summary Card */}
      <Paper
        sx={{
          p: 3,
          borderRadius: 3,
          mb: 3,
          bgcolor: "primary.main",
          color: "white",
        }}
      >
        <Grid container alignItems="center" spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Typography variant="h6" fontWeight={600}>
              This Month&apos;s Labor Cost
            </Typography>
            <Typography variant="h3" fontWeight={700}>
              ₹{stats.monthlyExpenses.toLocaleString()}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {dayjs().format("MMMM YYYY")} • Across all sites
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: { md: "right" } }}>
            <Button
              variant="contained"
              sx={{
                bgcolor: "white",
                color: "primary.main",
                "&:hover": { bgcolor: "grey.100" },
              }}
              endIcon={<ArrowForward />}
              onClick={() => router.push("/company/reports")}
            >
              View Full Report
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Site-wise Summary */}
        <Grid size={{ xs: 12, md: 5 }}>
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
                Active Sites
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForward />}
                onClick={() => router.push("/company/sites")}
              >
                Manage
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
            ) : siteSummaries.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                No active sites
              </Typography>
            ) : (
              <List>
                {siteSummaries.map((site, index) => (
                  <ListItem
                    key={site.id}
                    sx={{
                      px: 0,
                      borderBottom:
                        index < siteSummaries.length - 1 ? "1px solid" : "none",
                      borderColor: "divider",
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: "primary.light" }}>
                        <Business />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={site.name}
                      secondary={`${site.todayLaborers} laborers today`}
                    />
                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="body2" fontWeight={600}>
                        ₹{site.todayCost.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Today
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Site Comparison Chart */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Site-wise Cost Comparison
            </Typography>
            {siteComparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={siteComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: any) => `₹${value.toLocaleString()}`}
                  />
                  <Legend />
                  <Bar dataKey="Today" fill="#1976d2" />
                  <Bar dataKey="This Week" fill="#2e7d32" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No data available
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
                  startIcon={<Groups />}
                  onClick={() => router.push("/company/teams")}
                  sx={{ py: 1.5 }}
                >
                  Manage Teams
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AccountBalanceWallet />}
                  onClick={() => router.push("/company/salary")}
                  sx={{ py: 1.5 }}
                >
                  Salary & Payments
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<TrendingUp />}
                  onClick={() => router.push("/company/reports")}
                  sx={{ py: 1.5 }}
                >
                  Company Reports
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
