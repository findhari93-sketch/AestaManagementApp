"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  Skeleton,
  Paper,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  AccountBalanceWallet,
  People,
  TrendingUp,
  ArrowBack,
  Person,
} from "@mui/icons-material";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import PayerDetailReport from "./PayerDetailReport";

const COLORS = [
  "#1976d2",
  "#2e7d32",
  "#ed6c02",
  "#9c27b0",
  "#d32f2f",
  "#0288d1",
  "#7b1fa2",
  "#388e3c",
  "#f57c00",
  "#c2185b",
];

interface PayerSummary {
  id: string;
  name: string;
  phone: string | null;
  total_amount: number;
  expense_count: number;
}

interface PayerReportProps {
  siteId: string;
}

export default function PayerReport({ siteId }: PayerReportProps) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payerSummaries, setPayerSummaries] = useState<PayerSummary[]>([]);
  const [selectedPayerId, setSelectedPayerId] = useState<string | null>(null);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [unassignedTotal, setUnassignedTotal] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);

  useEffect(() => {
    fetchPayerSummaries();
  }, [siteId]);

  const fetchPayerSummaries = async () => {
    if (!siteId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all expenses for the site grouped by payer
      // Note: Using type assertion until migration is run and types regenerated
      const { data: expensesData, error: expError } = await (supabase as any)
        .from("expenses")
        .select(`
          id,
          amount,
          site_payer_id,
          site_payers(id, name, phone)
        `)
        .eq("site_id", siteId)
        .eq("is_deleted", false);

      if (expError) throw expError;

      // Group by payer
      const payerMap = new Map<string, PayerSummary>();
      let unassigned = 0;
      let unassignedExpenseCount = 0;
      let total = 0;

      (expensesData || []).forEach((expense: any) => {
        total += expense.amount;

        if (expense.site_payer_id && expense.site_payers) {
          const payer = expense.site_payers;
          const existing = payerMap.get(payer.id);
          if (existing) {
            existing.total_amount += expense.amount;
            existing.expense_count += 1;
          } else {
            payerMap.set(payer.id, {
              id: payer.id,
              name: payer.name,
              phone: payer.phone,
              total_amount: expense.amount,
              expense_count: 1,
            });
          }
        } else {
          unassigned += expense.amount;
          unassignedExpenseCount += 1;
        }
      });

      // Sort by total amount descending
      const summaries = Array.from(payerMap.values()).sort(
        (a, b) => b.total_amount - a.total_amount
      );

      setPayerSummaries(summaries);
      setTotalExpenses(total);
      setUnassignedTotal(unassigned);
      setUnassignedCount(unassignedExpenseCount);
    } catch (err: any) {
      console.error("Error fetching payer summaries:", err);
      setError("Failed to load payer data");
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    const data = payerSummaries.map((p) => ({
      name: p.name,
      value: p.total_amount,
    }));

    if (unassignedTotal > 0) {
      data.push({
        name: "Unassigned",
        value: unassignedTotal,
      });
    }

    return data;
  }, [payerSummaries, unassignedTotal]);

  const selectedPayer = useMemo(() => {
    return payerSummaries.find((p) => p.id === selectedPayerId);
  }, [payerSummaries, selectedPayerId]);

  if (loading) {
    return (
      <Box>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 4 }}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={300} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // If a payer is selected, show detail view
  if (selectedPayerId && selectedPayer) {
    return (
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Tooltip title="Back to Summary">
            <IconButton onClick={() => setSelectedPayerId(null)}>
              <ArrowBack />
            </IconButton>
          </Tooltip>
          <Typography variant="h6">
            {selectedPayer.name}&apos;s Expenses
          </Typography>
          <Chip
            label={`₹${selectedPayer.total_amount.toLocaleString()}`}
            color="primary"
            size="small"
          />
        </Box>
        <PayerDetailReport siteId={siteId} payerId={selectedPayerId} payerName={selectedPayer.name} />
      </Box>
    );
  }

  // Summary view
  return (
    <Box>
      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <AccountBalanceWallet color="error" />
                <Typography variant="body2" color="text.secondary">
                  Total Expenses
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700}>
                ₹{totalExpenses.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <People color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Payers
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700}>
                {payerSummaries.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <TrendingUp color="success" />
                <Typography variant="body2" color="text.secondary">
                  Avg per Payer
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700}>
                ₹{payerSummaries.length > 0
                  ? Math.round(
                      (totalExpenses - unassignedTotal) / payerSummaries.length
                    ).toLocaleString()
                  : 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {payerSummaries.length === 0 && unassignedTotal === 0 ? (
        <Alert severity="info">
          No expenses recorded yet. Add expenses with payer information to see the breakdown.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {/* Pie Chart */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Expense Distribution by Payer
              </Typography>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={100}
                      dataKey="value"
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => `₹${value.toLocaleString()}`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box
                  sx={{
                    height: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography color="text.secondary">No data to display</Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Payer Cards */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Payer Breakdown (Click to view details)
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {payerSummaries.map((payer, index) => (
                  <Card
                    key={payer.id}
                    sx={{
                      cursor: "pointer",
                      transition: "all 0.2s",
                      "&:hover": {
                        bgcolor: "action.hover",
                        transform: "translateX(4px)",
                      },
                      borderLeft: `4px solid ${COLORS[index % COLORS.length]}`,
                    }}
                    onClick={() => setSelectedPayerId(payer.id)}
                  >
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Person fontSize="small" color="action" />
                          <Box>
                            <Typography variant="body1" fontWeight={500}>
                              {payer.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {payer.expense_count} expenses
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="h6" fontWeight={600} color="error.main">
                          ₹{payer.total_amount.toLocaleString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}

                {unassignedTotal > 0 && (
                  <Card
                    sx={{
                      borderLeft: "4px solid",
                      borderColor: "grey.400",
                      opacity: 0.8,
                    }}
                  >
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box>
                          <Typography variant="body1" fontWeight={500} color="text.secondary">
                            Unassigned
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {unassignedCount} expenses without payer
                          </Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={600} color="text.secondary">
                          ₹{unassignedTotal.toLocaleString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
