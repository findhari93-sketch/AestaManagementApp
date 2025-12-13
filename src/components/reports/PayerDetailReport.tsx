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
  Chip,
} from "@mui/material";
import {
  AccountBalanceWallet,
  Receipt,
  Category,
  CalendarMonth,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useDateRange } from "@/contexts/DateRangeContext";
import dayjs from "dayjs";

interface PayerExpense {
  id: string;
  date: string;
  amount: number;
  category_name: string;
  module: string;
  description: string | null;
  vendor_name: string | null;
  payment_mode: string;
}

interface PayerDetailReportProps {
  siteId: string;
  payerId: string;
  payerName: string;
}

export default function PayerDetailReport({
  siteId,
  payerId,
  payerName,
}: PayerDetailReportProps) {
  const supabase = createClient();
  const { formatForApi, isAllTime } = useDateRange();

  const { dateFrom, dateTo } = formatForApi();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<PayerExpense[]>([]);

  useEffect(() => {
    fetchPayerExpenses();
  }, [siteId, payerId, dateFrom, dateTo, isAllTime]);

  const fetchPayerExpenses = async () => {
    if (!siteId || !payerId) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("expenses")
        .select(`
          id,
          date,
          amount,
          module,
          description,
          vendor_name,
          payment_mode,
          expense_categories(name)
        `)
        .eq("site_id", siteId)
        .eq("site_payer_id", payerId)
        .eq("is_deleted", false)
        .order("date", { ascending: false });

      // Only apply date filters if not "All Time"
      if (!isAllTime && dateFrom && dateTo) {
        query = query.gte("date", dateFrom).lte("date", dateTo);
      }

      const { data, error: expError } = await query;

      if (expError) throw expError;

      const mapped = (data || []).map((e: any) => ({
        id: e.id,
        date: e.date,
        amount: e.amount,
        category_name: e.expense_categories?.name || "Unknown",
        module: e.module,
        description: e.description,
        vendor_name: e.vendor_name,
        payment_mode: e.payment_mode,
      }));

      setExpenses(mapped);
    } catch (err: any) {
      console.error("Error fetching payer expenses:", err);
      setError("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const count = expenses.length;
    const avgPerExpense = count > 0 ? Math.round(total / count) : 0;

    // Find most common category
    const categoryCount = new Map<string, number>();
    expenses.forEach((e) => {
      categoryCount.set(
        e.category_name,
        (categoryCount.get(e.category_name) || 0) + 1
      );
    });
    let topCategory = "N/A";
    let maxCount = 0;
    categoryCount.forEach((count, category) => {
      if (count > maxCount) {
        maxCount = count;
        topCategory = category;
      }
    });

    return { total, count, avgPerExpense, topCategory };
  }, [expenses]);

  const columns = useMemo<MRT_ColumnDef<PayerExpense>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        size: 120,
        Cell: ({ cell }) =>
          dayjs(cell.getValue<string>()).format("DD MMM YYYY"),
      },
      {
        accessorKey: "module",
        header: "Module",
        size: 100,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>().toUpperCase()}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        accessorKey: "category_name",
        header: "Category",
        size: 150,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 120,
        Cell: ({ cell }) => (
          <Typography fontWeight={600} color="error.main">
            ₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 200,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "vendor_name",
        header: "Vendor",
        size: 150,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "payment_mode",
        header: "Payment Mode",
        size: 120,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>()?.replace("_", " ").toUpperCase() || "-"}
            size="small"
            color="default"
          />
        ),
      },
    ],
    []
  );

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <AccountBalanceWallet fontSize="small" color="error" />
                <Typography variant="caption" color="text.secondary">
                  Total Amount
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700}>
                ₹{stats.total.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Receipt fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary">
                  Expenses
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700}>
                {stats.count}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <CalendarMonth fontSize="small" color="success" />
                <Typography variant="caption" color="text.secondary">
                  Avg per Expense
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700}>
                ₹{stats.avgPerExpense.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Category fontSize="small" color="warning" />
                <Typography variant="caption" color="text.secondary">
                  Top Category
                </Typography>
              </Box>
              <Typography variant="h6" fontWeight={700} noWrap>
                {stats.topCategory}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Expenses Table */}
      {loading ? (
        <Box>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rounded" height={50} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : expenses.length === 0 ? (
        <Alert severity="info">
          No expenses found for {payerName} in the selected date range.
        </Alert>
      ) : (
        <DataTable columns={columns} data={expenses} isLoading={loading} />
      )}
    </Box>
  );
}
