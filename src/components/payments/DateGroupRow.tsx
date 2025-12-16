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
  NotificationsActive as NotifyIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import type { DateGroup, DailyPaymentRecord } from "@/types/payment.types";
import SettlementStatusIndicator from "./SettlementStatusIndicator";

interface DateGroupRowProps {
  dateGroup: DateGroup;
  onToggleExpand: () => void;
  onPayAllDaily: (records: DailyPaymentRecord[]) => void;
  onPayAllMarket: (records: DailyPaymentRecord[]) => void;
  onPayAll: (records: DailyPaymentRecord[]) => void;
  onPaySelected: (records: DailyPaymentRecord[]) => void;
  onPaySingle: (record: DailyPaymentRecord) => void;
  onNotifyEngineer?: (record: DailyPaymentRecord) => void;
  onNotifyDate?: (date: string, records: DailyPaymentRecord[]) => void;
  onCancelPayment?: (record: DailyPaymentRecord) => void;
  onCancelAllDirect?: (records: DailyPaymentRecord[]) => void;
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
  onNotifyEngineer,
  onNotifyDate,
  onCancelPayment,
  onCancelAllDirect,
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

  // Records sent to engineer (awaiting settlement)
  const sentToEngineerDaily = dailyRecords.filter(
    (r) => !r.isPaid && r.paidVia === "engineer_wallet"
  );
  const sentToEngineerMarket = marketRecords.filter(
    (r) => !r.isPaid && r.paidVia === "engineer_wallet"
  );
  const allSentToEngineer = [...sentToEngineerDaily, ...sentToEngineerMarket];

