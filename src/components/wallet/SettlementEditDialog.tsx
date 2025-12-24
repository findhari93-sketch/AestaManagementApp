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
import type { UnifiedSettlementRecord } from "@/types/wallet.types";
import type { PaymentMode } from "@/types/database.types";
import dayjs from "dayjs";

interface SettlementEditDialogProps {
  open: boolean;
  onClose: () => void;
  settlement: UnifiedSettlementRecord | null;
  onSuccess: () => void;
}

export default function SettlementEditDialog({
  open,
  onClose,
  settlement,
  onSuccess,
}: SettlementEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    total_amount: 0,
    settlement_date: "",
    payment_mode: "cash" as PaymentMode,
    notes: "",
  });

  const supabase = createClient();

  useEffect(() => {
    if (settlement) {
      setForm({
        total_amount: settlement.total_amount,
        settlement_date: dayjs(settlement.settlement_date).format("YYYY-MM-DD"),
        payment_mode: (settlement.payment_mode || "cash") as PaymentMode,
        notes: settlement.notes || "",
      });
    }
  }, [settlement]);

  const handleSubmit = async () => {
    if (!settlement) return;

    setLoading(true);
    setError("");

    try {
      if (settlement.source === "legacy") {
        // Update legacy settlement table
        const { error: updateError } = await supabase
          .from("site_engineer_settlements")
          .update({
            amount: form.total_amount,
            settlement_date: form.settlement_date,
            payment_mode: form.payment_mode,
            notes: form.notes || null,
          })
          .eq("id", settlement.id);

        if (updateError) throw updateError;
      } else {
        // Update settlement_groups table
        const { error: updateError } = await supabase
          .from("settlement_groups")
          .update({
            total_amount: form.total_amount,
            settlement_date: form.settlement_date,
            payment_mode: form.payment_mode,
            notes: form.notes || null,
          })
          .eq("id", settlement.id);

        if (updateError) throw updateError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update settlement");
    } finally {
      setLoading(false);
    }
  };

  if (!settlement) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <EditIcon color="primary" />
        Edit Settlement
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {settlement.source === "settlement_group" && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Editing a settlement group. This will update the master record.
          </Alert>
        )}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Amount"
            type="number"
            value={form.total_amount}
            onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) })}
            fullWidth
            InputProps={{ startAdornment: "Rs." }}
          />
          <TextField
            label="Settlement Date"
            type="date"
            value={form.settlement_date}
            onChange={(e) => setForm({ ...form, settlement_date: e.target.value })}
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
          disabled={loading || form.total_amount <= 0}
          startIcon={loading ? <CircularProgress size={16} /> : <EditIcon />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
