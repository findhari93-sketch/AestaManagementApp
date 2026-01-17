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
  Chip,
  Button,
} from "@mui/material";
import { Star as StarIcon } from "@mui/icons-material";
import type { MaterialWithDetails, MaterialBrand } from "@/types/material.types";

interface BrandGroup {
  brandName: string;
  isPreferred: boolean;
  variants: MaterialBrand[];
}

interface BrandChecklistSectionProps {
  material: MaterialWithDetails;
  selectedBrands: Set<string>;
  brandPrices: Record<string, number>;
  onBrandToggle: (brandId: string, checked: boolean) => void;
  onPriceChange: (brandId: string, price: number) => void;
  disabled?: boolean;
}

// Group brands by brand_name
function groupBrandsByName(brands: MaterialBrand[]): BrandGroup[] {
  const groups = new Map<string, BrandGroup>();

  for (const brand of brands.filter(b => b.is_active)) {
    const key = brand.brand_name.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        brandName: brand.brand_name,
        isPreferred: brand.is_preferred,
        variants: [],
      });
    }
    const group = groups.get(key)!;
    group.variants.push(brand);
    // Mark group as preferred if any variant is preferred
    if (brand.is_preferred) {
      group.isPreferred = true;
    }
  }

  // Sort: preferred first, then alphabetically
  return Array.from(groups.values()).sort((a, b) => {
    if (a.isPreferred && !b.isPreferred) return -1;
    if (!a.isPreferred && b.isPreferred) return 1;
    return a.brandName.localeCompare(b.brandName);
  });
}

export default function BrandChecklistSection({
  material,
  selectedBrands,
  brandPrices,
  onBrandToggle,
  onPriceChange,
  disabled = false,
}: BrandChecklistSectionProps) {
  const brands = material.brands || [];
  const activeBrands = brands.filter(b => b.is_active);
  const groupedBrands = useMemo(() => groupBrandsByName(brands), [brands]);

  // Get all brand IDs in a group
  const getBrandIdsInGroup = (group: BrandGroup): string[] => {
    return group.variants.map(v => v.id);
  };

  // Check if all brands in a group are selected
  const isGroupFullySelected = (group: BrandGroup): boolean => {
    return group.variants.every(v => selectedBrands.has(v.id));
  };

  // Check if some (but not all) brands in a group are selected
  const isGroupPartiallySelected = (group: BrandGroup): boolean => {
    const selected = group.variants.filter(v => selectedBrands.has(v.id));
    return selected.length > 0 && selected.length < group.variants.length;
  };

  // Toggle all brands in a group
  const toggleGroup = (group: BrandGroup, checked: boolean) => {
    group.variants.forEach(variant => {
      onBrandToggle(variant.id, checked);
    });
  };

  // Select all brands
  const selectAll = () => {
    activeBrands.forEach(brand => {
      onBrandToggle(brand.id, true);
    });
  };

  // Deselect all brands
  const deselectAll = () => {
    activeBrands.forEach(brand => {
      onBrandToggle(brand.id, false);
    });
  };

  // Format variant display name
  const getVariantLabel = (brand: MaterialBrand): string => {
    return brand.variant_name || "Standard";
  };

  if (activeBrands.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: "grey.50" }}>
        <Typography variant="body2" color="text.secondary">
          No brands defined for this material.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Select Brands This Vendor Carries
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

      {/* Brand Groups */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {groupedBrands.map((group) => {
          const isFullySelected = isGroupFullySelected(group);
          const isPartiallySelected = isGroupPartiallySelected(group);

          return (
            <Paper
              key={group.brandName}
              variant="outlined"
              sx={{
                p: 1.5,
                bgcolor: isFullySelected ? "primary.50" : isPartiallySelected ? "grey.50" : "transparent",
              }}
            >
              {/* Brand Group Header */}
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isFullySelected}
                      indeterminate={isPartiallySelected}
                      onChange={(e) => toggleGroup(group, e.target.checked)}
                      disabled={disabled}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {group.brandName}
                      </Typography>
                      {group.isPreferred && (
                        <StarIcon fontSize="small" color="warning" sx={{ ml: 0.5 }} />
                      )}
                    </Box>
                  }
                />
                {group.isPreferred && (
                  <Chip label="Preferred" size="small" color="primary" sx={{ ml: 1 }} />
                )}
              </Box>

              {/* Variants */}
              <Box sx={{ pl: 3, display: "flex", flexDirection: "column", gap: 1 }}>
                {group.variants.map((variant) => {
                  const isSelected = selectedBrands.has(variant.id);
                  const price = brandPrices[variant.id] || 0;

                  return (
                    <Box
                      key={variant.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        py: 0.5,
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) => onBrandToggle(variant.id, e.target.checked)}
                            disabled={disabled}
                            size="small"
                          />
                        }
                        label={
                          <Typography variant="body2">
                            {getVariantLabel(variant)}
                          </Typography>
                        }
                        sx={{ minWidth: 140, mr: 0 }}
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
                          sx={{ width: 130 }}
                          slotProps={{
                            input: {
                              startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                              inputProps: { min: 0, step: 0.01 },
                            },
                          }}
                        />
                      )}

                      {/* Quality rating if available */}
                      {variant.quality_rating && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          Quality: {variant.quality_rating}/5
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* Summary */}
      <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Selected: <strong>{selectedBrands.size}</strong> of {activeBrands.length} brands
        </Typography>
        {selectedBrands.size === 0 && (
          <Typography variant="caption" color="error">
            Please select at least one brand
          </Typography>
        )}
      </Box>
    </Box>
  );
}
