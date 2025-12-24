"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  TextField,
  CircularProgress,
} from "@mui/material";
import { Delete as DeleteIcon, Warning as WarningIcon } from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import dayjs from "dayjs";

interface TransactionWithDetails {
  id: string;
  amount: number;
  transaction_date: string;
  transaction_type: string;
  user_name?: string;
  site_name?: string;
  description: string | null;
}

interface TransactionDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: TransactionWithDetails | null;
  onSuccess: () => void;
}

export default function TransactionDeleteDialog({
  open,
  onClose,
  transaction,
  onSuccess,
}: TransactionDeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  const supabase = createClient();

  const handleDelete = async () => {
    if (!transaction) return;

    setLoading(true);
    setError("");

    try {
      // Step 1: Delete batch usage records (these have CASCADE, but explicit is safer)
      const { error: batchErr } = await supabase
        .from("engineer_wallet_batch_usage")
        .delete()
        .eq("transaction_id", transaction.id);
      if (batchErr) console.warn("Batch usage delete:", batchErr.message);

      // Step 2: Unlink related records - use RPC for bulk updates to bypass potential RLS issues
      // These may fail silently if no records exist, which is fine
      const unlinkQueries = [
        supabase.from("daily_attendance").update({ engineer_transaction_id: null }).eq("engineer_transaction_id", transaction.id),
        supabase.from("market_laborer_attendance").update({ engineer_transaction_id: null }).eq("engineer_transaction_id", transaction.id),
        supabase.from("expenses").update({ engineer_transaction_id: null }).eq("engineer_transaction_id", transaction.id),
        supabase.from("local_purchases").update({ reimbursement_transaction_id: null }).eq("reimbursement_transaction_id", transaction.id),
        supabase.from("settlement_groups").update({ engineer_transaction_id: null }).eq("engineer_transaction_id", transaction.id),
      ];

      // Run unlink queries in parallel, ignore errors (they may have no matching rows)
      await Promise.allSettled(unlinkQueries);

      // Step 3: Delete the transaction
      const { error: deleteError, data } = await supabase
        .from("site_engineer_transactions")
        .delete()
        .eq("id", transaction.id)
        .select();

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw new Error(deleteError.message || "Failed to delete transaction");
      }

      if (!data || data.length === 0) {
        throw new Error("Transaction not found or already deleted");
      }

      // Success - close and refresh
      onSuccess();
      onClose();
      setReason("");
    } catch (err: any) {
      console.error("Delete transaction error:", err);
      setError(err.message || "Failed to delete transaction. It may have related records.");
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "error.main" }}>
        <WarningIcon />
        Delete Transaction
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Alert severity="warning" sx={{ mb: 2 }}>
          This action will permanently delete the transaction. This cannot be undone.
        </Alert>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" fontWeight={600}>
            Are you sure you want to delete this transaction?
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Date: {dayjs(transaction.transaction_date).format("DD MMM YYYY")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Engineer: {transaction.user_name || "-"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Site: {transaction.site_name || "-"}
            </Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>
              Amount: Rs.{transaction.amount.toLocaleString()}
            </Typography>
            {transaction.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {transaction.description}
              </Typography>
            )}
          </Box>
        </Box>
        <TextField
          label="Reason for deletion (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          multiline
          rows={2}
          placeholder="Enter reason for deleting this transaction..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon />}
        >
          Delete Transaction
        </Button>
      </DialogActions>
    </Dialog>
  );
}