  // Paid direct payments (can be cancelled)
  const paidDirectDaily = dailyRecords.filter((r) => r.isPaid && r.paidVia === "direct");
  const paidDirectMarket = marketRecords.filter((r) => r.isPaid && r.paidVia === "direct");
  const allPaidDirect = [...paidDirectDaily, ...paidDirectMarket];

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
      return (
        <SettlementStatusIndicator
          paidVia={record.paidVia}
          settlementStatus={record.settlementStatus}
          compact
          amount={record.amount}
          companyProofUrl={record.companyProofUrl}
          engineerProofUrl={record.engineerProofUrl}
          transactionDate={record.transactionDate}
          settledDate={record.settledDate}
          confirmedAt={record.confirmedAt}
        />
      );
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
      {/* Collapsed Header Row - Compact Design */}
      <Box
        sx={{
          p: { xs: 1, sm: 1.5 },
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, sm: 2 },
          cursor: "pointer",
          bgcolor: isExpanded ? "action.selected" : "background.paper",
          "&:hover": { bgcolor: "action.hover" },
          flexWrap: { xs: "wrap", md: "nowrap" },
        }}
        onClick={onToggleExpand}
      >
        {/* Date Info - Compact */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: { xs: "auto", sm: 120 } }}>
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
              {dateLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: "0.65rem", sm: "0.75rem" } }}>
              {dayName}
            </Typography>
          </Box>
        </Box>

        {/* Counts - Compact Chips */}
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          <Chip
            icon={<PersonIcon sx={{ fontSize: 14 }} />}
            label={`${summary.dailyCount}D`}
            size="small"
            variant="outlined"
            sx={{ height: 22, "& .MuiChip-label": { px: 0.5, fontSize: "0.7rem" } }}
          />
          <Chip
            icon={<GroupsIcon sx={{ fontSize: 14 }} />}
            label={`${summary.marketCount}M`}
            size="small"
            variant="outlined"
            sx={{ height: 22, "& .MuiChip-label": { px: 0.5, fontSize: "0.7rem" } }}
          />
        </Box>

        {/* Status Summary - Compact */}
        <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, alignItems: "center", ml: { xs: 0, md: "auto" } }}>
          {(summary.dailyPending + summary.marketPending) > 0 && (
            <Chip
              label={`Pending: ${formatCurrency(summary.dailyPending + summary.marketPending)}`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 24, fontWeight: 600, fontSize: "0.7rem" }}
            />
          )}
          {(summary.dailySentToEngineer + summary.marketSentToEngineer) > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Chip
                label={`Engineer: ${formatCurrency(summary.dailySentToEngineer + summary.marketSentToEngineer)}`}
                size="small"
                color="info"
                variant="outlined"
                sx={{ height: 24, fontWeight: 500, fontSize: "0.7rem" }}
              />
              {allSentToEngineer.length > 0 && (
                <Tooltip title="Send reminder to engineer">
                  <IconButton
                    size="small"
                    color="warning"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNotifyDate?.(date, allSentToEngineer);
                    }}
                    disabled={disabled}
                    sx={{ p: 0.5 }}
                  >
                    <NotifyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
          {(summary.dailyPaid + summary.marketPaid) > 0 && (
            <Chip
              label={`Paid: ${formatCurrency(summary.dailyPaid + summary.marketPaid)}`}
              size="small"
              color="success"
              sx={{ height: 24, fontWeight: 600, fontSize: "0.7rem" }}
            />
          )}
        </Box>

        {/* Quick Pay Buttons - Compact Icon Buttons */}
        <Box
          sx={{ display: "flex", gap: 0.5, alignItems: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          {allPendingRecords.length > 0 && (
            <Tooltip title={`Settle all ${allPendingRecords.length} pending (${formatCurrency(summary.dailyPending + summary.marketPending)})`}>
              <Button
                size="small"
                variant="contained"
                onClick={() => onPayAll(allPendingRecords)}
                disabled={disabled}
                sx={{
                  minWidth: "auto",
                  px: { xs: 1, sm: 1.5 },
                  py: 0.5,
                  fontSize: "0.75rem",
                }}
              >
                <PaymentIcon sx={{ fontSize: 16, mr: { xs: 0, sm: 0.5 } }} />
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  Settle All
                </Box>
              </Button>
            </Tooltip>
          )}
          {allPaidDirect.length > 0 && (
            <Tooltip title={`Cancel ${allPaidDirect.length} direct payments`}>
              <IconButton
                size="small"
                color="error"
                onClick={() => onCancelAllDirect?.(allPaidDirect)}
                disabled={disabled}
                sx={{ p: 0.5 }}
              >
                <CancelIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Expand Icon */}
        <IconButton size="small" sx={{ p: 0.5 }}>
          {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
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
                    <TableCell align="center" sx={{ minWidth: 200 }}>Status</TableCell>
                    <TableCell>Notes</TableCell>
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
                      <TableCell>
                        {record.paymentNotes ? (
                          <Tooltip title={record.paymentNotes} arrow>
                            <Typography
                              variant="caption"
                              sx={{
                                maxWidth: 100,
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                              }}
                            >
                              {record.paymentNotes.length > 20
                                ? `${record.paymentNotes.substring(0, 20)}...`
                                : record.paymentNotes}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            -
                          </Typography>
                        )}
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
                        {!record.isPaid && record.paidVia === "engineer_wallet" ? (
                          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                            <Tooltip title="Send reminder to engineer">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => onNotifyEngineer?.(record)}
                                disabled={disabled}
                              >
                                <NotifyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {record.settlementStatus === "pending_settlement" && (
                              <Tooltip title="Cancel this payment">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => onCancelPayment?.(record)}
                                  disabled={disabled}
                                >
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        ) : !record.isPaid ? (
                          <Button
                            size="small"
                            onClick={() => onPaySingle(record)}
                            disabled={disabled}
                          >
                            Settle
                          </Button>
                        ) : record.isPaid && record.paidVia === "direct" ? (
                          <Tooltip title="Cancel this payment and reset to pending">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => onCancelPayment?.(record)}
                              disabled={disabled}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
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
                    <TableCell align="center" sx={{ minWidth: 200 }}>Status</TableCell>
                    <TableCell>Notes</TableCell>
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
                      <TableCell>
                        {record.paymentNotes ? (
                          <Tooltip title={record.paymentNotes} arrow>
                            <Typography
                              variant="caption"
                              sx={{
                                maxWidth: 100,
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                              }}
                            >
                              {record.paymentNotes.length > 20
                                ? `${record.paymentNotes.substring(0, 20)}...`
                                : record.paymentNotes}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            -
                          </Typography>
                        )}
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
                        {!record.isPaid && record.paidVia === "engineer_wallet" ? (
                          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                            <Tooltip title="Send reminder to engineer">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => onNotifyEngineer?.(record)}
                                disabled={disabled}
                              >
                                <NotifyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {record.settlementStatus === "pending_settlement" && (
                              <Tooltip title="Cancel this payment">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => onCancelPayment?.(record)}
                                  disabled={disabled}
                                >
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        ) : !record.isPaid ? (
                          <Button
                            size="small"
                            onClick={() => onPaySingle(record)}
                            disabled={disabled}
                          >
                            Settle
                          </Button>
                        ) : record.isPaid && record.paidVia === "direct" ? (
                          <Tooltip title="Cancel this payment and reset to pending">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => onCancelPayment?.(record)}
                              disabled={disabled}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
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
              <Typography variant="h6" component="span">Payment Proof</Typography>
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
