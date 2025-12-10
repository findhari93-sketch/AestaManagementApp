"use client";

import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Checkbox,
  Divider,
  LinearProgress,
  Tooltip,
  Alert,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  Payment as PaymentIcon,
  CheckCircle as CompletedIcon,
  Warning as WarningIcon,
  TrendingUp as AdvanceIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import type {
  WeekGroup,
  WeeklyContractLaborer,
  PaymentStatus,
} from "@/types/payment.types";
import {
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from "@/types/payment.types";

interface WeekGroupRowProps {
  weekGroup: WeekGroup;
  onToggleExpand: () => void;
  onPayWeeklyDue: (laborers: WeeklyContractLaborer[]) => void;
  onPaySelected: (laborers: WeeklyContractLaborer[]) => void;
  onPayLaborer: (laborer: WeeklyContractLaborer) => void;
  selectedLaborers: Set<string>;
  onToggleSelect: (laborerId: string) => void;
  onSelectAll: (weekStart: string, select: boolean) => void;
  disabled?: boolean;
}

export default function WeekGroupRow({
  weekGroup,
  onToggleExpand,
  onPayWeeklyDue,
  onPaySelected,
  onPayLaborer,
  selectedLaborers,
  onToggleSelect,
  onSelectAll,
  disabled = false,
}: WeekGroupRowProps) {
  const { weekStart, weekEnd, weekLabel, laborers, summary, isExpanded } =
    weekGroup;

  const pendingLaborers = laborers.filter(
    (l) => l.runningBalance > 0 && l.status !== "completed"
  );
  const selectedCount = laborers.filter(
    (l) => selectedLaborers.has(l.laborerId) && l.runningBalance > 0
  ).length;

  const formatCurrency = (amount: number) => `Rs.${amount.toLocaleString()}`;

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case "completed":
        return <CompletedIcon color="success" fontSize="small" />;
      case "advance":
        return <AdvanceIcon color="info" fontSize="small" />;
      case "partial":
        return <WarningIcon color="warning" fontSize="small" />;
      default:
        return <WarningIcon color="error" fontSize="small" />;
    }
  };

  const getProgressColor = (
    progress: number
  ): "error" | "warning" | "success" | "info" => {
    if (progress >= 100) return "success";
    if (progress > 100) return "info";
    if (progress >= 50) return "warning";
    return "error";
  };

  return (
    <Paper sx={{ mb: 1.5, overflow: "hidden" }}>
      {/* Collapsed Header Row */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          bgcolor: isExpanded ? "action.selected" : "background.paper",
          "&:hover": { bgcolor: "action.hover" },
        }}
        onClick={onToggleExpand}
      >
        {/* Week Info */}
        <Box sx={{ minWidth: 200 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Week: {weekLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {summary.laborerCount} contract laborers
          </Typography>
        </Box>

        {/* Summary Stats */}
        <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Salary
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatCurrency(summary.totalSalary)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Paid
            </Typography>
            <Typography variant="body2" fontWeight={600} color="success.main">
              {formatCurrency(summary.totalPaid)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Due
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              color={summary.totalDue > 0 ? "error.main" : "success.main"}
            >
              {formatCurrency(summary.totalDue)}
            </Typography>
          </Box>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ width: 200 }}>
          <Box
            sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              Progress
            </Typography>
            <Typography variant="caption" fontWeight={600}>
              {summary.paymentProgress.toFixed(0)}%
              {summary.paymentProgress > 100 && " (Advance)"}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(summary.paymentProgress, 100)}
            color={getProgressColor(summary.paymentProgress)}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        {/* Status Chip */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {getStatusIcon(summary.status)}
          <Chip
            label={getPaymentStatusLabel(summary.status)}
            size="small"
            color={getPaymentStatusColor(summary.status)}
            variant={summary.status === "completed" ? "filled" : "outlined"}
          />
        </Box>

        {/* Settle Button */}
        <Box onClick={(e) => e.stopPropagation()}>
          {summary.totalDue > 0 && (
            <Button
              variant="contained"
              size="small"
              onClick={() => onPayWeeklyDue(pendingLaborers)}
              disabled={disabled || pendingLaborers.length === 0}
              startIcon={<PaymentIcon />}
            >
              Settle Due {formatCurrency(summary.totalDue)}
            </Button>
          )}
        </Box>

        {/* Expand Icon */}
        <IconButton size="small">
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      {/* Expanded Content */}
      <Collapse in={isExpanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {/* Bulk Actions */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Checkbox
                checked={
                  pendingLaborers.length > 0 &&
                  pendingLaborers.every((l) =>
                    selectedLaborers.has(l.laborerId)
                  )
                }
                indeterminate={
                  pendingLaborers.some((l) =>
                    selectedLaborers.has(l.laborerId)
                  ) &&
                  !pendingLaborers.every((l) =>
                    selectedLaborers.has(l.laborerId)
                  )
                }
                onChange={(e) => onSelectAll(weekStart, e.target.checked)}
                disabled={pendingLaborers.length === 0}
              />
              <Typography variant="body2">Select All Pending</Typography>
            </Box>

            {selectedCount > 0 && (
              <Button
                variant="contained"
                size="small"
                onClick={() =>
                  onPaySelected(
                    laborers.filter(
                      (l) =>
                        selectedLaborers.has(l.laborerId) && l.runningBalance > 0
                    )
                  )
                }
                disabled={disabled}
              >
                Settle Selected ({selectedCount})
              </Button>
            )}
          </Box>

          {/* Laborers Table */}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Laborer</TableCell>
                <TableCell>Team / Subcontract</TableCell>
                <TableCell align="center">Days</TableCell>
                <TableCell align="right">Salary</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Due</TableCell>
                <TableCell align="center">Progress</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {laborers.map((laborer) => (
                <React.Fragment key={laborer.laborerId}>
                  <TableRow hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedLaborers.has(laborer.laborerId)}
                        onChange={() => onToggleSelect(laborer.laborerId)}
                        disabled={laborer.runningBalance <= 0}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {laborer.laborerName}
                      </Typography>
                      {laborer.laborerRole && (
                        <Typography variant="caption" color="text.secondary">
                          {laborer.laborerRole}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {laborer.teamName && (
                        <Typography variant="body2">
                          {laborer.teamName}
                        </Typography>
                      )}
                      {laborer.subcontractTitle && (
                        <Typography variant="caption" color="text.secondary">
                          {laborer.subcontractTitle}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={laborer.daysWorked}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500}>
                        {formatCurrency(laborer.weekSalary)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        color="success.main"
                      >
                        {formatCurrency(laborer.weekPaid)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={
                          laborer.runningBalance > 0
                            ? "error.main"
                            : laborer.runningBalance < 0
                              ? "info.main"
                              : "success.main"
                        }
                      >
                        {laborer.runningBalance < 0
                          ? `+${formatCurrency(Math.abs(laborer.runningBalance))}`
                          : formatCurrency(laborer.runningBalance)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ width: 80 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(laborer.paymentProgress, 100)}
                          color={getProgressColor(laborer.paymentProgress)}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: 10 }}
                        >
                          {laborer.paymentProgress.toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {laborer.runningBalance > 0 ? (
                        <Button
                          size="small"
                          onClick={() => onPayLaborer(laborer)}
                          disabled={disabled}
                        >
                          Settle
                        </Button>
                      ) : (
                        <Chip
                          label={laborer.status === "advance" ? "ADVANCE" : "SETTLED"}
                          size="small"
                          color={
                            laborer.status === "advance" ? "info" : "success"
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Daily Breakdown Row */}
                  <TableRow>
                    <TableCell colSpan={9} sx={{ py: 0.5, px: 2 }}>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          alignItems: "center",
                          pl: 4,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mr: 1 }}
                        >
                          Daily:
                        </Typography>
                        {laborer.dailySalary.map((day) => (
                          <Tooltip
                            key={day.date}
                            title={`${dayjs(day.date).format("ddd MMM D")} - ${day.workDays} day(s)`}
                          >
                            <Chip
                              label={`${day.dayName}:${day.amount}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: 10, height: 20 }}
                            />
                          </Tooltip>
                        ))}

                        {/* Previous Balance Warning */}
                        {laborer.previousBalance > 0 && (
                          <Alert
                            severity="warning"
                            sx={{ py: 0, px: 1, ml: 2 }}
                            icon={<WarningIcon fontSize="small" />}
                          >
                            <Typography variant="caption">
                              Previous balance: {formatCurrency(laborer.previousBalance)}
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Collapse>
    </Paper>
  );
}
