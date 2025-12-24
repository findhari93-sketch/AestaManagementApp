"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Tooltip,
  alpha,
  useTheme,
  Skeleton,
  Button,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  CalendarMonth as CalendarIcon,
  Receipt as ReceiptIcon,
  Image as ImageIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
  AccountBalance as AccountBalanceIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import dayjs from "dayjs";
import { getDateWiseSettlements } from "@/lib/services/settlementService";
import { getPayerSourceLabel, getPayerSourceColor } from "@/components/settlement/PayerSourceSelector";
import type { DateWiseSettlement, WeekAllocationEntry, PaymentStatus, PaymentMode } from "@/types/payment.types";
import type { PayerSource } from "@/types/settlement.types";
import ScreenshotViewer from "@/components/common/ScreenshotViewer";

// Week data type
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
  status: PaymentStatus;
  laborers: WeekLaborerData[];
  settlementReferences: string[];
}

interface WeekSettlementsDialogV2Props {
  open: boolean;
  onClose: () => void;
  week: WeekRowData | null;
  onViewPayment: (ref: string) => void;
  onEditSettlement?: (settlement: DateWiseSettlement) => void;
  onDeleteSettlement?: (settlement: DateWiseSettlement) => void;
  onRefresh?: () => void;
}

// Format currency
function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `Rs.${(amount / 100000).toFixed(1)}L`;
  }
  return `Rs.${amount.toLocaleString()}`;
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

