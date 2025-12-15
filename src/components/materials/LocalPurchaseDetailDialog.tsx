"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Alert,
  Grid,
} from "@mui/material";
import {
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  CalendarMonth as CalendarIcon,
  Payment as PaymentIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCancelLocalPurchase } from "@/hooks/queries/useLocalPurchases";
import type {
  LocalPurchaseWithDetails,
  LocalPurchaseStatus,
} from "@/types/material.types";
import { LOCAL_PURCHASE_STATUS_LABELS } from "@/types/material.types";

interface LocalPurchaseDetailDialogProps {
  open: boolean;
  onClose: () => void;
  purchase: LocalPurchaseWithDetails;
}

// Format currency
const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Status colors
const statusColors: Record<
  LocalPurchaseStatus,
  "default" | "success" | "error"
> = {
  draft: "default",
  completed: "success",
  cancelled: "error",
};

export default function LocalPurchaseDetailDialog({
  open,
  onClose,
  purchase,
}: LocalPurchaseDetailDialogProps) {
  const isMobile = useIsMobile();
  const cancelPurchase = useCancelLocalPurchase();

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this purchase?")) return;

    try {
      await cancelPurchase.mutateAsync(purchase.id);
      onClose();
    } catch (err) {
      console.error("Failed to cancel purchase:", err);
    }
  };

  const paymentModeLabel =
    purchase.payment_mode === "cash"
      ? "Site Cash"
      : purchase.payment_mode === "upi"
      ? "UPI"
      : purchase.payment_mode === "engineer_own"
      ? "Engineer Own Money"
      : purchase.payment_mode;

  const needsReimbursement =
    purchase.payment_mode === "engineer_own" &&
    !purchase.reimbursement_transaction_id;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography variant="h6">
            {purchase.purchase_number || "Local Purchase"}
          </Typography>
          <Chip
            label={
              LOCAL_PURCHASE_STATUS_LABELS[
                purchase.status as LocalPurchaseStatus
              ]
            }
            size="small"
            color={statusColors[purchase.status as LocalPurchaseStatus]}
          />
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Reimbursement Alert */}
          {needsReimbursement && (
            <Alert severity="warning">
              This purchase was made with engineer&apos;s own money and is
              pending reimbursement.
            </Alert>
          )}

          {/* Basic Info */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CalendarIcon fontSize="small" color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Date
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(purchase.purchase_date)}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <StoreIcon fontSize="small" color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body2">
                    {purchase.vendor_name}
                    {purchase.is_new_vendor && (
                      <Chip label="New" size="small" sx={{ ml: 0.5 }} />
                    )}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PaymentIcon fontSize="small" color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Payment Mode
                  </Typography>
                  <Typography variant="body2">{paymentModeLabel}</Typography>
                </Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PersonIcon fontSize="small" color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Created By
                  </Typography>
                  <Typography variant="body2">
                    {purchase.engineer?.name || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>

          <Divider />

          {/* Receipt */}
          {purchase.receipt_url && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Receipt/Bill
              </Typography>
              <Button
                variant="outlined"
                startIcon={<ReceiptIcon />}
                onClick={() => window.open(purchase.receipt_url!, "_blank")}
              >
                View Receipt
              </Button>
            </Box>
          )}

          {/* Items Table */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Items ({purchase.items?.length || 0})
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Material</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(purchase.items || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.material?.name || item.custom_material_name || "-"}
                        {item.brand && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {item.brand.brand_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(item.total_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} align="right">
                      <Typography fontWeight="bold">Total Amount</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold" color="primary">
                        {formatCurrency(purchase.total_amount)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Description */}
          {purchase.description && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Description
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {purchase.description}
              </Typography>
            </Box>
          )}

          {/* Reimbursement Info */}
          {purchase.reimbursement_transaction_id && (
            <Alert severity="success">
              Reimbursement has been processed.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {purchase.status === "completed" && (
          <Button
            color="error"
            onClick={handleCancel}
            disabled={cancelPurchase.isPending}
          >
            Cancel Purchase
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
