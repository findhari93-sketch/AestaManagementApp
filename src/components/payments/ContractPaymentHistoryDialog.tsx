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
  CalendarMonth as CalendarMonthIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import DeleteContractSettlementDialog from "./DeleteContractSettlementDialog";
import dayjs from "dayjs";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { getPayerSourceLabel, getPayerSourceColor } from "@/components/settlement/PayerSourceSelector";
import type { PayerSource } from "@/types/settlement.types";
import ScreenshotViewer from "@/components/common/ScreenshotViewer";

interface ContractPaymentHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  onViewPayment?: (reference: string) => void;
}

// Settlement record type
interface SettlementRecord {
  id: string;
  settlementReference: string;
  settlementDate: string;
  totalAmount: number;
  paymentMode: string | null;
  paymentChannel: string;
  paymentType: string | null;
  payerSource: string | null;
  payerName: string | null;
  subcontractId: string | null;
  subcontractTitle: string | null;
  proofUrl: string | null;
  proofUrls: string[];
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  laborerCount: number;
  weekAllocations: { weekStart: string; weekEnd: string; amount: number }[];
}

// Helper functions
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
  settlement,
}: {
  settlement: SettlementRecord;
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
      <Tooltip title="View details">
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
              minWidth: 300,
              maxWidth: 400,
              borderRadius: 2,
              boxShadow: theme.shadows[8],
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Settlement Details
          </Typography>
          <Divider sx={{ my: 1 }} />
          <List dense disablePadding>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <PersonIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Recorded By"
                secondary={settlement.createdBy || "System"}
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
            {settlement.subcontractTitle && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LinkIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Linked Subcontract"
                  secondary={settlement.subcontractTitle}
                  primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                  secondaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
                />
              </ListItem>
            )}
            {settlement.weekAllocations && settlement.weekAllocations.length > 0 && (
              <ListItem disableGutters sx={{ flexDirection: "column", alignItems: "flex-start" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <CalendarMonthIcon fontSize="small" color="primary" />
                  <Typography variant="caption" color="text.secondary">
                    Weeks Covered
                  </Typography>
                </Box>
                <Box sx={{ ml: 4, display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {settlement.weekAllocations.map((wa, idx) => (
                    <Typography key={idx} variant="body2" fontWeight={500}>
                      {dayjs(wa.weekStart).format("MMM D")} - {dayjs(wa.weekEnd).format("MMM D, YYYY")}
                      {wa.amount > 0 && ` (₹${wa.amount.toLocaleString("en-IN")})`}
                    </Typography>
                  ))}
                </Box>
              </ListItem>
            )}
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

export default function ContractPaymentHistoryDialog({
  open,
  onClose,
  onViewPayment,
}: ContractPaymentHistoryDialogProps) {
  const supabase = createClient();
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const theme = useTheme();

  // Data state
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Screenshot viewer state
  const [screenshotViewerOpen, setScreenshotViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [settlementToDelete, setSettlementToDelete] = useState<SettlementRecord | null>(null);

  const handleDeleteClick = useCallback((settlement: SettlementRecord) => {
    setSettlementToDelete(settlement);
    setDeleteDialogOpen(true);
  }, []);

  // Fetch settlement groups for contract payments
  // Hybrid approach: Use labor_payments to IDENTIFY salary settlements,
  // but also include advance/other payments that don't have labor_payments
  const fetchSettlements = useCallback(async () => {
    if (!open || !selectedSite) return;

    setLoading(true);
    try {
      // Step 1: Get settlement_group_ids that have contract labor_payments (salary payments)
      const { data: contractPayments } = await supabase
        .from("labor_payments")
        .select("settlement_group_id")
        .eq("site_id", selectedSite.id)
        .eq("is_under_contract", true)
        .not("settlement_group_id", "is", null);

      // Get unique settlement_group_ids from labor_payments
      const contractSettlementIds = contractPayments
        ? [...new Set(contractPayments.map((p: any) => p.settlement_group_id))]
        : [];

      // Step 2: Fetch settlement_groups - both salary settlements (by IDs) AND advance/other payments
      // Build OR query to include both:
      // - Settlements with labor_payments (salary)
      // - Settlements with payment_type = 'advance' or 'other' (no labor_payments)
      let query = (supabase as any)
        .from("settlement_groups")
        .select(`
          id,
          settlement_reference,
          settlement_date,
          total_amount,
          payment_mode,
          payment_channel,
          payment_type,
          payer_source,
          payer_name,
          subcontract_id,
          proof_url,
          proof_urls,
          notes,
          created_by_name,
          created_at,
          laborer_count,
          week_allocations,
          subcontracts (
            title
          )
        `)
        .eq("site_id", selectedSite.id)
        .eq("is_cancelled", false)
        .order("settlement_date", { ascending: false });

      // If we have salary settlements, use OR to include them plus advances/other/excess
      // If no salary settlements, just fetch advances/other/excess
      // Note: Using filter with .in() for IDs to avoid query string length issues
      let settlementData: any[] = [];
      let error: any = null;

      if (contractSettlementIds.length > 0) {
        // Query salary settlements by IDs
        const { data: salaryData, error: salaryError } = await query
          .in("id", contractSettlementIds);

        if (salaryError) {
          error = salaryError;
        } else {
          settlementData = salaryData || [];
        }

        // Query advance/other/excess settlements separately
        const { data: otherData, error: otherError } = await supabase
          .from("settlement_groups")
          .select(`
            id,
            settlement_reference,
            settlement_date,
            total_amount,
            payment_mode,
            payment_channel,
            payment_type,
            payer_source,
            payer_name,
            subcontract_id,
            proof_url,
            proof_urls,
            notes,
            created_by_name,
            created_at,
            laborer_count,
            week_allocations,
            subcontracts (
              title
            )
          `)
          .eq("site_id", selectedSite.id)
          .eq("is_cancelled", false)
          .in("payment_type", ["advance", "other", "excess"])
          .order("settlement_date", { ascending: false });

        if (!otherError && otherData) {
          // Merge results, avoiding duplicates (some may have been included in both)
          const existingIds = new Set(settlementData.map((s: any) => s.id));
          otherData.forEach((s: any) => {
            if (!existingIds.has(s.id)) {
              settlementData.push(s);
            }
          });
        }

        // Sort combined results by settlement_date descending
        settlementData.sort((a: any, b: any) =>
          new Date(b.settlement_date).getTime() - new Date(a.settlement_date).getTime()
        );
      } else {
        const { data: otherData, error: otherError } = await query
          .in("payment_type", ["advance", "other", "excess"]);
        settlementData = otherData || [];
        error = otherError;
      }

      if (error) {
        console.error("Error fetching settlements:", error);
        setSettlements([]);
        return;
      }

      if (!settlementData || settlementData.length === 0) {
        setSettlements([]);
        setLoading(false);
        return;
      }

      // Map to SettlementRecord format - use settlement_groups.total_amount directly
      const mapped: SettlementRecord[] = (settlementData || []).map((sg: any) => {
        return {
          id: sg.id,
          settlementReference: sg.settlement_reference,
          settlementDate: sg.settlement_date,
          // Use total_amount directly from settlement_groups (this is the actual transaction amount)
          totalAmount: sg.total_amount || 0,
          paymentMode: sg.payment_mode,
          paymentChannel: sg.payment_channel,
          paymentType: sg.payment_type,
          payerSource: sg.payer_source,
          payerName: sg.payer_name,
          subcontractId: sg.subcontract_id,
          subcontractTitle: sg.subcontracts?.title || null,
          proofUrl: sg.proof_url,
          proofUrls: sg.proof_urls || (sg.proof_url ? [sg.proof_url] : []),
          notes: sg.notes,
          createdBy: sg.created_by_name,
          createdAt: sg.created_at,
          laborerCount: sg.laborer_count || 0,
          weekAllocations: sg.week_allocations || [],
        };
      });

      setSettlements(mapped);
    } catch (err) {
      console.error("Error fetching settlement history:", err);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }, [open, selectedSite, supabase]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleDeleteSuccess = useCallback(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleViewSettlement = (settlement: SettlementRecord) => {
    if (settlement.settlementReference && onViewPayment) {
      onViewPayment(settlement.settlementReference);
    }
  };

  const handleOpenScreenshotViewer = (images: string[]) => {
    setViewerImages(images);
    setScreenshotViewerOpen(true);
  };

  // Define columns for MRT
  const columns = useMemo<MRT_ColumnDef<SettlementRecord>[]>(
    () => [
      {
        accessorKey: "settlementDate",
        header: "Date",
        size: 120,
        filterVariant: "date-range",
        Cell: ({ cell }) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {dayjs(cell.getValue<string>()).format("DD MMM YYYY")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {dayjs(cell.getValue<string>()).format("dddd")}
            </Typography>
          </Box>
        ),
        sortingFn: (a, b) =>
          dayjs(a.original.settlementDate).diff(dayjs(b.original.settlementDate)),
      },
      {
        accessorKey: "settlementReference",
        header: "Reference",
        size: 140,
        Cell: ({ row }) => (
          <Tooltip title="Click row to view details">
            <Chip
              size="small"
              icon={<ReceiptIcon sx={{ fontSize: 14 }} />}
              label={row.original.settlementReference}
              color="primary"
              variant="outlined"
              sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
            />
          </Tooltip>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Amount",
        size: 120,
        filterVariant: "range-slider",
        muiFilterSliderProps: {
          marks: true,
          step: 1000,
        },
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={700} color="success.main">
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
        size: 100,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "salary", label: "Salary" },
          { value: "advance", label: "Advance" },
          { value: "excess", label: "Excess" },
          { value: "other", label: "Other" },
        ],
        Cell: ({ cell }) => {
          const type = cell.getValue<string | null>();
          const isAdvance = type === "advance";
          const isOther = type === "other";
          const isExcess = type === "excess";
          // Excess payments are applied to salary in waterfall calculation, so show as Salary
          // with tooltip explaining it was originally an overpayment
          if (isExcess) {
            return (
              <Tooltip title="Originally recorded as overpayment (no salary due at time of payment). Now applied to salary.">
                <Chip
                  size="small"
                  label="Salary"
                  color="success"
                  variant="outlined"
                  sx={{ fontSize: "0.7rem" }}
                />
              </Tooltip>
            );
          }
          return (
            <Chip
              size="small"
              label={isAdvance ? "Advance" : isOther ? "Other" : "Salary"}
              color={isAdvance ? "warning" : isOther ? "info" : "success"}
              variant="outlined"
              sx={{ fontSize: "0.7rem" }}
            />
          );
        },
      },
      {
        accessorKey: "laborerCount",
        header: "Laborers",
        size: 90,
        Cell: ({ row }) => {
          const count = row.original.laborerCount;
          const type = row.original.paymentType;
          // For advance/other payments, show "-" since no laborers are linked
          // Note: excess payments are now shown as Salary, but may not have laborers if recorded before work
          if ((type === "advance" || type === "other") && count === 0) {
            return (
              <Typography variant="body2" color="text.secondary">
                -
              </Typography>
            );
          }
          // For excess payments with no laborers, show "-" but it's still salary
          if (type === "excess" && count === 0) {
            return (
              <Tooltip title="Applied to all contract laborers via waterfall">
                <Typography variant="body2" color="text.secondary">
                  -
                </Typography>
              </Tooltip>
            );
          }
          return (
            <Chip
              size="small"
              label={`${count} laborers`}
              variant="outlined"
              sx={{ fontSize: "0.7rem" }}
            />
          );
        },
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
        size: 140,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "own_money", label: "Own Money" },
          { value: "client_money", label: "Client Money" },
          { value: "trust_account", label: "Trust Account" },
          { value: "amma_money", label: "Amma Money" },
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
        accessorKey: "subcontractTitle",
        header: "Subcontract",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value ? (
            <Tooltip title={value}>
              <Typography variant="body2" noWrap sx={{ maxWidth: 130 }}>
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
        accessorKey: "notes",
        header: "Notes",
        size: 160,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value ? (
            <Tooltip title={value}>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
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
        size: 70,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) =>
          row.original.proofUrls && row.original.proofUrls.length > 0 ? (
            <Tooltip title="View proof">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenScreenshotViewer(row.original.proofUrls);
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
        header: "Details",
        size: 70,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => <AuditInfoPopover settlement={row.original} />,
      },
      {
        id: "actions",
        header: "Actions",
        size: 70,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => (
          <Tooltip title="Delete settlement">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(row.original);
              }}
              sx={{
                color: theme.palette.error.main,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.error.main, 0.08),
                },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [theme, handleDeleteClick]
  );

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    // totalAmount from grouped settlements (matches summary dashboard)
    const totalAmount = settlements.reduce((sum, s) => sum + s.totalAmount, 0);
    return { totalAmount, count: settlements.length };
  }, [settlements]);

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
                Contract Settlement History
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summaryStats.count} settlements • Total: ₹{summaryStats.totalAmount.toLocaleString("en-IN")}
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
              Total Settlements
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
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
              minWidth: 160,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Total Amount Paid
            </Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">
              ₹{summaryStats.totalAmount.toLocaleString("en-IN")}
            </Typography>
          </Box>
        </Box>

        {/* MRT Table */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
          <DataTable
            columns={columns}
            data={settlements}
            isLoading={loading}
            enableSelection={false}
            pageSize={100}
            maxHeight="calc(90vh - 260px)"
            mobileHiddenColumns={["laborerCount", "subcontractTitle", "notes"]}
            muiTableBodyRowProps={({ row }) => ({
              onClick: () => handleViewSettlement(row.original),
              sx: {
                cursor: onViewPayment ? "pointer" : "default",
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.04),
                },
              },
            })}
            renderTopToolbarCustomActions={() => (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                Date-wise settlement records (SET-* references)
              </Typography>
            )}
            initialState={{
              sorting: [{ id: "settlementDate", desc: true }],
              pagination: {
                pageSize: 100,
                pageIndex: 0,
              },
            }}
            muiPaginationProps={{
              rowsPerPageOptions: [10, 25, 50, 100],
              showFirstButton: true,
              showLastButton: true,
            }}
            enablePagination={true}
          />
        </Box>
      </DialogContent>

      {/* Screenshot Viewer */}
      <ScreenshotViewer
        open={screenshotViewerOpen}
        onClose={() => setScreenshotViewerOpen(false)}
        images={viewerImages}
        title="Payment Proof"
      />

      {/* Delete Confirmation Dialog */}
      <DeleteContractSettlementDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSettlementToDelete(null);
        }}
        settlement={settlementToDelete}
        onSuccess={handleDeleteSuccess}
      />
    </Dialog>
  );
}
