"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useExtendRentalReturnDate } from "@/hooks/queries/useRentals";

interface DateExtensionDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  currentExpectedReturnDate: string;
}

export function DateExtensionDialog({
  open,
  onClose,
  orderId,
  orderNumber,
  currentExpectedReturnDate,
}: DateExtensionDialogProps) {
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const extendDate = useExtendRentalReturnDate();

  const currentFormatted = new Date(currentExpectedReturnDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isValid = newDate && reason.trim().length >= 5 && newDate > currentExpectedReturnDate;

  const handleSubmit = async () => {
    if (!isValid) return;
    await extendDate.mutateAsync({ orderId, newExpectedReturnDate: newDate, reason });
    onClose();
    setNewDate("");
    setReason("");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Extend Return Date — {orderNumber}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Current expected return
          </Typography>
          <Typography variant="body2" fontWeight={600} color="error.main">
            {currentFormatted}
          </Typography>
        </Box>

        <TextField
          label="New expected return date"
          type="date"
          fullWidth
          size="small"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          inputProps={{ min: currentExpectedReturnDate }}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2 }}
        />

        <TextField
          label="Reason for extension"
          multiline
          rows={2}
          fullWidth
          size="small"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Slab curing delayed by rain"
          helperText="Minimum 5 characters required"
        />

        {newDate && reason.trim().length >= 5 && (
          <Alert severity="info" sx={{ mt: 1.5, fontSize: 12 }}>
            Expected remaining cost will recalculate after extension.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={handleSubmit}
          disabled={!isValid || extendDate.isPending}
          size="small"
        >
          Extend Date
        </Button>
      </DialogActions>
    </Dialog>
  );
}
