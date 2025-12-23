"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  CircularProgress,
  Collapse,
  Autocomplete,
  Chip,
  LinearProgress,
  Avatar,
  Divider,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {
  Payment as PaymentIcon,
  AccountBalanceWallet as WalletIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { processContractPayment } from "@/lib/services/settlementService";
import FileUploader, { UploadedFile } from "@/components/common/FileUploader";
import SubcontractLinkSelector from "./SubcontractLinkSelector";
import PayerSourceSelector from "@/components/settlement/PayerSourceSelector";
import dayjs from "dayjs";
import type {
  PaymentMode,
  PaymentChannel,
  ContractPaymentType,
  ContractLaborerPaymentView,
} from "@/types/payment.types";
import type { PayerSource } from "@/types/settlement.types";

interface Engineer {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  wallet_balance?: number;
}

interface ContractPaymentRecordDialogProps {
  open: boolean;
  onClose: () => void;
  laborers: ContractLaborerPaymentView[];
  preselectedLaborerId?: string;
  onSuccess?: () => void;
}

export default function ContractPaymentRecordDialog({
  open,
  onClose,
  laborers,
  preselectedLaborerId,
  onSuccess,
}: ContractPaymentRecordDialogProps) {
  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();

  // Laborer selection
  const [selectedLaborerId, setSelectedLaborerId] = useState<string | null>(
    preselectedLaborerId || null
  );

  // Form state
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>("direct");
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>("");
  const [paymentType, setPaymentType] = useState<ContractPaymentType>("salary");
  const [actualPaymentDate, setActualPaymentDate] = useState<dayjs.Dayjs>(dayjs());
  const [moneySource, setMoneySource] = useState<PayerSource>("own_money");
  const [moneySourceName, setMoneySourceName] = useState<string>("");
  const [subcontractId, setSubcontractId] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");

  // Data state
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get selected laborer
  const selectedLaborer = useMemo(
    () => laborers.find((l) => l.laborerId === selectedLaborerId) || null,
    [laborers, selectedLaborerId]
  );

  // Filter laborers with outstanding balance
  const laborersWithBalance = useMemo(
    () => laborers.filter((l) => l.outstanding > 0),
    [laborers]
  );

  // Set default amount when laborer is selected
  useEffect(() => {
    if (selectedLaborer && selectedLaborer.outstanding > 0) {
      setAmount(selectedLaborer.outstanding);
      // Auto-set subcontract if laborer has one
      if (selectedLaborer.subcontractId) {
        setSubcontractId(selectedLaborer.subcontractId);
      }
    }
  }, [selectedLaborer]);

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setSelectedLaborerId(preselectedLaborerId || null);
      setAmount(0);
      setPaymentMode("upi");
      setPaymentChannel("direct");
      setSelectedEngineerId("");
      setPaymentType("salary");
      setActualPaymentDate(dayjs());
      setMoneySource("own_money");
      setMoneySourceName("");
      setSubcontractId(null);
      setProofUrl(null);
      setNotes("");
      setError(null);
    }
  }, [open, preselectedLaborerId]);

  // Fetch site engineers
  useEffect(() => {
    const fetchEngineers = async () => {
      if (!selectedSite?.id || !open) return;

      setLoading(true);
      try {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name, email, avatar_url")
          .eq("role", "site_engineer")
          .eq("status", "active");

        const engineerList: Engineer[] = (usersData || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatar_url: u.avatar_url,
        }));

        // Get wallet balances
        for (const eng of engineerList) {
          const { data: txns } = await supabase
            .from("site_engineer_transactions")
            .select("amount, transaction_type")
            .eq("engineer_id", eng.id)
            .eq("site_id", selectedSite.id);

          if (txns) {
            eng.wallet_balance = txns.reduce((sum, t) => {
              if (t.transaction_type === "credit") return sum + t.amount;
              if (t.transaction_type === "debit" || t.transaction_type === "spent_on_behalf")
                return sum - t.amount;
              return sum;
            }, 0);
          }
        }

        setEngineers(engineerList);
      } catch (err) {
        console.error("Error fetching engineers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEngineers();
  }, [selectedSite?.id, open, supabase]);

  // Calculate auto-allocation preview
  const allocationPreview = useMemo(() => {
    if (!selectedLaborer || amount <= 0 || paymentType !== "salary") return [];

    const preview: { weekLabel: string; amount: number; isFullyPaid: boolean }[] = [];
    let remaining = amount;

    // Sort weeks by oldest first
    const sortedWeeks = [...selectedLaborer.weeklyBreakdown].sort(
      (a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
    );

    for (const week of sortedWeeks) {
      if (remaining <= 0) break;
      if (week.balance <= 0) continue;

      const allocAmount = Math.min(remaining, week.balance);
      preview.push({
        weekLabel: week.weekLabel,
        amount: allocAmount,
        isFullyPaid: allocAmount >= week.balance,
      });
      remaining -= allocAmount;
    }

    return preview;
  }, [selectedLaborer, amount, paymentType]);

  const handleSubmit = async () => {
    if (!selectedLaborer || !selectedSite || !userProfile || amount <= 0) {
      setError("Please select a laborer and enter a valid amount");
      return;
    }

    if (paymentChannel === "engineer_wallet" && !selectedEngineerId) {
      setError("Please select a site engineer");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Get the oldest unpaid week for payment reference
      const oldestUnpaidWeek = selectedLaborer.weeklyBreakdown
        .filter((w) => w.balance > 0)
        .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime())[0];

      const result = await processContractPayment(supabase, {
        siteId: selectedSite.id,
        laborerId: selectedLaborer.laborerId,
        laborerName: selectedLaborer.laborerName,
        amount: amount,
        paymentType: paymentType,
        actualPaymentDate: actualPaymentDate.format("YYYY-MM-DD"),
        paymentForDate: oldestUnpaidWeek?.weekStart || actualPaymentDate.format("YYYY-MM-DD"),
        paymentMode: paymentMode,
        paymentChannel: paymentChannel,
        payerSource: moneySource,
        customPayerName:
          moneySource === "other_site_money" || moneySource === "custom"
            ? moneySourceName
            : undefined,
        engineerId: paymentChannel === "engineer_wallet" ? selectedEngineerId : undefined,
        proofUrl: proofUrl || undefined,
        notes: notes || undefined,
        subcontractId: subcontractId || undefined,
        userId: userProfile.id,
        userName: userProfile.name || "Unknown",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to process payment");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Failed to process payment");
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = useCallback((file: UploadedFile) => {
    setProofUrl(file.url);
  }, []);

  const handleFileRemove = useCallback(() => {
    setProofUrl(null);
  }, []);

  const canSubmit =
    selectedLaborer && amount > 0 && (paymentChannel !== "engineer_wallet" || selectedEngineerId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h6">Record Payment</Typography>
            <Typography variant="body2" color="text.secondary">
              Contract laborer payment
            </Typography>
          </Box>
          <PaymentIcon color="primary" />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Laborer Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Select Laborer
          </Typography>
          <Autocomplete
            options={laborersWithBalance}
            getOptionLabel={(option) =>
              `${option.laborerName}${option.teamName ? ` (${option.teamName})` : ""} - Due: Rs.${option.outstanding.toLocaleString()}`
            }
            value={selectedLaborer}
            onChange={(_, newValue) => {
              setSelectedLaborerId(newValue?.laborerId || null);
            }}
            renderInput={(params) => (
              <TextField {...params} placeholder="Search laborer..." size="small" fullWidth />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">{option.laborerName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.teamName || "No team"} | Due: Rs.{option.outstanding.toLocaleString()}
                  </Typography>
                </Box>
                <Chip
                  label={`${option.paymentProgress.toFixed(0)}%`}
                  size="small"
                  color={option.paymentProgress >= 100 ? "success" : option.paymentProgress > 50 ? "warning" : "error"}
                  variant="outlined"
                />
              </Box>
            )}
            disabled={processing}
            noOptionsText="No laborers with outstanding balance"
          />
        </Box>

        {/* Selected Laborer Details */}
        {selectedLaborer && (
          <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2">{selectedLaborer.laborerName}</Typography>
              <Chip
                label={selectedLaborer.status}
                size="small"
                color={
                  selectedLaborer.status === "completed"
                    ? "success"
                    : selectedLaborer.status === "partial"
                      ? "warning"
                      : "error"
                }
              />
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Total Earned:
              </Typography>
              <Typography variant="body2">Rs.{selectedLaborer.totalEarned.toLocaleString()}</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Total Paid:
              </Typography>
              <Typography variant="body2" color="success.main">
                Rs.{selectedLaborer.totalPaid.toLocaleString()}
              </Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" fontWeight={600}>
                Outstanding:
              </Typography>
              <Typography variant="body2" fontWeight={600} color="error.main">
                Rs.{selectedLaborer.outstanding.toLocaleString()}
              </Typography>
            </Box>

            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(selectedLaborer.paymentProgress, 100)}
                color={
                  selectedLaborer.paymentProgress >= 100
                    ? "success"
                    : selectedLaborer.paymentProgress > 50
                      ? "warning"
                      : "error"
                }
                sx={{ height: 6, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {selectedLaborer.paymentProgress.toFixed(0)}% paid
              </Typography>
            </Box>
          </Box>
        )}

        {/* Amount */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Payment Amount
          </Typography>
          <TextField
            type="number"
            size="small"
            fullWidth
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            InputProps={{
              startAdornment: (
                <Typography variant="body2" sx={{ mr: 0.5, color: "text.secondary" }}>
                  Rs.
                </Typography>
              ),
            }}
            helperText={
              selectedLaborer
                ? `Full balance: Rs.${selectedLaborer.outstanding.toLocaleString()}`
                : "Select a laborer first"
            }
          />
        </Box>

        {/* Payment Type */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Payment Type
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as ContractPaymentType)}
            >
              <MenuItem value="salary">Salary (Auto-allocate to weeks)</MenuItem>
              <MenuItem value="advance">Advance (Tracked separately)</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Auto-allocation Preview */}
        {paymentType === "salary" && allocationPreview.length > 0 && (
          <Alert severity="info" sx={{ mb: 3 }} icon={<InfoIcon fontSize="small" />}>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              This payment will be allocated to:
            </Typography>
            {allocationPreview.map((item, idx) => (
              <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                <Typography variant="body2">
                  {item.weekLabel}: Rs.{item.amount.toLocaleString()}
                </Typography>
                {item.isFullyPaid && (
                  <Chip label="Fully Paid" size="small" color="success" variant="outlined" />
                )}
              </Box>
            ))}
          </Alert>
        )}

        {/* Payment Date */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Payment Date
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              value={actualPaymentDate}
              onChange={(newValue) => newValue && setActualPaymentDate(newValue)}
              slotProps={{
                textField: { size: "small", fullWidth: true },
              }}
              maxDate={dayjs()}
            />
          </LocalizationProvider>
        </Box>

        {/* Payment Mode */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Payment Mode
          </Typography>
          <RadioGroup
            row
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          >
            <FormControlLabel value="upi" control={<Radio size="small" />} label="UPI" />
            <FormControlLabel value="cash" control={<Radio size="small" />} label="Cash" />
            <FormControlLabel value="net_banking" control={<Radio size="small" />} label="Net Banking" />
            <FormControlLabel value="other" control={<Radio size="small" />} label="Other" />
          </RadioGroup>
        </Box>

        {/* Payment Channel */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Payment Channel
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={paymentChannel}
            onChange={(_, v) => v && setPaymentChannel(v)}
            fullWidth
            size="small"
          >
            <ToggleButton value="direct">
              <PaymentIcon sx={{ mr: 1 }} fontSize="small" />
              Direct Payment
            </ToggleButton>
            <ToggleButton value="engineer_wallet">
              <WalletIcon sx={{ mr: 1 }} fontSize="small" />
              Via Site Engineer
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Money Source */}
        <PayerSourceSelector
          value={moneySource}
          customName={moneySourceName}
          onChange={setMoneySource}
          onCustomNameChange={setMoneySourceName}
          disabled={processing}
        />

        {/* Engineer Selection */}
        <Collapse in={paymentChannel === "engineer_wallet"}>
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Select Site Engineer</InputLabel>
              <Select
                value={selectedEngineerId}
                onChange={(e) => setSelectedEngineerId(e.target.value)}
                label="Select Site Engineer"
                disabled={loading}
              >
                {loading ? (
                  <MenuItem disabled>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2">Loading...</Typography>
                    </Box>
                  </MenuItem>
                ) : engineers.length === 0 ? (
                  <MenuItem disabled>No site engineers found</MenuItem>
                ) : (
                  engineers.map((eng) => (
                    <MenuItem key={eng.id} value={eng.id}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar src={eng.avatar_url || undefined} sx={{ width: 28, height: 28 }}>
                          {eng.name?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">{eng.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Balance: Rs.{(eng.wallet_balance || 0).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Box>
        </Collapse>

        {/* Subcontract Link */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Link to Subcontract
          </Typography>
          <SubcontractLinkSelector
            selectedSubcontractId={subcontractId}
            onSelect={setSubcontractId}
            paymentAmount={amount}
            disabled={processing}
          />
        </Box>

        {/* Proof Upload */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Payment Proof (Optional)
          </Typography>
          <FileUploader
            supabase={supabase}
            bucketName="payment-proofs"
            folderPath={`${selectedSite?.id}/${dayjs().format("YYYY-MM")}`}
            fileNamePrefix="contract-payment"
            accept="image"
            label=""
            helperText="Upload payment screenshot or receipt"
            uploadOnSelect
            onUpload={handleFileUpload}
            onRemove={handleFileRemove}
            compact
          />
        </Box>

        {/* Notes */}
        <TextField
          fullWidth
          size="small"
          label="Notes (Optional)"
          placeholder="Add any notes about this payment..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          rows={2}
        />

        {/* Paid By Info */}
        {userProfile && (
          <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar src={userProfile.avatar_url || undefined} sx={{ width: 24, height: 24 }}>
              {userProfile.name?.[0]}
            </Avatar>
            <Typography variant="caption" color="text.secondary">
              Paid By: {userProfile.name}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit || processing}
          startIcon={processing ? <CircularProgress size={18} /> : <PaymentIcon />}
        >
          {processing ? "Processing..." : `Record Rs.${amount.toLocaleString()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