export default function WeekSettlementsDialogV2({
  open,
  onClose,
  week,
  onViewPayment,
  onEditSettlement,
  onDeleteSettlement,
  onRefresh,
}: WeekSettlementsDialogV2Props) {
  const theme = useTheme();
  const { selectedSite } = useSite();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<DateWiseSettlement[]>([]);
  const [laborerExpanded, setLaborerExpanded] = useState(false);
  const [screenshotViewerOpen, setScreenshotViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Fetch settlements for this week
  const fetchSettlements = useCallback(async () => {
    if (!selectedSite?.id || !week) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { settlements: data } = await getDateWiseSettlements(
        supabase,
        selectedSite.id,
        week.weekStart,
        week.weekEnd
      );

      // Map to DateWiseSettlement format
      const mapped: DateWiseSettlement[] = data.map((s) => ({
        settlementGroupId: s.settlementGroupId,
        settlementReference: s.settlementReference,
        settlementDate: s.settlementDate,
        totalAmount: s.totalAmount,
        weekAllocations: s.weekAllocations,
        paymentMode: s.paymentMode as PaymentMode | null,
        paymentChannel: s.paymentChannel as "direct" | "engineer_wallet",
        payerSource: s.payerSource as PayerSource | null,
        payerName: s.payerName,
        proofUrls: s.proofUrls,
        notes: s.notes,
        subcontractId: null,
        subcontractTitle: null,
        createdBy: s.createdBy || "",
        createdByName: s.createdBy,
        createdAt: s.createdAt,
        isCancelled: false,
      }));

      setSettlements(mapped);
    } catch (err) {
      console.error("Error fetching settlements:", err);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSite?.id, week, supabase]);

  useEffect(() => {
    if (open && week) {
      fetchSettlements();
    }
  }, [open, week, fetchSettlements]);

  const handleOpenScreenshotViewer = (images: string[], initialIndex = 0) => {
    setViewerImages(images);
    setViewerInitialIndex(initialIndex);
    setScreenshotViewerOpen(true);
  };

  if (!week) return null;

  const paymentProgress = week.totalSalary > 0 ? (week.totalPaid / week.totalSalary) * 100 : 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
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
            pb: 1,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CalendarIcon color="primary" />
            <Box>
              <Typography variant="h6" component="span">
                {week.weekLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }} component="span">
                {week.laborerCount} laborers
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Summary Header */}
          <Box
            sx={{
              p: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Salary
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {formatCurrency(week.totalSalary)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Paid
                </Typography>
                <Typography variant="h6" fontWeight={600} color="success.main">
                  {formatCurrency(week.totalPaid)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Due
                </Typography>
                <Typography variant="h6" fontWeight={600} color="error.main">
                  {formatCurrency(week.totalDue)}
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 150 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Progress
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {Math.round(paymentProgress)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(paymentProgress, 100)}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 4,
                      bgcolor: paymentProgress >= 100 ? "success.main" : "primary.main",
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Date-wise Settlements (Primary View) */}
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <ReceiptIcon fontSize="small" />
              Settlements ({settlements.length})
            </Typography>

            {loading ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {[1, 2].map((i) => (
                  <Skeleton key={i} variant="rounded" height={120} />
                ))}
              </Box>
            ) : settlements.length === 0 ? (
              <Card variant="outlined" sx={{ bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
                <CardContent sx={{ textAlign: "center", py: 4 }}>
                  <PaymentIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                  <Typography color="text.secondary">No settlements recorded for this week</Typography>
                </CardContent>
              </Card>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {settlements.map((settlement) => (
                  <Card
                    key={settlement.settlementGroupId}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      "&:hover": {
                        borderColor: theme.palette.primary.main,
                        boxShadow: theme.shadows[2],
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      {/* Settlement Header */}
                      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {dayjs(settlement.settlementDate).format("ddd, MMM DD, YYYY")}
                            </Typography>
                            <Chip
                              label={settlement.settlementReference}
                              size="small"
                              color="primary"
                              variant="outlined"
                              onClick={() => onViewPayment(settlement.settlementReference)}
                              sx={{
                                mt: 0.5,
                                fontFamily: "monospace",
                                cursor: "pointer",
                                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                              }}
                            />
                          </Box>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="h6" fontWeight={600}>
                            {formatCurrency(settlement.totalAmount)}
                          </Typography>
                          {onEditSettlement && (
                            <Tooltip title="Edit Settlement">
                              <IconButton
                                size="small"
                                onClick={() => onEditSettlement(settlement)}
                                sx={{ color: "text.secondary" }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {onDeleteSettlement && (
                            <Tooltip title="Delete Settlement">
                              <IconButton
                                size="small"
                                onClick={() => onDeleteSettlement(settlement)}
                                sx={{ color: "error.main" }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>

                      {/* Settlement Details */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 1 }}>
                        <Chip
                          label={getPaymentModeLabel(settlement.paymentMode)}
                          size="small"
                          variant="outlined"
                        />
                        {settlement.payerSource && (
                          <Chip
                            label={getPayerSourceLabel(settlement.payerSource as PayerSource)}
                            size="small"
                            color={getPayerSourceColor(settlement.payerSource as PayerSource)}
                            variant="filled"
                          />
                        )}
                        {settlement.paymentChannel === "engineer_wallet" && (
                          <Chip label="Via Engineer" size="small" color="info" variant="outlined" />
                        )}
                      </Box>

                      {/* Week Allocations */}
                      {settlement.weekAllocations && settlement.weekAllocations.length > 0 && (
                        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: alpha(theme.palette.grey[500], 0.05), borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                            Week Allocations:
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            {settlement.weekAllocations.map((alloc, idx) => (
                              <Box
                                key={idx}
                                sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                              >
                                <Typography variant="body2">
                                  {alloc.weekLabel}
                                </Typography>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <Typography variant="body2" fontWeight={500}>
                                    {formatCurrency(alloc.allocatedAmount)}
                                  </Typography>
                                  {alloc.isFullyPaid && (
                                    <Chip label="Paid" size="small" color="success" sx={{ height: 20 }} />
                                  )}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Screenshots */}
                      {settlement.proofUrls && settlement.proofUrls.length > 0 && (
                        <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                          <ImageIcon fontSize="small" color="action" />
                          <Box sx={{ display: "flex", gap: 1 }}>
                            {settlement.proofUrls.map((url, idx) => (
                              <Box
                                key={idx}
                                onClick={() => handleOpenScreenshotViewer(settlement.proofUrls, idx)}
                                sx={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 1,
                                  overflow: "hidden",
                                  cursor: "pointer",
                                  border: `1px solid ${theme.palette.divider}`,
                                  "&:hover": {
                                    borderColor: theme.palette.primary.main,
                                    transform: "scale(1.05)",
                                  },
                                  transition: "all 0.2s",
                                }}
                              >
                                <Box
                                  component="img"
                                  src={url}
                                  alt={`Proof ${idx + 1}`}
                                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Notes */}
                      {settlement.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: "italic" }}>
                          {settlement.notes}
                        </Typography>
                      )}

                      {/* Recorded by */}
                      <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: "block" }}>
                        Recorded by {settlement.createdByName || "Unknown"} on{" "}
                        {dayjs(settlement.createdAt).format("MMM DD, YYYY h:mm A")}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>

          <Divider />

          {/* Laborer Breakdown (Expandable) */}
          <Accordion
            expanded={laborerExpanded}
            onChange={() => setLaborerExpanded(!laborerExpanded)}
            disableGutters
            elevation={0}
            sx={{
              border: "none",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                px: 2,
                bgcolor: alpha(theme.palette.grey[500], 0.04),
                "&:hover": { bgcolor: alpha(theme.palette.grey[500], 0.08) },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="subtitle2">Laborer Breakdown</Typography>
                <Chip label={week.laborerCount} size="small" variant="outlined" />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
                      <TableCell>Laborer</TableCell>
                      <TableCell align="right">Earned</TableCell>
                      <TableCell align="right">Paid</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell align="center" sx={{ width: 100 }}>
                        Progress
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {week.laborers.map((laborer) => (
                      <TableRow key={laborer.laborerId} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {laborer.laborerName}
                            </Typography>
                            {laborer.laborerRole && (
                              <Typography variant="caption" color="text.secondary">
                                {laborer.laborerRole}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {formatCurrency(laborer.earned)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="success.main">
                            {formatCurrency(laborer.paid)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={laborer.balance > 0 ? "error.main" : "success.main"}
                          >
                            {formatCurrency(laborer.balance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(laborer.progress, 100)}
                            sx={{
                              height: 6,
                              borderRadius: 3,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              "& .MuiLinearProgress-bar": {
                                borderRadius: 3,
                                bgcolor: laborer.progress >= 100 ? "success.main" : "primary.main",
                              },
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        </DialogContent>
      </Dialog>

      {/* Screenshot Viewer */}
      <ScreenshotViewer
        open={screenshotViewerOpen}
        onClose={() => setScreenshotViewerOpen(false)}
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        title="Payment Proof"
      />
    </>
  );
}
