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
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from "@mui/material";
import {
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import type { DailyPaymentRecord } from "@/types/payment.types";
import dayjs from "dayjs";

interface DateCancelDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  records: DailyPaymentRecord[];
  onSuccess: () => void;
}

export default function DateCancelDialog({
  open,
  onClose,
  date,
  records,
  onSuccess,
}: DateCancelDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
  const dailyRecords = records.filter((r) => r.sourceType === "daily");
  const marketRecords = records.filter((r) => r.sourceType === "market");

  const handleSubmit = async () => {
    if (!selectedSite?.id || !userProfile) return;

    setProcessing(true);
    setError(null);

    try {
      // Get IDs
      const dailyIds = dailyRecords.map((r) => r.sourceId);
      const marketIds = marketRecords.map((r) => r.sourceId);

      // Collect unique engineer transaction IDs
      const engineerTxIds = new Set<string>();
      records.forEach((r) => {
        if (r.engineerTransactionId) {
          engineerTxIds.add(r.engineerTransactionId);
        }
      });

      // Reset daily attendance records
      if (dailyIds.length > 0) {
        const { error: dailyError } = await supabase
          .from("daily_attendance")
          .update({
            is_paid: false,
            payment_date: null,
            payment_mode: null,
            paid_via: null,
            engineer_transaction_id: null,
            payment_proof_url: null,
            subcontract_id: null,
            payer_source: null,
            payer_name: null,
            expense_id: null,
          })
          .in("id", dailyIds);

        if (dailyError) throw dailyError;
      }

      // Reset market attendance records
      if (marketIds.length > 0) {
        const { error: marketError } = await supabase
          .from("market_laborer_attendance")
          .update({
            is_paid: false,
            payment_date: null,
            payment_mode: null,
            paid_via: null,
            engineer_transaction_id: null,
            payment_proof_url: null,
            payer_source: null,
            payer_name: null,
            expense_id: null,
          })
          .in("id", marketIds);

        if (marketError) throw marketError;
      }

      // Handle engineer transactions
      for (const txId of engineerTxIds) {
        // Check remaining linked records
        const { count: remainingDaily } = await supabase
          .from("daily_attendance")
          .select("*", { count: "exact", head: true })
          .eq("engineer_transaction_id", txId);

        const { count: remainingMarket } = await supabase
          .from("market_laborer_attendance")
          .select("*", { count: "exact", head: true })
          .eq("engineer_transaction_id", txId);

        const totalRemaining = (remainingDaily || 0) + (remainingMarket || 0);

        // If no remaining records, mark transaction as cancelled
        if (totalRemaining === 0) {
          await supabase
            .from("site_engineer_transactions")
            .update({
              settlement_status: "cancelled",
              cancelled_at: new Date().toISOString(),
              cancelled_by: userProfile.name,
              cancelled_by_user_id: userProfile.id,
              cancellation_reason: reason || "Bulk cancel from payments page",
            })
            .eq("id", txId);
        }
      }

      // DELETE linked expenses when payment is cancelled
      // If salary is not paid, no expense should exist
      const expenseIds = records
        .filter((r) => r.expenseId)
        .map((r) => r.expenseId!);

      if (expenseIds.length > 0) {
        await supabase
          .from("expenses")
          .delete()
          .in("id", expenseIds);
      }

      // Also delete expenses linked by engineer transaction ID
      for (const txId of engineerTxIds) {
        await supabase
          .from("expenses")
          .delete()
          .eq("engineer_transaction_id", txId);
      }

      // Fallback: Delete salary settlement expenses by date and site that might not be linked
      // This handles old data that was created before the linking was implemented
      if (date && selectedSite?.id) {
        await supabase
          .from("expenses")
          .delete()
          .eq("site_id", selectedSite.id)
          .eq("date", date)
          .ilike("description", "%Salary Settlement%");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error cancelling payments:", err);
      setError(err.message || "Failed to cancel payments");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CancelIcon color="warning" />
        <Box>
          <Typography variant="h6">Cancel Payments</Typography>
          <Typography variant="caption" color="text.secondary">
            {dayjs(date).format("dddd, MMM D, YYYY")}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            This will reset all selected payments to pending status. This action
            cannot be undone.
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Payments to Cancel:
          </Typography>
          <List dense>
            {dailyRecords.length > 0 && (
              <ListItem>
                <ListItemIcon>
                  <PersonIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={`${dailyRecords.length} Daily Laborers`}
                  secondary={`Rs.${dailyRecords.reduce((s, r) => s + r.amount, 0).toLocaleString("en-IN")}`}
                />
              </ListItem>
            )}
            {marketRecords.length > 0 && (
              <ListItem>
                <ListItemIcon>
                  <GroupsIcon color="secondary" />
                </ListItemIcon>
                <ListItemText
                  primary={`${marketRecords.length} Market Labor entries`}
                  secondary={`Rs.${marketRecords.reduce((s, r) => s + r.amount, 0).toLocaleString("en-IN")}`}
                />
              </ListItem>
            )}
          </List>

          <Box
            sx={{
              p: 2,
              bgcolor: "error.lighter",
              borderRadius: 1,
              mt: 2,
            }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Total: Rs.{totalAmount.toLocaleString("en-IN")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {records.length} payment(s) will be reset to pending
            </Typography>
          </Box>
        </Box>

        <TextField
          fullWidth
          multiline
          rows={2}
          label="Cancellation Reason (Optional)"
          placeholder="Why are you cancelling these payments?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{ mt: 2 }}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={processing}>
          Keep Payments
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSubmit}
          disabled={processing || records.length === 0}
          startIcon={processing ? <CircularProgress size={20} /> : <CancelIcon />}
        >
          {processing ? "Cancelling..." : "Cancel All"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
