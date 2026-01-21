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
import { useRecordAdvancePayment } from "@/hooks/queries/usePurchaseOrders";
import type { MaterialPurchaseExpenseWithDetails, MaterialPaymentMode, PurchaseOrderWithDetails } from "@/types/material.types";
import type { PayerSource } from "@/types/settlement.types";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface MaterialSettlementDialogProps {
  open: boolean;
  purchase?: MaterialPurchaseExpenseWithDetails | null;
  purchaseOrder?: PurchaseOrderWithDetails | null;
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
  purchaseOrder,
  onClose,
  onSuccess,
}: MaterialSettlementDialogProps) {
  const supabase = createClient();
  const settleMutation = useSettleMaterialPurchase();
  const advancePaymentMutation = useRecordAdvancePayment();

  // Determine if this is a PO advance payment or expense settlement
  const isPOAdvancePayment = !!purchaseOrder && !purchase;

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
  const [amountPaid, setAmountPaid] = useState<string>(""); // Bargained amount

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const record = purchase || purchaseOrder;
      const purchaseAmount = Number(record?.total_amount || 0);

      setSettlementDate(new Date().toISOString().split("T")[0]);
      setPaymentMode("upi");
      setPayerSource("own_money");
      setPayerName("");
      setPaymentReference("");
      setBillUrl("");
      setPaymentScreenshotUrl("");
      setNotes("");
      setError("");
      setAmountPaid(purchaseAmount.toString()); // Initialize with original amount
    }
  }, [open, purchase, purchaseOrder]);

  const handleSubmit = async () => {
    // Validation
    if (!settlementDate) {
      setError("Please select a payment date");
      return;
    }

    // Validate amount paid
    const finalAmountPaid = Number(amountPaid);
    if (!finalAmountPaid || finalAmountPaid <= 0) {
      setError("Please enter a valid amount paid");
      return;
    }

    // Handle PO advance payment
    if (isPOAdvancePayment && purchaseOrder) {
      try {
        setError("");
        await advancePaymentMutation.mutateAsync({
          po_id: purchaseOrder.id,
          site_id: purchaseOrder.site_id,
          amount_paid: finalAmountPaid,
          payment_date: settlementDate,
          payment_mode: paymentMode,
          payment_reference: paymentReference || undefined,
          payment_screenshot_url: paymentScreenshotUrl || undefined,
          notes: notes || undefined,
        });

        onSuccess?.();
        onClose();
      } catch (err) {
        console.error("Advance payment recording failed:", err);
        setError("Failed to record advance payment. Please try again.");
      }
      return;
    }

    // Handle expense settlement
    if (!purchase) return;

    // Check if this is a group stock parent (vendor payment only)
    const isVendorPaymentOnly = purchase.purchase_type === "group_stock" && !purchase.original_batch_code;

    // Only validate payer source for non-vendor-only payments
    if (!isVendorPaymentOnly && ["custom", "other_site_money"].includes(payerSource) && !payerName.trim()) {
      setError("Please enter the payer name");
      return;
    }

    try {
      setError("");
      await settleMutation.mutateAsync({
        id: purchase.id,
        settlement_date: settlementDate,
        payment_mode: paymentMode,
        payer_source: isVendorPaymentOnly ? "own_money" : payerSource,
        payer_name: isVendorPaymentOnly ? undefined : (payerName || undefined),
        payment_reference: paymentReference || undefined,
        bill_url: billUrl || undefined,
        payment_screenshot_url: paymentScreenshotUrl || undefined,
        notes: notes || undefined,
        amount_paid: finalAmountPaid,
        isVendorPaymentOnly,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Settlement failed:", err);
      setError(isVendorPaymentOnly ? "Failed to record vendor payment. Please try again." : "Failed to settle purchase. Please try again.");
    }
  };

  if (!purchase && !purchaseOrder) return null;

  // Get details from either purchase or PO
  const record = purchase || purchaseOrder;
  const purchaseAmount = Number(record!.total_amount || 0);
  const vendorName = record!.vendor?.name || (purchase?.vendor_name) || "Unknown Vendor";
  const refCode = purchase?.ref_code || purchaseOrder?.po_number || "";
  const dateField = purchase?.purchase_date || purchaseOrder?.order_date || "";

  const materialsText = record!.items && record!.items.length > 0
    ? record!.items.map((i: any) => i.material?.name || "Unknown").join(", ")
    : "Material purchase";

  // Check if this is a group stock parent (vendor payment only)
  const isGroupStockParent = purchase?.purchase_type === "group_stock" && !purchase.original_batch_code;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PaymentIcon color={isPOAdvancePayment ? "warning" : isGroupStockParent ? "secondary" : "success"} />
        {isPOAdvancePayment ? "Record Advance Payment" : isGroupStockParent ? "Record Vendor Payment" : "Settle Material Purchase"}
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
            {isPOAdvancePayment ? "Purchase Order Details" : "Purchase Details"}
          </Typography>
          <Typography variant="body2" fontWeight={600} fontFamily="monospace">
            {refCode}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDate(dateField)} • {vendorName}
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

        {/* Advance Payment Info Alert */}
        {isPOAdvancePayment && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Recording <strong>advance payment</strong> for this purchase order.
            Materials haven't been delivered yet.
          </Alert>
        )}

        {/* Group Stock Info Alert */}
        {isGroupStockParent && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This is a <strong>Group Stock</strong> purchase. Recording vendor payment here.
            Inter-site settlements will be handled separately in the Batches tab.
          </Alert>
        )}

        {/* Editable Amount Field for Bargaining */}
        <Box
          sx={{
            bgcolor: "warning.lighter",
            border: "1px solid",
            borderColor: "warning.main",
            p: 2,
            borderRadius: 1,
            mb: 2,
          }}
        >
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Final Payment Amount
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            Original Amount: {formatCurrency(purchaseAmount)} • You can enter a different amount after bargaining
          </Typography>
          <TextField
            label="Amount to Pay"
            type="number"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            fullWidth
            size="small"
            placeholder={purchaseAmount.toString()}
            slotProps={{
              input: {
                startAdornment: <Typography sx={{ mr: 1, color: "text.secondary" }}>₹</Typography>,
              },
              inputLabel: { shrink: true },
            }}
            helperText="Enter the final amount you agreed to pay after bargaining"
          />
        </Box>

        {/* Payment Date */}
        <TextField
          label={isGroupStockParent ? "Payment Date" : "Settlement Date"}
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

        {/* Payer Source - only for regular expense settlements (not PO advance or group stock) */}
        {!isPOAdvancePayment && !isGroupStockParent && (
          <PayerSourceSelector
            value={payerSource}
            customName={payerName}
            onChange={setPayerSource}
            onCustomNameChange={setPayerName}
            compact
          />
        )}

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
            folderPath={`settlements/${record!.site_id}`}
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
            folderPath={`settlements/${record!.site_id}`}
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
          color={isPOAdvancePayment ? "warning" : isGroupStockParent ? "secondary" : "success"}
          onClick={handleSubmit}
          disabled={settleMutation.isPending || advancePaymentMutation.isPending}
          startIcon={
            (settleMutation.isPending || advancePaymentMutation.isPending) ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <PaymentIcon />
            )
          }
        >
          {(settleMutation.isPending || advancePaymentMutation.isPending)
            ? (isPOAdvancePayment ? "Recording..." : isGroupStockParent ? "Recording..." : "Settling...")
            : (isPOAdvancePayment ? "Confirm Advance Payment" : isGroupStockParent ? "Confirm Vendor Payment" : "Confirm Settlement")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
