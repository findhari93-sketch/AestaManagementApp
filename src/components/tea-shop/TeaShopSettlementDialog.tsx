"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Radio,
  RadioGroup,
  Paper,
  Divider,
  Checkbox,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import type { TeaShopAccount, TeaShopEntry, TeaShopSettlement, PaymentMode, Subcontract } from "@/types/database.types";
import dayjs from "dayjs";

interface TeaShopSettlementDialogProps {
  open: boolean;
  onClose: () => void;
  shop: TeaShopAccount;
  pendingBalance: number;
  entries: TeaShopEntry[];
  onSuccess?: () => void;
  settlement?: TeaShopSettlement | null; // For edit mode
}

interface SiteEngineer {
  id: string;
  name: string;
}

interface SubcontractOption {
  id: string;
  title: string;
  team_name?: string;
}

export default function TeaShopSettlementDialog({
  open,
  onClose,
  shop,
  pendingBalance,
  entries,
  onSuccess,
  settlement,
}: TeaShopSettlementDialogProps) {
  const isEditMode = !!settlement;
  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [periodStart, setPeriodStart] = useState(dayjs().subtract(7, "days").format("YYYY-MM-DD"));
  const [periodEnd, setPeriodEnd] = useState(dayjs().format("YYYY-MM-DD"));
  const [amountPaying, setAmountPaying] = useState(pendingBalance);
  const [paymentDate, setPaymentDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [payerType, setPayerType] = useState<"site_engineer" | "company_direct">("company_direct");
  const [selectedEngineerId, setSelectedEngineerId] = useState("");
  const [createWalletTransaction, setCreateWalletTransaction] = useState(true);
  const [notes, setNotes] = useState("");

  // Site engineers list
  const [engineers, setEngineers] = useState<SiteEngineer[]>([]);

  // Subcontracts for linking
  const [subcontracts, setSubcontracts] = useState<SubcontractOption[]>([]);
  const [selectedSubcontractId, setSelectedSubcontractId] = useState<string>("");

  useEffect(() => {
    if (open) {
      // Fetch site engineers and subcontracts
      fetchEngineers();
      fetchSubcontracts();

      if (isEditMode && settlement) {
        // Edit mode - populate from settlement
        setPeriodStart(settlement.period_start);
        setPeriodEnd(settlement.period_end);
        setAmountPaying(settlement.amount_paid);
        setPaymentDate(settlement.payment_date);
        setPaymentMode(settlement.payment_mode);
        setPayerType(settlement.payer_type);
        setSelectedEngineerId(settlement.site_engineer_id || "");
        setCreateWalletTransaction(false); // Don't create new transaction when editing
        setNotes(settlement.notes || "");
        setSelectedSubcontractId(settlement.subcontract_id || "");
      } else {
        // New settlement - reset form
        setPeriodStart(dayjs().subtract(7, "days").format("YYYY-MM-DD"));
        setPeriodEnd(dayjs().format("YYYY-MM-DD"));
        setAmountPaying(pendingBalance);
        setPaymentDate(dayjs().format("YYYY-MM-DD"));
        setPaymentMode("cash");
        setPayerType("company_direct");
        setSelectedEngineerId("");
        setCreateWalletTransaction(true);
        setNotes("");
        setSelectedSubcontractId("");
      }
      setError(null);
    }
  }, [open, pendingBalance, settlement, isEditMode]);

  const fetchEngineers = async () => {
    if (!selectedSite) return;

    try {
      // Get users who have site_engineer role or are assigned to this site
      const { data } = await supabase
        .from("users")
        .select("id, name")
        .in("role", ["site_engineer", "admin", "office"]);

      setEngineers(data || []);
    } catch (err) {
      console.error("Error fetching engineers:", err);
    }
  };

  const fetchSubcontracts = async () => {
    if (!selectedSite) return;

    try {
      const { data } = await supabase
        .from("subcontracts")
        .select("id, title, teams(name)")
        .eq("site_id", selectedSite.id)
        .in("status", ["draft", "active"]);

      const options: SubcontractOption[] = (data || []).map((sc: any) => ({
        id: sc.id,
        title: sc.title,
        team_name: sc.teams?.name,
      }));
      setSubcontracts(options);
    } catch (err) {
      console.error("Error fetching subcontracts:", err);
    }
  };

  // Calculate entries total for the period
  const entriesInPeriod = useMemo(() => {
    return entries.filter(
      (e) => e.date >= periodStart && e.date <= periodEnd
    );
  }, [entries, periodStart, periodEnd]);

  const entriesTotalInPeriod = useMemo(() => {
    return entriesInPeriod.reduce((sum, e) => sum + e.total_amount, 0);
  }, [entriesInPeriod]);

  const previousBalance = pendingBalance - entriesTotalInPeriod;
  const totalDue = pendingBalance;
  const balanceRemaining = Math.max(0, totalDue - amountPaying);

  const handleSave = async () => {
    if (amountPaying <= 0) {
      setError("Please enter amount to pay");
      return;
    }

    if (payerType === "site_engineer" && !selectedEngineerId) {
      setError("Please select a site engineer");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let engineerTransactionId: string | null = null;

      // If site engineer is paying, create wallet transaction
      if (payerType === "site_engineer" && createWalletTransaction) {
        const transactionData = {
          user_id: selectedEngineerId,
          site_id: selectedSite?.id,
          transaction_type: "spent_on_behalf",
          amount: amountPaying,
          transaction_date: paymentDate,
          description: `Tea shop payment - ${shop.shop_name}`,
          recipient_type: "vendor",
          recipient_name: shop.shop_name,
          payment_mode: paymentMode,
          is_settled: false,
          recorded_by: userProfile?.name || null,
          recorded_by_user_id: userProfile?.id || null,
        };

        const { data: txData, error: txError } = await (supabase
          .from("site_engineer_transactions") as any)
          .insert(transactionData)
          .select()
          .single();

        if (txError) throw txError;
        engineerTransactionId = txData?.id || null;
      }

      // Settlement record data
      const settlementData = {
        tea_shop_id: shop.id,
        period_start: periodStart,
        period_end: periodEnd,
        entries_total: entriesTotalInPeriod,
        previous_balance: previousBalance > 0 ? previousBalance : 0,
        total_due: totalDue,
        amount_paid: amountPaying,
        balance_remaining: balanceRemaining,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        payer_type: payerType,
        site_engineer_id: payerType === "site_engineer" ? selectedEngineerId : null,
        site_engineer_transaction_id: isEditMode ? settlement?.site_engineer_transaction_id : engineerTransactionId,
        is_engineer_settled: isEditMode ? settlement?.is_engineer_settled : false,
        status: balanceRemaining > 0 ? "partial" : "completed",
        notes: notes.trim() || null,
        recorded_by: userProfile?.name || null,
        recorded_by_user_id: userProfile?.id || null,
        subcontract_id: selectedSubcontractId || null,
      };

      if (isEditMode && settlement) {
        // Update existing settlement
        const { error: settlementError } = await (supabase
          .from("tea_shop_settlements") as any)
          .update(settlementData)
          .eq("id", settlement.id);

        if (settlementError) throw settlementError;
      } else {
        // Create new settlement
        const { error: settlementError } = await (supabase
          .from("tea_shop_settlements") as any)
          .insert(settlementData);

        if (settlementError) throw settlementError;
      }

      onSuccess?.();
    } catch (err: any) {
      console.error("Error saving settlement:", err);
      setError(err.message || "Failed to save settlement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" fontWeight={700}>
            {isEditMode ? "Edit Settlement" : "Record Settlement"}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Shop Info */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Shop:</strong> {shop.shop_name}
          </Typography>
        </Alert>

        {/* Period Selection */}
        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <TextField
            label="Period From"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            fullWidth
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Period To"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            fullWidth
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        {/* Amounts Summary */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            AMOUNTS
          </Typography>

          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2">Entries in Period ({entriesInPeriod.length}):</Typography>
            <Typography variant="body2">₹{entriesTotalInPeriod.toLocaleString()}</Typography>
          </Box>

          {previousBalance > 0 && (
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2">Previous Balance:</Typography>
              <Typography variant="body2">+ ₹{previousBalance.toLocaleString()}</Typography>
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="subtitle1" fontWeight={700}>
              TOTAL DUE:
            </Typography>
            <Typography variant="subtitle1" fontWeight={700} color="error.main">
              ₹{totalDue.toLocaleString()}
            </Typography>
          </Box>
        </Paper>

        {/* Amount Paying */}
        <TextField
          label="Amount Paying"
          type="number"
          value={amountPaying}
          onChange={(e) => setAmountPaying(Math.max(0, parseFloat(e.target.value) || 0))}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          slotProps={{
            htmlInput: { min: 0 },
            input: { startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> },
          }}
        />

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Balance After Payment:
          </Typography>
          <Typography
            variant="body2"
            fontWeight={600}
            color={balanceRemaining > 0 ? "error.main" : "success.main"}
          >
            ₹{balanceRemaining.toLocaleString()}
          </Typography>
        </Box>

        {/* Payment Date */}
        <TextField
          label="Payment Date"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          fullWidth
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ mb: 3 }}
        />

        {/* Who is Paying */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            WHO IS PAYING?
          </Typography>

          <RadioGroup
            value={payerType}
            onChange={(e) => setPayerType(e.target.value as "site_engineer" | "company_direct")}
          >
            <FormControlLabel
              value="site_engineer"
              control={<Radio />}
              label="Site Engineer"
            />
            <FormControlLabel
              value="company_direct"
              control={<Radio />}
              label="Company Direct"
            />
          </RadioGroup>

          {payerType === "site_engineer" && (
            <Box sx={{ mt: 2, pl: 4 }}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Select Engineer</InputLabel>
                <Select
                  value={selectedEngineerId}
                  onChange={(e) => setSelectedEngineerId(e.target.value)}
                  label="Select Engineer"
                >
                  {engineers.map((eng) => (
                    <MenuItem key={eng.id} value={eng.id}>
                      {eng.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={createWalletTransaction}
                    onChange={(e) => setCreateWalletTransaction(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Create wallet transaction</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Records as &quot;Spent on Behalf&quot; in engineer wallet
                    </Typography>
                  </Box>
                }
              />
            </Box>
          )}
        </Paper>

        {/* Link to Subcontract (Optional) */}
        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Link to Subcontract (Optional)</InputLabel>
          <Select
            value={selectedSubcontractId}
            onChange={(e) => setSelectedSubcontractId(e.target.value)}
            label="Link to Subcontract (Optional)"
          >
            <MenuItem value="">
              <em>None - General Site Expense</em>
            </MenuItem>
            {subcontracts.map((sc) => (
              <MenuItem key={sc.id} value={sc.id}>
                {sc.title}{sc.team_name ? ` (${sc.team_name})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Payment Mode */}
        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Payment Mode</InputLabel>
          <Select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            label="Payment Mode"
          >
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="upi">UPI</MenuItem>
            <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
            <MenuItem value="cheque">Cheque</MenuItem>
          </Select>
        </FormControl>

        {/* Notes */}
        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          multiline
          rows={2}
          size="small"
          placeholder="e.g., Settled as per shop notebook..."
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || amountPaying <= 0}
        >
          {loading ? <CircularProgress size={24} /> : isEditMode ? "Update Settlement" : "Record Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
