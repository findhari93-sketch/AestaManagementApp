"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Payment as PaymentIcon } from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import PayerSourceSelector from "@/components/settlement/PayerSourceSelector";
import FileUploader, { UploadedFile } from "@/components/common/FileUploader";
import { useSettleMaterialPurchase } from "@/hooks/queries/useMaterialPurchases";
import type { MaterialPurchaseExpenseWithDetails, MaterialPaymentMode } from "@/types/material.types";
import type { PayerSource } from "@/types/settlement.types";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface MaterialSettlementDialogProps {
  open: boolean;
  purchase: MaterialPurchaseExpenseWithDetails | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const PAYMENT_MODES: { value: MaterialPaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
];

export default function MaterialSettlementDialog({
  open,
  purchase,
  onClose,
  onSuccess,
}: MaterialSettlementDialogProps) {
  const supabase = createClient();
  const settleMutation = useSettleMaterialPurchase();

  // Form state
  const [settlementDate, setSettlementDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMode, setPaymentMode] = useState<MaterialPaymentMode>("upi");
  const [payerSource, setPayerSource] = useState<PayerSource>("own_money");
  const [payerName, setPayerName] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [billUrl, setBillUrl] = useState("");
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSettlementDate(new Date().toISOString().split("T")[0]);
      setPaymentMode("upi");
      setPayerSource("own_money");
      setPayerName("");
      setPaymentReference("");
      setBillUrl("");
      setPaymentScreenshotUrl("");
      setNotes("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!purchase) return;

    // Validation
    if (!settlementDate) {
      setError("Please select a settlement date");
      return;
    }
    if (["custom", "other_site_money"].includes(payerSource) && !payerName.trim()) {
      setError("Please enter the payer name");
      return;
    }

    try {
      setError("");
      await settleMutation.mutateAsync({
        id: purchase.id,
        settlement_date: settlementDate,
        payment_mode: paymentMode,
        payer_source: payerSource,
        payer_name: payerName || undefined,
        payment_reference: paymentReference || undefined,
        bill_url: billUrl || undefined,
        payment_screenshot_url: paymentScreenshotUrl || undefined,
        notes: notes || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Settlement failed:", err);
      setError("Failed to settle purchase. Please try again.");
    }
  };

  if (!purchase) return null;

  const purchaseAmount = Number(purchase.total_amount || 0);
  const vendorName = purchase.vendor?.name || purchase.vendor_name || "Unknown Vendor";
  const materialsText = purchase.items && purchase.items.length > 0
    ? purchase.items.map((i) => i.material?.name || "Unknown").join(", ")
    : "Material purchase";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PaymentIcon color="success" />
        Settle Material Purchase
      </DialogTitle>

      <DialogContent>
        {/* Purchase Summary */}
        <Box
          sx={{
            bgcolor: "background.default",
            p: 2,
            borderRadius: 1,
            mb: 3,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Purchase Details
          </Typography>
          <Typography variant="body2" fontWeight={600} fontFamily="monospace">
            {purchase.ref_code}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDate(purchase.purchase_date)} • {vendorName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {materialsText}
          </Typography>
          <Typography variant="h5" color="primary" fontWeight={700} sx={{ mt: 1 }}>
            {formatCurrency(purchaseAmount)}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {/* Settlement Date */}
        <TextField
          label="Settlement Date"
          type="date"
          value={settlementDate}
          onChange={(e) => setSettlementDate(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        {/* Payment Mode */}
        <FormControl sx={{ mb: 2 }} fullWidth>
          <FormLabel sx={{ mb: 1, fontWeight: 600, fontSize: "0.875rem" }}>
            Payment Mode
          </FormLabel>
          <RadioGroup
            row
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as MaterialPaymentMode)}
          >
            {PAYMENT_MODES.map((mode) => (
              <FormControlLabel
                key={mode.value}
                value={mode.value}
                control={<Radio size="small" />}
                label={mode.label}
              />
            ))}
          </RadioGroup>
        </FormControl>

        {/* Payer Source */}
        <PayerSourceSelector
          value={payerSource}
          customName={payerName}
          onChange={setPayerSource}
          onCustomNameChange={setPayerName}
          compact
        />

        {/* Payment Reference */}
        <TextField
          label="Payment Reference"
          placeholder="UPI ID / Transaction ID / Cheque No."
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        />

        <Divider sx={{ mb: 2 }} />

        {/* File Uploads */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
          Attachments (Optional)
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2 }}>
          <FileUploader
            supabase={supabase}
            bucketName="documents"
            folderPath={`settlements/${purchase.site_id}`}
            fileNamePrefix="bill"
            accept="all"
            label="Vendor Bill"
            helperText="Upload bill/invoice from vendor"
            uploadOnSelect
            value={billUrl ? { name: "bill", size: 0, url: billUrl } : null}
            onUpload={(file: UploadedFile) => setBillUrl(file.url)}
            onRemove={() => setBillUrl("")}
            compact
          />

          <FileUploader
            supabase={supabase}
            bucketName="documents"
            folderPath={`settlements/${purchase.site_id}`}
            fileNamePrefix="payment-proof"
            accept="image"
            label="Payment Proof"
            helperText="UPI screenshot / Bank statement"
            uploadOnSelect
            value={
              paymentScreenshotUrl
                ? { name: "payment-proof", size: 0, url: paymentScreenshotUrl }
                : null
            }
            onUpload={(file: UploadedFile) => setPaymentScreenshotUrl(file.url)}
            onRemove={() => setPaymentScreenshotUrl("")}
            compact
          />
        </Box>

        {/* Notes */}
        <TextField
          label="Notes"
          placeholder="Any additional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          size="small"
          multiline
          rows={2}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={settleMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleSubmit}
          disabled={settleMutation.isPending}
          startIcon={
            settleMutation.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <PaymentIcon />
            )
          }
        >
          {settleMutation.isPending ? "Settling..." : "Confirm Settlement"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
