"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Receipt as ReceiptIcon,
  Image as ImageIcon,
  Payment as PaymentIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import dayjs from "dayjs";
import { getDateWiseSettlements } from "@/lib/services/settlementService";
import { getPayerSourceLabel } from "@/components/settlement/PayerSourceSelector";
import type { DateWiseSettlement, PaymentMode, PaymentStatus } from "@/types/payment.types";
import type { PayerSource } from "@/types/settlement.types";
import ScreenshotViewer from "@/components/common/ScreenshotViewer";

// Week data type (matching ContractWeeklyPaymentsTab)
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
  settlementReferences: string[];
  paymentDates: string[];
}

interface DateTransactionDetailPanelProps {
  week: WeekRowData;
  onViewRef?: (ref: string) => void;
  onOpenSettlementDetails?: (settlement: DateWiseSettlement) => void;
}

// Format currency
function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  return `₹${amount.toLocaleString()}`;
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

export default function DateTransactionDetailPanel({
  week,
  onViewRef,
  onOpenSettlementDetails,
}: DateTransactionDetailPanelProps) {
  const theme = useTheme();
  const { selectedSite } = useSite();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<DateWiseSettlement[]>([]);
  const [screenshotViewerOpen, setScreenshotViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);

  // Fetch settlements for this week
  const fetchSettlements = useCallback(async () => {
    if (!selectedSite?.id || !week) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Pass contractOnly=true to only show contract laborer settlements
      const { settlements: data } = await getDateWiseSettlements(
        supabase,
        selectedSite.id,
        week.weekStart,
        week.weekEnd,
        true // contractOnly - filter to only contract laborer settlements
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
        subcontractId: s.subcontractId || null,
        subcontractTitle: null,
        createdBy: s.createdBy || "",
        createdByName: s.createdBy,
        createdAt: s.createdAt,
        isCancelled: false,
      }));

      // Sort by date (newest first)
      mapped.sort((a, b) =>
        new Date(b.settlementDate).getTime() - new Date(a.settlementDate).getTime()
      );

      setSettlements(mapped);
    } catch (err) {
      console.error("Error fetching settlements:", err);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSite?.id, week, supabase]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleOpenScreenshotViewer = (images: string[]) => {
    setViewerImages(images);
    setScreenshotViewerOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Transactions
        </Typography>
        <Skeleton variant="rounded" height={100} />
      </Box>
    );
  }

  if (settlements.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <PaymentIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No transactions recorded for this week
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ReceiptIcon fontSize="small" color="primary" />
        Transactions ({settlements.length})
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableCell>Date</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Ref Code</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Proof</TableCell>
              <TableCell>Recorded By</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {settlements.map((settlement) => (
              <TableRow
                key={settlement.settlementGroupId}
                sx={{
                  "&:hover": {
                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                  },
                  cursor: onOpenSettlementDetails ? "pointer" : undefined,
                }}
                onClick={() => onOpenSettlementDetails?.(settlement)}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {dayjs(settlement.settlementDate).format("MMM D")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(settlement.settlementDate).format("ddd")}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {formatCurrency(settlement.totalAmount)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={settlement.settlementReference}
                    size="small"
                    color="primary"
                    variant="outlined"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewRef?.(settlement.settlementReference);
                    }}
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "0.7rem",
                      cursor: "pointer",
                      "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {getPaymentModeLabel(settlement.paymentMode)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {settlement.payerSource ? (
                    <Typography variant="body2" color="text.secondary">
                      {getPayerSourceLabel(settlement.payerSource as PayerSource)}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {settlement.proofUrls && settlement.proofUrls.length > 0 ? (
                    <Tooltip title="View payment proof">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenScreenshotViewer(settlement.proofUrls);
                        }}
                        sx={{ color: "primary.main" }}
                      >
                        <ImageIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" color="text.disabled">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 100 }}>
                    {settlement.createdByName || settlement.createdBy || "-"}
                  </Typography>
                </TableCell>
                <TableCell>
                  {settlement.notes ? (
                    <Tooltip title={settlement.notes}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        noWrap
                        sx={{ maxWidth: 120, cursor: "help" }}
                      >
                        {settlement.notes}
                      </Typography>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" color="text.disabled">-</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Screenshot Viewer */}
      <ScreenshotViewer
        open={screenshotViewerOpen}
        onClose={() => setScreenshotViewerOpen(false)}
        images={viewerImages}
        title="Payment Proof"
      />
    </Box>
  );
}
