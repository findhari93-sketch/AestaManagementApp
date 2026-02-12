"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Edit as EditIcon, Close as CloseIcon } from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { updateContractPayment } from "@/lib/services/settlementService";
import FileUploader, { UploadedFile } from "@/components/common/FileUploader";
import SubcontractLinkSelector from "./SubcontractLinkSelector";
import dayjs from "dayjs";
import type { PaymentDetails, ContractPaymentType, PaymentMode } from "@/types/payment.types";

interface ContractPaymentEditDialogProps {
  open: boolean;
  paymentDetails: PaymentDetails | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ContractPaymentEditDialog({
  open,
  paymentDetails,
  onClose,
  onSuccess,
}: ContractPaymentEditDialogProps) {
  const { userProfile } = useAuth();
  const supabase = createClient();

  // Form state
  const [amount, setAmount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<ContractPaymentType>("salary");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [actualPaymentDate, setActualPaymentDate] = useState<dayjs.Dayjs>(dayjs());
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [subcontractId, setSubcontractId] = useState<string | null>(null);

  // UI state
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form from payment details
  useEffect(() => {
    if (open && paymentDetails) {
      setAmount(paymentDetails.amount);
      setPaymentType(paymentDetails.paymentType);
      setPaymentMode(paymentDetails.paymentMode);
      setActualPaymentDate(dayjs(paymentDetails.actualPaymentDate));
      setProofUrl(paymentDetails.proofUrl);
      setNotes(paymentDetails.notes || "");
      setSubcontractId(paymentDetails.subcontractId);
      setError(null);
    }
  }, [open, paymentDetails]);

  const handleSubmit = async () => {
    if (!paymentDetails || !userProfile) return;

    if (amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await updateContractPayment(supabase, paymentDetails.paymentId, {
        amount: amount !== paymentDetails.amount ? amount : undefined,
        actualPaymentDate: actualPaymentDate.format("YYYY-MM-DD"),
        paymentType,
        paymentMode,
        proofUrl,
        notes: notes || null,
        subcontractId,
        userId: userProfile.id,
        userName: userProfile.name || "Unknown",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update payment");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Update payment error:", err);
      setError(err.message || "Failed to update payment");
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

  if (!paymentDetails) return null;

  const amountChanged = amount !== paymentDetails.amount;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <EditIcon color="primary" />
            <Typography variant="h6" component="span">Edit Payment</Typography>
          </Box>
          <Typography variant="body2" fontFamily="monospace" color="text.secondary">
            {paymentDetails.paymentReference}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Laborer Info */}
        <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Laborer
          </Typography>
          <Typography variant="subtitle1" fontWeight={500}>
            {paymentDetails.laborerName}
          </Typography>
          {paymentDetails.laborerRole && (
            <Typography variant="caption" color="text.secondary">
              {paymentDetails.laborerRole}
            </Typography>
          )}
        </Box>

        {/* Amount */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Amount"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            InputProps={{
              startAdornment: (
                <Typography variant="body2" sx={{ mr: 0.5 }}>
                  Rs.
                </Typography>
              ),
            }}
          />
          {amountChanged && paymentDetails.paymentType === "salary" && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Changing the amount will reallocate payments to weeks automatically.
            </Alert>
          )}
        </Box>

        {/* Payment Type */}
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Payment Type</InputLabel>
            <Select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as ContractPaymentType)}
              label="Payment Type"
            >
              <MenuItem value="salary">Salary</MenuItem>
              <MenuItem value="advance">Advance</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Payment Mode */}
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Payment Mode</InputLabel>
            <Select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              label="Payment Mode"
            >
              <MenuItem value="upi">UPI</MenuItem>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="net_banking">Net Banking</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Actual Payment Date */}
        <Box sx={{ mb: 3 }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Payment Date"
              value={actualPaymentDate}
              onChange={(newValue) => newValue && setActualPaymentDate(newValue)}
              slotProps={{
                textField: {
                  size: "small",
                  fullWidth: true,
                },
              }}
              maxDate={dayjs()}
            />
          </LocalizationProvider>
        </Box>

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
            Payment Proof
          </Typography>
          {proofUrl && (
            <Box sx={{ mb: 1 }}>
              <Box
                component="img"
                src={proofUrl}
                alt="Current proof"
                sx={{
                  maxWidth: "100%",
                  maxHeight: 120,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              />
            </Box>
          )}
          <FileUploader
            supabase={supabase}
            bucketName="payment-proofs"
            folderPath={`payments/${dayjs().format("YYYY-MM")}`}
            fileNamePrefix="payment"
            accept="image"
            label={proofUrl ? "Replace proof" : "Upload proof"}
            helperText="Upload a new image to replace the current proof"
            uploadOnSelect
            onUpload={handleFileUpload}
            onRemove={handleFileRemove}
            compact
          />
        </Box>

        {/* Notes */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Notes"
            placeholder="Add any notes about this payment..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={2}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={processing || amount <= 0}
          startIcon={processing ? <CircularProgress size={20} /> : <EditIcon />}
        >
          {processing ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
