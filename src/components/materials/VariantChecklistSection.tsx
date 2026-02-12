"use client";

import { useMemo } from "react";
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  TextField,
  InputAdornment,
  Paper,
  Divider,
  Button,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { useMaterialVariants } from "@/hooks/queries/useMaterials";
import { calculatePieceWeight } from "@/lib/weightCalculation";
import type { MaterialWithDetails, MaterialBrand } from "@/types/material.types";

interface VariantChecklistSectionProps {
  parentMaterial: MaterialWithDetails;
  selectedVariants: Set<string>;
  variantPrices: Record<string, number>;
  onVariantToggle: (variantId: string, checked: boolean) => void;
  onPriceChange: (variantId: string, price: number) => void;
  disabled?: boolean;
  // New props for brand and pricing mode
  selectedBrandId?: string | null;
  onBrandChange?: (brandId: string | null) => void;
  pricingMode?: 'per_piece' | 'per_kg';
  onPricingModeChange?: (mode: 'per_piece' | 'per_kg') => void;
}

// Format variant specs for display
// Note: weight_per_unit is stored as weight per meter (industry standard)
// We calculate actual piece weight = weight_per_meter × length_per_piece
function formatVariantSpecs(variant: MaterialWithDetails): string {
  const specs: string[] = [];

  // Calculate actual piece weight from weight per meter and length
  if (variant.weight_per_unit && variant.length_per_piece) {
    const actualPieceWeight = calculatePieceWeight(
      variant.weight_per_unit,
      variant.length_per_piece,
      variant.length_unit || "ft"
    );
    if (actualPieceWeight) {
      specs.push(`~${actualPieceWeight.toFixed(2)} kg/pc`);
    }
  }

  if (variant.length_per_piece) {
    specs.push(`${variant.length_per_piece} ${variant.length_unit || "ft"}`);
  }

  if (variant.rods_per_bundle) {
    specs.push(`${variant.rods_per_bundle} rods/bundle`);
  }

  return specs.join(" | ");
}

// Get piece weight for a variant
function getPieceWeight(variant: MaterialWithDetails): number | null {
  if (variant.weight_per_unit && variant.length_per_piece) {
    return calculatePieceWeight(
      variant.weight_per_unit,
      variant.length_per_piece,
      variant.length_unit || "ft"
    );
  }
  return null;
}

