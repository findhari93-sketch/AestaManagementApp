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
  Card,
  CardContent,
  Grid,
  alpha,
  useTheme,
  Popover,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  CalendarMonth as CalendarIcon,
  Receipt as ReceiptIcon,
  Image as ImageIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  AccessTime as AccessTimeIcon,
  AccountBalance as AccountBalanceIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Payment as PaymentIcon,
  Notes as NotesIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import dayjs from "dayjs";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { getPayerSourceLabel, getPayerSourceColor } from "@/components/settlement/PayerSourceSelector";
import type { PayerSource } from "@/types/settlement.types";

// Week data type from ContractWeeklyPaymentsTab
interface WeekLaborerData {
  laborerId: string;
  laborerName: string;
  laborerRole: string | null;
  teamId: string | null;
  teamName: string | null;
  subcontractId: string | null;
  subcontractTitle: string | null;
  daysWorked: number;
  earned: number;
  paid: number;
  balance: number;
  progress: number;
}

interface WeekRowData {
  id: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  laborerCount: number;
  totalSalary: number;
  totalPaid: number;
  totalDue: number;
  paymentProgress: number;
  status: string;
  laborers: WeekLaborerData[];
  settlementReferences: string[];
}

interface WeekSettlement {
  id: string;
  paymentReference: string;
  laborerId: string;
  laborerName: string;
  laborerRole: string | null;
  amount: number;
  paymentType: string;
  paymentMode: string | null;
  actualPaymentDate: string;
  proofUrl: string | null;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
  payerSource: string | null;
  payerName: string | null;
}

