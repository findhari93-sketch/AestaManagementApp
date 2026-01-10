"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Chip,
  Alert,
  Grid,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  AttachMoney,
  TrendingUp,
  Receipt,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import MiscExpenseDialog from "@/components/expenses/MiscExpenseDialog";
import MiscExpenseViewDialog from "@/components/expenses/MiscExpenseViewDialog";
import { getMiscExpenses, getMiscExpenseStats, cancelMiscExpense } from "@/lib/services/miscExpenseService";
import { getPayerSourceLabel } from "@/components/settlement/PayerSourceSelector";
import type { MiscExpenseWithDetails } from "@/types/misc-expense.types";
import type { PayerSource } from "@/types/settlement.types";
import dayjs from "dayjs";

export default function MiscellaneousExpensesPage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const { formatForApi, isAllTime } = useDateRange();
  const supabase = createClient();

  const { dateFrom, dateTo } = formatForApi();

  const [expenses, setExpenses] = useState<MiscExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MiscExpenseWithDetails | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<MiscExpenseWithDetails | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    cleared: 0,
    pending: 0,
    totalCount: 0,
    clearedCount: 0,
    pendingCount: 0,
  });

  // Cancel dialog state
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    expense: MiscExpenseWithDetails | null;
    reason: string;
  }>({ open: false, expense: null, reason: "" });

  const canEdit = hasEditPermission(userProfile?.role);

  const fetchExpenses = useCallback(async () => {
    if (!selectedSite?.id) {
      setExpenses([]);
      return;
    }

    setLoading(true);
    try {
      const data = await getMiscExpenses(supabase, selectedSite.id, {
        dateFrom: isAllTime ? undefined : (dateFrom || undefined),
        dateTo: isAllTime ? undefined : (dateTo || undefined),
      });
      setExpenses(data);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSite?.id, dateFrom, dateTo, isAllTime]);

  const fetchStats = useCallback(async () => {
    if (!selectedSite?.id) {
      setStats({ total: 0, cleared: 0, pending: 0, totalCount: 0, clearedCount: 0, pendingCount: 0 });
      return;
    }

    try {
      const data = await getMiscExpenseStats(supabase, selectedSite.id, {
        dateFrom: isAllTime ? undefined : (dateFrom || undefined),
        dateTo: isAllTime ? undefined : (dateTo || undefined),
      });
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, [selectedSite?.id, dateFrom, dateTo, isAllTime]);

  useEffect(() => {
    fetchExpenses();
    fetchStats();
  }, [fetchExpenses, fetchStats]);

  const handleEdit = (expense: MiscExpenseWithDetails) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleView = (expense: MiscExpenseWithDetails) => {
    setViewingExpense(expense);
    setViewDialogOpen(true);
  };

  const handleCancelClick = (expense: MiscExpenseWithDetails) => {
    setCancelDialog({ open: true, expense, reason: "" });
  };

  const handleCancelConfirm = async () => {
    if (!cancelDialog.expense || !cancelDialog.reason.trim()) return;

    try {
      const result = await cancelMiscExpense(
        supabase,
        cancelDialog.expense.id,
        cancelDialog.reason,
        userProfile?.id || "",
        userProfile?.name || "System"
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      setCancelDialog({ open: false, expense: null, reason: "" });
      fetchExpenses();
      fetchStats();
    } catch (err: any) {
      console.error("Error cancelling expense:", err);
      alert(err.message || "Failed to cancel expense");
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const handleSuccess = () => {
    fetchExpenses();
    fetchStats();
  };

  const columns = useMemo<MRT_ColumnDef<MiscExpenseWithDetails>[]>(
    () => [
      {
        accessorKey: "reference_number",
        header: "Ref Code",
        size: 140,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return (
            <Chip
              label={value}
              size="small"
              color="info"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: "0.75rem" }}
            />
          );
        },
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 110,
        Cell: ({ cell }) => dayjs(cell.getValue<string>()).format("DD MMM YYYY"),
      },
      {
        accessorKey: "category_name",
        header: "Category",
        size: 140,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 120,
        Cell: ({ cell }) => (
          <Typography fontWeight={600} color="success.main">
            ₹{cell.getValue<number>()?.toLocaleString("en-IN") || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "vendor_name",
        header: "Vendor",
        size: 150,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "payer_source",
        header: "Payer Source",
        size: 130,
        Cell: ({ row }) => {
          const source = row.original.payer_source as PayerSource | null;
          const customName = row.original.payer_name;
          if (!source) return "-";
          return (
            <Chip
              label={getPayerSourceLabel(source, customName || undefined)}
              size="small"
              variant="outlined"
            />
          );
        },
      },
      {
        accessorKey: "payment_mode",
        header: "Mode",
        size: 100,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          const modeLabels: Record<string, string> = {
            cash: "Cash",
            upi: "UPI",
            bank_transfer: "Bank",
            cheque: "Cheque",
          };
          return (
            <Chip
              label={modeLabels[value] || value}
              size="small"
              variant="outlined"
            />
          );
        },
      },
      {
        accessorKey: "subcontract_title",
        header: "Subcontract",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          if (!value) return "-";
          return (
            <Chip
              label={value.length > 20 ? value.substring(0, 18) + "..." : value}
              size="small"
              color="secondary"
              variant="outlined"
            />
          );
        },
      },
      {
        accessorKey: "is_cleared",
        header: "Status",
        size: 100,
        Cell: ({ cell }) => {
          const isCleared = cell.getValue<boolean>();
          return (
            <Chip
              label={isCleared ? "CLEARED" : "PENDING"}
              size="small"
              color={isCleared ? "success" : "warning"}
            />
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 130,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => handleView(row.original)}
              color="info"
              title="View Details"
            >
              <ViewIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleEdit(row.original)}
              disabled={!canEdit}
              color="primary"
              title="Edit"
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleCancelClick(row.original)}
              disabled={!canEdit}
              color="error"
              title="Cancel"
            >
              <CancelIcon fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ],
    [canEdit]
  );

  if (!selectedSite) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Please select a site to view miscellaneous expenses.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Miscellaneous Expenses"
        subtitle="Track ad-hoc expenses that don't fit into major categories"
        actions={
          canEdit && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setDialogOpen(true)}
            >
              Add Expense
            </Button>
          )
        }
      />

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <AttachMoney color="primary" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Expenses
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ₹{stats.total.toLocaleString("en-IN")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.totalCount} records
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TrendingUp color="success" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Cleared
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="success.main">
                    ₹{stats.cleared.toLocaleString("en-IN")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.clearedCount} records
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Receipt color="warning" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Pending
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="warning.main">
                    ₹{stats.pending.toLocaleString("en-IN")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.pendingCount} records
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={expenses}
        isLoading={loading}
        initialState={{
          sorting: [{ id: "date", desc: true }],
        }}
      />

      {/* Add/Edit Dialog */}
      <MiscExpenseDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        expense={editingExpense}
        onSuccess={handleSuccess}
      />

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={cancelDialog.open}
        onClose={() => setCancelDialog({ open: false, expense: null, reason: "" })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Cancel Expense</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to cancel this expense?
          </Typography>
          {cancelDialog.expense && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: "grey.100", borderRadius: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {cancelDialog.expense.reference_number}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ₹{cancelDialog.expense.amount?.toLocaleString("en-IN")} -{" "}
                {cancelDialog.expense.vendor_name || cancelDialog.expense.description || "No description"}
              </Typography>
            </Box>
          )}
          <TextField
            label="Cancellation Reason"
            value={cancelDialog.reason}
            onChange={(e) => setCancelDialog((prev) => ({ ...prev, reason: e.target.value }))}
            fullWidth
            multiline
            rows={2}
            required
            placeholder="Why is this expense being cancelled?"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog({ open: false, expense: null, reason: "" })}>
            Keep Expense
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancelConfirm}
            disabled={!cancelDialog.reason.trim()}
          >
            Cancel Expense
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <MiscExpenseViewDialog
        open={viewDialogOpen}
        onClose={() => {
          setViewDialogOpen(false);
          setViewingExpense(null);
        }}
        expense={viewingExpense}
      />
    </Box>
  );
}
