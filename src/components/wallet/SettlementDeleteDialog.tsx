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
import { useAuth } from "@/contexts/AuthContext";
import type { UnifiedSettlementRecord } from "@/types/wallet.types";
import dayjs from "dayjs";

interface SettlementDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  settlement: UnifiedSettlementRecord | null;
  onSuccess: () => void;
}

export default function SettlementDeleteDialog({
  open,
  onClose,
  settlement,
  onSuccess,
}: SettlementDeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const { userProfile } = useAuth();

  const supabase = createClient();

  const handleDelete = async () => {
    if (!settlement) return;

    setLoading(true);
    setError("");

    try {
      if (settlement.source === "legacy") {
        // Soft delete legacy settlement - add is_deleted column if not exists
        // For now, we'll delete the record (legacy doesn't have soft-delete)
        const { error: deleteError } = await supabase
          .from("site_engineer_settlements")
          .delete()
          .eq("id", settlement.id);

        if (deleteError) throw deleteError;
      } else {
        // Cancel settlement_group (soft delete)
        const { error: updateError } = await supabase
          .from("settlement_groups")
          .update({
            is_cancelled: true,
            cancelled_at: new Date().toISOString(),
            cancelled_by: userProfile?.name || "Unknown",
            cancelled_by_user_id: userProfile?.id || null,
            cancellation_reason: reason || "Cancelled by user",
          })
          .eq("id", settlement.id);

        if (updateError) throw updateError;
      }

      onSuccess();
      onClose();
      setReason("");
    } catch (err: any) {
      setError(err.message || "Failed to delete settlement");
    } finally {
      setLoading(false);
    }
  };

  if (!settlement) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "error.main" }}>
        <WarningIcon />
        {settlement.source === "legacy" ? "Delete" : "Cancel"} Settlement
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Alert severity="warning" sx={{ mb: 2 }}>
          {settlement.source === "legacy"
            ? "This action will permanently delete the legacy settlement record."
            : "This action will cancel the settlement. The record will be preserved for audit purposes."}
        </Alert>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" fontWeight={600}>
            Are you sure you want to {settlement.source === "legacy" ? "delete" : "cancel"} this settlement?
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
            {settlement.settlement_reference && (
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Reference: {settlement.settlement_reference}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Date: {dayjs(settlement.settlement_date).format("DD MMM YYYY")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Site: {settlement.site_name || "-"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Engineer: {settlement.engineer_name || "-"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Laborers: {settlement.laborer_count || 0}
            </Typography>
            <Typography variant="h6" sx={{ mt: 1 }} color="error">
              Amount: Rs.{settlement.total_amount.toLocaleString()}
            </Typography>
          </Box>
        </Box>
        <TextField
          label={`Reason for ${settlement.source === "legacy" ? "deletion" : "cancellation"} (optional)`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          multiline
          rows={2}
          placeholder={`Enter reason for ${settlement.source === "legacy" ? "deleting" : "cancelling"} this settlement...`}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Keep Settlement
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon />}
        >
          {settlement.source === "legacy" ? "Delete" : "Cancel"} Settlement
        </Button>
      </DialogActions>
    </Dialog>
  );
}