interface WeekSettlementsDialogProps {
  open: boolean;
  onClose: () => void;
  week: WeekRowData | null;
  onViewPayment: (ref: string) => void;
  onEditPayment?: (ref: string) => void;
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

// Audit Info Popover Component
function AuditInfoPopover({ settlement }: { settlement: WeekSettlement }) {
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
                secondary={settlement.recordedBy || "Unknown"}
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
                secondary={dayjs(settlement.createdAt).format("DD MMM YYYY, hh:mm A")}
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
                  settlement.payerSource
                    ? getPayerSourceLabel(settlement.payerSource as PayerSource, settlement.payerName || undefined)
                    : "Not specified"
                }
                primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                secondaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
              />
            </ListItem>
            {settlement.notes && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <NotesIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Notes"
                  secondary={settlement.notes}
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

export default function WeekSettlementsDialog({
  open,
  onClose,
  week,
  onViewPayment,
  onEditPayment,
}: WeekSettlementsDialogProps) {
  const supabase = createClient();
  const { selectedSite } = useSite();
  const theme = useTheme();

  const [settlements, setSettlements] = useState<WeekSettlement[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch settlements for the week based on payment references
  const fetchSettlements = useCallback(async () => {
    if (!open || !selectedSite || !week || week.settlementReferences.length === 0) {
      setSettlements([]);
      return;
    }

    setLoading(true);
    try {
      // Fetch labor_payments by payment_reference
      const { data, error } = await supabase
        .from("labor_payments")
        .select(`
          id,
          payment_reference,
          laborer_id,
          amount,
          payment_type,
          payment_mode,
          actual_payment_date,
          proof_url,
          notes,
          paid_by,
          created_at,
          settlement_groups(payer_source, payer_name),
          laborers(name, labor_roles(name))
        `)
        .eq("site_id", selectedSite.id)
        .in("payment_reference", week.settlementReferences)
        .order("actual_payment_date", { ascending: false });

      if (error) throw error;

      const mapped: WeekSettlement[] = (data || []).map((p: any) => ({
        id: p.id,
        paymentReference: p.payment_reference || "N/A",
        laborerId: p.laborer_id,
        laborerName: p.laborers?.name || "Unknown",
        laborerRole: p.laborers?.labor_roles?.name || null,
        amount: p.amount,
        paymentType: p.payment_type,
        paymentMode: p.payment_mode,
        actualPaymentDate: p.actual_payment_date,
        proofUrl: p.proof_url,
        notes: p.notes,
        recordedBy: p.paid_by,
        createdAt: p.created_at,
        payerSource: p.settlement_groups?.payer_source || null,
        payerName: p.settlement_groups?.payer_name || null,
      }));

      setSettlements(mapped);
    } catch (err) {
      console.error("Error fetching week settlements:", err);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }, [open, selectedSite, week, supabase]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // Calculate totals
  const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
  const settlementCount = settlements.length;

  // Define columns for MRT
  const columns = useMemo<MRT_ColumnDef<WeekSettlement>[]>(
    () => [
      {
        accessorKey: "actualPaymentDate",
        header: "Date",
        size: 100,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={500}>
            {dayjs(cell.getValue<string>()).format("DD MMM")}
          </Typography>
        ),
      },
      {
        accessorKey: "laborerName",
        header: "Laborer",
        size: 150,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {row.original.laborerName}
            </Typography>
            {row.original.laborerRole && (
              <Typography variant="caption" color="text.secondary">
                {row.original.laborerRole}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "paymentReference",
        header: "Reference",
        size: 140,
        Cell: ({ row }) => (
          <Tooltip title="Click to view details">
            <Chip
              size="small"
              icon={<ReceiptIcon sx={{ fontSize: 14 }} />}
              label={row.original.paymentReference}
              variant="outlined"
              sx={{
                fontFamily: "monospace",
                fontSize: "0.7rem",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onViewPayment(row.original.paymentReference);
              }}
            />
          </Tooltip>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 100,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="success.main">
            Rs.{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
        Footer: () => (
          <Typography variant="body2" fontWeight={700} color="success.main">
            Rs.{totalAmount.toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "paymentType",
        header: "Type",
        size: 80,
        Cell: ({ cell }) => (
          <Chip
            label={getPaymentTypeLabel(cell.getValue<string>())}
            size="small"
            color={getPaymentTypeColor(cell.getValue<string>())}
            variant="outlined"
          />
        ),
      },
      {
        accessorKey: "paymentMode",
        header: "Mode",
        size: 90,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {getPaymentModeLabel(cell.getValue<string | null>())}
          </Typography>
        ),
      },
      {
        accessorKey: "proofUrl",
        header: "Proof",
        size: 60,
        Cell: ({ cell }) => {
          const proofUrl = cell.getValue<string | null>();
          if (!proofUrl) {
            return <Typography variant="body2" color="text.disabled">-</Typography>;
          }
          return (
            <Tooltip title="View proof image">
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(proofUrl, "_blank");
                }}
              >
                <ImageIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Tooltip title="View details">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewPayment(row.original.paymentReference);
                }}
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {onEditPayment && (
              <Tooltip title="Edit payment">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPayment(row.original.paymentReference);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <AuditInfoPopover settlement={row.original} />
          </Box>
        ),
      },
    ],
    [totalAmount, onViewPayment, onEditPayment]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: "90vh",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <CalendarIcon color="primary" />
          <Box>
            <Typography variant="h6" component="span" fontWeight={600}>
              Week Settlements
            </Typography>
            {week && (
              <Typography variant="body2" color="text.secondary">
                {week.weekLabel}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                borderLeft: 4,
                borderColor: "primary.main",
              }}
            >
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  Total Settlements
                </Typography>
                <Typography variant="h5" fontWeight={600} color="primary.dark">
                  {settlementCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card
              sx={{
                bgcolor: alpha(theme.palette.success.main, 0.08),
                borderLeft: 4,
                borderColor: "success.main",
              }}
            >
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  Total Paid
                </Typography>
                <Typography variant="h5" fontWeight={600} color="success.dark">
                  Rs.{totalAmount.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card
              sx={{
                bgcolor: alpha(theme.palette.info.main, 0.08),
                borderLeft: 4,
                borderColor: "info.main",
              }}
            >
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  Week Salary
                </Typography>
                <Typography variant="h5" fontWeight={600} color="info.dark">
                  Rs.{week?.totalSalary.toLocaleString() || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card
              sx={{
                bgcolor: week && week.totalDue > 0
                  ? alpha(theme.palette.warning.main, 0.08)
                  : alpha(theme.palette.success.main, 0.08),
                borderLeft: 4,
                borderColor: week && week.totalDue > 0 ? "warning.main" : "success.main",
              }}
            >
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  Week Due
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={600}
                  color={week && week.totalDue > 0 ? "warning.dark" : "success.dark"}
                >
                  Rs.{week?.totalDue.toLocaleString() || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Settlements Table */}
        {settlements.length === 0 && !loading ? (
          <Box
            sx={{
              textAlign: "center",
              py: 6,
              bgcolor: alpha(theme.palette.grey[500], 0.04),
              borderRadius: 2,
            }}
          >
            <PaymentIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              No settlements recorded for this week yet
            </Typography>
          </Box>
        ) : (
          <DataTable
            columns={columns}
            data={settlements}
            isLoading={loading}
            enableRowSelection={false}
            enablePagination={settlements.length > 10}
            initialState={{
              pagination: { pageSize: 10, pageIndex: 0 },
              sorting: [{ id: "actualPaymentDate", desc: true }],
            }}
            muiTableContainerProps={{
              sx: { maxHeight: "400px" },
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
