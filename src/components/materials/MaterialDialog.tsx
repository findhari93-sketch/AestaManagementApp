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
  InputAdornment,
} from "@mui/material";
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  AccountTree as AccountTreeIcon,
  Edit as EditIcon,
  Translate as TranslateIcon,
  Description as DescriptionIcon,
  Image as ImageIcon,
} from "@mui/icons-material";
import CategoryAutocomplete from "@/components/common/CategoryAutocomplete";
import FileUploader from "@/components/common/FileUploader";
import { createClient } from "@/lib/supabase/client";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useCreateMaterial,
  useUpdateMaterial,
  useCreateMaterialBrand,
  useDeleteMaterialBrand,
  useUpdateMaterialBrand,
  useParentMaterials,
  useCreateMaterialWithVariants,
  useMaterial,
} from "@/hooks/queries/useMaterials";
import type {
  MaterialWithDetails,
  MaterialCategory,
  MaterialFormData,
  MaterialUnit,
  MaterialBrand,
  VariantFormData,
} from "@/types/material.types";
import VariantInlineTable from "./VariantInlineTable";
import BrandVariantEditor from "./BrandVariantEditor";

// Category patterns that should hide certain fields
const CEMENT_CATEGORY_PATTERNS = ["cement", "ppc", "opc"];
const TMT_CATEGORY_PATTERNS = ["tmt", "steel", "bar", "rod"];

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
  const createMaterialWithVariants = useCreateMaterialWithVariants();
  const updateMaterial = useUpdateMaterial();
  const createBrand = useCreateMaterialBrand();
  const updateBrand = useUpdateMaterialBrand();
  const deleteBrand = useDeleteMaterialBrand();
  const { data: parentMaterials = [] } = useParentMaterials();

  // Fetch fresh material data to get updated brands after mutations
  const { data: freshMaterial } = useMaterial(material?.id);
  // Use fresh data for brands (falls back to prop if query not ready)
  const materialForBrands = freshMaterial || material;

  const [error, setError] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [isVariant, setIsVariant] = useState(false);
  const [variants, setVariants] = useState<VariantFormData[]>([]);
  const [showVariantSection, setShowVariantSection] = useState(false);
  const [showWeightSection, setShowWeightSection] = useState(false);
  // UX improvement toggles
  const [customizeCode, setCustomizeCode] = useState(false);
  const [showLocalName, setShowLocalName] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const supabase = createClient();
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
    weight_per_unit: null,
    weight_unit: "kg",
    length_per_piece: null,
    length_unit: "ft",
    image_url: "",
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
        weight_per_unit: material.weight_per_unit,
        weight_unit: material.weight_unit || "kg",
        length_per_piece: material.length_per_piece,
        length_unit: material.length_unit || "ft",
        image_url: material.image_url || "",
      });
      setIsVariant(!!material.parent_id);
      setVariants([]);
      setShowVariantSection(false);
      // Show weight section if material has weight/length data
      setShowWeightSection(!!material.weight_per_unit || !!material.length_per_piece);
      // Set UX toggles based on existing data
      setCustomizeCode(!!material.code);
      setShowLocalName(!!material.local_name);
      setShowDescription(!!material.description);
      setShowImageUpload(!!material.image_url);
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
        weight_per_unit: null,
        weight_unit: "kg",
        length_per_piece: null,
        length_unit: "ft",
        image_url: "",
      });
      setIsVariant(false);
      setVariants([]);
      setShowVariantSection(false);
      setShowWeightSection(false);
      // Reset UX toggles
      setCustomizeCode(false);
      setShowLocalName(false);
      setShowDescription(false);
      setShowImageUpload(false);
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

  // Get current category name for field visibility rules
  const currentCategoryName = useMemo(() => {
    if (!formData.category_id) return null;
    const category = categories.find(c => c.id === formData.category_id);
    if (!category) return null;
    // If it's a sub-category, also check the parent
    if (category.parent_id) {
      const parent = categories.find(c => c.id === category.parent_id);
      return `${parent?.name || ""} ${category.name}`.toLowerCase();
    }
    return category.name.toLowerCase();
  }, [formData.category_id, categories]);

  // Determine which fields to show based on category
  const fieldVisibility = useMemo(() => {
    const isCement = currentCategoryName
      ? CEMENT_CATEGORY_PATTERNS.some(p => currentCategoryName.includes(p))
      : false;
    const isTMT = currentCategoryName
      ? TMT_CATEGORY_PATTERNS.some(p => currentCategoryName.includes(p))
      : false;

    return {
      showHsnCode: !isCement, // Hide HSN for cement
      showMinOrderQty: !isCement, // Hide Min Order Qty for cement
      showWeightLengthToggle: isTMT, // Only show weight/length toggle for TMT
      defaultShowBrands: isCement, // Auto-expand brands for cement
    };
  }, [currentCategoryName]);

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
      } else if (variants.length > 0 && !isVariant) {
        // Create material with variants
        await createMaterialWithVariants.mutateAsync({
          ...dataToSubmit,
          variants,
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

  const handleAddBrand = async (brandName?: string, variantName?: string | null) => {
    const name = brandName || newBrandName;
    if (!material || !name.trim()) return;

    try {
      await createBrand.mutateAsync({
        material_id: material.id,
        brand_name: name.trim(),
        variant_name: variantName || null,
        is_preferred: false,
      });
      if (!brandName) {
        setNewBrandName("");
      }
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

  const isSubmitting =
    createMaterial.isPending ||
    createMaterialWithVariants.isPending ||
    updateMaterial.isPending;
  const activeBrands = materialForBrands?.brands?.filter((b) => b.is_active) || [];

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
          <Grid size={{ xs: 12, md: customizeCode ? 6 : 8 }}>
            <TextField
              fullWidth
              label="Material Name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
              autoFocus
              helperText={
                !customizeCode && (
                  <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    Code will be auto-generated
                    <Button
                      size="small"
                      onClick={() => setCustomizeCode(true)}
                      sx={{ minWidth: "auto", p: 0, ml: 0.5, textTransform: "none", fontSize: "0.75rem" }}
                      startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                    >
                      Customize
                    </Button>
                  </Box>
                )
              }
            />
          </Grid>
          {customizeCode && (
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                fullWidth
                label="Code"
                value={formData.code}
                onChange={(e) =>
                  handleChange("code", e.target.value.toUpperCase())
                }
                placeholder="Auto"
                helperText="Auto if empty"
              />
            </Grid>
          )}

          <Grid size={{ xs: 12, md: 4 }}>
            <CategoryAutocomplete
              value={formData.category_id || null}
              onChange={(value) => handleChange("category_id", value || "")}
              parentOnly={false}
              disabled={isVariant && !!formData.parent_id}
              label="Category"
              placeholder="Search categories..."
            />
          </Grid>

          {/* Optional Fields - Local Name and Description as toggle buttons */}
          <Grid size={12}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {!showLocalName && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<TranslateIcon />}
                  onClick={() => setShowLocalName(true)}
                  sx={{ textTransform: "none" }}
                >
                  Add Local Name (Tamil)
                </Button>
              )}
              {!showDescription && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DescriptionIcon />}
                  onClick={() => setShowDescription(true)}
                  sx={{ textTransform: "none" }}
                >
                  Add Description
                </Button>
              )}
              {!showImageUpload && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => setShowImageUpload(true)}
                  sx={{ textTransform: "none" }}
                >
                  Add Product Image
                </Button>
              )}
            </Box>
          </Grid>

          {showLocalName && (
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Local Name (Tamil)"
                value={formData.local_name}
                onChange={(e) => handleChange("local_name", e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setShowLocalName(false);
                          handleChange("local_name", "");
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}

          {showDescription && (
            <Grid size={{ xs: 12, md: showLocalName ? 6 : 12 }}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                multiline
                rows={2}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ alignSelf: "flex-start", mt: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setShowDescription(false);
                          handleChange("description", "");
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}

          {showImageUpload && (
            <Grid size={12}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <FileUploader
                    supabase={supabase}
                    bucketName="work-updates"
                    folderPath="product-photos"
                    fileNamePrefix="material"
                    accept="image"
                    label="Product Image"
                    value={formData.image_url ? { url: formData.image_url, name: "Product Image", size: 0 } : null}
                    onUpload={(file) => handleChange("image_url", file.url)}
                    onRemove={() => handleChange("image_url", "")}
                    compact
                    maxSizeMB={2}
                  />
                </Box>
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowImageUpload(false);
                    handleChange("image_url", "");
                  }}
                  sx={{ mt: 1 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Grid>
          )}

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

          {fieldVisibility.showHsnCode && (
            <Grid size={{ xs: 6, md: 4 }}>
              <TextField
                fullWidth
                label="HSN Code"
                value={formData.hsn_code}
                onChange={(e) => handleChange("hsn_code", e.target.value)}
              />
            </Grid>
          )}

          <Grid size={{ xs: 6, md: fieldVisibility.showHsnCode ? 4 : 6 }}>
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

          <Grid size={{ xs: 6, md: fieldVisibility.showMinOrderQty ? 6 : 12 }}>
            <TextField
              fullWidth
              label={`Reorder Level (${formData.unit})`}
              type="number"
              value={formData.reorder_level}
              onChange={(e) =>
                handleChange("reorder_level", parseFloat(e.target.value) || 0)
              }
              helperText="Alert when stock falls below this level"
              slotProps={{
                input: {
                  inputProps: { min: 0, step: 1 },
                  endAdornment: <InputAdornment position="end">{formData.unit}</InputAdornment>,
                },
              }}
            />
          </Grid>

          {fieldVisibility.showMinOrderQty && (
            <Grid size={{ xs: 6, md: 6 }}>
              <TextField
                fullWidth
                label={`Min Order Quantity (${formData.unit})`}
                type="number"
                value={formData.min_order_qty}
                onChange={(e) =>
                  handleChange("min_order_qty", parseFloat(e.target.value) || 1)
                }
                helperText="Minimum quantity when placing orders"
                slotProps={{
                  input: {
                    inputProps: { min: 1, step: 1 },
                    endAdornment: <InputAdornment position="end">{formData.unit}</InputAdornment>,
                  },
                }}
              />
            </Grid>
          )}

          {/* Weight & Length Section - Only show toggle for TMT/Steel materials */}
          {fieldVisibility.showWeightLengthToggle && (
            <Grid size={12}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showWeightSection}
                      onChange={(e) => setShowWeightSection(e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary">
                      Enable Weight & Length Tracking
                    </Typography>
                  }
                />
              </Box>
            </Grid>
          )}

          {fieldVisibility.showWeightLengthToggle && showWeightSection && (
            <>
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                  Common Settings (Applied to All Variants)
                </Typography>
              </Grid>

              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  fullWidth
                  label="Length per Piece"
                  type="number"
                  value={formData.length_per_piece ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "length_per_piece",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  helperText="e.g., 40ft for TMT bars"
                  slotProps={{
                    input: {
                      inputProps: { min: 0, step: 0.1 },
                    },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Length Unit</InputLabel>
                  <Select
                    value={formData.length_unit || "ft"}
                    onChange={(e) => handleChange("length_unit", e.target.value)}
                    label="Length Unit"
                  >
                    <MenuItem value="ft">Feet (ft)</MenuItem>
                    <MenuItem value="m">Meter (m)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Weight Unit</InputLabel>
                  <Select
                    value={formData.weight_unit || "kg"}
                    onChange={(e) => handleChange("weight_unit", e.target.value)}
                    label="Weight Unit"
                  >
                    <MenuItem value="kg">Kilogram (kg)</MenuItem>
                    <MenuItem value="g">Gram (g)</MenuItem>
                    <MenuItem value="ton">Ton</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  fullWidth
                  label="Weight per Unit"
                  type="number"
                  value={formData.weight_per_unit ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "weight_per_unit",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  helperText="For parent material (optional)"
                  slotProps={{
                    input: {
                      inputProps: { min: 0, step: 0.001 },
                    },
                  }}
                />
              </Grid>
            </>
          )}

          {/* Inline Variants Section - Only for new parent materials (not editing, not variants) */}
          {!isEdit && !isVariant && (
            <Grid size={12}>
              <Accordion
                expanded={showVariantSection}
                onChange={(_, expanded) => setShowVariantSection(expanded)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AccountTreeIcon fontSize="small" color="action" />
                    <Typography>
                      Add Variants{" "}
                      {variants.length > 0 && `(${variants.length})`}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <VariantInlineTable
                    parentName={formData.name}
                    parentCode={formData.code}
                    parentUnit={formData.unit}
                    variants={variants}
                    onVariantsChange={setVariants}
                  />
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}

          {/* Brands & Variants Section - Only show for existing materials */}
          {isEdit && material && (
            <Grid size={12}>
              <Accordion defaultExpanded={activeBrands.length > 0 || fieldVisibility.defaultShowBrands}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    Brands & Variants ({activeBrands.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <BrandVariantEditor
                    materialId={material.id}
                    brands={activeBrands}
                    categoryName={currentCategoryName}
                    onAddBrand={handleAddBrand}
                    onUpdateBrand={async (brandId, data) => {
                      await updateBrand.mutateAsync({ id: brandId, data });
                    }}
                    onDeleteBrand={handleDeleteBrand}
                    disabled={createBrand.isPending || updateBrand.isPending || deleteBrand.isPending}
                  />
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
