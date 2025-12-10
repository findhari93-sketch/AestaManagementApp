"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Divider,
  Avatar,
  Chip,
  LinearProgress,
  Collapse,
} from "@mui/material";
import {
  Payment as PaymentIcon,
  AccountBalanceWallet as WalletIcon,
  Person as PersonIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import FileUploader, { UploadedFile } from "@/components/common/FileUploader";
import SubcontractLinkSelector from "./SubcontractLinkSelector";
import dayjs from "dayjs";
import type {
  PaymentDialogProps,
  PaymentMode,
  PaymentChannel,
  DailyPaymentRecord,
  WeeklyContractLaborer,
} from "@/types/payment.types";

interface Engineer {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  wallet_balance?: number;
}

export default function PaymentDialog({
  open,
  onClose,
  dailyRecords = [],
  weeklyPayment,
  allowSubcontractLink = true,
  defaultSubcontractId,
  onSuccess,
}: PaymentDialogProps) {
  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();

  // Form state
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [paymentChannel, setPaymentChannel] =
    useState<PaymentChannel>("direct");
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>("");
  const [engineerReference, setEngineerReference] = useState<string>("");
  const [subcontractId, setSubcontractId] = useState<string | null>(
    defaultSubcontractId || null
  );
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");

  // For partial payments (weekly)
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [partialAmount, setPartialAmount] = useState<number>(0);

  // Data state
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if this is a weekly payment or daily/market
  const isWeeklyPayment = !!weeklyPayment;

  // Calculate totals
  const totalAmount = useMemo(() => {
    if (isWeeklyPayment && weeklyPayment) {
      return weeklyPayment.laborer.runningBalance;
    }
    return dailyRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [isWeeklyPayment, weeklyPayment, dailyRecords]);

  const paymentAmount = useMemo(() => {
    if (isPartialPayment && partialAmount > 0) {
      return partialAmount;
    }
    return totalAmount;
  }, [isPartialPayment, partialAmount, totalAmount]);

  // Fetch site engineers
  useEffect(() => {
    const fetchEngineers = async () => {
      if (!selectedSite?.id) return;

      setLoading(true);
      try {
        // Get site engineers from users table (only site_engineer role)
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

        // Get wallet balances for engineers
        for (const eng of engineerList) {
          const { data: transactions } = await supabase
            .from("site_engineer_transactions")
            .select("amount, transaction_type")
            .eq("user_id", eng.id)
            .eq("site_id", selectedSite.id);

          const balance =
            transactions?.reduce((sum, t) => {
              if (t.transaction_type === "credit") return sum + t.amount;
              if (
                t.transaction_type === "debit" ||
                t.transaction_type === "spent_on_behalf"
              )
                return sum - t.amount;
              return sum;
            }, 0) || 0;

          eng.wallet_balance = balance;
        }

        setEngineers(engineerList);
      } catch (err) {
        console.error("Error fetching engineers:", err);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchEngineers();
    }
  }, [selectedSite?.id, open, supabase]);

  // Generate default reference for engineer
  useEffect(() => {
    if (paymentChannel === "engineer_wallet" && !engineerReference) {
      if (isWeeklyPayment && weeklyPayment) {
        const weekLabel = `Week ${dayjs(weeklyPayment.weekStart).format("MMM D")}-${dayjs(weeklyPayment.weekEnd).format("D")}`;
        setEngineerReference(
          `${weeklyPayment.laborer.laborerName} weekly salary ${weekLabel}`
        );
      } else if (dailyRecords.length > 0) {
        const date = dailyRecords[0].date;
        const types = [
          ...new Set(dailyRecords.map((r) => r.laborerType)),
        ].join(" & ");
        setEngineerReference(
          `${types} laborers payment for ${dayjs(date).format("MMM D, YYYY")}`
        );
      }
    }
  }, [
    paymentChannel,
    isWeeklyPayment,
    weeklyPayment,
    dailyRecords,
    engineerReference,
  ]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPaymentMode("upi");
      setPaymentChannel("direct");
      setSelectedEngineerId("");
      setEngineerReference("");
      setSubcontractId(defaultSubcontractId || null);
      setProofUrl(null);
      setNotes("");
      setIsPartialPayment(false);
      setPartialAmount(0);
      setError(null);

      // Set default subcontract for weekly payment
      if (weeklyPayment?.laborer.subcontractId) {
        setSubcontractId(weeklyPayment.laborer.subcontractId);
      }
    }
  }, [open, defaultSubcontractId, weeklyPayment]);

  const handleSubmit = async () => {
    if (!selectedSite?.id || !userProfile) return;

    // Validation
    if (paymentChannel === "engineer_wallet" && !selectedEngineerId) {
      setError("Please select a site engineer");
      return;
    }

    if (isPartialPayment && partialAmount <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const paymentDate = dayjs().format("YYYY-MM-DD");
      let engineerTransactionId: string | null = null;

      // 1. If via engineer, create engineer transaction first
      if (paymentChannel === "engineer_wallet") {
        const { data: txData, error: txError } = await (supabase
          .from("site_engineer_transactions") as any)
          .insert({
            user_id: selectedEngineerId,
            site_id: selectedSite.id,
            transaction_type: "spent_on_behalf",
            amount: paymentAmount,
            description: engineerReference,
            payment_mode: paymentMode,
            proof_url: proofUrl,
            is_settled: false,
            recorded_by: userProfile.name,
            recorded_by_user_id: userProfile.id,
            related_subcontract_id: subcontractId,
          })
          .select()
          .single();

        if (txError) throw txError;
        engineerTransactionId = txData.id;
      }

      // 2. Process based on payment type
      if (isWeeklyPayment && weeklyPayment) {
        // Weekly contract laborer payment
        await processWeeklyPayment(
          weeklyPayment.laborer,
          weeklyPayment.weekStart,
          paymentDate,
          engineerTransactionId
        );
      } else {
        // Daily/Market laborer payments
        await processDailyPayments(
          dailyRecords,
          paymentDate,
          engineerTransactionId
        );
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

  const processDailyPayments = async (
    records: DailyPaymentRecord[],
    paymentDate: string,
    engineerTransactionId: string | null
  ) => {
    const dailyIds = records
      .filter((r) => r.sourceType === "daily")
      .map((r) => r.sourceId);
    const marketIds = records
      .filter((r) => r.sourceType === "market")
      .map((r) => r.sourceId);

    // Update daily_attendance records
    if (dailyIds.length > 0) {
      const { error } = await supabase
        .from("daily_attendance")
        .update({
          is_paid: paymentChannel === "direct",
          payment_date: paymentDate,
          payment_mode: paymentMode,
          paid_via: paymentChannel === "direct" ? "direct" : "engineer_wallet",
          engineer_transaction_id: engineerTransactionId,
          payment_proof_url: proofUrl,
          subcontract_id: subcontractId,
        })
        .in("id", dailyIds);

      if (error) throw error;
    }

    // Update market_laborer_attendance records
    if (marketIds.length > 0) {
      const { error } = await supabase
        .from("market_laborer_attendance")
        .update({
          is_paid: paymentChannel === "direct",
          payment_date: paymentDate,
          payment_mode: paymentMode,
          paid_via: paymentChannel === "direct" ? "direct" : "engineer_wallet",
          engineer_transaction_id: engineerTransactionId,
          payment_proof_url: proofUrl,
        })
        .in("id", marketIds);

      if (error) throw error;
    }
  };

  const processWeeklyPayment = async (
    laborer: WeeklyContractLaborer,
    weekStart: string,
    paymentDate: string,
    engineerTransactionId: string | null
  ) => {
    // Create labor_payments record for the weekly payment
    const { data: paymentRecord, error: paymentError } = await supabase
      .from("labor_payments")
      .insert({
        laborer_id: laborer.laborerId,
        site_id: selectedSite!.id,
        payment_date: paymentDate,
        payment_for_date: weekStart, // Week start date
        amount: paymentAmount,
        payment_mode: paymentMode,
        payment_channel:
          paymentChannel === "direct" ? "company_direct" : "via_site_engineer",
        site_engineer_transaction_id: engineerTransactionId,
        subcontract_id: subcontractId,
        is_under_contract: true,
        proof_url: proofUrl,
        paid_by: userProfile!.name,
        paid_by_user_id: userProfile!.id,
        recorded_by: userProfile!.name,
        recorded_by_user_id: userProfile!.id,
        notes: notes,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Update daily_attendance records for this week with payment_id
    const attendanceIds = laborer.dailySalary.map((d) => d.attendanceId);

    if (attendanceIds.length > 0) {
      // Check if fully paid
      const newTotalPaid = laborer.cumulativePaid + paymentAmount;
      const isFullyPaid = newTotalPaid >= laborer.cumulativeSalary;

      const { error: updateError } = await supabase
        .from("daily_attendance")
        .update({
          payment_id: paymentRecord.id,
          is_paid: isFullyPaid,
          payment_date: isFullyPaid ? paymentDate : null,
          paid_via: paymentChannel === "direct" ? "direct" : "engineer_wallet",
          subcontract_id: subcontractId,
        })
        .in("id", attendanceIds);

      if (updateError) throw updateError;
    }
  };

  const handleFileUpload = (file: UploadedFile) => {
    setProofUrl(file.url);
  };

  const handleFileRemove = () => {
    setProofUrl(null);
  };

  const selectedEngineer = engineers.find((e) => e.id === selectedEngineerId);

  // Title based on payment type
  const dialogTitle = isWeeklyPayment
    ? `Weekly Settlement - ${weeklyPayment?.laborer.laborerName}`
    : `Salary Settlement (${dailyRecords.length} ${dailyRecords.length === 1 ? "record" : "records"})`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box>
            <Typography variant="h6">{dialogTitle}</Typography>
            <Typography variant="body2" color="text.secondary">
              Total: Rs.{totalAmount.toLocaleString()}
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

        {/* Weekly Payment Details */}
        {isWeeklyPayment && weeklyPayment && (
          <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              {weeklyPayment.laborer.laborerName}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Week: {dayjs(weeklyPayment.weekStart).format("MMM D")} -{" "}
              {dayjs(weeklyPayment.weekEnd).format("MMM D, YYYY")}
            </Typography>

            <Box sx={{ mt: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography variant="body2">This Week Salary:</Typography>
                <Typography variant="body2" fontWeight={500}>
                  Rs.{weeklyPayment.laborer.weekSalary.toLocaleString()}
                </Typography>
              </Box>
              {weeklyPayment.laborer.previousBalance > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 0.5,
                  }}
                >
                  <Typography variant="body2" color="warning.main">
                    Previous Balance:
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    color="warning.main"
                  >
                    Rs.{weeklyPayment.laborer.previousBalance.toLocaleString()}
                  </Typography>
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography variant="body2">Total Due:</Typography>
                <Typography variant="body2" fontWeight={600}>
                  Rs.
                  {(
                    weeklyPayment.laborer.weekSalary +
                    weeklyPayment.laborer.previousBalance
                  ).toLocaleString()}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography variant="body2">Already Paid:</Typography>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  color="success.main"
                >
                  Rs.{weeklyPayment.laborer.weekPaid.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" fontWeight={600}>
                  Balance Due:
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color="error.main"
                >
                  Rs.{weeklyPayment.laborer.runningBalance.toLocaleString()}
                </Typography>
              </Box>
            </Box>

            {/* Progress bar */}
            <Box sx={{ mt: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Payment Progress
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {weeklyPayment.laborer.paymentProgress.toFixed(0)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(weeklyPayment.laborer.paymentProgress, 100)}
                color={
                  weeklyPayment.laborer.paymentProgress >= 100
                    ? "success"
                    : weeklyPayment.laborer.paymentProgress > 50
                      ? "warning"
                      : "error"
                }
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>

            {/* Partial payment option */}
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Radio
                    checked={!isPartialPayment}
                    onChange={() => setIsPartialPayment(false)}
                    size="small"
                  />
                }
                label={`Full Balance Rs.${weeklyPayment.laborer.runningBalance.toLocaleString()}`}
              />
              <FormControlLabel
                control={
                  <Radio
                    checked={isPartialPayment}
                    onChange={() => setIsPartialPayment(true)}
                    size="small"
                  />
                }
                label="Partial Payment"
              />
              <Collapse in={isPartialPayment}>
                <TextField
                  size="small"
                  type="number"
                  label="Amount"
                  value={partialAmount || ""}
                  onChange={(e) => setPartialAmount(Number(e.target.value))}
                  InputProps={{
                    startAdornment: (
                      <Typography variant="body2" sx={{ mr: 0.5 }}>
                        Rs.
                      </Typography>
                    ),
                  }}
                  sx={{ mt: 1, width: 200 }}
                />
              </Collapse>
            </Box>
          </Box>
        )}

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
            <FormControlLabel value="upi" control={<Radio />} label="UPI" />
            <FormControlLabel value="cash" control={<Radio />} label="Cash" />
            <FormControlLabel
              value="net_banking"
              control={<Radio />}
              label="Net Banking"
            />
            <FormControlLabel value="other" control={<Radio />} label="Other" />
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

        {/* Engineer Selection */}
        <Collapse in={paymentChannel === "engineer_wallet"}>
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Select Site Engineer</InputLabel>
              <Select
                value={selectedEngineerId}
                onChange={(e) => setSelectedEngineerId(e.target.value)}
                label="Select Site Engineer"
              >
                {engineers.map((eng) => (
                  <MenuItem key={eng.id} value={eng.id}>
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
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
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              label="Reference/Purpose"
              placeholder="What is this payment for?"
              value={engineerReference}
              onChange={(e) => setEngineerReference(e.target.value)}
              helperText="This helps the engineer know which payment to settle"
            />
          </Box>
        </Collapse>

        {/* Subcontract Linking */}
        {allowSubcontractLink && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Link to Subcontract
            </Typography>
            <SubcontractLinkSelector
              selectedSubcontractId={subcontractId}
              onSelect={setSubcontractId}
              paymentAmount={paymentAmount}
              disabled={processing}
            />
          </Box>
        )}

        {/* Proof Upload */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Payment Proof (Optional)
          </Typography>
          <FileUploader
            supabase={supabase}
            bucketName="payment-proofs"
            folderPath={`${selectedSite?.id}/${dayjs().format("YYYY-MM")}`}
            fileNamePrefix="payment"
            accept="image"
            label=""
            helperText={
              paymentMode === "upi"
                ? "Upload UPI payment screenshot"
                : "Upload payment receipt"
            }
            uploadOnSelect
            onUpload={handleFileUpload}
            onRemove={handleFileRemove}
            compact
          />
        </Box>

        {/* Paid By */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1.5,
            bgcolor: "action.hover",
            borderRadius: 1,
          }}
        >
          <Avatar
            src={userProfile?.avatar_url || undefined}
            sx={{ width: 32, height: 32 }}
          >
            {userProfile?.name?.[0]}
          </Avatar>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Paid By
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {userProfile?.name} (You)
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            processing ||
            (paymentChannel === "engineer_wallet" && !selectedEngineerId) ||
            (isPartialPayment && partialAmount <= 0)
          }
          startIcon={processing ? <CircularProgress size={20} /> : undefined}
        >
          {processing
            ? "Processing..."
            : `Confirm Settlement Rs.${paymentAmount.toLocaleString()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
