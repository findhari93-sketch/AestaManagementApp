"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  CalendarMonth as CalendarIcon,
  Receipt as ReceiptIcon,
  Undo as UndoIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { createClient } from "@/lib/supabase/client";
import { supabaseQueryWithTimeout } from "@/lib/utils/supabaseQuery";
import { useAuth } from "@/contexts/AuthContext";

// Settlement record type (matches ContractPaymentHistoryDialog)
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

interface DeleteContractSettlementDialogProps {
  open: boolean;
  onClose: () => void;
  settlement: SettlementRecord | null;
  onSuccess?: () => void;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function DeleteContractSettlementDialog({
  open,
  onClose,
  settlement,
  onSuccess,
}: DeleteContractSettlementDialogProps) {
  const theme = useTheme();
  const { userProfile } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  const handleDelete = async () => {
    if (!settlement || confirmText !== "DELETE") return;

    setLoading(true);
    setError(null);

    try {
      // 1. Soft delete the settlement_group (mark as cancelled)
      const { error: cancelError } = await (supabase
        .from("settlement_groups") as any)
        .update({
          is_cancelled: true,
          cancelled_at: new Date().toISOString(),
          cancelled_by: userProfile?.name || "Unknown",
          cancelled_by_user_id: userProfile?.id,
          cancellation_reason: reason || "User requested deletion",
        })
        .eq("id", settlement.id);

      if (cancelError) {
        throw cancelError;
      }

      // 2. Get labor_payments for this settlement and clean up
      const { data: payments, error: paymentsError } = await supabaseQueryWithTimeout(
        supabase
          .from("labor_payments")
          .select("id, laborer_id")
          .eq("settlement_group_id", settlement.id)
      );

      if (paymentsError) {
        console.error("Error fetching labor_payments:", paymentsError);
      }

      if (payments && payments.length > 0) {
        // Reset attendance records linked to these payments
        for (const payment of payments) {
          await supabase
            .from("daily_attendance")
            .update({
              is_paid: false,
              payment_date: null,
              payment_id: null,
              settlement_group_id: null,
            })
            .eq("payment_id", payment.id);
        }

        // Delete payment_week_allocations
        const paymentIds = payments.map((p) => p.id);
        await supabase
          .from("payment_week_allocations")
          .delete()
          .in("labor_payment_id", paymentIds);

        // Delete labor_payments
        await supabase
          .from("labor_payments")
          .delete()
          .eq("settlement_group_id", settlement.id);
      }

      onSuccess?.();
      onClose();
      setConfirmText("");
      setReason("");
    } catch (err: any) {
      console.error("Error deleting settlement:", err);
      setError(err.message || "Failed to delete settlement");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    setReason("");
    setError(null);
    onClose();
  };

  if (!settlement) return null;

  const isConfirmValid = confirmText === "DELETE";
  // Excess payments are applied to salary in waterfall calculation, so show as Salary
  const paymentTypeLabel = settlement.paymentType === "advance"
    ? "Advance"
    : settlement.paymentType === "other"
    ? "Other"
    : "Salary";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.error.main, 0.04),
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DeleteIcon color="error" />
          <Typography variant="h6" component="span" color="error.main">
            Delete Settlement
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Warning Alert */}
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            This action cannot be undone!
          </Typography>
          <Typography variant="body2">
            Deleting this settlement will cancel the payment record and reset any linked attendance as unpaid.
          </Typography>
        </Alert>

        {/* Settlement Details */}
        <Box sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.grey[500], 0.05), borderRadius: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <ReceiptIcon fontSize="small" color="primary" />
            <Chip
              label={settlement.settlementReference}
              color="primary"
              variant="outlined"
              sx={{ fontFamily: "monospace" }}
            />
            <Chip
              label={paymentTypeLabel}
              size="small"
              color={settlement.paymentType === "advance" ? "warning" : settlement.paymentType === "other" ? "info" : "success"}
              variant="outlined"
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <CalendarIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {dayjs(settlement.settlementDate).format("ddd, MMM DD, YYYY")}
            </Typography>
          </Box>

          {settlement.laborerCount > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {settlement.laborerCount} laborers affected
            </Typography>
          )}

          <Typography variant="h5" fontWeight={600} color="error.main">
            {formatCurrency(settlement.totalAmount)}
          </Typography>
        </Box>

        {/* Affected Weeks */}
        {settlement.weekAllocations && settlement.weekAllocations.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Affected Weeks
            </Typography>
            <List dense>
              {settlement.weekAllocations.map((alloc, idx) => (
                <ListItem key={idx} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <UndoIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${dayjs(alloc.weekStart).format("MMM D")} - ${dayjs(alloc.weekEnd).format("MMM D, YYYY")}`}
                    secondary={alloc.amount > 0 ? `${formatCurrency(alloc.amount)} will be unmarked as paid` : undefined}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Reason for Deletion */}
        <TextField
          fullWidth
          size="small"
          label="Reason for Deletion (optional)"
          multiline
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you deleting this settlement?"
          sx={{ mb: 3 }}
        />

        {/* Confirmation Input */}
        <Box sx={{ p: 2, bgcolor: alpha(theme.palette.error.main, 0.04), borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Type <strong>DELETE</strong> to confirm:
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder="DELETE"
            error={confirmText.length > 0 && !isConfirmValid}
            sx={{
              "& .MuiOutlinedInput-root": {
                fontFamily: "monospace",
                fontSize: "1.1rem",
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDelete}
          disabled={loading || !isConfirmValid}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
        >
          Delete Settlement
        </Button>
      </DialogActions>
    </Dialog>
  );
}
