"use client";

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
} from "@mui/material";
import { useMaterialVariants } from "@/hooks/queries/useMaterials";
import type { MaterialWithDetails } from "@/types/material.types";

interface VariantChecklistSectionProps {
  parentMaterial: MaterialWithDetails;
  selectedVariants: Set<string>;
  variantPrices: Record<string, number>;
  onVariantToggle: (variantId: string, checked: boolean) => void;
  onPriceChange: (variantId: string, price: number) => void;
  disabled?: boolean;
}

// Format variant specs for display
function formatVariantSpecs(variant: MaterialWithDetails): string {
  const specs: string[] = [];

  if (variant.weight_per_unit) {
    specs.push(`${variant.weight_per_unit} ${variant.weight_unit || "kg"}/pc`);
  }

  if (variant.length_per_piece) {
    specs.push(`${variant.length_per_piece} ${variant.length_unit || "m"}`);
  }

  if (variant.rods_per_bundle) {
    specs.push(`${variant.rods_per_bundle} rods/bundle`);
  }

  return specs.join(" | ");
}

export default function VariantChecklistSection({
  parentMaterial,
  selectedVariants,
  variantPrices,
  onVariantToggle,
  onPriceChange,
  disabled = false,
}: VariantChecklistSectionProps) {
  const { data: variants = [], isLoading, error } = useMaterialVariants(parentMaterial.id);

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

      <Divider sx={{ mb: 2 }} />

      {/* Variant List */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {variants.map((variant) => {
          const isSelected = selectedVariants.has(variant.id);
          const price = variantPrices[variant.id] || 0;
          const specs = formatVariantSpecs(variant);

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
                        inputProps: { min: 0, step: 0.01 },
                      },
                    }}
                  />
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
