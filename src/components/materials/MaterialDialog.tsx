"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  FormControlLabel,
  Switch,
  Autocomplete,
} from "@mui/material";
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useCreateMaterial,
  useUpdateMaterial,
  useCreateMaterialBrand,
  useDeleteMaterialBrand,
  useUpdateMaterialBrand,
  useParentMaterials,
} from "@/hooks/queries/useMaterials";
import type {
  MaterialWithDetails,
  MaterialCategory,
  MaterialFormData,
  MaterialUnit,
  MaterialBrand,
} from "@/types/material.types";

const UNITS: { value: MaterialUnit; label: string }[] = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "ton", label: "Ton" },
  { value: "bag", label: "Bag" },
  { value: "piece", label: "Piece" },
  { value: "nos", label: "Numbers (nos)" },
  { value: "sqft", label: "Square Feet (sqft)" },
  { value: "sqm", label: "Square Meter (sqm)" },
  { value: "cft", label: "Cubic Feet (cft)" },
  { value: "cum", label: "Cubic Meter (cum)" },
  { value: "rmt", label: "Running Meter (rmt)" },
  { value: "liter", label: "Liter" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "bundle", label: "Bundle" },
  { value: "box", label: "Box" },
  { value: "set", label: "Set" },
];

interface MaterialDialogProps {
  open: boolean;
  onClose: () => void;
  material: MaterialWithDetails | null;
  categories: MaterialCategory[];
}

