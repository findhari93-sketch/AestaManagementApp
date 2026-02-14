"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Typography,
} from "@mui/material";
import {
  CompareArrows as CompareArrowsIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { formatCurrency } from "@/lib/formatters";
import { useNetSettlement } from "@/hooks/queries/useInterSiteSettlements";
import type { InterSiteBalance } from "@/types/material.types";

interface NetSettlementDialogProps {
  open: boolean;
  onClose: () => void;
  balanceA: InterSiteBalance;
  balanceB: InterSiteBalance;
  groupId: string;
  onSuccess: () => void;
}

export default function NetSettlementDialog({
  open,
  onClose,
  balanceA,
  balanceB,
  groupId,
  onSuccess,
}: NetSettlementDialogProps) {
  const netSettlement = useNetSettlement();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountA = balanceA.total_amount_owed;
  const amountB = balanceB.total_amount_owed;
  const offsetAmount = Math.min(amountA, amountB);
  const netRemaining = Math.round(Math.abs(amountA - amountB) * 100) / 100;

  // Determine which site pays the net remainder
  const largerIsA = amountA > amountB;
  const netPayerName = largerIsA
    ? balanceA.debtor_site_name
    : balanceB.debtor_site_name;
  const netReceiverName = largerIsA
    ? balanceA.creditor_site_name
    : balanceB.creditor_site_name;

  const handleConfirm = async () => {
    setError(null);
    try {
      await netSettlement.mutateAsync({
        siteGroupId: groupId,
        balanceA,
        balanceB,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error("Net settlement failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process net settlement. Please try again."
      );
    }
  };

  const handleClose = () => {
    if (!netSettlement.isPending) {
      setSuccess(false);
      setError(null);
      onClose();
    }
  };

  if (success) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 4,
            }}
          >
            <CheckCircleIcon
              sx={{ fontSize: 64, color: "success.main", mb: 2 }}
            />
            <Typography variant="h6" gutterBottom>
              Net Settlement Complete
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {formatCurrency(offsetAmount)} offset applied.
              {netRemaining > 0
                ? ` ${netPayerName} still owes ${formatCurrency(netRemaining)} to ${netReceiverName}.`
                : " All debts fully settled!"}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CompareArrowsIcon color="primary" />
        Net Settlement
      </DialogTitle>

      <DialogContent dividers>
        {/* Direction A */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            py: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Chip label={balanceA.debtor_site_name} size="small" color="error" variant="outlined" />
          <Typography variant="caption" color="text.secondary">owes</Typography>
          <ArrowForwardIcon fontSize="small" color="action" />
          <Chip label={balanceA.creditor_site_name} size="small" color="success" variant="outlined" />
          <Typography variant="body2" fontWeight={700} sx={{ ml: "auto" }}>
            {formatCurrency(amountA)}
          </Typography>
        </Box>

        {/* Direction B */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            py: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Chip label={balanceB.debtor_site_name} size="small" color="error" variant="outlined" />
          <Typography variant="caption" color="text.secondary">owes</Typography>
          <ArrowForwardIcon fontSize="small" color="action" />
          <Chip label={balanceB.creditor_site_name} size="small" color="success" variant="outlined" />
          <Typography variant="body2" fontWeight={700} sx={{ ml: "auto" }}>
            {formatCurrency(amountB)}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Offset Calculation */}
        <Paper
          sx={{
            p: 2,
            bgcolor: "primary.50",
            border: "1px solid",
            borderColor: "primary.200",
          }}
        >
          <Typography variant="subtitle2" color="primary.main" gutterBottom>
            Offset Calculation
          </Typography>

          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Offset amount (auto-adjusted)
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatCurrency(offsetAmount)}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Net remaining
            </Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              color={netRemaining > 0 ? "warning.main" : "success.main"}
            >
              {netRemaining > 0
                ? formatCurrency(netRemaining)
                : "Fully settled!"}
            </Typography>
          </Box>

          {netRemaining > 0 && (
            <Box
              sx={{
                mt: 1.5,
                pt: 1.5,
                borderTop: "1px dashed",
                borderColor: "primary.200",
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Chip label={netPayerName} size="small" color="warning" />
              <Typography variant="body2">
                pays {formatCurrency(netRemaining)} to
              </Typography>
              <Chip label={netReceiverName} size="small" color="success" variant="outlined" />
            </Box>
          )}
        </Paper>

        {/* What will happen */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>What happens:</strong>
          </Typography>
          <Typography variant="body2" component="div">
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
              <li>Both directions are generated as settlements</li>
              <li>
                {formatCurrency(offsetAmount)} offset applied as adjustment on
                both
              </li>
              {netRemaining > 0 ? (
                <>
                  <li>
                    Smaller settlement ({formatCurrency(Math.min(amountA, amountB))}) fully closed
                  </li>
                  <li>
                    Remaining {formatCurrency(netRemaining)} can be paid later
                    via normal settlement flow
                  </li>
                </>
              ) : (
                <li>Both settlements fully closed (equal amounts)</li>
              )}
            </ul>
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={netSettlement.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={netSettlement.isPending}
          startIcon={
            netSettlement.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <CompareArrowsIcon />
            )
          }
        >
          {netSettlement.isPending ? "Processing..." : "Confirm Net Settlement"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
