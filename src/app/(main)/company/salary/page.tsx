"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  Card,
  CardContent,
  Grid,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Calculate as CalculateIcon,
  Payment as PaymentIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import type { SalaryPeriod } from "@/types/database.types";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";

dayjs.extend(weekOfYear);

type SalaryPeriodDetailed = SalaryPeriod & {
  laborer_name: string;
  laborer_phone: string | null;
  team_name: string | null;
};

export default function CompanySalaryPage() {
  const [salaryPeriods, setSalaryPeriods] = useState<SalaryPeriodDetailed[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openCalculateDialog, setOpenCalculateDialog] = useState(false);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [selectedPeriod, setSelectedPeriod] =
    useState<SalaryPeriodDetailed | null>(null);
  const [calculating, setCalculating] = useState(false);

  const { userProfile } = useAuth();
  const supabase = createClient();

  const canEdit =
    userProfile?.role === "admin" || userProfile?.role === "office";

  // Calculate default week ending (Saturday)
  const getDefaultWeekEnding = () => {
    const today = dayjs();
    const dayOfWeek = today.day();
    const daysUntilSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7;
    return today.add(daysUntilSaturday, "day").format("YYYY-MM-DD");
  };

  const [calculateForm, setCalculateForm] = useState({
    week_ending: getDefaultWeekEnding(),
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_mode: "cash" as "cash" | "upi" | "bank_transfer" | "cheque",
    payment_date: dayjs().format("YYYY-MM-DD"),
  });

  const fetchSalaryPeriods = async () => {
    try {
      setLoading(true);
      setError("");

      // Try to fetch from view first, fall back to join query
      const { data, error } = await supabase
        .from("salary_periods")
        .select(
          `
          *,
          laborers(name, phone, teams(name))
        `
        )
        .order("week_ending", { ascending: false })
        .limit(200);

      if (error) throw error;

      const formattedData: SalaryPeriodDetailed[] = (data || []).map(
        (item: any) => ({
          ...item,
          laborer_name: item.laborers?.name || "Unknown",
          laborer_phone: item.laborers?.phone || null,
          team_name: item.laborers?.teams?.name || null,
        })
      );

      setSalaryPeriods(formattedData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryPeriods();
  }, []);

  const handleCalculateSalary = async () => {
    try {
      setCalculating(true);
      setError("");
      setSuccess("");

      const weekEnding = dayjs(calculateForm.week_ending);
      const weekStart = weekEnding.subtract(6, "days").format("YYYY-MM-DD");

      // Fetch all active laborers
      const { data: laborers, error: laborersError } = await supabase
        .from("laborers")
        .select("*")
        .eq("status", "active");

      if (laborersError) throw laborersError;

      if (!laborers || laborers.length === 0) {
        setError("No active laborers found");
        return;
      }

      // Process each laborer
      const salaryRecords = [];

      for (const laborer of laborers) {
        // Fetch attendance for the week
        const { data: attendance, error: attendanceError } = await supabase
          .from("daily_attendance")
          .select("*")
          .eq("laborer_id", laborer.id)
          .gte("date", weekStart)
          .lte("date", calculateForm.week_ending);

        if (attendanceError) throw attendanceError;

        // Calculate totals
        const totalDaysWorked =
          attendance?.reduce((sum, a) => sum + (a.work_days || 0), 0) || 0;
        const grossEarnings =
          attendance?.reduce((sum, a) => sum + (a.daily_earnings || 0), 0) || 0;

        // Fetch advances for the week
        const { data: advances, error: advancesError } = await supabase
          .from("advances")
          .select("*")
          .eq("laborer_id", laborer.id)
          .eq("transaction_type", "advance")
          .gte("date", weekStart)
          .lte("date", calculateForm.week_ending);

        if (advancesError) throw advancesError;

        const advanceDeductions =
          advances?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;

        // Fetch extras for the week
        const { data: extras, error: extrasError } = await supabase
          .from("advances")
          .select("*")
          .eq("laborer_id", laborer.id)
          .eq("transaction_type", "extra")
          .gte("date", weekStart)
          .lte("date", calculateForm.week_ending);

        if (extrasError) throw extrasError;

        const extrasAmount =
          extras?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

        const netPayable = grossEarnings - advanceDeductions + extrasAmount;

        // Only create salary record if there's activity
        if (totalDaysWorked > 0 || advanceDeductions > 0 || extrasAmount > 0) {
          salaryRecords.push({
            laborer_id: laborer.id,
            week_ending: calculateForm.week_ending,
            week_start: weekStart,
            total_days_worked: totalDaysWorked,
            gross_earnings: grossEarnings,
            advance_deductions: advanceDeductions,
            extras: extrasAmount,
            net_payable: netPayable,
            amount_paid: 0,
            balance_due: netPayable,
            status: "calculated" as const,
            calculated_by: userProfile?.id,
          });
        }
      }

      if (salaryRecords.length === 0) {
        setError("No salary records to create for this period");
        return;
      }

      // Delete existing salary periods for this week (if recalculating)
      const { error: deleteError } = await supabase
        .from("salary_periods")
        .delete()
        .eq("week_ending", calculateForm.week_ending);

      if (deleteError) throw deleteError;

      // Insert new salary records
      const { error: insertError } = await supabase
        .from("salary_periods")
        .insert(salaryRecords);

      if (insertError) throw insertError;

      setSuccess(`Salary calculated for ${salaryRecords.length} laborer(s)`);
      await fetchSalaryPeriods();
      setOpenCalculateDialog(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleOpenPaymentDialog = (period: SalaryPeriodDetailed) => {
    setSelectedPeriod(period);
    setPaymentForm({
      amount: period.balance_due,
      payment_mode: "cash",
      payment_date: dayjs().format("YYYY-MM-DD"),
    });
    setOpenPaymentDialog(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedPeriod) return;

    try {
      setError("");
      setSuccess("");

      // Insert payment record
      const { error: paymentError } = await supabase
        .from("salary_payments")
        .insert({
          salary_period_id: selectedPeriod.id,
          amount: paymentForm.amount,
          payment_date: paymentForm.payment_date,
          payment_mode: paymentForm.payment_mode,
          paid_by: userProfile?.id,
          is_team_payment: false,
          team_id: null,
        });

      if (paymentError) throw paymentError;

      // Update salary period
      const newAmountPaid = selectedPeriod.amount_paid + paymentForm.amount;
      const newBalanceDue = selectedPeriod.net_payable - newAmountPaid;
      const newStatus =
        newBalanceDue <= 0
          ? "paid"
          : newAmountPaid > 0
          ? "partial"
          : "calculated";

      const { error: updateError } = await supabase
        .from("salary_periods")
        .update({
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: newStatus,
        })
        .eq("id", selectedPeriod.id);

      if (updateError) throw updateError;

      setSuccess("Payment recorded successfully");
      await fetchSalaryPeriods();
      setOpenPaymentDialog(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const columns = useMemo<MRT_ColumnDef<SalaryPeriodDetailed>[]>(
    () => [
      {
        id: "mrt-row-actions",
        header: "Actions",
        size: 100,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            {row.original.balance_due > 0 && (
              <Tooltip title="Record Payment">
                <IconButton
                  size="small"
                  onClick={() => handleOpenPaymentDialog(row.original)}
                >
                  <PaymentIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
        columnDefType: "display",
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "laborer_name",
        header: "Laborer",
        size: 180,
      },
      {
        accessorKey: "team_name",
        header: "Team",
        size: 140,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "week_ending",
        header: "Week Ending",
        size: 120,
        Cell: ({ cell }) =>
          dayjs(cell.getValue<string>()).format("DD MMM YYYY"),
      },
      {
        accessorKey: "total_days_worked",
        header: "Days",
        size: 80,
        Cell: ({ cell }) => cell.getValue<number>().toFixed(1),
      },
      {
        accessorKey: "gross_earnings",
        header: "Gross",
        size: 110,
        Cell: ({ cell }) => `₹${cell.getValue<number>().toLocaleString()}`,
      },
      {
        accessorKey: "advance_deductions",
        header: "Advances",
        size: 100,
        Cell: ({ cell }) => (
          <Typography variant="body2" color="warning.main">
            -₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "extras",
        header: "Extras",
        size: 90,
        Cell: ({ cell }) => (
          <Typography variant="body2" color="success.main">
            +₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "net_payable",
        header: "Net Payable",
        size: 120,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600}>
            ₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "balance_due",
        header: "Balance",
        size: 110,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="error.main">
            ₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 100,
        Cell: ({ cell }) => {
          const status = cell.getValue<string>();
          const colorMap: Record<string, any> = {
            draft: "default",
            calculated: "error",
            partial: "warning",
            paid: "success",
          };
          return (
            <Chip
              label={status.toUpperCase()}
              size="small"
              color={colorMap[status] || "default"}
            />
          );
        },
      },
    ],
    []
  );

  const stats = useMemo(() => {
    const totalPayable = salaryPeriods.reduce(
      (sum, p) => sum + (p.net_payable || 0),
      0
    );
    const totalPaid = salaryPeriods.reduce(
      (sum, p) => sum + (p.amount_paid || 0),
      0
    );
    const totalDue = salaryPeriods.reduce(
      (sum, p) => sum + (p.balance_due || 0),
      0
    );
    const pendingCount = salaryPeriods.filter(
      (p) => p.status === "calculated" || p.status === "partial"
    ).length;

    return { totalPayable, totalPaid, totalDue, pendingCount };
  }, [salaryPeriods]);

  return (
    <Box>
      <PageHeader
        title="Salary Management"
        subtitle="Manage salary calculations and payments across all sites"
        onRefresh={fetchSalaryPeriods}
        isLoading={loading}
        actions={
          canEdit && (
            <Button
              variant="contained"
              startIcon={<CalculateIcon />}
              onClick={() => setOpenCalculateDialog(true)}
            >
              Calculate Salary
            </Button>
          )
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Stats Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Payable
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  ₹{stats.totalPayable.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Paid
                </Typography>
                <Typography variant="h5" fontWeight={600} color="success.main">
                  ₹{stats.totalPaid.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Balance Due
                </Typography>
                <Typography variant="h5" fontWeight={600} color="error.main">
                  ₹{stats.totalDue.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Pending Payments
                </Typography>
                <Typography variant="h5" fontWeight={600} color="warning.main">
                  {stats.pendingCount}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Salary Periods Table */}
      <DataTable columns={columns} data={salaryPeriods} isLoading={loading} />

      {/* Calculate Salary Dialog */}
      <Dialog
        open={openCalculateDialog}
        onClose={() => setOpenCalculateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Calculate Weekly Salary</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Week Ending (Saturday)"
              type="date"
              value={calculateForm.week_ending}
              onChange={(e) =>
                setCalculateForm({
                  ...calculateForm,
                  week_ending: e.target.value,
                })
              }
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Select the Saturday ending the work week"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCalculateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCalculateSalary}
            variant="contained"
            disabled={calculating}
          >
            {calculating ? "Calculating..." : "Calculate"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog
        open={openPaymentDialog}
        onClose={() => setOpenPaymentDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Salary Payment</DialogTitle>
        <DialogContent>
          {selectedPeriod && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {selectedPeriod.laborer_name} - Week ending{" "}
                {dayjs(selectedPeriod.week_ending).format("DD MMM YYYY")}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
                sx={{ mb: 3 }}
              >
                Net Payable: ₹{selectedPeriod.net_payable.toLocaleString()} |
                Balance Due: ₹{selectedPeriod.balance_due.toLocaleString()}
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Payment Amount"
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        amount: Number(e.target.value),
                      })
                    }
                    slotProps={{ input: { startAdornment: "₹" } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Payment Date"
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_date: e.target.value,
                      })
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Mode</InputLabel>
                    <Select
                      value={paymentForm.payment_mode}
                      label="Payment Mode"
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          payment_mode: e.target.value as any,
                        })
                      }
                    >
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="upi">UPI</MenuItem>
                      <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                      <MenuItem value="cheque">Cheque</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPaymentDialog(false)}>Cancel</Button>
          <Button onClick={handleRecordPayment} variant="contained">
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