export default function VariantChecklistSection({
  parentMaterial,
  selectedVariants,
  variantPrices,
  onVariantToggle,
  onPriceChange,
  disabled = false,
  selectedBrandId,
  onBrandChange,
  pricingMode = 'per_piece',
  onPricingModeChange,
}: VariantChecklistSectionProps) {
  const { data: variants = [], isLoading, error } = useMaterialVariants(parentMaterial.id);

  // Get unique brands from parent material
  const availableBrands = useMemo(() => {
    // Brands can be on the parent or on variants
    const allBrands: MaterialBrand[] = [];

    // Add parent material brands
    if (parentMaterial.brands) {
      allBrands.push(...parentMaterial.brands.filter(b => b.is_active));
    }

    // Also check variant brands (some materials have brand-specific variants)
    variants.forEach(variant => {
      if (variant.brands) {
        variant.brands.filter(b => b.is_active).forEach(brand => {
          if (!allBrands.find(b => b.id === brand.id)) {
            allBrands.push(brand);
          }
        });
      }
    });

    return allBrands;
  }, [parentMaterial.brands, variants]);

  // Check if any variant has weight data (to show per-kg option)
  const hasWeightBasedVariants = useMemo(() => {
    return variants.some(v => v.weight_per_unit && v.length_per_piece);
  }, [variants]);

  // Select all variants
  const selectAll = () => {
    variants.forEach((variant) => {
      onVariantToggle(variant.id, true);
    });
  };

  // Deselect all variants
  const deselectAll = () => {
    variants.forEach((variant) => {
      onVariantToggle(variant.id, false);
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load variants: {(error as Error).message}
      </Alert>
    );
  }

  if (variants.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: "grey.50" }}>
        <Typography variant="body2" color="text.secondary">
          No variants defined for this material.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Brand Selection - show if brands available */}
      {availableBrands.length > 0 && onBrandChange && (
        <Box sx={{ mb: 2 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Select Brand"
            value={selectedBrandId || ""}
            onChange={(e) => onBrandChange(e.target.value || null)}
            disabled={disabled}
            helperText="Select the brand for which you're adding prices"
          >
            <MenuItem value="">
              <em>No specific brand (generic)</em>
            </MenuItem>
            {availableBrands.map((brand) => (
              <MenuItem key={brand.id} value={brand.id}>
                {brand.brand_name}
                {brand.variant_name && ` - ${brand.variant_name}`}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      )}

      {/* Pricing Mode Toggle - show for weight-based materials */}
      {hasWeightBasedVariants && onPricingModeChange && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Price Entry Mode
          </Typography>
          <ToggleButtonGroup
            value={pricingMode}
            exclusive
            onChange={(_, value) => {
              if (value) onPricingModeChange(value);
            }}
            size="small"
            fullWidth
            disabled={disabled}
          >
            <ToggleButton value="per_piece">
              Per Piece
            </ToggleButton>
            <ToggleButton value="per_kg">
              Per Kg (from bill)
            </ToggleButton>
          </ToggleButtonGroup>
          {pricingMode === 'per_kg' && (
            <Typography variant="caption" color="info.main" sx={{ display: "block", mt: 0.5 }}>
              Enter the rate per kg as shown on vendor bills
            </Typography>
          )}
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Select Variants This Vendor Supplies
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" onClick={selectAll} disabled={disabled}>
            Select All
          </Button>
          <Button size="small" onClick={deselectAll} disabled={disabled}>
            Clear
          </Button>
        </Box>
      </Box>

      {/* Variant List */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {variants.map((variant) => {
          const isSelected = selectedVariants.has(variant.id);
          const price = variantPrices[variant.id] || 0;
          const specs = formatVariantSpecs(variant);
          const pieceWeight = getPieceWeight(variant);

          // Calculate equivalent price when in per_kg mode
          const equivalentPerPiecePrice = pricingMode === 'per_kg' && pieceWeight && price > 0
            ? price * pieceWeight
            : null;

          // Calculate equivalent per-kg price when in per_piece mode
          const equivalentPerKgPrice = pricingMode === 'per_piece' && pieceWeight && price > 0
            ? price / pieceWeight
            : null;

          return (
            <Paper
              key={variant.id}
              variant="outlined"
              sx={{
                p: 1.5,
                bgcolor: isSelected ? "primary.50" : "transparent",
                borderColor: isSelected ? "primary.main" : undefined,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 1,
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isSelected}
                      onChange={(e) => onVariantToggle(variant.id, e.target.checked)}
                      disabled={disabled}
                      size="small"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {variant.name}
                      </Typography>
                      {specs && (
                        <Typography variant="caption" color="text.secondary">
                          {specs}
                        </Typography>
                      )}
                    </Box>
                  }
                  sx={{ flex: 1, minWidth: 180, mr: 0 }}
                />

                {/* Price Input - only show when selected */}
                {isSelected && (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
                    <TextField
                      size="small"
                      type="number"
                      placeholder="Price"
                      value={price || ""}
                      onChange={(e) => onPriceChange(variant.id, parseFloat(e.target.value) || 0)}
                      disabled={disabled}
                      sx={{ width: 140 }}
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                          endAdornment: pricingMode === 'per_kg' ? (
                            <InputAdornment position="end">/kg</InputAdornment>
                          ) : undefined,
                          inputProps: { min: 0, step: 0.01 },
                        },
                      }}
                    />
                    {/* Show equivalent price */}
                    {equivalentPerPiecePrice !== null && (
                      <Tooltip title="Calculated: rate × piece weight">
                        <Typography variant="caption" color="success.main">
                          ≈ ₹{equivalentPerPiecePrice.toFixed(0)}/pc
                        </Typography>
                      </Tooltip>
                    )}
                    {equivalentPerKgPrice !== null && (
                      <Tooltip title="Calculated: price ÷ piece weight">
                        <Typography variant="caption" color="text.secondary">
                          ≈ ₹{equivalentPerKgPrice.toFixed(2)}/kg
                        </Typography>
                      </Tooltip>
                    )}
                  </Box>
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* Summary */}
      <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Selected: <strong>{selectedVariants.size}</strong> of {variants.length} variants
        </Typography>
        {selectedVariants.size === 0 && (
          <Typography variant="caption" color="error">
            Please select at least one variant
          </Typography>
        )}
      </Box>
    </Box>
  );
}
