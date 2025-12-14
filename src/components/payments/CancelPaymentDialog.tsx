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
import {
  Warning as WarningIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import type { DailyPaymentRecord } from "@/types/payment.types";

interface CancelPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  record: DailyPaymentRecord | null;
  engineerName?: string;
  onConfirm: (reason?: string) => Promise<void>;
}

export default function CancelPaymentDialog({
  open,
  onClose,
  record,
  engineerName,
  onConfirm,
}: CancelPaymentDialogProps) {
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);

    try {
      await onConfirm(reason.trim() || undefined);
      setReason("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to cancel payment");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setReason("");
      setError(null);
      onClose();
    }
  };

  if (!record) return null;

  const formatCurrency = (amount: number) => `Rs.${amount.toLocaleString()}`;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CancelIcon color="error" />
          <Typography variant="h6">
            {engineerName ? "Cancel Payment to Engineer" : "Cancel Payment"}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          This payment will be cancelled and the attendance record will return
          to &quot;Pending&quot; status.
        </Alert>

        {/* Payment Details */}
        <Box
          sx={{
            p: 2,
            bgcolor: "action.hover",
            borderRadius: 1,
            mb: 3,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Payment Details
          </Typography>

          <Box sx={{ display: "grid", gap: 1.5, mt: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Date:
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {dayjs(record.date).format("DD MMM YYYY")}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Amount:
              </Typography>
              <Typography variant="body2" fontWeight={600} color="error.main">
                {formatCurrency(record.amount)}
              </Typography>
            </Box>

            {engineerName && (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  Engineer:
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {engineerName}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Laborer:
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {record.laborerName}
                {record.count && record.count > 1 ? ` (${record.count} ppl)` : ""}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Type:
              </Typography>
              <Typography variant="body2">
                {record.laborerType === "market" ? "Market Labor" : "Daily Labor"}
              </Typography>
            </Box>

            {record.paidVia && (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  Payment Method:
                </Typography>
                <Typography variant="body2">
                  {record.paidVia === "direct" ? "Direct Payment" : "Via Engineer"}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Reason Input */}
        <TextField
          fullWidth
          multiline
          rows={2}
          label="Reason for Cancellation (Optional)"
          placeholder="e.g., Wrong engineer selected, duplicate payment, etc."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={processing}
        />

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          The record will return to Pending status and can be settled again.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={processing}>
          Keep Payment
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={processing}
          startIcon={processing ? <CircularProgress size={20} /> : <CancelIcon />}
        >
          {processing ? "Cancelling..." : "Cancel This Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
