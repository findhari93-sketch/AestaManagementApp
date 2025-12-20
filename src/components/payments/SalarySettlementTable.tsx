"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  alpha,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
} from "@mui/material";
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Cancel as CancelIcon,
  Notifications as NotifyIcon,
  MoreVert as MoreVertIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  CheckCircle as PaidIcon,
  Schedule as PendingIcon,
  Send as SentIcon,
  PhotoCamera as PhotoIcon,
  Close as CloseIcon,
  TaskAlt as ConfirmIcon,
  Warning as WarningIcon,
  EventNote as AttendanceIcon,
  ArrowForward as ArrowForwardIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import dayjs from "dayjs";
import type { DateGroup, DailyPaymentRecord } from "@/types/payment.types";
import { getPayerSourceLabel, getPayerSourceColor } from "@/components/settlement/PayerSourceSelector";
import type { PayerSource } from "@/types/settlement.types";

interface SalarySettlementTableProps {
  dateGroups: DateGroup[];
  loading?: boolean;
  disabled?: boolean;
  isAdmin?: boolean;
  onPayDate: (date: string, records: DailyPaymentRecord[]) => void;
  onViewDate: (date: string, group: DateGroup) => void;
  onEditDate: (date: string, group: DateGroup) => void;
  onCancelDate: (date: string, records: DailyPaymentRecord[]) => void;
  onDeleteDate: (date: string, records: DailyPaymentRecord[]) => void;
  onNotifyDate: (date: string, records: DailyPaymentRecord[]) => void;
  onConfirmSettlement?: (transactionId: string) => void;
  onEditRecord?: (record: DailyPaymentRecord) => void;
  onEditSettlements?: (date: string, records: DailyPaymentRecord[]) => void;
}

// Row data structure for the MRT table
interface DateRowData {
  id: string;
  date: string;
  dateLabel: string;
  dayName: string;
  dailyCount: number;
  marketCount: number;
  dailyLaborers: number;
  marketLaborers: number;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  sentToEngineerAmount: number;
  awaitingApprovalAmount: number;
  status: "all_paid" | "all_pending" | "partial" | "sent_to_engineer";
  hasPendingRecords: boolean;
  hasSentToEngineerRecords: boolean;
  hasPaidRecords: boolean;
  hasAwaitingApprovalRecords: boolean;
  awaitingApprovalTransactionId: string | null;
  // For expanded row
  dailyRecords: DailyPaymentRecord[];
  marketRecords: DailyPaymentRecord[];
  // Original group for actions
  group: DateGroup;
}

