"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import { Delete as DeleteIcon, Warning as WarningIcon } from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cancelContractPayment } from "@/lib/services/settlementService";
import dayjs from "dayjs";
import type { PaymentDetails } from "@/types/payment.types";

interface ContractPaymentDeleteDialogProps {
  open: boolean;
  paymentDetails: PaymentDetails | null;
  onClose: () => void;
  onSuccess?: () => void;
}

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

export default function ContractPaymentDeleteDialog({
  open,
  paymentDetails,
  onClose,
  onSuccess,
}: ContractPaymentDeleteDialogProps) {
  const { userProfile } = useAuth();
  const supabase = createClient();

  // Form state
  const [reason, setReason] = useState("");

  // UI state
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!paymentDetails || !userProfile) return;

    if (!reason.trim()) {
      setError("Please provide a reason for cancellation");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await cancelContractPayment(
        supabase,
        paymentDetails.paymentId,
        reason.trim(),
        userProfile.id,
        userProfile.name || "Unknown"
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to cancel payment");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Cancel payment error:", err);
      setError(err.message || "Failed to cancel payment");
    } finally {
      setProcessing(false);
    }
  };

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  if (!paymentDetails) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningIcon color="error" />
          <Typography variant="h6" component="span">Cancel Payment</Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="warning" sx={{ mb: 3 }}>
          This action will cancel the payment and reverse any week allocations.
          The payment record will be marked as cancelled but not deleted.
        </Alert>

        {/* Payment Summary */}
        <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Payment Reference
          </Typography>
          <Typography variant="subtitle1" fontFamily="monospace" fontWeight={500}>
            {paymentDetails.paymentReference}
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Laborer
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {paymentDetails.laborerName}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Amount
              </Typography>
              <Typography variant="body2" fontWeight={600} color="error.main">
                Rs.{paymentDetails.amount.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Type
              </Typography>
              <Typography variant="body2">
                {getPaymentTypeLabel(paymentDetails.paymentType)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Date
              </Typography>
              <Typography variant="body2">
                {dayjs(paymentDetails.actualPaymentDate).format("MMM D, YYYY")}
              </Typography>
            </Box>
          </Box>

          {paymentDetails.paymentType === "salary" && paymentDetails.weeksCovered.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Week Allocations to be Reversed
              </Typography>
              {paymentDetails.weeksCovered.map((week, idx) => (
                <Typography key={idx} variant="body2" sx={{ ml: 1 }}>
                  {dayjs(week.weekStart).format("MMM D")} - {dayjs(week.weekEnd).format("MMM D")}:
                  Rs.{week.allocatedAmount.toLocaleString()}
                </Typography>
              ))}
            </>
          )}
        </Box>

        {/* Reason Input */}
        <TextField
          fullWidth
          required
          label="Reason for Cancellation"
          placeholder="Why is this payment being cancelled?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          multiline
          rows={3}
          error={!reason.trim() && processing}
          helperText="This reason will be recorded for audit purposes"
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={processing}>
          Keep Payment
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDelete}
          disabled={processing || !reason.trim()}
          startIcon={processing ? <CircularProgress size={20} /> : <DeleteIcon />}
        >
          {processing ? "Cancelling..." : "Cancel Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
