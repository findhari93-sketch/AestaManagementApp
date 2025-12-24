"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Edit as EditIcon } from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMode } from "@/types/database.types";
import dayjs from "dayjs";

interface TransactionWithDetails {
  id: string;
  amount: number;
  transaction_date: string;
  payment_mode: string;
  notes: string | null;
  description: string | null;
}

interface TransactionEditDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: TransactionWithDetails | null;
  onSuccess: () => void;
}

export default function TransactionEditDialog({
  open,
  onClose,
  transaction,
  onSuccess,
}: TransactionEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: 0,
    transaction_date: "",
    payment_mode: "cash" as PaymentMode,
    notes: "",
    description: "",
  });

  const supabase = createClient();

  useEffect(() => {
    if (transaction) {
      setForm({
        amount: transaction.amount,
        transaction_date: dayjs(transaction.transaction_date).format("YYYY-MM-DD"),
        payment_mode: transaction.payment_mode as PaymentMode,
        notes: transaction.notes || "",
        description: transaction.description || "",
      });
    }
  }, [transaction]);

  const handleSubmit = async () => {
    if (!transaction) return;

    setLoading(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("site_engineer_transactions")
        .update({
          amount: form.amount,
          transaction_date: form.transaction_date,
          payment_mode: form.payment_mode,
          notes: form.notes || null,
          description: form.description || null,
        })
        .eq("id", transaction.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update transaction");
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <EditIcon color="primary" />
        Edit Transaction
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Amount"
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            fullWidth
            InputProps={{ startAdornment: "Rs." }}
          />
          <TextField
            label="Transaction Date"
            type="date"
            value={form.transaction_date}
            onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth>
            <InputLabel>Payment Mode</InputLabel>
            <Select
              value={form.payment_mode}
              label="Payment Mode"
              onChange={(e) => setForm({ ...form, payment_mode: e.target.value as PaymentMode })}
            >
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="upi">UPI</MenuItem>
              <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
              <MenuItem value="cheque">Cheque</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            fullWidth
            multiline
            rows={2}
          />
          <TextField
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            fullWidth
            multiline
            rows={2}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || form.amount <= 0}
          startIcon={loading ? <CircularProgress size={16} /> : <EditIcon />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
