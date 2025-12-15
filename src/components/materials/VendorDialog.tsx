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
  Chip,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Rating,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  InputAdornment,
} from "@mui/material";
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Store as StoreIcon,
  LocalShipping as DealerIcon,
  Factory as FactoryIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useCreateVendor,
  useUpdateVendor,
} from "@/hooks/queries/useVendors";
import type {
  VendorWithCategories,
  VendorFormData,
  MaterialCategory,
  VendorType,
} from "@/types/material.types";
import { VENDOR_TYPE_LABELS } from "@/types/material.types";

interface VendorDialogProps {
  open: boolean;
  onClose: () => void;
  vendor: VendorWithCategories | null;
  categories: MaterialCategory[];
}

export default function VendorDialog({
  open,
  onClose,
  vendor,
  categories,
}: VendorDialogProps) {
  const isMobile = useIsMobile();
  const isEdit = !!vendor;

  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();

  const [error, setError] = useState("");
  const [formData, setFormData] = useState<VendorFormData>({
    name: "",
    code: "",
    contact_person: "",
    phone: "",
    alternate_phone: "",
    whatsapp_number: "",
    email: "",
    address: "",
    city: "",
    state: "Tamil Nadu",
    pincode: "",
    gst_number: "",
    pan_number: "",
    bank_name: "",
    bank_account_number: "",
    bank_ifsc: "",
    payment_terms_days: 30,
    credit_limit: 0,
    notes: "",
    rating: 0,
    category_ids: [],
    // New vendor enhancement fields
    vendor_type: "dealer" as VendorType,
    shop_name: "",
    has_physical_store: false,
    store_address: "",
    store_city: "",
    store_pincode: "",
    provides_transport: false,
    provides_loading: false,
    provides_unloading: false,
    min_order_amount: 0,
    delivery_radius_km: 0,
    specializations: [],
    accepts_upi: true,
    accepts_cash: true,
    accepts_credit: false,
    credit_days: 0,
  });

  // Reset form when vendor changes
  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name,
        code: vendor.code || "",
        contact_person: vendor.contact_person || "",
        phone: vendor.phone || "",
        alternate_phone: vendor.alternate_phone || "",
        whatsapp_number: vendor.whatsapp_number || "",
        email: vendor.email || "",
        address: vendor.address || "",
        city: vendor.city || "",
        state: vendor.state || "Tamil Nadu",
        pincode: vendor.pincode || "",
        gst_number: vendor.gst_number || "",
        pan_number: vendor.pan_number || "",
        bank_name: vendor.bank_name || "",
        bank_account_number: vendor.bank_account_number || "",
        bank_ifsc: vendor.bank_ifsc || "",
        payment_terms_days: vendor.payment_terms_days || 30,
        credit_limit: vendor.credit_limit || 0,
        notes: vendor.notes || "",
        rating: vendor.rating || 0,
        category_ids: vendor.categories?.map((c) => c?.id).filter(Boolean) as string[] || [],
        // New vendor enhancement fields
        vendor_type: vendor.vendor_type || "dealer",
        shop_name: vendor.shop_name || "",
        has_physical_store: vendor.has_physical_store || false,
        store_address: vendor.store_address || "",
        store_city: vendor.store_city || "",
        store_pincode: vendor.store_pincode || "",
        provides_transport: vendor.provides_transport || false,
        provides_loading: vendor.provides_loading || false,
        provides_unloading: vendor.provides_unloading || false,
        min_order_amount: vendor.min_order_amount || 0,
        delivery_radius_km: vendor.delivery_radius_km || 0,
        specializations: vendor.specializations || [],
        accepts_upi: vendor.accepts_upi ?? true,
        accepts_cash: vendor.accepts_cash ?? true,
        accepts_credit: vendor.accepts_credit || false,
        credit_days: vendor.credit_days || 0,
      });
    } else {
      setFormData({
        name: "",
        code: "",
        contact_person: "",
        phone: "",
        alternate_phone: "",
        whatsapp_number: "",
        email: "",
        address: "",
        city: "",
        state: "Tamil Nadu",
        pincode: "",
        gst_number: "",
        pan_number: "",
        bank_name: "",
        bank_account_number: "",
        bank_ifsc: "",
        payment_terms_days: 30,
        credit_limit: 0,
        notes: "",
        rating: 0,
        category_ids: [],
        // New vendor enhancement fields
        vendor_type: "dealer",
        shop_name: "",
        has_physical_store: false,
        store_address: "",
        store_city: "",
        store_pincode: "",
        provides_transport: false,
        provides_loading: false,
        provides_unloading: false,
        min_order_amount: 0,
        delivery_radius_km: 0,
        specializations: [],
        accepts_upi: true,
        accepts_cash: true,
        accepts_credit: false,
        credit_days: 0,
      });
    }
    setError("");
  }, [vendor, open]);

  // Get parent categories only
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );

  const handleChange = (field: keyof VendorFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Vendor name is required");
      return;
    }

    try {
      if (isEdit) {
        await updateVendor.mutateAsync({
          id: vendor.id,
          data: formData,
        });
      } else {
        await createVendor.mutateAsync(formData);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save vendor";
      setError(message);
    }
  };

  const isSubmitting = createVendor.isPending || updateVendor.isPending;

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
        <Typography variant="h6">
          {isEdit ? "Edit Vendor" : "Add New Vendor"}
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
          {/* Basic Info */}
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Vendor Name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
              autoFocus
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Vendor Code"
              value={formData.code}
              onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
              placeholder="Auto-generated if empty"
              helperText="Leave empty to auto-generate based on type"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Box sx={{ pt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Rating
              </Typography>
              <Rating
                value={formData.rating || 0}
                onChange={(_, value) => handleChange("rating", value)}
                precision={0.5}
              />
            </Box>
          </Grid>

          {/* Vendor Type Selector */}
          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Vendor Type
              </Typography>
            </Divider>
          </Grid>

          <Grid size={12}>
            <ToggleButtonGroup
              value={formData.vendor_type}
              exclusive
              onChange={(_, value) => {
                if (value) {
                  handleChange("vendor_type", value);
                  // Auto-set has_physical_store for shop type
                  if (value === "shop") {
                    handleChange("has_physical_store", true);
                  }
                }
              }}
              aria-label="vendor type"
              fullWidth
              sx={{ mb: 1 }}
            >
              <ToggleButton value="shop" aria-label="shop">
                <StoreIcon sx={{ mr: 1 }} />
                {VENDOR_TYPE_LABELS.shop}
              </ToggleButton>
              <ToggleButton value="dealer" aria-label="dealer">
                <DealerIcon sx={{ mr: 1 }} />
                {VENDOR_TYPE_LABELS.dealer}
              </ToggleButton>
              <ToggleButton value="manufacturer" aria-label="manufacturer">
                <FactoryIcon sx={{ mr: 1 }} />
                {VENDOR_TYPE_LABELS.manufacturer}
              </ToggleButton>
              <ToggleButton value="individual" aria-label="individual">
                <PersonIcon sx={{ mr: 1 }} />
                {VENDOR_TYPE_LABELS.individual}
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          {/* Shop Name - shown for shop type */}
          {formData.vendor_type === "shop" && (
            <Grid size={12}>
              <TextField
                fullWidth
                label="Shop/Store Name"
                value={formData.shop_name}
                onChange={(e) => handleChange("shop_name", e.target.value)}
                placeholder="e.g., Sri Lakshmi Hardware"
                helperText="Display name for the shop"
              />
            </Grid>
          )}

          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Contact Information
              </Typography>
            </Divider>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Contact Person"
              value={formData.contact_person}
              onChange={(e) => handleChange("contact_person", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="+91 99999 99999"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              label="Alternate Phone"
              value={formData.alternate_phone}
              onChange={(e) => handleChange("alternate_phone", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              label="WhatsApp"
              value={formData.whatsapp_number}
              onChange={(e) => handleChange("whatsapp_number", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 8 }}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </Grid>

          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Address
              </Typography>
            </Divider>
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              label="Address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              multiline
              rows={2}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              label="City"
              value={formData.city}
              onChange={(e) => handleChange("city", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              label="State"
              value={formData.state}
              onChange={(e) => handleChange("state", e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              label="Pincode"
              value={formData.pincode}
              onChange={(e) => handleChange("pincode", e.target.value)}
            />
          </Grid>

          {/* Store Location - shown for shop and dealer types with physical store */}
          {(formData.vendor_type === "shop" || formData.has_physical_store) && (
            <>
              <Grid size={12}>
                <Divider sx={{ my: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Store/Warehouse Location
                  </Typography>
                </Divider>
              </Grid>

              {formData.vendor_type !== "shop" && (
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.has_physical_store || false}
                        onChange={(e) =>
                          handleChange("has_physical_store", e.target.checked)
                        }
                      />
                    }
                    label="Has physical store/warehouse"
                  />
                </Grid>
              )}

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Store Address"
                  value={formData.store_address}
                  onChange={(e) => handleChange("store_address", e.target.value)}
                  multiline
                  rows={2}
                  placeholder="Physical store/warehouse address"
                />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField
                  fullWidth
                  label="Store City"
                  value={formData.store_city}
                  onChange={(e) => handleChange("store_city", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField
                  fullWidth
                  label="Store Pincode"
                  value={formData.store_pincode}
                  onChange={(e) => handleChange("store_pincode", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <TextField
                  fullWidth
                  label="Delivery Radius (km)"
                  type="number"
                  value={formData.delivery_radius_km || ""}
                  onChange={(e) =>
                    handleChange(
                      "delivery_radius_km",
                      parseInt(e.target.value) || 0
                    )
                  }
                  slotProps={{
                    input: { inputProps: { min: 0 } },
                  }}
                />
              </Grid>
            </>
          )}

          {/* Services & Delivery Options */}
          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Services & Delivery
              </Typography>
            </Divider>
          </Grid>

          <Grid size={{ xs: 6, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.provides_transport || false}
                  onChange={(e) =>
                    handleChange("provides_transport", e.target.checked)
                  }
                />
              }
              label="Provides Transport"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.provides_loading || false}
                  onChange={(e) =>
                    handleChange("provides_loading", e.target.checked)
                  }
                />
              }
              label="Provides Loading"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.provides_unloading || false}
                  onChange={(e) =>
                    handleChange("provides_unloading", e.target.checked)
                  }
                />
              }
              label="Provides Unloading"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              label="Minimum Order Amount (₹)"
              type="number"
              value={formData.min_order_amount || ""}
              onChange={(e) =>
                handleChange("min_order_amount", parseFloat(e.target.value) || 0)
              }
              slotProps={{
                input: {
                  inputProps: { min: 0 },
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                },
              }}
            />
          </Grid>

          {/* Material Categories */}
          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Material Categories Supplied
              </Typography>
            </Divider>
          </Grid>

          <Grid size={12}>
            <FormControl fullWidth>
              <InputLabel>Categories</InputLabel>
              <Select
                multiple
                value={formData.category_ids || []}
                onChange={(e) => handleChange("category_ids", e.target.value)}
                input={<OutlinedInput label="Categories" />}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as string[]).map((id) => {
                      const cat = categories.find((c) => c.id === id);
                      return cat ? (
                        <Chip key={id} label={cat.name} size="small" />
                      ) : null;
                    })}
                  </Box>
                )}
              >
                {parentCategories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Tax & Payment Section - Accordion */}
          <Grid size={12}>
            <Accordion defaultExpanded={isEdit}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Tax & Payment Details</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, md: 4 }}>
                    <TextField
                      fullWidth
                      label="GST Number"
                      value={formData.gst_number}
                      onChange={(e) =>
                        handleChange("gst_number", e.target.value.toUpperCase())
                      }
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }}>
                    <TextField
                      fullWidth
                      label="PAN Number"
                      value={formData.pan_number}
                      onChange={(e) =>
                        handleChange("pan_number", e.target.value.toUpperCase())
                      }
                      placeholder="AAAAA0000A"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Payment Terms (Days)"
                      type="number"
                      value={formData.payment_terms_days}
                      onChange={(e) =>
                        handleChange(
                          "payment_terms_days",
                          parseInt(e.target.value) || 0
                        )
                      }
                      slotProps={{
                        input: { inputProps: { min: 0 } },
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Credit Limit (₹)"
                      type="number"
                      value={formData.credit_limit}
                      onChange={(e) =>
                        handleChange(
                          "credit_limit",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      slotProps={{
                        input: { inputProps: { min: 0 } },
                      }}
                    />
                  </Grid>

                  {/* Payment Methods Accepted */}
                  <Grid size={12}>
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                      Payment Methods Accepted
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 4, md: 3 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.accepts_upi || false}
                          onChange={(e) =>
                            handleChange("accepts_upi", e.target.checked)
                          }
                        />
                      }
                      label="UPI"
                    />
                  </Grid>
                  <Grid size={{ xs: 4, md: 3 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.accepts_cash || false}
                          onChange={(e) =>
                            handleChange("accepts_cash", e.target.checked)
                          }
                        />
                      }
                      label="Cash"
                    />
                  </Grid>
                  <Grid size={{ xs: 4, md: 3 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.accepts_credit || false}
                          onChange={(e) =>
                            handleChange("accepts_credit", e.target.checked)
                          }
                        />
                      }
                      label="Credit"
                    />
                  </Grid>
                  {formData.accepts_credit && (
                    <Grid size={{ xs: 6, md: 3 }}>
                      <TextField
                        fullWidth
                        label="Credit Days"
                        type="number"
                        value={formData.credit_days || ""}
                        onChange={(e) =>
                          handleChange(
                            "credit_days",
                            parseInt(e.target.value) || 0
                          )
                        }
                        slotProps={{
                          input: { inputProps: { min: 0 } },
                        }}
                        helperText="Days of credit allowed"
                      />
                    </Grid>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Bank Details - Accordion */}
          <Grid size={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Bank Details</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Bank Name"
                      value={formData.bank_name}
                      onChange={(e) => handleChange("bank_name", e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Account Number"
                      value={formData.bank_account_number}
                      onChange={(e) =>
                        handleChange("bank_account_number", e.target.value)
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 4 }}>
                    <TextField
                      fullWidth
                      label="IFSC Code"
                      value={formData.bank_ifsc}
                      onChange={(e) =>
                        handleChange("bank_ifsc", e.target.value.toUpperCase())
                      }
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Notes */}
          <Grid size={12}>
            <TextField
              fullWidth
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              multiline
              rows={2}
              placeholder="Additional notes about this vendor..."
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
          disabled={isSubmitting || !formData.name.trim()}
        >
          {isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
