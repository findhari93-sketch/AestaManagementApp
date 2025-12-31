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
  Autocomplete,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useVendors } from "@/hooks/queries/useVendors";
import { useMaterials } from "@/hooks/queries/useMaterials";
import {
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useAddPOItem,
  useRemovePOItem,
} from "@/hooks/queries/usePurchaseOrders";
import type {
  PurchaseOrderWithDetails,
  PurchaseOrderItemFormData,
  Vendor,
  MaterialWithDetails,
} from "@/types/material.types";
import { formatCurrency } from "@/lib/formatters";
import WeightCalculationDisplay from "./WeightCalculationDisplay";

interface PurchaseOrderDialogProps {
  open: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrderWithDetails | null;
  siteId: string;
  // Prefilled data from navigation (e.g., from material-search)
  prefilledVendorId?: string;
  prefilledMaterialId?: string;
  prefilledMaterialName?: string;
  prefilledUnit?: string;
}

interface POItemRow extends PurchaseOrderItemFormData {
  id?: string;
  materialName?: string;
  unit?: string;
  weight_per_unit?: number | null;
  weight_unit?: string | null;
}

export default function PurchaseOrderDialog({
  open,
  onClose,
  purchaseOrder,
  siteId,
  prefilledVendorId,
  prefilledMaterialId,
  prefilledMaterialName,
  prefilledUnit,
}: PurchaseOrderDialogProps) {
  const isMobile = useIsMobile();
  const isEdit = !!purchaseOrder;

  const { data: vendors = [] } = useVendors();
  const { data: materials = [] } = useMaterials();

  const createPO = useCreatePurchaseOrder();
  const updatePO = useUpdatePurchaseOrder();
  const addItem = useAddPOItem();
  const removeItem = useRemovePOItem();

  const [error, setError] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItemRow[]>([]);

  // New item form
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialWithDetails | null>(null);
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemTaxRate, setNewItemTaxRate] = useState("");

  // Reset form when PO changes
  useEffect(() => {
    if (purchaseOrder) {
      const vendor = vendors.find((v) => v.id === purchaseOrder.vendor_id);
      setSelectedVendor(vendor || null);
      setExpectedDeliveryDate(purchaseOrder.expected_delivery_date || "");
      setDeliveryAddress(purchaseOrder.delivery_address || "");
      setPaymentTerms(purchaseOrder.payment_terms || "");
      setNotes(purchaseOrder.notes || "");

      // Map existing items
      const existingItems: POItemRow[] =
        purchaseOrder.items?.map((item) => ({
          id: item.id,
          material_id: item.material_id,
          brand_id: item.brand_id || undefined,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate || undefined,
          materialName: item.material?.name,
          unit: item.material?.unit,
        })) || [];
      setItems(existingItems);
    } else {
      // Handle prefilled data from navigation (e.g., material-search)
      if (prefilledVendorId) {
        const prefillVendor = vendors.find((v) => v.id === prefilledVendorId);
        setSelectedVendor(prefillVendor || null);
      } else {
        setSelectedVendor(null);
      }

      // Pre-select material for adding (not add to items yet)
      if (prefilledMaterialId && materials.length > 0) {
        const prefillMaterial = materials.find((m) => m.id === prefilledMaterialId);
        if (prefillMaterial) {
          setSelectedMaterial(prefillMaterial);
          if (prefillMaterial.gst_rate) {
            setNewItemTaxRate(prefillMaterial.gst_rate.toString());
          }
        }
      }

      setExpectedDeliveryDate("");
      setDeliveryAddress("");
      setPaymentTerms("");
      setNotes("");
      setItems([]);
    }
    setError("");
    // Only reset these if no prefilled material
    if (!prefilledMaterialId) {
      setSelectedMaterial(null);
      setNewItemTaxRate("");
    }
    setNewItemQty("");
    setNewItemPrice("");
  }, [purchaseOrder, vendors, materials, open, prefilledVendorId, prefilledMaterialId]);

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;

    items.forEach((item) => {
      const itemTotal = item.quantity * item.unit_price;
      const itemTax = item.tax_rate ? (itemTotal * item.tax_rate) / 100 : 0;
      subtotal += itemTotal;
      taxAmount += itemTax;
    });

    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    };
  }, [items]);

  const handleAddItem = () => {
    if (!selectedMaterial) {
      setError("Please select a material");
      return;
    }
    if (!newItemQty || parseFloat(newItemQty) <= 0) {
      setError("Please enter a valid quantity");
      return;
    }
    if (!newItemPrice || parseFloat(newItemPrice) <= 0) {
      setError("Please enter a valid unit price");
      return;
    }

    const newItem: POItemRow = {
      material_id: selectedMaterial.id,
      quantity: parseFloat(newItemQty),
      unit_price: parseFloat(newItemPrice),
      tax_rate: newItemTaxRate ? parseFloat(newItemTaxRate) : selectedMaterial.gst_rate || undefined,
      materialName: selectedMaterial.name,
      unit: selectedMaterial.unit,
      weight_per_unit: selectedMaterial.weight_per_unit,
      weight_unit: selectedMaterial.weight_unit,
    };

    setItems([...items, newItem]);
    setSelectedMaterial(null);
    setNewItemQty("");
    setNewItemPrice("");
    setNewItemTaxRate("");
    setError("");
  };

  const handleRemoveItem = (index: number) => {
    const item = items[index];
    if (item.id && purchaseOrder) {
      // Remove from database
      removeItem.mutate({ id: item.id, poId: purchaseOrder.id });
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedVendor) {
      setError("Please select a vendor");
      return;
    }
    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    try {
      if (isEdit) {
        await updatePO.mutateAsync({
          id: purchaseOrder.id,
          data: {
            vendor_id: selectedVendor.id,
            expected_delivery_date: expectedDeliveryDate || undefined,
            delivery_address: deliveryAddress || undefined,
            payment_terms: paymentTerms || undefined,
            notes: notes || undefined,
          },
        });

        // Add new items (items without id)
        const newItems = items.filter((item) => !item.id);
        for (const item of newItems) {
          await addItem.mutateAsync({
            poId: purchaseOrder.id,
            item: {
              material_id: item.material_id,
              brand_id: item.brand_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
            },
          });
        }
      } else {
        await createPO.mutateAsync({
          site_id: siteId,
          vendor_id: selectedVendor.id,
          expected_delivery_date: expectedDeliveryDate || undefined,
          delivery_address: deliveryAddress || undefined,
          payment_terms: paymentTerms || undefined,
          notes: notes || undefined,
          items: items.map((item) => ({
            material_id: item.material_id,
            brand_id: item.brand_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
          })),
        });
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save purchase order";
      setError(message);
    }
  };

  const isSubmitting =
    createPO.isPending || updatePO.isPending || addItem.isPending;

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
        <Typography variant="h6">
          {isEdit ? `Edit PO ${purchaseOrder.po_number}` : "Create Purchase Order"}
        </Typography>
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
          {/* Vendor Selection */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              options={vendors}
              getOptionLabel={(option) => option.name}
              value={selectedVendor}
              onChange={(_, value) => setSelectedVendor(value)}
              renderInput={(params) => (
                <TextField {...params} label="Vendor" required />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    {option.phone && (
                      <Typography variant="caption" color="text.secondary">
                        {option.phone}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              type="date"
              label="Expected Delivery"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Payment Terms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="e.g., Net 30"
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              label="Delivery Address"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              multiline
              rows={2}
            />
          </Grid>

          {/* Add Item Section */}
          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="subtitle2">Add Items</Typography>
            </Divider>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Autocomplete
              options={materials}
              getOptionLabel={(option) =>
                `${option.name}${option.code ? ` (${option.code})` : ""}`
              }
              value={selectedMaterial}
              onChange={(_, value) => {
                setSelectedMaterial(value);
                if (value?.gst_rate) {
                  setNewItemTaxRate(value.gst_rate.toString());
                }
              }}
              renderInput={(params) => (
                <TextField {...params} label="Material" size="small" />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.code} • {option.unit}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          </Grid>

          <Grid size={{ xs: 4, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Quantity"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              slotProps={{ input: { inputProps: { min: 0, step: 0.01 } } }}
            />
          </Grid>

          <Grid size={{ xs: 4, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Unit Price (₹)"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              slotProps={{ input: { inputProps: { min: 0, step: 0.01 } } }}
            />
          </Grid>

          <Grid size={{ xs: 4, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="GST %"
              value={newItemTaxRate}
              onChange={(e) => setNewItemTaxRate(e.target.value)}
              slotProps={{ input: { inputProps: { min: 0, max: 100 } } }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddItem}
              sx={{ height: 40 }}
            >
              Add
            </Button>
          </Grid>

          {/* Items Table */}
          <Grid size={12}>
            <Paper variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Material</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">GST %</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 2 }}
                        >
                          No items added yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => {
                      const itemTotal = item.quantity * item.unit_price;
                      const itemTax = item.tax_rate
                        ? (itemTotal * item.tax_rate) / 100
                        : 0;
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2">
                              {item.materialName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.unit}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {item.quantity}
                            {item.weight_per_unit && (
                              <WeightCalculationDisplay
                                weightPerUnit={item.weight_per_unit}
                                weightUnit={item.weight_unit}
                                quantity={item.quantity}
                                unit={item.unit}
                                variant="inline"
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell align="right">
                            {item.tax_rate ? `${item.tax_rate}%` : "-"}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(itemTotal + itemTax)}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Grid>

          {/* Totals */}
          {items.length > 0 && (
            <Grid size={12}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  mt: 2,
                }}
              >
                <Box sx={{ minWidth: 200 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="body2">Subtotal:</Typography>
                    <Typography variant="body2">
                      {formatCurrency(totals.subtotal)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="body2">Tax:</Typography>
                    <Typography variant="body2">
                      {formatCurrency(totals.taxAmount)}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={600}>
                      Total:
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {formatCurrency(totals.total)}
                    </Typography>
                  </Box>
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
              placeholder="Additional notes..."
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
          disabled={isSubmitting || !selectedVendor || items.length === 0}
        >
          {isSubmitting
            ? "Saving..."
            : isEdit
            ? "Update"
            : "Create Draft PO"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
