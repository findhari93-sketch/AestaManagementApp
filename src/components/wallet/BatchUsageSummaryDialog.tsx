"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
} from "@mui/material";
import {
  AccountBalanceWallet as WalletIcon,
  TrendingDown as SpentIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { getPayerSourceLabel } from "@/components/settlement/PayerSourceSelector";
import dayjs from "dayjs";

interface SettlementUsage {
  settlement_reference: string;
  settlement_date: string;
  amount_used: number;
  laborer_count: number;
  site_name: string;
  payment_channel: string;
}

interface BatchUsageSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  batchId: string | null;
  batchCode: string;
  originalAmount: number;
  remainingBalance: number;
  payerSource?: string | null;
  payerName?: string | null;
  transactionDate?: string;
}

export default function BatchUsageSummaryDialog({
  open,
  onClose,
  batchId,
  batchCode,
  originalAmount,
  remainingBalance,
  payerSource,
  payerName,
  transactionDate,
}: BatchUsageSummaryDialogProps) {
  const [settlements, setSettlements] = useState<SettlementUsage[]>([]);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (open && batchId) {
      fetchSettlements();
    } else {
      setSettlements([]);
    }
  }, [open, batchId]);

  const fetchSettlements = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      // Use any cast since the RPC function is defined in migration but not in generated types yet
      const { data, error } = await (supabase.rpc as any)("get_batch_settlement_summary", {
        batch_id: batchId,
      });
      if (error) throw error;
      setSettlements((data as SettlementUsage[]) || []);
    } catch (err) {
      console.error("Error fetching batch settlements:", err);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  };

  const amountSpent = originalAmount - remainingBalance;
  const usagePercentage = originalAmount > 0 ? (amountSpent / originalAmount) * 100 : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <WalletIcon color="primary" />
        Batch Usage Summary
        <Chip
          label={batchCode}
          size="small"
          color="primary"
          sx={{ ml: 1, fontFamily: "monospace" }}
        />
      </DialogTitle>
      <DialogContent dividers>
        {/* Batch Overview */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", gap: 4, mb: 2, flexWrap: "wrap" }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Original Amount
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                Rs.{originalAmount.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Amount Spent
              </Typography>
              <Typography variant="h6" fontWeight={600} color="error.main">
                Rs.{amountSpent.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Remaining Balance
              </Typography>
              <Typography variant="h6" fontWeight={600} color="success.main">
                Rs.{remainingBalance.toLocaleString()}
              </Typography>
            </Box>
          </Box>

          {/* Progress bar */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Usage
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {usagePercentage.toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={usagePercentage}
              sx={{ height: 8, borderRadius: 4 }}
              color={usagePercentage >= 100 ? "error" : usagePercentage >= 75 ? "warning" : "primary"}
            />
          </Box>

          {/* Source info */}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {payerSource && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Money Source
                </Typography>
                <Typography variant="body2">
                  {getPayerSourceLabel(payerSource as import("@/types/settlement.types").PayerSource)}
                  {payerName && ` (${payerName})`}
                </Typography>
              </Box>
            )}
            {transactionDate && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Deposit Date
                </Typography>
                <Typography variant="body2">
                  {dayjs(transactionDate).format("DD MMM YYYY")}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Settlements that used this batch */}
        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <SpentIcon color="error" />
            Settlements Using This Batch
            {settlements.length > 0 && (
              <Chip label={settlements.length} size="small" color="default" />
            )}
          </Typography>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : settlements.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Settlement Ref</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Site</TableCell>
                    <TableCell>Laborers</TableCell>
                    <TableCell align="right">Amount Used</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {settlements.map((settlement, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Chip
                          label={settlement.settlement_reference}
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ fontFamily: "monospace" }}
                        />
                      </TableCell>
                      <TableCell>
                        {dayjs(settlement.settlement_date).format("DD MMM YYYY")}
                      </TableCell>
                      <TableCell>{settlement.site_name}</TableCell>
                      <TableCell>{settlement.laborer_count}</TableCell>
                      <TableCell align="right">
                        Rs.{settlement.amount_used.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell colSpan={4}>
                      <Typography fontWeight={600}>Total</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={600}>
                        Rs.{settlements.reduce((sum, s) => sum + s.amount_used, 0).toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: "center", bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                This batch has not been used in any settlements yet.
              </Typography>
              <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                Full balance of Rs.{remainingBalance.toLocaleString()} is available.
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