export default function SalarySettlementTable({
  dateGroups,
  loading = false,
  disabled = false,
  isAdmin = false,
  onPayDate,
  onViewDate,
  onEditDate,
  onCancelDate,
  onDeleteDate,
  onNotifyDate,
  onConfirmSettlement,
  onEditRecord,
  onEditSettlements,
}: SalarySettlementTableProps) {
  const theme = useTheme();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<DateRowData | null>(null);
  const [viewingProof, setViewingProof] = useState<{
    url: string;
    type: "company" | "engineer";
  } | null>(null);

  // Redirect dialog state for delete prevention
  const [deleteRedirectDialog, setDeleteRedirectDialog] = useState<{
    open: boolean;
    date: string;
    records: DailyPaymentRecord[];
  } | null>(null);

  // Handle redirect to attendance page
  const handleRedirectToAttendance = (date: string) => {
    const params = new URLSearchParams({
      date,
      action: "edit_or_delete",
    });
    router.push(`/site/attendance?${params.toString()}`);
  };

  // Transform DateGroup[] to row data
  const tableData: DateRowData[] = useMemo(() => {
    return dateGroups.map((group) => {
      const allRecords = [...group.dailyRecords, ...group.marketRecords];
      const pendingRecords = allRecords.filter(
        (r) => !r.isPaid && r.paidVia !== "engineer_wallet"
      );
      const sentToEngineerRecords = allRecords.filter(
        (r) => !r.isPaid && r.paidVia === "engineer_wallet"
      );
      const paidRecords = allRecords.filter((r) => r.isPaid);

      // Records awaiting admin approval (engineer submitted settlement)
      const awaitingApprovalRecords = allRecords.filter(
        (r) => r.settlementStatus === "pending_confirmation" && r.engineerTransactionId
      );

      const pendingAmount = pendingRecords.reduce((sum, r) => sum + r.amount, 0);
      const sentToEngineerAmount = sentToEngineerRecords.reduce(
        (sum, r) => sum + r.amount,
        0
      );
      const paidAmount = paidRecords.reduce((sum, r) => sum + r.amount, 0);
      const awaitingApprovalAmount = awaitingApprovalRecords.reduce(
        (sum, r) => sum + r.amount,
        0
      );
      const totalAmount = pendingAmount + sentToEngineerAmount + paidAmount;

      // Get the first transaction ID for awaiting approval records (all should have same transaction)
      const awaitingApprovalTransactionId = awaitingApprovalRecords.length > 0
        ? awaitingApprovalRecords[0].engineerTransactionId
        : null;

      // Determine status
      let status: DateRowData["status"] = "partial";
      if (allRecords.length > 0) {
        if (paidRecords.length === allRecords.length) {
          status = "all_paid";
        } else if (
          pendingRecords.length === allRecords.length ||
          (pendingRecords.length > 0 && sentToEngineerRecords.length === 0 && paidRecords.length === 0)
        ) {
          status = "all_pending";
        } else if (
          sentToEngineerRecords.length > 0 &&
          pendingRecords.length === 0 &&
          paidRecords.length === 0
        ) {
          status = "sent_to_engineer";
        }
      }

      // Count unique daily laborers
      const dailyLaborers = group.dailyRecords.length;
      // Count total market laborers (sum of count)
      const marketLaborers = group.marketRecords.reduce(
        (sum, r) => sum + (r.count || 1),
        0
      );

      return {
        id: group.date,
        date: group.date,
        dateLabel: group.dateLabel,
        dayName: group.dayName,
        dailyCount: group.dailyRecords.length,
        marketCount: group.marketRecords.length,
        dailyLaborers,
        marketLaborers,
        totalAmount,
        pendingAmount,
        paidAmount,
        sentToEngineerAmount,
        awaitingApprovalAmount,
        status,
        hasPendingRecords: pendingRecords.length > 0,
        hasSentToEngineerRecords: sentToEngineerRecords.length > 0,
        hasPaidRecords: paidRecords.length > 0,
        hasAwaitingApprovalRecords: awaitingApprovalRecords.length > 0,
        awaitingApprovalTransactionId,
        dailyRecords: group.dailyRecords,
        marketRecords: group.marketRecords,
        group,
      };
    });
  }, [dateGroups]);

  // Handle menu open
  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    row: DateRowData
  ) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  // Get all pending/sent records for a date
  const getActionableRecords = (group: DateGroup) => {
    return [...group.dailyRecords, ...group.marketRecords];
  };

  // Get sent to engineer records
  const getSentToEngineerRecords = (group: DateGroup) => {
    return [...group.dailyRecords, ...group.marketRecords].filter(
      (r) => !r.isPaid && r.paidVia === "engineer_wallet"
    );
  };

  // Get paid records (for cancel/delete)
  const getPaidRecords = (group: DateGroup) => {
    return [...group.dailyRecords, ...group.marketRecords].filter(
      (r) => r.isPaid
    );
  };

  // Get pending records
  const getPendingRecords = (group: DateGroup) => {
    return [...group.dailyRecords, ...group.marketRecords].filter(
      (r) => !r.isPaid && r.paidVia !== "engineer_wallet"
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `Rs.${amount.toLocaleString("en-IN")}`;
  };

  // Define columns
  const columns = useMemo<MRT_ColumnDef<DateRowData>[]>(
    () => [
      {
        accessorKey: "dateLabel",
        header: "Date",
        size: 140,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {row.original.dateLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.dayName}
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: "dailyLaborers",
        header: "Daily",
        size: 80,
        Cell: ({ row }) => (
          <Chip
            icon={<PersonIcon sx={{ fontSize: 14 }} />}
            label={row.original.dailyLaborers}
            size="small"
            variant="outlined"
            color="primary"
            sx={{ minWidth: 60 }}
          />
        ),
      },
      {
        accessorKey: "marketLaborers",
        header: "Market",
        size: 80,
        Cell: ({ row }) => (
          <Chip
            icon={<GroupsIcon sx={{ fontSize: 14 }} />}
            label={row.original.marketLaborers}
            size="small"
            variant="outlined"
            color="secondary"
            sx={{ minWidth: 60 }}
          />
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        size: 100,
        Cell: ({ row }) => (
          <Typography variant="body2" fontWeight={600}>
            {formatCurrency(row.original.totalAmount)}
          </Typography>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 160,
        Cell: ({ row }) => {
          const { status, pendingAmount, paidAmount, sentToEngineerAmount, awaitingApprovalAmount, hasAwaitingApprovalRecords } =
            row.original;

          // Calculate "With Engineer" amount excluding awaiting approval
          const withEngineerAmount = sentToEngineerAmount - awaitingApprovalAmount;

          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {pendingAmount > 0 && (
                <Chip
                  icon={<PendingIcon sx={{ fontSize: 12 }} />}
                  label={`Pending: ${formatCurrency(pendingAmount)}`}
                  size="small"
                  color="warning"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              )}
              {withEngineerAmount > 0 && (
                <Chip
                  icon={<SentIcon sx={{ fontSize: 12 }} />}
                  label={`With Engr: ${formatCurrency(withEngineerAmount)}`}
                  size="small"
                  color="info"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              )}
              {awaitingApprovalAmount > 0 && (
                <Chip
                  icon={<ConfirmIcon sx={{ fontSize: 12 }} />}
                  label={`Awaiting: ${formatCurrency(awaitingApprovalAmount)}`}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              )}
              {paidAmount > 0 && (
                <Chip
                  icon={<PaidIcon sx={{ fontSize: 12 }} />}
                  label={`Paid: ${formatCurrency(paidAmount)}`}
                  size="small"
                  color="success"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              )}
            </Box>
          );
        },
      },
    ],
    []
  );

  // Render expanded row detail panel
  const renderDetailPanel = ({ row }: { row: { original: DateRowData } }) => {
    const { dailyRecords, marketRecords } = row.original;
    const allRecords = [...dailyRecords, ...marketRecords];

    if (allRecords.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No records for this date
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell>Type</TableCell>
                <TableCell>Name / Role</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Paid By</TableCell>
                <TableCell>Subcontract</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Settlement</TableCell>
                {onEditRecord && <TableCell align="center">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Daily Laborers */}
              {dailyRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <Chip
                      label="Daily"
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: "0.65rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {record.laborerName}
                    </Typography>
                    {record.role && (
                      <Typography variant="caption" color="text.secondary">
                        {record.role}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">1</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={500}>
                      {formatCurrency(record.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {record.moneySource ? (
                      <Chip
                        label={getPayerSourceLabel(record.moneySource as PayerSource, record.moneySourceName || undefined)}
                        size="small"
                        variant="outlined"
                        color={getPayerSourceColor(record.moneySource as PayerSource)}
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.subcontractTitle ? (
                      <Chip
                        label={record.subcontractTitle}
                        size="small"
                        color="info"
                        variant="outlined"
                        icon={<LinkIcon sx={{ fontSize: 14 }} />}
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    ) : (
                      <Chip
                        label="Unlinked"
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.65rem", color: 'text.disabled', borderColor: 'divider' }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {record.isPaid ? (
                      <Chip
                        label="Paid"
                        size="small"
                        color="success"
                        sx={{ height: 18, fontSize: "0.6rem" }}
                      />
                    ) : record.paidVia === "engineer_wallet" ? (
                      // Show different status based on settlement status
                      record.settlementStatus === "pending_confirmation" ? (
                        <Chip
                          label="Awaiting Approval"
                          size="small"
                          color="warning"
                          sx={{ height: 18, fontSize: "0.6rem" }}
                        />
                      ) : record.settlementStatus === "confirmed" ? (
                        <Chip
                          label="Settled"
                          size="small"
                          color="success"
                          sx={{ height: 18, fontSize: "0.6rem" }}
                        />
                      ) : (
                        <Chip
                          label="With Engineer"
                          size="small"
                          color="info"
                          sx={{ height: 18, fontSize: "0.6rem" }}
                        />
                      )
                    ) : (
                      <Chip
                        label="Pending"
                        size="small"
                        color="warning"
                        sx={{ height: 18, fontSize: "0.6rem" }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {(record.paidVia === "engineer_wallet" || record.settlementStatus) && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "center", flexWrap: "wrap" }}>
                        {/* Settlement Mode Chip */}
                        {record.settlementMode && (
                          <Chip
                            size="small"
                            label={record.settlementMode.toUpperCase()}
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.6rem" }}
                          />
                        )}
                        {/* Money Source Chip */}
                        {record.moneySource && (
                          <Chip
                            size="small"
                            label={getPayerSourceLabel(record.moneySource as PayerSource, record.moneySourceName || undefined)}
                            color={getPayerSourceColor(record.moneySource as PayerSource)}
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.6rem" }}
                          />
                        )}
                        {/* Company Proof Icon */}
                        {record.companyProofUrl && (
                          <Tooltip title="View company payment proof">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingProof({ url: record.companyProofUrl!, type: "company" });
                              }}
                              sx={{ p: 0.25 }}
                            >
                              <PhotoIcon fontSize="small" color="info" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* Engineer Proof Icon */}
                        {record.engineerProofUrl && (
                          <Tooltip title="View engineer settlement proof">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingProof({ url: record.engineerProofUrl!, type: "engineer" });
                              }}
                              sx={{ p: 0.25 }}
                            >
                              <PhotoIcon fontSize="small" color="success" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* Settled Date */}
                        {record.settledDate && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                            {dayjs(record.settledDate).format("DD MMM")}
                          </Typography>
                        )}
                        {/* Notes/Reason */}
                        {record.cashReason && (
                          <Tooltip title={record.cashReason}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                fontSize: "0.55rem",
                                maxWidth: 80,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "block",
                                fontStyle: "italic",
                              }}
                            >
                              &quot;{record.cashReason}&quot;
                            </Typography>
                          </Tooltip>
                        )}
                      </Box>
                    )}
                  </TableCell>
                  {onEditRecord && (
                    <TableCell align="center">
                      <Tooltip title="Edit settlement details">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRecord(record);
                          }}
                          disabled={disabled}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {/* Market Laborers */}
              {marketRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <Chip
                      label="Market"
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ height: 20, fontSize: "0.65rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{record.role || record.laborerName}</Typography>
                  </TableCell>
                  <TableCell align="right">{record.count || 1}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={500}>
                      {formatCurrency(record.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {record.moneySource ? (
                      <Chip
                        label={getPayerSourceLabel(record.moneySource as PayerSource, record.moneySourceName || undefined)}
                        size="small"
                        variant="outlined"
                        color={getPayerSourceColor(record.moneySource as PayerSource)}
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* Market laborers don't have subcontract linking */}
                    <Chip
                      label="Unlinked"
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: "0.65rem", color: 'text.disabled', borderColor: 'divider' }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {record.isPaid ? (
                      <Chip
                        label="Paid"
                        size="small"
                        color="success"
                        sx={{ height: 18, fontSize: "0.6rem" }}
                      />
                    ) : record.paidVia === "engineer_wallet" ? (
                      // Show different status based on settlement status
                      record.settlementStatus === "pending_confirmation" ? (
                        <Chip
                          label="Awaiting Approval"
                          size="small"
                          color="warning"
                          sx={{ height: 18, fontSize: "0.6rem" }}
                        />
                      ) : record.settlementStatus === "confirmed" ? (
                        <Chip
                          label="Settled"
                          size="small"
                          color="success"
                          sx={{ height: 18, fontSize: "0.6rem" }}
                        />
                      ) : (
                        <Chip
                          label="With Engineer"
                          size="small"
                          color="info"
                          sx={{ height: 18, fontSize: "0.6rem" }}
                        />
                      )
                    ) : (
                      <Chip
                        label="Pending"
                        size="small"
                        color="warning"
                        sx={{ height: 18, fontSize: "0.6rem" }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {(record.paidVia === "engineer_wallet" || record.settlementStatus) && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "center", flexWrap: "wrap" }}>
                        {/* Settlement Mode Chip */}
                        {record.settlementMode && (
                          <Chip
                            size="small"
                            label={record.settlementMode.toUpperCase()}
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.6rem" }}
                          />
                        )}
                        {/* Money Source Chip */}
                        {record.moneySource && (
                          <Chip
                            size="small"
                            label={getPayerSourceLabel(record.moneySource as PayerSource, record.moneySourceName || undefined)}
                            color={getPayerSourceColor(record.moneySource as PayerSource)}
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.6rem" }}
                          />
                        )}
                        {/* Company Proof Icon */}
                        {record.companyProofUrl && (
                          <Tooltip title="View company payment proof">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingProof({ url: record.companyProofUrl!, type: "company" });
                              }}
                              sx={{ p: 0.25 }}
                            >
                              <PhotoIcon fontSize="small" color="info" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* Engineer Proof Icon */}
                        {record.engineerProofUrl && (
                          <Tooltip title="View engineer settlement proof">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingProof({ url: record.engineerProofUrl!, type: "engineer" });
                              }}
                              sx={{ p: 0.25 }}
                            >
                              <PhotoIcon fontSize="small" color="success" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* Settled Date */}
                        {record.settledDate && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
                            {dayjs(record.settledDate).format("DD MMM")}
                          </Typography>
                        )}
                        {/* Notes/Reason */}
                        {record.cashReason && (
                          <Tooltip title={record.cashReason}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                fontSize: "0.55rem",
                                maxWidth: 80,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "block",
                                fontStyle: "italic",
                              }}
                            >
                              &quot;{record.cashReason}&quot;
                            </Typography>
                          </Tooltip>
                        )}
                      </Box>
                    )}
                  </TableCell>
                  {onEditRecord && (
                    <TableCell align="center">
                      <Tooltip title="Edit settlement details">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRecord(record);
                          }}
                          disabled={disabled}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <>
      <DataTable<DateRowData>
        columns={columns}
        data={tableData}
        isLoading={loading}
        enableExpanding
        renderDetailPanel={renderDetailPanel}
        enableRowActions
        positionActionsColumn="last"
        renderRowActions={({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {/* Confirm Settlement - for admin when records are awaiting approval */}
            {isAdmin && row.original.hasAwaitingApprovalRecords && row.original.awaitingApprovalTransactionId && onConfirmSettlement && (
              <Tooltip title="View & Confirm Settlement">
                <IconButton
                  size="small"
                  color="warning"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirmSettlement(row.original.awaitingApprovalTransactionId!);
                  }}
                >
                  <ConfirmIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {/* Primary actions */}
            {row.original.hasPendingRecords && !disabled && (
              <Tooltip title="Settle All">
                <IconButton
                  size="small"
                  color="success"
                  onClick={(e) => {
                    e.stopPropagation();
                    const pendingRecords = getPendingRecords(row.original.group);
                    onPayDate(row.original.date, pendingRecords);
                  }}
                >
                  <PaymentIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {/* More actions menu */}
            <Tooltip title="More actions">
              <IconButton
                size="small"
                onClick={(e) => handleMenuOpen(e, row.original)}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        initialState={{
          sorting: [{ id: "dateLabel", desc: true }],
        }}
        enablePagination={tableData.length > 20}
        pageSize={20}
        muiExpandButtonProps={({ row }) => ({
          sx: {
            color:
              row.original.dailyRecords.length + row.original.marketRecords.length > 0
                ? "primary.main"
                : "text.disabled",
          },
        })}
      />

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            if (selectedRow) {
              onViewDate(selectedRow.date, selectedRow.group);
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>

        {!disabled && selectedRow?.hasPendingRecords && (
          <MenuItem
            onClick={() => {
              if (selectedRow) {
                onEditDate(selectedRow.date, selectedRow.group);
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit All</ListItemText>
          </MenuItem>
        )}

        {!disabled && onEditSettlements && (
          <MenuItem
            onClick={() => {
              if (selectedRow) {
                const allRecords = getActionableRecords(selectedRow.group);
                onEditSettlements(selectedRow.date, allRecords);
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <LinkIcon fontSize="small" color="info" />
            </ListItemIcon>
            <ListItemText>Edit Settlements</ListItemText>
          </MenuItem>
        )}

        {!disabled && selectedRow?.hasSentToEngineerRecords && (
          <MenuItem
            onClick={() => {
              if (selectedRow) {
                const records = getSentToEngineerRecords(selectedRow.group);
                onNotifyDate(selectedRow.date, records);
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <NotifyIcon fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText>Notify Engineer</ListItemText>
          </MenuItem>
        )}

        <Divider />

        {!disabled &&
          (selectedRow?.hasPaidRecords || selectedRow?.hasSentToEngineerRecords) && (
            <MenuItem
              onClick={() => {
                if (selectedRow) {
                  const allRecords = getActionableRecords(selectedRow.group).filter(
                    (r) => r.isPaid || r.paidVia === "engineer_wallet"
                  );
                  onCancelDate(selectedRow.date, allRecords);
                }
                handleMenuClose();
              }}
            >
              <ListItemIcon>
                <CancelIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>Cancel Payments</ListItemText>
            </MenuItem>
          )}

        {!disabled && selectedRow?.hasPaidRecords && (
          <MenuItem
            onClick={() => {
              if (selectedRow) {
                const paidRecords = getPaidRecords(selectedRow.group);
                // Show redirect dialog - salary records come from attendance
                setDeleteRedirectDialog({
                  open: true,
                  date: selectedRow.date,
                  records: paidRecords,
                });
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete & Reset</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Settlement Proof Image Viewer - Full Screen */}
      <Dialog
        open={!!viewingProof}
        onClose={() => setViewingProof(null)}
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: "rgba(0, 0, 0, 0.95)",
          },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
            zIndex: 1,
            bgcolor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <Typography variant="h6" sx={{ color: "white" }}>
            {viewingProof?.type === "company"
              ? "Company Payment Proof"
              : "Engineer Settlement Proof"}
          </Typography>
          <IconButton
            onClick={() => setViewingProof(null)}
            sx={{
              color: "white",
              bgcolor: "rgba(255, 255, 255, 0.1)",
              "&:hover": { bgcolor: "rgba(255, 255, 255, 0.2)" },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            p: 0,
            height: "100%",
          }}
        >
          {viewingProof && (
            <Box
              component="img"
              src={viewingProof.url}
              alt={
                viewingProof.type === "company"
                  ? "Company payment proof"
                  : "Engineer settlement proof"
              }
              sx={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Redirect Dialog - Salary records come from attendance */}
      <Dialog
        open={!!deleteRedirectDialog?.open}
        onClose={() => setDeleteRedirectDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <WarningIcon color="warning" />
          <Typography variant="h6" component="span">
            Cannot Delete Salary Records
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Salary payment records are linked to attendance data. To delete or modify these records, you need to edit or delete the corresponding attendance entries.
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: "action.hover",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Box sx={{ color: "primary.main" }}>
                <AttendanceIcon />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Attendance Page
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {deleteRedirectDialog?.date
                    ? `Go to attendance for ${dayjs(deleteRedirectDialog.date).format("DD MMM YYYY")} to make changes.`
                    : "You will be redirected to the attendance page."}
                </Typography>
              </Box>
              <ArrowForwardIcon color="action" />
            </Box>
          </Box>
        </DialogContent>
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteRedirectDialog(null)} variant="outlined">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (deleteRedirectDialog?.date) {
                handleRedirectToAttendance(deleteRedirectDialog.date);
              }
              setDeleteRedirectDialog(null);
            }}
            endIcon={<ArrowForwardIcon />}
          >
            Go to Attendance
          </Button>
        </Box>
      </Dialog>
    </>
  );
}
