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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  Payment as PaymentIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  Receipt as ReceiptIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import type { DateGroup, DailyPaymentRecord } from "@/types/payment.types";

interface DateGroupRowProps {
  dateGroup: DateGroup;
  onToggleExpand: () => void;
  onPayAllDaily: (records: DailyPaymentRecord[]) => void;
  onPayAllMarket: (records: DailyPaymentRecord[]) => void;
  onPayAll: (records: DailyPaymentRecord[]) => void;
  onPaySelected: (records: DailyPaymentRecord[]) => void;
  onPaySingle: (record: DailyPaymentRecord) => void;
  selectedRecords: Set<string>;
  onToggleSelect: (recordId: string) => void;
  onSelectAllDaily: (date: string, select: boolean) => void;
  onSelectAllMarket: (date: string, select: boolean) => void;
  disabled?: boolean;
}

export default function DateGroupRow({
  dateGroup,
  onToggleExpand,
  onPayAllDaily,
  onPayAllMarket,
  onPayAll,
  onPaySelected,
  onPaySingle,
  selectedRecords,
  onToggleSelect,
  onSelectAllDaily,
  onSelectAllMarket,
  disabled = false,
}: DateGroupRowProps) {
  const { date, dateLabel, dayName, dailyRecords, marketRecords, summary, isExpanded } =
    dateGroup;

  // Proof viewer state
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [selectedProof, setSelectedProof] = useState<{
    url: string;
    laborerName: string;
    amount: number;
    date: string;
  } | null>(null);

  const handleViewProof = (record: DailyPaymentRecord) => {
    if (record.proofUrl) {
      setSelectedProof({
        url: record.proofUrl,
        laborerName: record.laborerName,
        amount: record.amount,
        date: record.date,
      });
      setProofDialogOpen(true);
    }
  };

  const pendingDailyRecords = dailyRecords.filter((r) => !r.isPaid && !r.paidVia);
  const pendingMarketRecords = marketRecords.filter((r) => !r.isPaid && !r.paidVia);
  const allPendingRecords = [...pendingDailyRecords, ...pendingMarketRecords];

  const selectedDailyCount = dailyRecords.filter(
    (r) => selectedRecords.has(r.id) && !r.isPaid
  ).length;
  const selectedMarketCount = marketRecords.filter(
    (r) => selectedRecords.has(r.id) && !r.isPaid
  ).length;

  const formatCurrency = (amount: number) => `Rs.${amount.toLocaleString()}`;

  const getPaymentStatusChip = (record: DailyPaymentRecord) => {
    if (record.isPaid) {
      return <Chip label="PAID" size="small" color="success" />;
    }
    if (record.paidVia === "engineer_wallet") {
      return <Chip label="SENT TO ENGINEER" size="small" color="info" />;
    }
    return (
      <Chip
        label="PENDING"
        size="small"
        color="warning"
        variant="outlined"
        onClick={() => onPaySingle(record)}
        sx={{ cursor: "pointer" }}
      />
    );
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
        {/* Date Info */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 200 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {dateLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {dayName}
            </Typography>
          </Box>
        </Box>

        {/* Counts */}
        <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
          <Box sx={{ textAlign: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <PersonIcon fontSize="small" color="action" />
              <Typography variant="body2" fontWeight={500}>
                {summary.dailyCount} Daily
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {formatCurrency(summary.dailyTotal)}
            </Typography>
          </Box>

          <Box sx={{ textAlign: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <GroupsIcon fontSize="small" color="action" />
              <Typography variant="body2" fontWeight={500}>
                {summary.marketCount} Market
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {formatCurrency(summary.marketTotal)}
            </Typography>
          </Box>
        </Box>

        {/* Status Summary */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">
              Pending
            </Typography>
            <Typography variant="body2" fontWeight={600} color="warning.main">
              {formatCurrency(summary.dailyPending + summary.marketPending)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">
              Paid
            </Typography>
            <Typography variant="body2" fontWeight={600} color="success.main">
              {formatCurrency(summary.dailyPaid + summary.marketPaid)}
            </Typography>
          </Box>
        </Box>

        {/* Quick Pay Buttons (in collapsed view) */}
        <Box
          sx={{ display: "flex", gap: 1, alignItems: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          {pendingDailyRecords.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onPayAllDaily(pendingDailyRecords)}
              disabled={disabled}
            >
              Settle Daily ({pendingDailyRecords.length})
            </Button>
          )}
          {pendingMarketRecords.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onPayAllMarket(pendingMarketRecords)}
              disabled={disabled}
            >
              Settle Market ({pendingMarketRecords.length})
            </Button>
          )}
          {allPendingRecords.length > 0 && (
            <Button
              size="small"
              variant="contained"
              onClick={() => onPayAll(allPendingRecords)}
              disabled={disabled}
              startIcon={<PaymentIcon />}
            >
              Settle All
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
          {/* Daily Laborers Section */}
          {dailyRecords.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PersonIcon fontSize="small" />
                  <Typography variant="subtitle2">
                    DAILY LABORERS ({dailyRecords.length})
                  </Typography>
                  <Chip
                    label={`Pending: ${formatCurrency(summary.dailyPending)}`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                </Box>
                {selectedDailyCount > 0 && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() =>
                      onPaySelected(
                        dailyRecords.filter(
                          (r) => selectedRecords.has(r.id) && !r.isPaid
                        )
                      )
                    }
                    disabled={disabled}
                  >
                    Settle Selected ({selectedDailyCount})
                  </Button>
                )}
              </Box>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={
                          pendingDailyRecords.length > 0 &&
                          pendingDailyRecords.every((r) =>
                            selectedRecords.has(r.id)
                          )
                        }
                        indeterminate={
                          pendingDailyRecords.some((r) =>
                            selectedRecords.has(r.id)
                          ) &&
                          !pendingDailyRecords.every((r) =>
                            selectedRecords.has(r.id)
                          )
                        }
                        onChange={(e) =>
                          onSelectAllDaily(date, e.target.checked)
                        }
                        disabled={pendingDailyRecords.length === 0}
                      />
                    </TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Proof</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyRecords.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedRecords.has(record.id)}
                          onChange={() => onToggleSelect(record.id)}
                          disabled={record.isPaid}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {record.laborerName}
                        </Typography>
                        {record.category && (
                          <Typography variant="caption" color="text.secondary">
                            {record.category}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{record.role}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          {formatCurrency(record.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {getPaymentStatusChip(record)}
                      </TableCell>
                      <TableCell align="center">
                        {record.proofUrl ? (
                          <Tooltip title="View Payment Proof">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewProof(record)}
                            >
                              <ReceiptIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {!record.isPaid && (
                          <Button
                            size="small"
                            onClick={() => onPaySingle(record)}
                            disabled={disabled}
                          >
                            Settle
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Market Laborers Section */}
          {marketRecords.length > 0 && (
            <Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <GroupsIcon fontSize="small" />
                  <Typography variant="subtitle2">
                    MARKET LABORERS ({marketRecords.length})
                  </Typography>
                  <Chip
                    label={`Pending: ${formatCurrency(summary.marketPending)}`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                </Box>
                {selectedMarketCount > 0 && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() =>
                      onPaySelected(
                        marketRecords.filter(
                          (r) => selectedRecords.has(r.id) && !r.isPaid
                        )
                      )
                    }
                    disabled={disabled}
                  >
                    Settle Selected ({selectedMarketCount})
                  </Button>
                )}
              </Box>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={
                          pendingMarketRecords.length > 0 &&
                          pendingMarketRecords.every((r) =>
                            selectedRecords.has(r.id)
                          )
                        }
                        indeterminate={
                          pendingMarketRecords.some((r) =>
                            selectedRecords.has(r.id)
                          ) &&
                          !pendingMarketRecords.every((r) =>
                            selectedRecords.has(r.id)
                          )
                        }
                        onChange={(e) =>
                          onSelectAllMarket(date, e.target.checked)
                        }
                        disabled={pendingMarketRecords.length === 0}
                      />
                    </TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="center">Count</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Proof</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marketRecords.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedRecords.has(record.id)}
                          onChange={() => onToggleSelect(record.id)}
                          disabled={record.isPaid}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {record.laborerName}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${record.count} ppl`}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          {formatCurrency(record.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {getPaymentStatusChip(record)}
                      </TableCell>
                      <TableCell align="center">
                        {record.proofUrl ? (
                          <Tooltip title="View Payment Proof">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewProof(record)}
                            >
                              <ReceiptIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {!record.isPaid && (
                          <Button
                            size="small"
                            onClick={() => onPaySingle(record)}
                            disabled={disabled}
                          >
                            Settle
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Box>
      </Collapse>

      {/* Payment Proof Viewer Dialog */}
      <Dialog
        open={proofDialogOpen}
        onClose={() => setProofDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box>
              <Typography variant="h6">Payment Proof</Typography>
              {selectedProof && (
                <Typography variant="body2" color="text.secondary">
                  {selectedProof.laborerName} - {formatCurrency(selectedProof.amount)} ({dayjs(selectedProof.date).format("MMM D, YYYY")})
                </Typography>
              )}
            </Box>
            <IconButton onClick={() => setProofDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedProof?.url && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 300,
                bgcolor: "action.selected",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <img
                src={selectedProof.url}
                alt="Payment Proof"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (selectedProof?.url) {
                window.open(selectedProof.url, "_blank");
              }
            }}
            color="primary"
          >
            Open in New Tab
          </Button>
          <Button onClick={() => setProofDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
