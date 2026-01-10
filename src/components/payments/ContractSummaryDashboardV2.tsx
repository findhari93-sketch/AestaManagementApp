"use client";

import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Skeleton,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  Warning as OutstandingIcon,
  Savings as AdvanceIcon,
  CheckCircle as PaidIcon,
  AccountBalanceWallet as TotalPaidIcon,
  TrendingUp as ProgressIcon,
} from "@mui/icons-material";

export interface ContractSummaryDashboardV2Props {
  // Salary-only totals
  totalSalaryEarned: number;
  totalSalarySettled: number;

  // Advance totals (separate from salary)
  totalAdvancesGiven: number;

  // Counts
  laborerCount: number;
  laborersWithDue: number;

  // Record counts
  salaryRecordCount?: number;
  advanceRecordCount?: number;

  // Loading state
  loading?: boolean;
}

export default function ContractSummaryDashboardV2({
  totalSalaryEarned,
  totalSalarySettled,
  totalAdvancesGiven,
  laborerCount,
  laborersWithDue,
  salaryRecordCount = 0,
  advanceRecordCount = 0,
  loading = false,
}: ContractSummaryDashboardV2Props) {
  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  // Calculate derived values
  // Remaining balance = Salary earned - Salary settled (advances NOT included)
  // Can be negative if overpaid (excess)
  const balanceDifference = totalSalaryEarned - totalSalarySettled;
  const remainingBalance = Math.max(0, balanceDifference);
  const excessPaid = balanceDifference < 0 ? Math.abs(balanceDifference) : 0;
  const isExcessPaid = excessPaid > 0;

  // Total paid = Salary settled + Advances given
  const totalPaid = totalSalarySettled + totalAdvancesGiven;

  // Payment progress (salary only)
  const paymentProgress = totalSalaryEarned > 0
    ? Math.round((totalSalarySettled / totalSalaryEarned) * 100)
    : 0;

  // Determine progress color: red < 50%, orange 50-80%, green >= 80%
  const getProgressColor = (progress: number): "error" | "warning" | "success" => {
    if (progress < 50) return "error";
    if (progress < 80) return "warning";
    return "success";
  };
  const progressColor = getProgressColor(paymentProgress);

  if (loading) {
    return (
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card sx={{ borderLeft: 4, borderColor: "grey.300" }}>
                <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Skeleton variant="circular" width={20} height={20} />
                    <Skeleton variant="text" width="60%" height={16} />
                  </Box>
                  <Skeleton variant="text" width="80%" height={32} sx={{ mb: 1 }} />
                  <Skeleton variant="rounded" width={80} height={24} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        {/* Salary Settlements (Green) */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            sx={{
              bgcolor: "success.50",
              borderLeft: 4,
              borderColor: "success.main",
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PaidIcon color="success" fontSize="small" />
                <Tooltip title="Total salary payments made (excluding advances)">
                  <Typography variant="caption" color="text.secondary" sx={{ cursor: "help" }}>
                    Salary Settlements
                  </Typography>
                </Tooltip>
              </Box>
              <Typography variant="h5" fontWeight={600} color="success.dark">
                {formatCurrency(totalSalarySettled)}
              </Typography>
              <Chip
                label={`${salaryRecordCount} settlement${salaryRecordCount !== 1 ? "s" : ""}`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Advances Given (Orange/Warning) */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            sx={{
              bgcolor: totalAdvancesGiven > 0 ? "warning.50" : "grey.50",
              borderLeft: 4,
              borderColor: totalAdvancesGiven > 0 ? "warning.main" : "grey.400",
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <AdvanceIcon
                  color={totalAdvancesGiven > 0 ? "warning" : "disabled"}
                  fontSize="small"
                />
                <Tooltip title="Advance payments given (tracked separately from salary)">
                  <Typography variant="caption" color="text.secondary" sx={{ cursor: "help" }}>
                    Advances Given
                  </Typography>
                </Tooltip>
              </Box>
              <Typography
                variant="h5"
                fontWeight={600}
                color={totalAdvancesGiven > 0 ? "warning.dark" : "text.secondary"}
              >
                {formatCurrency(totalAdvancesGiven)}
              </Typography>
              <Chip
                label={`${advanceRecordCount} settlement${advanceRecordCount !== 1 ? "s" : ""}`}
                size="small"
                color={totalAdvancesGiven > 0 ? "warning" : "default"}
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Total Paid (Blue) */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            sx={{
              bgcolor: "info.50",
              borderLeft: 4,
              borderColor: "info.main",
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <TotalPaidIcon color="info" fontSize="small" />
                <Tooltip title="Total amount paid (salary settlements + advances)">
                  <Typography variant="caption" color="text.secondary" sx={{ cursor: "help" }}>
                    Total Paid
                  </Typography>
                </Tooltip>
              </Box>
              <Typography variant="h5" fontWeight={600} color="info.dark">
                {formatCurrency(totalPaid)}
              </Typography>
              <Chip
                label={`${salaryRecordCount + advanceRecordCount} settlement${(salaryRecordCount + advanceRecordCount) !== 1 ? "s" : ""}`}
                size="small"
                color="info"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Remaining Balance / Excess Paid */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            sx={{
              bgcolor: isExcessPaid
                ? "info.50"
                : remainingBalance > 0
                  ? "error.50"
                  : "success.50",
              borderLeft: 4,
              borderColor: isExcessPaid
                ? "info.main"
                : remainingBalance > 0
                  ? "error.main"
                  : "success.main",
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <OutstandingIcon
                  color={isExcessPaid ? "info" : remainingBalance > 0 ? "error" : "success"}
                  fontSize="small"
                />
                <Tooltip
                  title={
                    isExcessPaid
                      ? "Amount paid in excess of salary earned (advances not included)"
                      : "Remaining salary balance (advances not deducted)"
                  }
                >
                  <Typography variant="caption" color="text.secondary" sx={{ cursor: "help" }}>
                    {isExcessPaid ? "Excess Paid" : "Remaining Balance"}
                  </Typography>
                </Tooltip>
              </Box>
              <Typography
                variant="h5"
                fontWeight={600}
                color={
                  isExcessPaid
                    ? "info.dark"
                    : remainingBalance > 0
                      ? "error.dark"
                      : "success.dark"
                }
              >
                {isExcessPaid ? `+${formatCurrency(excessPaid)}` : formatCurrency(remainingBalance)}
              </Typography>
              <Chip
                label={
                  isExcessPaid
                    ? "Overpaid"
                    : remainingBalance > 0
                      ? `${laborersWithDue} with due`
                      : "All settled"
                }
                size="small"
                color={isExcessPaid ? "info" : remainingBalance > 0 ? "error" : "success"}
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Progress (Circular) */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            sx={{
              bgcolor: `${progressColor}.50`,
              borderLeft: 4,
              borderColor: `${progressColor}.main`,
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <ProgressIcon color={progressColor} fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Salary Progress
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ position: "relative", display: "inline-flex" }}>
                  <CircularProgress
                    variant="determinate"
                    value={Math.min(paymentProgress, 100)}
                    size={56}
                    thickness={5}
                    color={progressColor}
                  />
                  <Box
                    sx={{
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      position: "absolute",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="div"
                      fontWeight={600}
                      color={`${progressColor}.dark`}
                    >
                      {paymentProgress}%
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {formatCurrency(totalSalarySettled)}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    of {formatCurrency(totalSalaryEarned)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
