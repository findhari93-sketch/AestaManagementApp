"use client";

import { useState, useEffect, useMemo } from "react";
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
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Chip,
  Divider,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRecordDelivery } from "@/hooks/queries/usePurchaseOrders";
import { useStockLocations } from "@/hooks/queries/useStockInventory";
import type {
  PurchaseOrderWithDetails,
  DeliveryItemFormData,
} from "@/types/material.types";
import { formatCurrency } from "@/lib/formatters";

interface DeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrderWithDetails | null;
  siteId: string;
}

interface DeliveryItemRow extends DeliveryItemFormData {
  materialName?: string;
  unit?: string;
  orderedQty: number;
  pendingQty: number;
}

export default function DeliveryDialog({
  open,
  onClose,
  purchaseOrder,
  siteId,
}: DeliveryDialogProps) {
  const isMobile = useIsMobile();

  const { data: locations = [] } = useStockLocations(siteId);
  const recordDelivery = useRecordDelivery();

  const [error, setError] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [challanNumber, setChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DeliveryItemRow[]>([]);

  // Reset form when PO changes (only when dialog is open)
  useEffect(() => {
    // Skip if dialog is closed to prevent unnecessary state updates
    if (!open) return;

    if (purchaseOrder?.items) {
      const deliveryItems: DeliveryItemRow[] = purchaseOrder.items
        .filter((item) => {
          const pending = item.quantity - item.received_qty;
          return pending > 0;
        })
        .map((item) => ({
          po_item_id: item.id,
          material_id: item.material_id,
          brand_id: item.brand_id || undefined,
          ordered_qty: item.quantity,
          received_qty: item.quantity - item.received_qty, // Default to pending qty
          accepted_qty: item.quantity - item.received_qty,
          rejected_qty: 0,
          unit_price: item.unit_price,
          materialName: item.material?.name,
          unit: item.material?.unit,
          orderedQty: item.quantity,
          pendingQty: item.quantity - item.received_qty,
        }));
      setItems(deliveryItems);
    } else {
      setItems([]);
    }
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setChallanNumber("");
    setChallanDate("");
    setVehicleNumber("");
    setDriverName("");
    setDriverPhone("");
    setNotes("");
    setError("");
  }, [purchaseOrder, open]);

  const handleItemChange = (
    index: number,
    field: "received_qty" | "accepted_qty" | "rejected_qty" | "rejection_reason",
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const updated = { ...item, [field]: value };

        // Auto-calculate rejected qty when received changes
        if (field === "received_qty") {
          updated.accepted_qty = Number(value);
          updated.rejected_qty = 0;
        }
        // Auto-calculate accepted when rejected changes
        if (field === "rejected_qty") {
          updated.accepted_qty = updated.received_qty - Number(value);
        }

        return updated;
      })
    );
  };

  // Calculate totals
  const totals = useMemo(() => {
    let totalReceived = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalValue = 0;

    items.forEach((item) => {
      totalReceived += item.received_qty;
      totalAccepted += item.accepted_qty || item.received_qty;
      totalRejected += item.rejected_qty || 0;
      totalValue += (item.accepted_qty || item.received_qty) * (item.unit_price || 0);
    });

    return { totalReceived, totalAccepted, totalRejected, totalValue };
  }, [items]);

  const handleSubmit = async () => {
    if (!purchaseOrder) return;

    // Validate
    const hasReceivedItems = items.some((item) => item.received_qty > 0);
    if (!hasReceivedItems) {
      setError("Please enter received quantity for at least one item");
      return;
    }

    // Validate quantities don't exceed pending
    for (const item of items) {
      if (item.received_qty > item.pendingQty) {
        setError(
          `Received quantity for ${item.materialName} exceeds pending quantity`
        );
        return;
      }
    }

    try {
      await recordDelivery.mutateAsync({
        po_id: purchaseOrder.id,
        site_id: siteId,
        vendor_id: purchaseOrder.vendor_id,
        delivery_date: deliveryDate,
        challan_number: challanNumber || undefined,
        challan_date: challanDate || undefined,
        vehicle_number: vehicleNumber || undefined,
        driver_name: driverName || undefined,
        driver_phone: driverPhone || undefined,
        notes: notes || undefined,
        items: items
          .filter((item) => item.received_qty > 0)
          .map((item) => ({
            po_item_id: item.po_item_id,
            material_id: item.material_id,
            brand_id: item.brand_id,
            ordered_qty: item.orderedQty,
            received_qty: item.received_qty,
            accepted_qty: item.accepted_qty,
            rejected_qty: item.rejected_qty,
            rejection_reason: item.rejection_reason,
            unit_price: item.unit_price,
          })),
      });
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to record delivery";
      setError(message);
    }
  };

  const isSubmitting = recordDelivery.isPending;

  if (!purchaseOrder) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
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
          <Typography variant="h6" component="span">Record Delivery (GRN)</Typography>
          <Typography variant="body2" color="text.secondary">
            PO: {purchaseOrder.po_number} • {purchaseOrder.vendor?.name}
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

        <Grid container spacing={2}>
          {/* Delivery Details */}
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              type="date"
              label="Delivery Date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              label="Challan Number"
              value={challanNumber}
              onChange={(e) => setChallanNumber(e.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              type="date"
              label="Challan Date"
              value={challanDate}
              onChange={(e) => setChallanDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Vehicle Number"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="TN 00 AB 0000"
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              label="Driver Name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              label="Driver Phone"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
            />
          </Grid>

          {/* Items Table */}
          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="subtitle2">Received Items</Typography>
            </Divider>
          </Grid>

          <Grid size={12}>
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Material</TableCell>
                    <TableCell align="right">Ordered</TableCell>
                    <TableCell align="right">Pending</TableCell>
                    <TableCell align="right" sx={{ width: 100 }}>
                      Received
                    </TableCell>
                    <TableCell align="right" sx={{ width: 100 }}>
                      Accepted
                    </TableCell>
                    <TableCell align="right" sx={{ width: 100 }}>
                      Rejected
                    </TableCell>
                    <TableCell>Rejection Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 2 }}
                        >
                          No pending items in this PO
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2">
                            {item.materialName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.unit}
                            {item.unit_price && ` • ${formatCurrency(item.unit_price)}/unit`}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{item.orderedQty}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={item.pendingQty}
                            size="small"
                            color={item.pendingQty > 0 ? "warning" : "success"}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={item.received_qty}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "received_qty",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            slotProps={{
                              input: {
                                inputProps: {
                                  min: 0,
                                  max: item.pendingQty,
                                  step: 0.01,
                                },
                              },
                            }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={item.accepted_qty}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "accepted_qty",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            slotProps={{
                              input: {
                                inputProps: {
                                  min: 0,
                                  max: item.received_qty,
                                  step: 0.01,
                                },
                              },
                            }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={item.rejected_qty}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "rejected_qty",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            slotProps={{
                              input: {
                                inputProps: {
                                  min: 0,
                                  max: item.received_qty,
                                  step: 0.01,
                                },
                              },
                            }}
                            sx={{ width: 80 }}
                            error={(item.rejected_qty || 0) > 0}
                          />
                        </TableCell>
                        <TableCell>
                          {(item.rejected_qty || 0) > 0 && (
                            <TextField
                              size="small"
                              placeholder="Reason"
                              value={item.rejection_reason || ""}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "rejection_reason",
                                  e.target.value
                                )
                              }
                              sx={{ minWidth: 120 }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Grid>

          {/* Summary */}
          {items.length > 0 && (
            <Grid size={12}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  mt: 1,
                  gap: 3,
                }}
              >
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    Total Received
                  </Typography>
                  <Typography variant="h6">{totals.totalReceived}</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    Total Accepted
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {totals.totalAccepted}
                  </Typography>
                </Box>
                {totals.totalRejected > 0 && (
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">
                      Total Rejected
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {totals.totalRejected}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    Delivery Value
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(totals.totalValue)}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}

          {/* Notes */}
          <Grid size={12}>
            <TextField
              fullWidth
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              placeholder="Inspection notes, remarks..."
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || items.every((i) => i.received_qty === 0)}
        >
          {isSubmitting ? "Recording..." : "Record Delivery"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
