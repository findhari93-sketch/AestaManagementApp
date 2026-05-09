"use client";

import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Close, CloudUpload, Image as ImageIcon } from "@mui/icons-material";
import dayjs from "dayjs";
import PayerSourceSelector from "@/components/settlement/PayerSourceSelector";
import { useImageUpload } from "@/hooks/useImageUpload";
import { createClient } from "@/lib/supabase/client";
import {
  useRecordWalletDeposit,
  useRecordWalletReturn,
} from "@/hooks/mutations/useEngineerWalletMutations";
import { WalletValidationError } from "@/types/engineer-wallet-v2.types";
import type {
  WalletPaymentMode,
  WalletPayerSourceKey,
} from "@/types/engineer-wallet-v2.types";
import type { PayerSource } from "@/types/settlement.types";

interface AddFundsDialogProps {
  open: boolean;
  onClose: () => void;
  engineerId: string;
  engineerName: string;
  recordedBy: string;
  recordedByUserId: string;
  /** Defaults to "deposit" — pass "return" to reuse this dialog for returns. */
  mode?: "deposit" | "return";
}

export default function AddFundsDialog({
  open,
  onClose,
  engineerId,
  engineerName,
  recordedBy,
  recordedByUserId,
  mode = "deposit",
}: AddFundsDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const supabase = createClient();
  const isReturn = mode === "return";

  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<WalletPaymentMode>("upi");
  const [payerSource, setPayerSource] = useState<PayerSource>("trust_account");
  const [payerName, setPayerName] = useState("");
  const [transactionDate, setTransactionDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [notes, setNotes] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const upload = useImageUpload({
    supabase,
    bucketName: "settlement-proofs",
    folderPath: isReturn ? "wallet-returns" : "wallet-deposits",
  });

  const deposit = useRecordWalletDeposit();
  const returnMutation = useRecordWalletReturn();

  const reset = () => {
    setAmount("");
    setPaymentMode("upi");
    setPayerSource("trust_account");
    setPayerName("");
    setTransactionDate(dayjs().format("YYYY-MM-DD"));
    setNotes("");
    setProofUrl(null);
    setProofPreview(null);
    setSubmitError(null);
    upload.reset();
  };

  const handleClose = () => {
    if (deposit.isPending || upload.isUploading) return;
    reset();
    onClose();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError(null);
    try {
      const result = await upload.upload(file);
      setProofUrl(result.url);
      setProofPreview(URL.createObjectURL(file));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const upiProofMissing = paymentMode === "upi" && !proofUrl;
  const customNameMissing =
    (payerSource === "custom" || payerSource === "other_site_money") &&
    payerName.trim() === "" &&
    !isReturn;
  const amountInvalid = !amount || isNaN(Number(amount)) || Number(amount) <= 0;
  const canSubmit = !amountInvalid && !upiProofMissing && !customNameMissing;

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      const baseInput = {
        engineer_id: engineerId,
        amount: Number(amount),
        payment_mode: paymentMode,
        proof_url: proofUrl,
        transaction_date: transactionDate,
        notes: notes.trim() || null,
        recorded_by: recordedBy,
        recorded_by_user_id: recordedByUserId,
      };
      if (isReturn) {
        await returnMutation.mutateAsync(baseInput);
      } else {
        await deposit.mutateAsync({
          ...baseInput,
          payer_source: payerSource as WalletPayerSourceKey,
          payer_name: payerName.trim() || null,
        });
      }
      reset();
      onClose();
    } catch (err) {
      if (err instanceof WalletValidationError) {
        setSubmitError(err.message);
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Something went wrong. Try again.");
      }
    }
  };

  const isSubmitting = deposit.isPending || returnMutation.isPending || upload.isUploading;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3 } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {isReturn ? "Record return" : "Add funds"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isReturn ? `${engineerName} returns money` : `Add money to ${engineerName}'s wallet`}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} disabled={isSubmitting}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            fullWidth
            autoFocus
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1, color: "text.secondary" }}>₹</Typography>,
            }}
            error={!!amount && amountInvalid}
            helperText={!!amount && amountInvalid ? "Amount must be a positive number" : " "}
          />

          <Box>
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>
              Payment mode
            </Typography>
            <ToggleButtonGroup
              value={paymentMode}
              exclusive
              onChange={(_, v) => v && setPaymentMode(v)}
              fullWidth
              size="small"
            >
              <ToggleButton value="cash">Cash</ToggleButton>
              <ToggleButton value="upi">UPI</ToggleButton>
              <ToggleButton value="bank_transfer">Bank transfer</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {!isReturn && (
            <PayerSourceSelector
              value={payerSource}
              customName={payerName}
              onChange={setPayerSource}
              onCustomNameChange={setPayerName}
              compact
            />
          )}

          <TextField
            label="Date"
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <Box>
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>
              Proof / receipt {paymentMode === "upi" && (
                <Typography component="span" variant="caption" color="error.main" sx={{ ml: 0.5 }}>
                  required for UPI
                </Typography>
              )}
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                component="label"
                variant="outlined"
                startIcon={upload.isUploading ? <CircularProgress size={16} /> : <CloudUpload />}
                disabled={upload.isUploading}
                size="small"
              >
                {proofUrl ? "Replace" : paymentMode === "upi" ? "Upload screenshot" : "Add receipt photo"}
                <input type="file" hidden accept="image/*" onChange={handleFile} />
              </Button>
              {proofPreview && (
                <Box
                  component="img"
                  src={proofPreview}
                  alt="proof"
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    objectFit: "cover",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
              )}
              {!proofPreview && proofUrl && (
                <ImageIcon color="action" />
              )}
            </Stack>
            {upload.error && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
                {upload.error}
              </Typography>
            )}
          </Box>

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="Optional context (e.g. 'For week 18 wages')"
          />

          {submitError && <Alert severity="error">{submitError}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canSubmit || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {isSubmitting ? "Saving…" : isReturn ? "Record return" : "Add funds"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
