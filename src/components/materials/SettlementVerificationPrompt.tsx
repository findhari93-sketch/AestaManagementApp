"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Link,
  Chip,
} from "@mui/material";
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Receipt as ReceiptIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import type { PurchaseOrderWithDetails, MaterialPurchaseExpenseWithDetails } from "@/types/material.types";
import { formatCurrency } from "@/lib/formatters";

// Minimal PO info needed for verification prompt
type MinimalPOInfo = {
  id: string;
  po_number: string;
  vendor_bill_url?: string | null;
  bill_verified?: boolean;
  vendor?: { name: string } | null;
  total_amount?: number;
} | PurchaseOrderWithDetails;

interface SettlementVerificationPromptProps {
  open: boolean;
  onClose: () => void;
  purchaseOrder: MinimalPOInfo | null;
  purchase?: MaterialPurchaseExpenseWithDetails | null;
  onProceed: () => void; // User confirms they've verified
  onVerify: () => void; // User wants to verify first (opens BillVerificationDialog)
  onSkip?: () => void; // User wants to skip verification
  isSettling?: boolean;
}

/**
 * Prompt shown before settlement when bill exists but is not verified
 * Asks user to confirm they've checked the bill matches the PO
 */
export default function SettlementVerificationPrompt({
  open,
  onClose,
  purchaseOrder,
  purchase,
  onProceed,
  onVerify,
  onSkip,
  isSettling = false,
}: SettlementVerificationPromptProps) {
  const billUrl = purchaseOrder?.vendor_bill_url || purchase?.bill_url;
  const isVerified = purchaseOrder?.bill_verified;
  const poNumber = purchaseOrder?.po_number || purchase?.purchase_order?.po_number;
  const vendorName = purchaseOrder?.vendor?.name || purchase?.vendor?.name || purchase?.vendor_name;
  const totalAmount = purchaseOrder?.total_amount || purchase?.total_amount || 0;

  // Don't show if no bill or already verified
  if (!billUrl || isVerified) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          bgcolor: "warning.lighter",
          color: "warning.dark",
        }}
      >
        <WarningIcon color="warning" />
        <Typography variant="h6" fontWeight={600} component="div">
          Bill Verification Required
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          A vendor bill has been uploaded but not yet verified against the purchase order.
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            Have you verified that the vendor bill matches the purchase order details?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please ensure the following match before settling:
          </Typography>
          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              Item names and quantities
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Unit prices and totals
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Tax amounts (if applicable)
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Total bill amount
            </Typography>
          </Box>
        </Box>

        {/* Order Summary */}
        <Box
          sx={{
            p: 2,
            bgcolor: "grey.50",
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <ReceiptIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" fontWeight={600}>
              Order Summary
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
            }}
          >
            {poNumber && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  PO Number
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {poNumber}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Vendor
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {vendorName || "Unknown"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Amount
              </Typography>
              <Typography variant="body2" fontWeight={600} color="primary">
                {formatCurrency(totalAmount)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Bill Status
              </Typography>
              <Chip
                label="Unverified"
                color="warning"
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
        {/* Skip verification link */}
        {onSkip && (
          <Link
            component="button"
            variant="body2"
            color="text.secondary"
            onClick={onSkip}
            underline="hover"
            sx={{ mr: "auto" }}
          >
            Skip verification
          </Link>
        )}

        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>

        <Button
          onClick={onVerify}
          variant="outlined"
          startIcon={<EditIcon />}
        >
          Verify Bill First
        </Button>

        <Button
          onClick={onProceed}
          variant="contained"
          color="success"
          startIcon={<CheckCircleIcon />}
          disabled={isSettling}
        >
          {isSettling ? "Processing..." : "Yes, I've Verified"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Hook to manage verification prompt state
 */
export function useSettlementVerification() {
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [verificationConfirmed, setVerificationConfirmed] = React.useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = React.useState(false);

  const checkVerification = React.useCallback(
    (hasBill: boolean, isVerified: boolean): boolean => {
      // If no bill or already verified, no prompt needed
      if (!hasBill || isVerified || verificationConfirmed) {
        return true; // Can proceed
      }
      // Show prompt
      setShowPrompt(true);
      return false; // Cannot proceed yet
    },
    [verificationConfirmed]
  );

  const handleProceed = React.useCallback(() => {
    setVerificationConfirmed(true);
    setShowPrompt(false);
  }, []);

  const handleVerify = React.useCallback(() => {
    setShowPrompt(false);
    setShowVerificationDialog(true);
  }, []);

  const handleVerificationComplete = React.useCallback(() => {
    setVerificationConfirmed(true);
    setShowVerificationDialog(false);
  }, []);

  const handleSkip = React.useCallback(() => {
    setVerificationConfirmed(true);
    setShowPrompt(false);
  }, []);

  const resetVerification = React.useCallback(() => {
    setVerificationConfirmed(false);
    setShowPrompt(false);
    setShowVerificationDialog(false);
  }, []);

  return {
    showPrompt,
    setShowPrompt,
    verificationConfirmed,
    showVerificationDialog,
    setShowVerificationDialog,
    checkVerification,
    handleProceed,
    handleVerify,
    handleVerificationComplete,
    handleSkip,
    resetVerification,
  };
}
