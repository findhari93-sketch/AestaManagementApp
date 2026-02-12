"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Autocomplete,
  CircularProgress,
  Divider,
  Stack,
  FormControlLabel,
  Switch,
  Alert,
} from "@mui/material";
import {
  Search as SearchIcon,
  Add as AddIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { useMaterials } from "@/hooks/queries/useMaterials";
import { useVendorInventory, useAddVendorInventory } from "@/hooks/queries/useVendorInventory";
import { queryKeys } from "@/lib/cache/keys";
import type { Material, MaterialWithDetails, VendorInventoryFormData } from "@/types/material.types";

interface AddProductDialogProps {
  open: boolean;
  onClose: () => void;
  vendorId: string;
  vendorName: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function AddProductDialog({
  open,
  onClose,
  vendorId,
  vendorName,
}: AddProductDialogProps) {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialWithDetails | null>(null);
  const [price, setPrice] = useState("");
  const [includesGst, setIncludesGst] = useState(true);
  const [gstRate, setGstRate] = useState("18");
  const [minOrderQty, setMinOrderQty] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: materials = [], isLoading: materialsLoading } = useMaterials();
  const { data: existingInventory = [] } = useVendorInventory(vendorId);
  const addVendorInventory = useAddVendorInventory();

  // Filter out materials already in vendor's inventory
  const existingMaterialIds = new Set(
    existingInventory.map((item) => item.material_id).filter(Boolean)
  );
  const availableMaterials = materials.filter(
    (m) => !existingMaterialIds.has(m.id)
  );

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    resetForm();
  };

  const resetForm = () => {
    setSelectedMaterial(null);
    setPrice("");
    setIncludesGst(true);
    setGstRate("18");
    setMinOrderQty("");
    setNotes("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddExisting = async () => {
    if (!selectedMaterial) {
      setError("Please select a material");
      return;
    }
    if (!price || parseFloat(price) <= 0) {
      setError("Please enter a valid price");
      return;
    }

    setError(null);

    const formData: VendorInventoryFormData = {
      vendor_id: vendorId,
      material_id: selectedMaterial.id,
      current_price: parseFloat(price),
      price_includes_gst: includesGst,
      gst_rate: parseFloat(gstRate) || undefined,
      min_order_qty: minOrderQty ? parseFloat(minOrderQty) : undefined,
      unit: selectedMaterial.unit,
      is_available: true,
      notes: notes || undefined,
    };

    try {
      await addVendorInventory.mutateAsync(formData);
      // Invalidate store catalog queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.storeCatalog.byVendor(vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.storeCatalog.categories(vendorId),
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { minHeight: 400 },
      }}
    >
      <DialogTitle>
        <Typography variant="h6" component="span" fontWeight={600}>
          Add Product to Store
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {vendorName}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab
            icon={<LinkIcon fontSize="small" />}
            iconPosition="start"
            label="Link Existing Material"
          />
          <Tab
            icon={<AddIcon fontSize="small" />}
            iconPosition="start"
            label="Create New"
            disabled
          />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TabPanel value={tabValue} index={0}>
          {/* Link Existing Material */}
          <Stack spacing={2}>
            <Autocomplete
              options={availableMaterials}
              getOptionLabel={(option) =>
                `${option.name}${option.code ? ` (${option.code})` : ""}`
              }
              value={selectedMaterial}
              onChange={(_, value) => {
                setSelectedMaterial(value);
                // Pre-fill GST rate from material if available
                if (value?.gst_rate) {
                  setGstRate(value.gst_rate.toString());
                }
              }}
              loading={materialsLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Material"
                  placeholder="Search materials..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <SearchIcon color="action" />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                    endAdornment: (
                      <>
                        {materialsLoading ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.code && `${option.code} • `}
                      {option.unit}
                    </Typography>
                  </Box>
                </li>
              )}
            />

            {selectedMaterial && (
              <>
                <Divider />

                <Typography variant="subtitle2">
                  Set Price for {selectedMaterial.name}
                </Typography>

                <TextField
                  label="Price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">₹</InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        /{selectedMaterial.unit}
                      </InputAdornment>
                    ),
                  }}
                  required
                  fullWidth
                />

                <Box display="flex" gap={2} alignItems="center">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={includesGst}
                        onChange={(e) => setIncludesGst(e.target.checked)}
                      />
                    }
                    label="Price includes GST"
                  />
                  <TextField
                    label="GST Rate"
                    type="number"
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    size="small"
                    sx={{ width: 100 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Box>

                <TextField
                  label="Minimum Order Quantity (optional)"
                  type="number"
                  value={minOrderQty}
                  onChange={(e) => setMinOrderQty(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {selectedMaterial.unit}
                      </InputAdornment>
                    ),
                  }}
                  fullWidth
                />

                <TextField
                  label="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                />
              </>
            )}

            {availableMaterials.length === 0 && !materialsLoading && (
              <Alert severity="info">
                All materials have already been added to this store. Create a new
                material to add more products.
              </Alert>
            )}
          </Stack>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Create New Material - placeholder for future implementation */}
          <Alert severity="info">
            To create a new material, go to Company → Materials and create it there.
            Then come back here to link it to this store.
          </Alert>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAddExisting}
          disabled={!selectedMaterial || !price || addVendorInventory.isPending}
          startIcon={
            addVendorInventory.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AddIcon />
            )
          }
        >
          {addVendorInventory.isPending ? "Adding..." : "Add to Store"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