export default function MaterialDialog({
  open,
  onClose,
  material,
  categories,
}: MaterialDialogProps) {
  const isMobile = useIsMobile();
  const isEdit = !!material;

  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const createBrand = useCreateMaterialBrand();
  const updateBrand = useUpdateMaterialBrand();
  const deleteBrand = useDeleteMaterialBrand();
  const { data: parentMaterials = [] } = useParentMaterials();

  const [error, setError] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [isVariant, setIsVariant] = useState(false);
  const [formData, setFormData] = useState<MaterialFormData>({
    name: "",
    code: "",
    local_name: "",
    category_id: "",
    parent_id: "",
    description: "",
    unit: "piece",
    hsn_code: "",
    gst_rate: 18,
    reorder_level: 10,
    min_order_qty: 1,
  });

  // Reset form when material changes
  useEffect(() => {
    if (material) {
      setFormData({
        name: material.name,
        code: material.code || "",
        local_name: material.local_name || "",
        category_id: material.category_id || "",
        parent_id: material.parent_id || "",
        description: material.description || "",
        unit: material.unit,
        hsn_code: material.hsn_code || "",
        gst_rate: material.gst_rate || 18,
        reorder_level: material.reorder_level || 10,
        min_order_qty: material.min_order_qty || 1,
      });
      setIsVariant(!!material.parent_id);
    } else {
      setFormData({
        name: "",
        code: "",
        local_name: "",
        category_id: "",
        parent_id: "",
        description: "",
        unit: "piece",
        hsn_code: "",
        gst_rate: 18,
        reorder_level: 10,
        min_order_qty: 1,
      });
      setIsVariant(false);
    }
    setError("");
    setNewBrandName("");
  }, [material, open]);

  // Get parent categories only
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );

  // Get sub-categories for selected parent
  const subCategories = useMemo(() => {
    const parentId = formData.category_id;
    if (!parentId) return [];
    // Check if selected is a parent category
    const isParent = parentCategories.some((c) => c.id === parentId);
    if (isParent) {
      return categories.filter((c) => c.parent_id === parentId);
    }
    return [];
  }, [categories, parentCategories, formData.category_id]);

  // Get available parent materials (exclude current material and materials that already have variants)
  const availableParentMaterials = useMemo(() => {
    if (isEdit && material) {
      // Exclude the current material from being its own parent
      return parentMaterials.filter((m) => m.id !== material.id);
    }
    return parentMaterials;
  }, [parentMaterials, isEdit, material]);

  // When parent material changes, inherit properties
  const handleParentChange = (parentId: string) => {
    handleChange("parent_id", parentId);
    if (parentId) {
      const parent = parentMaterials.find((m) => m.id === parentId);
      if (parent) {
        // Inherit category and unit from parent
        if (parent.category_id) {
          handleChange("category_id", parent.category_id);
        }
        handleChange("unit", parent.unit);
      }
    }
  };

  const handleChange = (field: keyof MaterialFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Material name is required");
      return;
    }

    if (isVariant && !formData.parent_id) {
      setError("Please select a parent material for this variant");
      return;
    }

    try {
      const dataToSubmit = {
        ...formData,
        parent_id: isVariant ? formData.parent_id : null,
      };

      if (isEdit) {
        await updateMaterial.mutateAsync({
          id: material.id,
          data: dataToSubmit,
        });
      } else {
        await createMaterial.mutateAsync(dataToSubmit);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save material";
      setError(message);
    }
  };

  const handleAddBrand = async () => {
    if (!material || !newBrandName.trim()) return;

    try {
      await createBrand.mutateAsync({
        material_id: material.id,
        brand_name: newBrandName.trim(),
        is_preferred: false,
      });
      setNewBrandName("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add brand";
      setError(message);
    }
  };

  const handleTogglePreferred = async (brand: MaterialBrand) => {
    if (!material) return;
    try {
      await updateBrand.mutateAsync({
        id: brand.id,
        data: { is_preferred: !brand.is_preferred },
      });
    } catch (err) {
      console.error("Failed to update brand:", err);
    }
  };

  const handleDeleteBrand = async (brand: MaterialBrand) => {
    if (!material) return;
    if (!confirm(`Delete brand "${brand.brand_name}"?`)) return;
    try {
      await deleteBrand.mutateAsync({
        id: brand.id,
        materialId: material.id,
      });
    } catch (err) {
      console.error("Failed to delete brand:", err);
    }
  };

  const isSubmitting = createMaterial.isPending || updateMaterial.isPending;
  const activeBrands = material?.brands?.filter((b) => b.is_active) || [];

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
        <Typography variant="h6" component="span">
          {isEdit ? "Edit Material" : "Add New Material"}
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
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              fullWidth
              label="Material Name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
              autoFocus
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Material Code"
              value={formData.code}
              onChange={(e) =>
                handleChange("code", e.target.value.toUpperCase())
              }
              placeholder="Auto-generated if empty"
              helperText="Leave empty to auto-generate"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Local Name (Tamil)"
              value={formData.local_name}
              onChange={(e) => handleChange("local_name", e.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category_id}
                onChange={(e) => handleChange("category_id", e.target.value)}
                label="Category"
                disabled={isVariant && !!formData.parent_id}
              >
                <MenuItem value="">No Category</MenuItem>
                {parentCategories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
                {subCategories.length > 0 && <Divider sx={{ my: 1 }} />}
                {subCategories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id} sx={{ pl: 4 }}>
                    └ {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Variant Section */}
          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Material Variant
              </Typography>
            </Divider>
          </Grid>

          <Grid size={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={isVariant}
                  onChange={(e) => {
                    setIsVariant(e.target.checked);
                    if (!e.target.checked) {
                      handleChange("parent_id", "");
                    }
                  }}
                  disabled={isEdit && (material?.variant_count || 0) > 0}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    This is a variant of another material
                  </Typography>
                  {isEdit && (material?.variant_count || 0) > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Cannot convert to variant: this material has {material?.variant_count} variants
                    </Typography>
                  )}
                </Box>
              }
            />
          </Grid>

          {isVariant && (
            <Grid size={12}>
              <Autocomplete
                options={availableParentMaterials}
                getOptionLabel={(option) =>
                  `${option.name}${option.code ? ` (${option.code})` : ""}`
                }
                value={
                  availableParentMaterials.find((m) => m.id === formData.parent_id) || null
                }
                onChange={(_, newValue) => {
                  handleParentChange(newValue?.id || "");
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Parent Material"
                    placeholder="Search parent material..."
                    helperText="Select the parent material this variant belongs to"
                    required
                  />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              multiline
              rows={2}
            />
          </Grid>

          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Units & Specifications
              </Typography>
            </Divider>
          </Grid>

          <Grid size={{ xs: 6, md: 4 }}>
            <FormControl fullWidth required>
              <InputLabel>Primary Unit</InputLabel>
              <Select
                value={formData.unit}
                onChange={(e) =>
                  handleChange("unit", e.target.value as MaterialUnit)
                }
                label="Primary Unit"
              >
                {UNITS.map((unit) => (
                  <MenuItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              label="HSN Code"
              value={formData.hsn_code}
              onChange={(e) => handleChange("hsn_code", e.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 4 }}>
            <TextField
              fullWidth
              label="GST Rate (%)"
              type="number"
              value={formData.gst_rate}
              onChange={(e) =>
                handleChange("gst_rate", parseFloat(e.target.value) || 0)
              }
              slotProps={{
                input: {
                  inputProps: { min: 0, max: 100, step: 0.5 },
                },
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 6 }}>
            <TextField
              fullWidth
              label="Reorder Level"
              type="number"
              value={formData.reorder_level}
              onChange={(e) =>
                handleChange("reorder_level", parseFloat(e.target.value) || 0)
              }
              helperText="Alert when stock falls below this level"
              slotProps={{
                input: {
                  inputProps: { min: 0, step: 1 },
                },
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 6 }}>
            <TextField
              fullWidth
              label="Min Order Quantity"
              type="number"
              value={formData.min_order_qty}
              onChange={(e) =>
                handleChange("min_order_qty", parseFloat(e.target.value) || 1)
              }
              slotProps={{
                input: {
                  inputProps: { min: 1, step: 1 },
                },
              }}
            />
          </Grid>

          {/* Brands Section - Only show for existing materials */}
          {isEdit && (
            <Grid size={12}>
              <Accordion defaultExpanded={activeBrands.length > 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    Brands ({activeBrands.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                    {activeBrands.map((brand) => (
                      <Chip
                        key={brand.id}
                        label={brand.brand_name}
                        color={brand.is_preferred ? "primary" : "default"}
                        variant={brand.is_preferred ? "filled" : "outlined"}
                        onDelete={() => handleDeleteBrand(brand)}
                        icon={
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePreferred(brand);
                            }}
                            sx={{ p: 0 }}
                          >
                            {brand.is_preferred ? (
                              <StarIcon fontSize="small" color="warning" />
                            ) : (
                              <StarBorderIcon fontSize="small" />
                            )}
                          </IconButton>
                        }
                      />
                    ))}
                  </Box>

                  <Box sx={{ display: "flex", gap: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Add brand name..."
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddBrand();
                        }
                      }}
                      sx={{ flex: 1 }}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleAddBrand}
                      disabled={!newBrandName.trim() || createBrand.isPending}
                    >
                      Add
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}
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
