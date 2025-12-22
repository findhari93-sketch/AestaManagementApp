"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Avatar,
  Popover,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Close as CloseIcon,
  History as HistoryIcon,
  Receipt as ReceiptIcon,
  Image as ImageIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  AccessTime as AccessTimeIcon,
  AccountBalance as AccountBalanceIcon,
  Link as LinkIcon,
  Notes as NotesIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import {
  getContractPaymentHistory,
  ContractPaymentHistoryRecord,
} from "@/lib/services/settlementService";
import dayjs from "dayjs";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { getPayerSourceLabel, getPayerSourceColor } from "@/components/settlement/PayerSourceSelector";
import type { PayerSource } from "@/types/settlement.types";

interface ContractPaymentHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  onViewPayment?: (reference: string) => void;
}

// Helper functions
function getPaymentTypeLabel(type: string): string {
  switch (type) {
    case "salary":
      return "Salary";
    case "advance":
      return "Advance";
    case "other":
      return "Other";
    default:
      return type;
  }
}

function getPaymentTypeColor(type: string): "success" | "warning" | "default" | "info" {
  switch (type) {
    case "salary":
      return "success";
    case "advance":
      return "warning";
    case "other":
      return "info";
    default:
      return "default";
  }
}

function getPaymentModeLabel(mode: string | null): string {
  if (!mode) return "N/A";
  switch (mode) {
    case "upi":
      return "UPI";
    case "cash":
      return "Cash";
    case "net_banking":
      return "Net Banking";
    case "other":
      return "Other";
    default:
      return mode;
  }
}

function getChannelLabel(channel: string | null): string {
  if (!channel) return "N/A";
  switch (channel) {
    case "direct":
      return "Direct";
    case "engineer_wallet":
      return "Via Engineer";
    default:
      return channel;
  }
}

// Audit Info Popover Component
function AuditInfoPopover({
  payment,
}: {
  payment: ContractPaymentHistoryRecord;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const theme = useTheme();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="View audit details">
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{
            color: theme.palette.text.secondary,
            "&:hover": {
              color: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 280,
              maxWidth: 350,
              borderRadius: 2,
              boxShadow: theme.shadows[8],
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Payment Audit Details
          </Typography>
          <Divider sx={{ my: 1 }} />
          <List dense disablePadding>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <PersonIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Recorded By"
                secondary={payment.recordedBy}
                primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                secondaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
              />
            </ListItem>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <AccessTimeIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Created At"
                secondary={dayjs(payment.createdAt).format("DD MMM YYYY, hh:mm A")}
                primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                secondaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
              />
            </ListItem>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <AccountBalanceIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Payment Source"
                secondary={
                  payment.payerSource
                    ? getPayerSourceLabel(payment.payerSource as PayerSource, payment.payerName || undefined)
                    : "Not specified"
                }
                primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                secondaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
              />
            </ListItem>
            {payment.subcontractTitle && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LinkIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Linked Subcontract"
                  secondary={payment.subcontractTitle}
                  primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                  secondaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
                />
              </ListItem>
            )}
            {payment.notes && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <NotesIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Notes"
                  secondary={payment.notes}
                  primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                  secondaryTypographyProps={{ variant: "body2", fontWeight: 500, sx: { whiteSpace: "pre-wrap" } }}
                />
              </ListItem>
            )}
          </List>
        </Box>
      </Popover>
    </>
  );
}

