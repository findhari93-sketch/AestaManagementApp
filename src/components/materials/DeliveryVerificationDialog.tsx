"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  IconButton,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  Close as CloseIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Cancel as CancelIcon,
  PhotoCamera as CameraIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useDeliveryVerificationDetails,
  useVerifyDelivery,
  useQuickVerifyDelivery,
  useUploadVerificationPhotos,
} from "@/hooks/queries/useDeliveryVerification";
import FileUploader, { type UploadedFile } from "@/components/common/FileUploader";
import { createClient } from "@/lib/supabase/client";
import type {
  DeliveryWithVerification,
  DeliveryVerificationStatus,
  DeliveryDiscrepancy,
} from "@/types/material.types";

interface DeliveryVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  deliveryId: string;
  userId: string | undefined;
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

interface ItemVerification {
  itemId: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  hasIssue: boolean;
  issueType: string;
  notes: string;
}

export default function DeliveryVerificationDialog({
  open,
  onClose,
  deliveryId,
  userId,
}: DeliveryVerificationDialogProps) {
  const isMobile = useIsMobile();

  // Fetch delivery details
  const { data: delivery, isLoading } =
    useDeliveryVerificationDetails(deliveryId);

  // Mutations
  const verifyDelivery = useVerifyDelivery();
  const quickVerifyDelivery = useQuickVerifyDelivery();
  const uploadPhotos = useUploadVerificationPhotos();
  const supabase = createClient();

  // State
  const [error, setError] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedFile[]>([]);
  const [notes, setNotes] = useState("");
  const [itemVerifications, setItemVerifications] = useState<ItemVerification[]>([]);
  const [verificationMode, setVerificationMode] = useState<"quick" | "detailed">(
    "quick"
  );

  // Initialize item verifications when delivery loads
  useEffect(() => {
    if (delivery?.items) {
      setItemVerifications(
        delivery.items.map((item) => ({
          itemId: item.id,
          orderedQty: item.ordered_qty || 0,
          receivedQty: item.received_qty || item.ordered_qty || 0,
          acceptedQty: item.received_qty || item.ordered_qty || 0,
          rejectedQty: 0,
          hasIssue: false,
          issueType: "",
          notes: "",
        }))
      );
      setUploadedPhotos([]);
      setNotes("");
      setError("");
      setVerificationMode("quick");
    }
  }, [delivery]);

  // Check if there are any issues
  const hasAnyIssues = useMemo(() => {
    return itemVerifications.some((v) => v.hasIssue);
  }, [itemVerifications]);

  const handleItemChange = useCallback(
    (
      itemId: string,
      field: keyof ItemVerification,
      value: unknown
    ) => {
      setItemVerifications((prev) =>
        prev.map((item) => {
          if (item.itemId !== itemId) return item;

          const updated = { ...item, [field]: value };

          // Auto-calculate rejected qty
          if (field === "acceptedQty") {
            updated.rejectedQty = updated.receivedQty - (value as number);
            updated.hasIssue = updated.rejectedQty > 0;
          }

          if (field === "hasIssue" && !value) {
            updated.acceptedQty = updated.receivedQty;
            updated.rejectedQty = 0;
            updated.issueType = "";
            updated.notes = "";
          }

          return updated;
        })
      );
    },
    []
  );

  const handlePhotoUpload = useCallback((file: UploadedFile) => {
    setUploadedPhotos((prev) => [...prev, file]);
  }, []);

  const handleRemovePhoto = useCallback((index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleQuickVerify = async () => {
    if (!userId || !deliveryId) {
      setError("Missing user or delivery information");
      return;
    }

    if (uploadedPhotos.length === 0) {
      setError("Please upload at least one verification photo");
      return;
    }

    try {
      const photoUrls = uploadedPhotos.map((p) => p.url);
      await quickVerifyDelivery.mutateAsync({
        deliveryId,
        userId,
        photos: photoUrls,
        notes: notes || undefined,
      });
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Verification failed";
      setError(message);
    }
  };

  const handleDetailedVerify = async (
    status: "verified" | "disputed" | "rejected"
  ) => {
    if (!userId || !deliveryId) {
      setError("Missing user or delivery information");
      return;
    }

    if (uploadedPhotos.length === 0) {
      setError("Please upload at least one verification photo");
      return;
    }

    // Build discrepancies array
    const discrepancies: DeliveryDiscrepancy[] = itemVerifications
      .filter((v) => v.hasIssue)
      .map((v) => ({
        item_id: v.itemId,
        expected_qty: v.orderedQty,
        received_qty: v.acceptedQty,
        issue: v.issueType as "damaged" | "missing" | "wrong_spec" | "short",
        notes: v.notes,
      }));

    try {
      const photoUrls = uploadedPhotos.map((p) => p.url);
      await verifyDelivery.mutateAsync({
        deliveryId,
        userId,
        verificationPhotos: photoUrls,
        verificationNotes: notes || undefined,
        discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
        verificationStatus: status,
      });
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Verification failed";
      setError(message);
    }
  };

  const isSubmitting =
    verifyDelivery.isPending ||
    quickVerifyDelivery.isPending ||
    uploadPhotos.isPending;

  if (isLoading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 4,
            }}
          >
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (!delivery) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Alert severity="error">Delivery not found</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

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
          <Typography variant="h6" component="span">Verify Delivery</Typography>
          <Typography variant="caption" color="text.secondary">
            {delivery.grn_number || "GRN"}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={3}>
          {/* Delivery Info */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Vendor
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {delivery.vendor?.name || "-"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Delivery Date
              </Typography>
              <Typography variant="body2">
                {formatDate(delivery.delivery_date)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                PO Number
              </Typography>
              <Typography variant="body2">
                {delivery.po?.po_number || "Direct"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Challan No.
              </Typography>
              <Typography variant="body2">
                {delivery.challan_number || "-"}
              </Typography>
            </Grid>
          </Grid>

          <Divider />

          {/* Photos */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Verification Photos *
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Take photos of the delivery, materials received, and any issues
            </Typography>
            <Box sx={{ mt: 1 }}>
              <FileUploader
                supabase={supabase}
                bucketName="delivery-verifications"
                folderPath={deliveryId}
                fileNamePrefix="verification"
                accept="image"
                maxSizeMB={10}
                onUpload={handlePhotoUpload}
              />
            </Box>
            {uploadedPhotos.length > 0 && (
              <Box
                sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}
              >
                {uploadedPhotos.map((photo, index) => (
                  <Box
                    key={index}
                    sx={{
                      position: "relative",
                      width: 80,
                      height: 80,
                      borderRadius: 1,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={photo.url}
                      alt={`Photo ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleRemovePhoto(index)}
                      sx={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        bgcolor: "rgba(0,0,0,0.5)",
                        color: "white",
                        "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Divider />

          {/* Verification Mode Toggle */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Verification Type
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Chip
                label="Quick Verify (All OK)"
                color={verificationMode === "quick" ? "primary" : "default"}
                onClick={() => setVerificationMode("quick")}
                icon={<CheckIcon />}
              />
              <Chip
                label="Detailed (Report Issues)"
                color={verificationMode === "detailed" ? "primary" : "default"}
                onClick={() => setVerificationMode("detailed")}
                icon={<WarningIcon />}
              />
            </Box>
          </Box>

          {/* Detailed Verification - Item by Item */}
          {verificationMode === "detailed" && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Item Verification
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Material</TableCell>
                      <TableCell align="right">Ordered</TableCell>
                      <TableCell align="right">Received</TableCell>
                      <TableCell align="right">Accepted</TableCell>
                      <TableCell>Issue</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {itemVerifications.map((item) => {
                      const deliveryItem = delivery.items?.find(
                        (i) => i.id === item.itemId
                      );
                      return (
                        <TableRow key={item.itemId}>
                          <TableCell>
                            {deliveryItem?.material?.name || "-"}
                            {deliveryItem?.brand && (
                              <Typography variant="caption" display="block">
                                {deliveryItem.brand.brand_name}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">{item.orderedQty}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              value={item.receivedQty}
                              onChange={(e) =>
                                handleItemChange(
                                  item.itemId,
                                  "receivedQty",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              sx={{ width: 80 }}
                              slotProps={{
                                input: { inputProps: { min: 0 } },
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              value={item.acceptedQty}
                              onChange={(e) =>
                                handleItemChange(
                                  item.itemId,
                                  "acceptedQty",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              sx={{ width: 80 }}
                              slotProps={{
                                input: { inputProps: { min: 0 } },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {item.hasIssue ? (
                              <FormControl size="small" sx={{ minWidth: 100 }}>
                                <Select
                                  value={item.issueType}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.itemId,
                                      "issueType",
                                      e.target.value
                                    )
                                  }
                                  displayEmpty
                                >
                                  <MenuItem value="">Select Issue</MenuItem>
                                  <MenuItem value="short">Short</MenuItem>
                                  <MenuItem value="damaged">Damaged</MenuItem>
                                  <MenuItem value="wrong_spec">
                                    Wrong Spec
                                  </MenuItem>
                                  <MenuItem value="missing">Missing</MenuItem>
                                </Select>
                              </FormControl>
                            ) : (
                              <Chip
                                label="OK"
                                size="small"
                                color="success"
                                onClick={() =>
                                  handleItemChange(item.itemId, "hasIssue", true)
                                }
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Notes */}
          <TextField
            fullWidth
            label="Verification Notes (Optional)"
            multiline
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any observations or notes about this delivery..."
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />

        {verificationMode === "quick" ? (
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
            onClick={handleQuickVerify}
            disabled={isSubmitting || uploadedPhotos.length === 0}
          >
            {isSubmitting ? "Verifying..." : "Verify & Add to Stock"}
          </Button>
        ) : (
          <>
            {hasAnyIssues && (
              <Button
                variant="contained"
                color="warning"
                startIcon={<WarningIcon />}
                onClick={() => handleDetailedVerify("disputed")}
                disabled={isSubmitting || uploadedPhotos.length === 0}
              >
                {isSubmitting ? "Saving..." : "Report Dispute"}
              </Button>
            )}
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              onClick={() => handleDetailedVerify("verified")}
              disabled={isSubmitting || uploadedPhotos.length === 0}
            >
              {isSubmitting ? "Verifying..." : "Verify & Add to Stock"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
