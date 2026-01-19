"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  FormControlLabel,
  Switch,
  InputAdornment,
  Collapse,
  MenuItem,
} from "@mui/material";
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Groups as GroupsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  History as HistoryIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useVendors } from "@/hooks/queries/useVendors";
import { useMaterials } from "@/hooks/queries/useMaterials";
import { useLatestPrice } from "@/hooks/queries/useVendorInventory";
import { useSiteGroupMembership } from "@/hooks/queries/useSiteGroups";
import {
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useAddPOItem,
  useRemovePOItem,
} from "@/hooks/queries/usePurchaseOrders";
import { useAddHistoricalGroupStockPurchase } from "@/hooks/queries/useSiteGroups";
import { useCreateMaterialPurchase } from "@/hooks/queries/useMaterialPurchases";
import type {
  PurchaseOrderWithDetails,
  PurchaseOrderItemFormData,
  Vendor,
  MaterialWithDetails,
  MaterialBrand,
  MaterialPurchaseType,
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
  brandName?: string;
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
  const addHistoricalPurchase = useAddHistoricalGroupStockPurchase();
  const createMaterialPurchase = useCreateMaterialPurchase();

  // Check if site belongs to a group
  const { data: groupMembership } = useSiteGroupMembership(siteId);

  // Get today's date in YYYY-MM-DD format for comparison
  const today = new Date().toISOString().split("T")[0];

  const [error, setError] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");

  // Determine if this is historical mode (date is in the past)
  const isHistoricalMode = Boolean(purchaseDate && purchaseDate < today);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItemRow[]>([]);

  // Group stock fields - initialize payingSiteId with siteId
  const [isGroupStock, setIsGroupStock] = useState(false);
  const [payingSiteId, setPayingSiteId] = useState<string>(siteId);
  const [transportCost, setTransportCost] = useState("");

  // Historical mode purchase type (group_stock or own_site)
  const [purchaseType, setPurchaseType] = useState<MaterialPurchaseType>("group_stock");

  // New item form
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialWithDetails | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<MaterialBrand | null>(null);
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemTaxRate, setNewItemTaxRate] = useState("");

  // Track if we've auto-filled the price to prevent infinite loops
  const hasAutofilledPrice = useRef(false);

  // Fetch latest price for the selected vendor + material + brand
  const { data: latestPrice } = useLatestPrice(
    selectedVendor?.id,
    selectedMaterial?.id,
    selectedBrand?.id
  );

  // Get available brands for selected material
  const availableBrands = useMemo(() => {
    if (!selectedMaterial?.brands) return [];
    return selectedMaterial.brands.filter((b) => b.is_active);
  }, [selectedMaterial]);

  // Calculate price change info
  const priceChangeInfo = useMemo(() => {
    if (!latestPrice || !newItemPrice) return null;
    const currentPrice = parseFloat(newItemPrice);
    if (isNaN(currentPrice) || currentPrice <= 0) return null;

    const lastPrice = latestPrice.total_landed_cost || latestPrice.price;
    const changeAmount = currentPrice - lastPrice;
    const changePercent = ((changeAmount) / lastPrice) * 100;

    return {
      lastPrice,
      changeAmount,
      changePercent,
      recordedDate: latestPrice.recorded_date,
      isIncrease: changePercent > 1,
      isDecrease: changePercent < -1,
      isFlat: changePercent >= -1 && changePercent <= 1,
    };
  }, [latestPrice, newItemPrice]);

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

      setPurchaseDate(today);
      setExpectedDeliveryDate("");
      setDeliveryAddress("");
      setPaymentTerms("");
      setNotes("");
      setItems([]);
      // Reset group stock fields
      setIsGroupStock(false);
      setTransportCost("");
      setPurchaseType("group_stock");
    }
    setError("");
    // Only reset these if no prefilled material
    if (!prefilledMaterialId) {
      setSelectedMaterial(null);
      setSelectedBrand(null);
      setNewItemTaxRate("");
    }
    setNewItemQty("");
    setNewItemPrice("");
  }, [purchaseOrder, vendors, materials, open, prefilledVendorId, prefilledMaterialId]);

  // Reset brand when material changes
  useEffect(() => {
    setSelectedBrand(null);
  }, [selectedMaterial]);

  // Auto-fill price when latest price is found (only once per material/brand selection)
  useEffect(() => {
    if (latestPrice && !hasAutofilledPrice.current) {
      hasAutofilledPrice.current = true;
      setNewItemPrice(latestPrice.price.toString());
    }
  }, [latestPrice]);

  // Reset auto-fill flag when material or brand changes
  useEffect(() => {
    hasAutofilledPrice.current = false;
  }, [selectedMaterial, selectedBrand]);

  // Update payingSiteId when siteId changes (separate effect to avoid loops)
  useEffect(() => {
    if (!purchaseOrder && siteId) {
      setPayingSiteId(siteId);
    }
  }, [siteId, purchaseOrder]);

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

    const transport = parseFloat(transportCost) || 0;

    return {
      subtotal,
      taxAmount,
      transport,
      total: subtotal + taxAmount + transport,
    };
  }, [items, transportCost]);

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
      brand_id: selectedBrand?.id,
      quantity: parseFloat(newItemQty),
      unit_price: parseFloat(newItemPrice),
      tax_rate: newItemTaxRate ? parseFloat(newItemTaxRate) : selectedMaterial.gst_rate || undefined,
      materialName: selectedMaterial.name,
      brandName: selectedBrand
        ? selectedBrand.variant_name
          ? `${selectedBrand.brand_name} ${selectedBrand.variant_name}`
          : selectedBrand.brand_name
        : undefined,
      unit: selectedMaterial.unit,
      weight_per_unit: selectedMaterial.weight_per_unit,
      weight_unit: selectedMaterial.weight_unit,
    };

    setItems([...items, newItem]);
    setSelectedMaterial(null);
    setSelectedBrand(null);
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
      // Historical Mode: Direct entry (skip PO workflow)
      if (isHistoricalMode && !isEdit && groupMembership?.isInGroup) {
        if (purchaseType === "own_site") {
          // Own Site Purchase: Create BOTH a PO record (for visibility) AND expense record

          // 1. Create a "delivered" PO for visibility in Purchase Orders list
          const poResult = await createPO.mutateAsync({
            site_id: siteId,
            vendor_id: selectedVendor.id,
            order_date: purchaseDate, // Use historical date
            status: "delivered", // Mark as already delivered
            notes: notes ? `[HISTORICAL] ${notes}` : "[HISTORICAL]",
            transport_cost: parseFloat(transportCost) || undefined,
            items: items.map((item) => ({
              material_id: item.material_id,
              brand_id: item.brand_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
            })),
          });

          // 2. Create material purchase expense linked to PO for cascade delete
          await createMaterialPurchase.mutateAsync({
            site_id: siteId,
            purchase_type: "own_site",
            purchase_order_id: poResult.id, // Link to PO for cascade delete
            vendor_id: selectedVendor.id,
            vendor_name: selectedVendor.name,
            purchase_date: purchaseDate,
            transport_cost: parseFloat(transportCost) || 0,
            is_paid: true,
            paid_date: purchaseDate,
            notes: notes || undefined,
            items: items.map((item) => ({
              material_id: item.material_id,
              brand_id: item.brand_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
            })),
          });
        } else {
          // Group Stock Purchase: Keep existing behavior
          for (const item of items) {
            // Calculate per-item transport cost (distributed by value)
            const itemValue = item.quantity * item.unit_price;
            const totalValue = totals.subtotal;
            const itemTransportCost =
              totalValue > 0
                ? (parseFloat(transportCost) || 0) * (itemValue / totalValue)
                : 0;

            await addHistoricalPurchase.mutateAsync({
              groupId: groupMembership.groupId!,
              materialId: item.material_id,
              brandId: item.brand_id,
              quantity: item.quantity,
              unitCost: item.unit_price,
              transportCost: itemTransportCost,
              paymentSiteId: payingSiteId || siteId,
              purchaseDate,
              vendorName: selectedVendor.name,
              notes: notes || undefined,
            });
          }
        }
        onClose();
        return;
      }

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
        // Build notes with group stock info if applicable
        let finalNotes = notes || "";
        if (isGroupStock && groupMembership?.isInGroup) {
          const payingSite = groupMembership.allSites?.find((s) => s.id === payingSiteId);
          const groupNote = `[GROUP STOCK] Paying Site: ${payingSite?.name || "Unknown"}`;
          finalNotes = finalNotes ? `${groupNote}\n${finalNotes}` : groupNote;
        }

        await createPO.mutateAsync({
          site_id: siteId,
          vendor_id: selectedVendor.id,
          expected_delivery_date: expectedDeliveryDate || undefined,
          delivery_address: deliveryAddress || undefined,
          payment_terms: paymentTerms || undefined,
          transport_cost: transportCost ? parseFloat(transportCost) : undefined,
          notes: finalNotes || undefined,
          // Pass group stock info via internal_notes for processing on delivery
          internal_notes: isGroupStock
            ? JSON.stringify({
                is_group_stock: true,
                group_id: groupMembership?.groupId,
                payment_source_site_id: payingSiteId,
              })
            : undefined,
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
    createPO.isPending || updatePO.isPending || addItem.isPending || addHistoricalPurchase.isPending || createMaterialPurchase.isPending;

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
        <Typography component="span" variant="h6">
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

        {/* Historical Mode Indicator */}
        {isHistoricalMode && !isEdit && (
          <Alert
            severity="info"
            icon={<HistoryIcon />}
            sx={{ mb: 2, bgcolor: "warning.50", borderColor: "warning.main" }}
            variant="outlined"
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Historical Purchase Mode
            </Typography>
            <Typography variant="body2">
              This is a past date ({purchaseDate}). The purchase will be recorded directly to
              {groupMembership?.isInGroup ? " group stock" : " inventory"} without creating a purchase order.
            </Typography>
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Vendor Selection */}
          <Grid size={{ xs: 12, md: 4 }}>
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

          {/* Purchase Date - determines if historical mode */}
          {!isEdit && (
            <Grid size={{ xs: 12, md: 2.5 }}>
              <TextField
                fullWidth
                type="date"
                label="Purchase Date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText={isHistoricalMode ? "Historical entry" : ""}
                color={isHistoricalMode ? "warning" : undefined}
                focused={isHistoricalMode}
              />
            </Grid>
          )}

          <Grid size={{ xs: 12, md: isEdit ? 3 : 2.5 }}>
            <TextField
              fullWidth
              type="date"
              label="Expected Delivery"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              disabled={isHistoricalMode}
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

          {/* Group Stock Toggle - Only show if site is in a group */}
          {groupMembership?.isInGroup && !isEdit && (
            <Grid size={12}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: (isGroupStock || (isHistoricalMode && purchaseType === "group_stock"))
                    ? "primary.50"
                    : (isHistoricalMode && purchaseType === "own_site")
                    ? "success.50"
                    : "transparent",
                  borderColor: (isGroupStock || isHistoricalMode) ? "primary.main" : "divider",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <GroupsIcon
                    color={(isGroupStock || (isHistoricalMode && purchaseType === "group_stock")) ? "primary" : "action"}
                    sx={{ mt: 0.5 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    {!isHistoricalMode ? (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isGroupStock}
                            onChange={(e) => {
                              setIsGroupStock(e.target.checked);
                              if (e.target.checked && !payingSiteId) {
                                setPayingSiteId(siteId);
                              }
                            }}
                          />
                        }
                        label={
                          <Typography fontWeight={500}>
                            Purchase for Group Shared Stock
                          </Typography>
                        }
                      />
                    ) : (
                      // Historical Mode: Show purchase type selector
                      <Box>
                        <Typography variant="subtitle2" gutterBottom fontWeight={500}>
                          Purchase Type (Historical)
                        </Typography>
                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                          <Box
                            onClick={() => setPurchaseType("own_site")}
                            sx={{
                              flex: 1,
                              minWidth: 180,
                              p: 1.5,
                              border: 2,
                              borderColor: purchaseType === "own_site" ? "success.main" : "divider",
                              borderRadius: 1,
                              cursor: "pointer",
                              bgcolor: purchaseType === "own_site" ? "success.50" : "transparent",
                              "&:hover": { bgcolor: purchaseType === "own_site" ? "success.50" : "action.hover" },
                            }}
                          >
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              color={purchaseType === "own_site" ? "success.main" : "text.primary"}
                            >
                              Own Site Purchase
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Materials for this site only
                            </Typography>
                          </Box>
                          <Box
                            onClick={() => setPurchaseType("group_stock")}
                            sx={{
                              flex: 1,
                              minWidth: 180,
                              p: 1.5,
                              border: 2,
                              borderColor: purchaseType === "group_stock" ? "primary.main" : "divider",
                              borderRadius: 1,
                              cursor: "pointer",
                              bgcolor: purchaseType === "group_stock" ? "primary.50" : "transparent",
                              "&:hover": { bgcolor: purchaseType === "group_stock" ? "primary.50" : "action.hover" },
                            }}
                          >
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              color={purchaseType === "group_stock" ? "primary" : "text.primary"}
                            >
                              Group Shared Stock
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Shared across {groupMembership.groupName}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    )}
                    {(!isHistoricalMode || purchaseType === "group_stock") && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Materials will be shared across all sites in{" "}
                        <strong>{groupMembership.groupName}</strong>
                      </Typography>
                    )}

                    {/* Show paying site for group stock mode (normal or historical) */}
                    <Collapse in={isGroupStock || (isHistoricalMode && purchaseType === "group_stock")}>
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Paying Site"
                            value={payingSiteId}
                            onChange={(e) => setPayingSiteId(e.target.value)}
                            helperText="Which site's money was used"
                            required={isHistoricalMode}
                          >
                            {groupMembership.allSites?.map((site) => (
                              <MenuItem key={site.id} value={site.id}>
                                {site.name}
                                {site.id === siteId && " (Current)"}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Transport Cost"
                            value={transportCost}
                            onChange={(e) => setTransportCost(e.target.value)}
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">₹</InputAdornment>
                                ),
                                inputProps: { min: 0, step: 0.01 },
                              },
                            }}
                            helperText="Include for accurate per-unit cost"
                          />
                        </Grid>
                      </Grid>
                    </Collapse>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Transport Cost for non-group purchases (not shown in historical mode for grouped sites) */}
          {(!groupMembership?.isInGroup || (!isGroupStock && !isHistoricalMode)) && !isEdit && (
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Transport Cost (Optional)"
                value={transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">₹</InputAdornment>
                    ),
                    inputProps: { min: 0, step: 0.01 },
                  },
                }}
              />
            </Grid>
          )}

          {/* Add Item Section */}
          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="subtitle2">Add Items</Typography>
            </Divider>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
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
                // Reset price when material changes
                setNewItemPrice("");
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
                      {option.brands && option.brands.length > 0 && (
                        <> • {option.brands.filter(b => b.is_active).length} brands</>
                      )}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          </Grid>

          {/* Brand Selection */}
          <Grid size={{ xs: 12, md: 2 }}>
            <Autocomplete
              options={availableBrands}
              getOptionLabel={(brand) =>
                brand.variant_name
                  ? `${brand.brand_name} ${brand.variant_name}`
                  : brand.brand_name
              }
              value={selectedBrand}
              onChange={(_, value) => {
                setSelectedBrand(value);
                // Reset price to trigger re-fetch
                setNewItemPrice("");
              }}
              disabled={!selectedMaterial || availableBrands.length === 0}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Brand"
                  size="small"
                  placeholder={
                    !selectedMaterial
                      ? "Select material"
                      : availableBrands.length === 0
                      ? "No brands"
                      : "Optional"
                  }
                />
              )}
              renderOption={(props, brand) => (
                <li {...props} key={brand.id}>
                  <Typography variant="body2">
                    {brand.brand_name}
                    {brand.variant_name && (
                      <Typography component="span" color="text.secondary">
                        {" "}- {brand.variant_name}
                      </Typography>
                    )}
                  </Typography>
                </li>
              )}
            />
          </Grid>

          <Grid size={{ xs: 4, md: 1.5 }}>
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
              helperText={
                priceChangeInfo ? (
                  <Box
                    component="span"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      color: priceChangeInfo.isIncrease
                        ? "error.main"
                        : priceChangeInfo.isDecrease
                        ? "success.main"
                        : "text.secondary",
                    }}
                  >
                    {priceChangeInfo.isIncrease && <TrendingUpIcon sx={{ fontSize: 14 }} />}
                    {priceChangeInfo.isDecrease && <TrendingDownIcon sx={{ fontSize: 14 }} />}
                    {priceChangeInfo.isFlat && <TrendingFlatIcon sx={{ fontSize: 14 }} />}
                    <span>
                      Last: {formatCurrency(priceChangeInfo.lastPrice)}
                      {!priceChangeInfo.isFlat && (
                        <> ({priceChangeInfo.changePercent > 0 ? "+" : ""}
                        {priceChangeInfo.changePercent.toFixed(1)}%)</>
                      )}
                    </span>
                  </Box>
                ) : latestPrice ? (
                  <span>Last: {formatCurrency(latestPrice.price)}</span>
                ) : undefined
              }
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
                            {item.brandName && (
                              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                                {item.brandName}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
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
                  {totals.transport > 0 && (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="body2">Transport:</Typography>
                      <Typography variant="body2">
                        {formatCurrency(totals.transport)}
                      </Typography>
                    </Box>
                  )}
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
          color={isHistoricalMode && !isEdit ? "warning" : "primary"}
          startIcon={isHistoricalMode && !isEdit ? <HistoryIcon /> : undefined}
        >
          {isSubmitting
            ? "Saving..."
            : isEdit
            ? "Update"
            : isHistoricalMode
            ? "Record Purchase"
            : "Create Draft PO"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