export default function ContractPaymentHistoryDialog({
  open,
  onClose,
  onViewPayment,
}: ContractPaymentHistoryDialogProps) {
  const supabase = createClient();
  const { selectedSite } = useSite();
  const theme = useTheme();

  // Data state
  const [payments, setPayments] = useState<ContractPaymentHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all data (MRT will handle pagination/filtering)
  const fetchPayments = useCallback(async () => {
    if (!open || !selectedSite) return;

    setLoading(true);
    try {
      const result = await getContractPaymentHistory(supabase, selectedSite.id, {
        limit: 500, // Fetch more records, MRT handles client-side pagination
      });
      setPayments(result.payments);
    } catch (err) {
      console.error("Error fetching payment history:", err);
    } finally {
      setLoading(false);
    }
  }, [open, selectedSite, supabase]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleViewPayment = (payment: ContractPaymentHistoryRecord) => {
    const reference = payment.paymentReference || payment.settlementReference;
    if (reference && onViewPayment) {
      onViewPayment(reference);
    }
  };

  // Define columns for MRT
  const columns = useMemo<MRT_ColumnDef<ContractPaymentHistoryRecord>[]>(
    () => [
      {
        accessorKey: "actualPaymentDate",
        header: "Date",
        size: 110,
        filterVariant: "date-range",
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={500}>
            {dayjs(cell.getValue<string>()).format("DD MMM YYYY")}
          </Typography>
        ),
        sortingFn: (a, b) =>
          dayjs(a.original.actualPaymentDate).diff(dayjs(b.original.actualPaymentDate)),
      },
      {
        accessorKey: "laborerName",
        header: "Laborer",
        size: 160,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500} noWrap>
              {row.original.laborerName}
            </Typography>
            {row.original.laborerRole && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.original.laborerRole}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "paymentReference",
        header: "Reference",
        size: 130,
        Cell: ({ row }) => (
          <Tooltip title="Click row to view details">
            <Chip
              size="small"
              icon={<ReceiptIcon sx={{ fontSize: 14 }} />}
              label={row.original.paymentReference || row.original.settlementReference || "N/A"}
              variant="outlined"
              sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}
            />
          </Tooltip>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 100,
        filterVariant: "range-slider",
        muiFilterSliderProps: {
          marks: true,
          step: 500,
        },
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="success.main">
            ₹{cell.getValue<number>().toLocaleString("en-IN")}
          </Typography>
        ),
        aggregationFn: "sum",
        AggregatedCell: ({ cell }) => (
          <Typography variant="body2" fontWeight={700} color="success.dark">
            ₹{cell.getValue<number>().toLocaleString("en-IN")}
          </Typography>
        ),
      },
      {
        accessorKey: "paymentType",
        header: "Type",
        size: 90,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "salary", label: "Salary" },
          { value: "advance", label: "Advance" },
          { value: "other", label: "Other" },
        ],
        Cell: ({ cell }) => (
          <Chip
            size="small"
            label={getPaymentTypeLabel(cell.getValue<string>())}
            color={getPaymentTypeColor(cell.getValue<string>())}
            sx={{ fontWeight: 500 }}
          />
        ),
      },
      {
        accessorKey: "paymentMode",
        header: "Mode",
        size: 100,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "upi", label: "UPI" },
          { value: "cash", label: "Cash" },
          { value: "net_banking", label: "Net Banking" },
          { value: "other", label: "Other" },
        ],
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {getPaymentModeLabel(cell.getValue<string | null>())}
          </Typography>
        ),
      },
      {
        accessorKey: "payerSource",
        header: "Paid By",
        size: 130,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "own_money", label: "Own Money" },
          { value: "client_money", label: "Client Money" },
          { value: "trust_account", label: "Trust Account" },
          { value: "company_money", label: "Company Money" },
          { value: "other_site_money", label: "Other Site" },
          { value: "custom", label: "Custom" },
        ],
        Cell: ({ row }) => {
          const source = row.original.payerSource;
          if (!source) {
            return (
              <Typography variant="body2" color="text.secondary">
                -
              </Typography>
            );
          }
          return (
            <Chip
              size="small"
              variant="outlined"
              label={getPayerSourceLabel(source as PayerSource, row.original.payerName || undefined)}
              color={getPayerSourceColor(source as PayerSource)}
              sx={{ fontSize: "0.7rem" }}
            />
          );
        },
      },
      {
        accessorKey: "paymentChannel",
        header: "Channel",
        size: 100,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "direct", label: "Direct" },
          { value: "engineer_wallet", label: "Via Engineer" },
        ],
        Cell: ({ cell }) => (
          <Chip
            size="small"
            variant="outlined"
            label={getChannelLabel(cell.getValue<string | null>())}
            color={cell.getValue<string>() === "engineer_wallet" ? "info" : "default"}
            sx={{ fontSize: "0.7rem" }}
          />
        ),
      },
      {
        accessorKey: "subcontractTitle",
        header: "Subcontract",
        size: 140,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value ? (
            <Tooltip title={value}>
              <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
                {value}
              </Typography>
            </Tooltip>
          ) : (
            <Typography variant="body2" color="text.secondary">
              -
            </Typography>
          );
        },
      },
      {
        id: "proof",
        header: "Proof",
        size: 60,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) =>
          row.original.proofUrl ? (
            <Tooltip title="View proof">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(row.original.proofUrl!, "_blank");
                }}
              >
                <ImageIcon fontSize="small" color="primary" />
              </IconButton>
            </Tooltip>
          ) : (
            <Typography variant="body2" color="text.secondary" align="center">
              -
            </Typography>
          ),
      },
      {
        id: "audit",
        header: "Audit",
        size: 60,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => <AuditInfoPopover payment={row.original} />,
      },
    ],
    []
  );

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const salaryTotal = payments.filter((p) => p.paymentType === "salary").reduce((sum, p) => sum + p.amount, 0);
    const advanceTotal = payments.filter((p) => p.paymentType === "advance").reduce((sum, p) => sum + p.amount, 0);
    return { totalAmount, salaryTotal, advanceTotal, count: payments.length };
  }, [payments]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: "90vh",
          maxHeight: "90vh",
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 40, height: 40 }}>
              <HistoryIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Contract Payment History
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summaryStats.count} payments • Total: ₹{summaryStats.totalAmount.toLocaleString("en-IN")}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column" }}>
        {/* Summary Cards */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            p: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexWrap: "wrap",
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: "background.paper",
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              minWidth: 140,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Total Payments
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {summaryStats.count}
            </Typography>
          </Box>
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: "background.paper",
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              minWidth: 140,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Total Amount
            </Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">
              ₹{summaryStats.totalAmount.toLocaleString("en-IN")}
            </Typography>
          </Box>
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: "background.paper",
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
              minWidth: 140,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Salary Payments
            </Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">
              ₹{summaryStats.salaryTotal.toLocaleString("en-IN")}
            </Typography>
          </Box>
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: "background.paper",
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
              minWidth: 140,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Advance Payments
            </Typography>
            <Typography variant="h6" fontWeight={700} color="warning.main">
              ₹{summaryStats.advanceTotal.toLocaleString("en-IN")}
            </Typography>
          </Box>
        </Box>

        {/* MRT Table */}
        <Box sx={{ flex: 1, overflow: "hidden", p: 2 }}>
          <DataTable
            columns={columns}
            data={payments}
            isLoading={loading}
            enableSelection={false}
            pageSize={30}
            maxHeight="calc(90vh - 280px)"
            mobileHiddenColumns={["paymentChannel", "subcontractTitle", "audit"]}
            muiTableBodyRowProps={({ row }) => ({
              onClick: () => handleViewPayment(row.original),
              sx: {
                cursor: onViewPayment ? "pointer" : "default",
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.04),
                },
              },
            })}
            renderTopToolbarCustomActions={() => (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                Click any row to view payment details
              </Typography>
            )}
            initialState={{
              sorting: [{ id: "actualPaymentDate", desc: true }],
              columnVisibility: {
                paymentChannel: false, // Hidden by default, can be shown via column visibility toggle
              },
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
