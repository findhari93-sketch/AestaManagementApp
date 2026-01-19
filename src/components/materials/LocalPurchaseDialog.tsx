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
  InputAdornment,
  Autocomplete,
  Card,
  CardContent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  PhotoCamera as CameraIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useVendors } from "@/hooks/queries/useVendors";
import { useMaterials } from "@/hooks/queries/useMaterials";
import { useCreateLocalPurchase } from "@/hooks/queries/useLocalPurchases";
import FileUploader, { type UploadedFile } from "@/components/common/FileUploader";
import { createClient } from "@/lib/supabase/client";
import type {
  LocalPurchaseFormData,
  LocalPurchaseItemFormData,
  LocalPurchasePaymentMode,
  VendorWithCategories,
  MaterialWithDetails,
} from "@/types/material.types";

interface LocalPurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  siteId: string | undefined;
  engineerId: string | undefined;
}

interface PurchaseItem {
  id: string;
  material_id: string | null;
  custom_material_name: string;
  brand_id: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

interface LocalPurchaseDraftData {
  receiptUrl: string | null;
  selectedVendorId: string | null;
  isNewVendor: boolean;
  newVendorName: string;
  newVendorPhone: string;
  paymentMode: LocalPurchasePaymentMode;
  description: string;
  items: PurchaseItem[];
}

const emptyItem = (): PurchaseItem => ({
  id: crypto.randomUUID(),
  material_id: null,
  custom_material_name: "",
  brand_id: null,
  quantity: 1,
  unit: "nos",
  unit_price: 0,
  total_price: 0,
});

const getInitialDraftData = (): LocalPurchaseDraftData => ({
  receiptUrl: null,
  selectedVendorId: null,
  isNewVendor: false,
  newVendorName: "",
  newVendorPhone: "",
  paymentMode: "cash",
  description: "",
  items: [emptyItem()],
});

export default function LocalPurchaseDialog({
  open,
  onClose,
  siteId,
  engineerId,
}: LocalPurchaseDialogProps) {
  const isMobile = useIsMobile();

  const { data: vendors = [] } = useVendors();
  const { data: materials = [] } = useMaterials();
  const createLocalPurchase = useCreateLocalPurchase();
  const supabase = createClient();

  const [error, setError] = useState("");

  // Use form draft hook for persistence
  const initialDraftData = useMemo(() => getInitialDraftData(), []);
  const {
    formData: draftData,
    updateField,
    isDirty,
    hasRestoredDraft,
    clearDraft,
    discardDraft,
  } = useFormDraft<LocalPurchaseDraftData>({
    key: "local_purchase_dialog",
    initialData: initialDraftData,
    isOpen: open,
  });

  // Derived state from draft data
  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === draftData.selectedVendorId) || null,
    [vendors, draftData.selectedVendorId]
  );
  const receiptFile: UploadedFile | null = draftData.receiptUrl
    ? { url: draftData.receiptUrl, name: "Receipt", size: 0 }
    : null;

  // Reset error when dialog opens
  useEffect(() => {
    if (open) {
      setError("");
    }
  }, [open]);

  // Calculate total
  const totalAmount = useMemo(() => {
    return draftData.items.reduce((sum, item) => sum + item.total_price, 0);
  }, [draftData.items]);

  const handleAddItem = useCallback(() => {
    updateField("items", [...draftData.items, emptyItem()]);
  }, [draftData.items, updateField]);

  const handleRemoveItem = useCallback(
    (id: string) => {
      if (draftData.items.length <= 1) return;
      updateField(
        "items",
        draftData.items.filter((item) => item.id !== id)
      );
    },
    [draftData.items, updateField]
  );

  const handleItemChange = useCallback(
    (id: string, field: keyof PurchaseItem, value: unknown) => {
      updateField(
        "items",
        draftData.items.map((item) => {
          if (item.id !== id) return item;

          const updated = { ...item, [field]: value };

          // Auto-calculate total price
          if (field === "quantity" || field === "unit_price") {
            updated.total_price = updated.quantity * updated.unit_price;
          }

          return updated;
        })
      );
    },
    [draftData.items, updateField]
  );

  const handleMaterialSelect = useCallback(
    (id: string, material: MaterialWithDetails | null) => {
      updateField(
        "items",
        draftData.items.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            material_id: material?.id || null,
            custom_material_name: material ? "" : item.custom_material_name,
            unit: material?.unit || item.unit,
          };
        })
      );
    },
    [draftData.items, updateField]
  );

  const handleSubmit = async () => {
    // Validation
    if (!siteId || !engineerId) {
      setError("Site or engineer not selected");
      return;
    }

    if (!selectedVendor && !draftData.isNewVendor) {
      setError("Please select or add a vendor");
      return;
    }

    if (draftData.isNewVendor && !draftData.newVendorName.trim()) {
      setError("Please enter vendor name");
      return;
    }

    const validItems = draftData.items.filter(
      (item) =>
        (item.material_id || item.custom_material_name) &&
        item.quantity > 0 &&
        item.unit_price > 0
    );

    if (validItems.length === 0) {
      setError("Please add at least one item with valid details");
      return;
    }

    try {
      const formData: LocalPurchaseFormData & { engineerId: string } = {
        site_id: siteId,
        engineerId: engineerId,
        vendor_id: selectedVendor?.id,
        vendor_name: draftData.isNewVendor
          ? draftData.newVendorName
          : selectedVendor?.name || "",
        vendor_phone: draftData.isNewVendor
          ? draftData.newVendorPhone
          : selectedVendor?.phone || "",
        is_new_vendor: draftData.isNewVendor,
        purchase_date: new Date().toISOString().split("T")[0],
        receipt_url: draftData.receiptUrl || undefined,
        payment_mode: draftData.paymentMode,
        description: draftData.description || undefined,
        items: validItems.map((item) => ({
          material_id: item.material_id || undefined,
          custom_material_name: item.custom_material_name || undefined,
          brand_id: item.brand_id || undefined,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
        })),
      };

      await createLocalPurchase.mutateAsync(formData);
      clearDraft(); // Clear draft on successful save
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create purchase";
      setError(message);
    }
  };

  const isSubmitting = createLocalPurchase.isPending;

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
        <Typography variant="h6" component="span">Add Local Purchase</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {hasRestoredDraft && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button size="small" color="inherit" onClick={discardDraft}>
                Discard
              </Button>
            }
          >
            Restored from previous session
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={3}>
          {/* Receipt Photo */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Receipt/Bill Photo
            </Typography>
            <FileUploader
              supabase={supabase}
              bucketName="receipts"
              folderPath={`local-purchases/${siteId}`}
              fileNamePrefix="receipt"
              accept="image"
              maxSizeMB={5}
              onUpload={(file) => updateField("receiptUrl", file.url)}
              onRemove={() => updateField("receiptUrl", null)}
              value={receiptFile}
            />
          </Box>

          <Divider />

          {/* Vendor Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Vendor/Shop
            </Typography>
            <ToggleButtonGroup
              value={draftData.isNewVendor ? "new" : "existing"}
              exclusive
              onChange={(_, value) => {
                if (value === "new") {
                  updateField("isNewVendor", true);
                  updateField("selectedVendorId", null);
                } else if (value === "existing") {
                  updateField("isNewVendor", false);
                  updateField("newVendorName", "");
                  updateField("newVendorPhone", "");
                }
              }}
              size="small"
              sx={{ mb: 2 }}
            >
              <ToggleButton value="existing">Existing Vendor</ToggleButton>
              <ToggleButton value="new">New Vendor</ToggleButton>
            </ToggleButtonGroup>

            {draftData.isNewVendor ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Vendor/Shop Name"
                    value={draftData.newVendorName}
                    onChange={(e) => updateField("newVendorName", e.target.value)}
                    required
                    placeholder="e.g., Sri Lakshmi Hardware"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Phone (Optional)"
                    value={draftData.newVendorPhone}
                    onChange={(e) => updateField("newVendorPhone", e.target.value)}
                    placeholder="+91 99999 99999"
                  />
                </Grid>
              </Grid>
            ) : (
              <Autocomplete
                options={vendors}
                getOptionLabel={(option) =>
                  option.shop_name || option.name || ""
                }
                value={selectedVendor}
                onChange={(_, value) => updateField("selectedVendorId", value?.id || null)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Vendor"
                    placeholder="Search vendors..."
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box>
                      <Typography variant="body2">
                        {option.shop_name || option.name}
                      </Typography>
                      {option.city && (
                        <Typography variant="caption" color="text.secondary">
                          {option.city}
                        </Typography>
                      )}
                    </Box>
                  </li>
                )}
              />
            )}
          </Box>

          <Divider />

          {/* Payment Mode */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Payment Mode
            </Typography>
            <ToggleButtonGroup
              value={draftData.paymentMode}
              exclusive
              onChange={(_, value) => {
                if (value) updateField("paymentMode", value);
              }}
              size="small"
            >
              <ToggleButton value="cash">Site Cash</ToggleButton>
              <ToggleButton value="upi">UPI</ToggleButton>
              <ToggleButton value="engineer_own">My Own Money</ToggleButton>
            </ToggleButtonGroup>
            {draftData.paymentMode === "engineer_own" && (
              <Alert severity="info" sx={{ mt: 1 }}>
                This will be added to your pending reimbursement
              </Alert>
            )}
          </Box>

          <Divider />

          {/* Items */}
          <Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="subtitle2">Items Purchased</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddItem}
              >
                Add Item
              </Button>
            </Box>

            <Stack spacing={2}>
              {draftData.items.map((item, index) => (
                <Card key={item.id} variant="outlined">
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Autocomplete
                          options={materials}
                          getOptionLabel={(option) => {
                            if (typeof option === "string") return option;
                            return option.name || "";
                          }}
                          value={
                            materials.find((m) => m.id === item.material_id) ||
                            null
                          }
                          onChange={(_, value) =>
                            handleMaterialSelect(
                              item.id,
                              typeof value === "string" ? null : value
                            )
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Material"
                              size="small"
                              placeholder="Select or type custom"
                            />
                          )}
                          freeSolo
                          onInputChange={(_, inputValue, reason) => {
                            if (reason === "input") {
                              handleItemChange(
                                item.id,
                                "custom_material_name",
                                inputValue
                              );
                              handleItemChange(item.id, "material_id", null);
                            }
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 4, sm: 2 }}>
                        <TextField
                          fullWidth
                          label="Qty"
                          type="number"
                          size="small"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "quantity",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          slotProps={{
                            input: { inputProps: { min: 0, step: 0.1 } },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 4, sm: 2 }}>
                        <TextField
                          fullWidth
                          label="Unit"
                          size="small"
                          value={item.unit}
                          onChange={(e) =>
                            handleItemChange(item.id, "unit", e.target.value)
                          }
                        />
                      </Grid>
                      <Grid size={{ xs: 4, sm: 2 }}>
                        <TextField
                          fullWidth
                          label="Price"
                          type="number"
                          size="small"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "unit_price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          slotProps={{
                            input: {
                              inputProps: { min: 0 },
                              startAdornment: (
                                <InputAdornment position="start">
                                  ₹
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 8, sm: 1.5 }}>
                        <Typography variant="body2" fontWeight="medium">
                          = ₹{item.total_price.toLocaleString()}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 4, sm: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={draftData.items.length <= 1}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Total */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">Total Amount</Typography>
            <Typography variant="h5" color="primary.main" fontWeight="bold">
              ₹{totalAmount.toLocaleString()}
            </Typography>
          </Box>

          {/* Description */}
          <TextField
            fullWidth
            label="Description/Notes (Optional)"
            multiline
            rows={2}
            value={draftData.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Any additional notes about this purchase..."
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting || totalAmount === 0}
        >
          {isSubmitting ? "Saving..." : "Save Purchase"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
