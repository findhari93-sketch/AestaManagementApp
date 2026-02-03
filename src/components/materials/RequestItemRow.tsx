"use client";

import { useState, useEffect, useMemo } from "react";
import {
  TableRow,
  TableCell,
  Checkbox,
  Box,
  Typography,
  TextField,
  Autocomplete,
  InputAdornment,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { Warning as WarningIcon } from "@mui/icons-material";
import { useVendorMaterialBrands, useVendorMaterialPrice } from "@/hooks/queries/useVendorInventory";
import type { RequestItemForConversion, MaterialBrand } from "@/types/material.types";
import { formatCurrency } from "@/lib/formatters";

interface RequestItemRowProps {
  item: RequestItemForConversion;
  vendorId: string | undefined;
  onToggle: () => void;
  onQuantityChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onTaxRateChange: (value: string) => void;
  onVariantChange: (variantId: string | null, variantName: string | null) => void;
  onBrandChange: (brandId: string | null, brandName: string | null) => void;
}

export default function RequestItemRow({
  item,
  vendorId,
  onToggle,
  onQuantityChange,
  onPriceChange,
  onTaxRateChange,
  onVariantChange,
  onBrandChange,
}: RequestItemRowProps) {
  const isDisabled = item.remaining_qty <= 0;

  // Get the effective material ID for brand lookup
  // If variant is selected, use variant's material_id, otherwise use the parent
  const effectiveMaterialId = item.selected_variant_id || item.material_id;

  // Fetch brands for the vendor + material combination
  const { data: vendorBrands = [], isLoading: isLoadingBrands } = useVendorMaterialBrands(
    vendorId,
    effectiveMaterialId
  );

  // Get unique brand names from vendor inventory
  const uniqueBrandNames = useMemo(() => {
    if (!vendorBrands || vendorBrands.length === 0) return [];
    const brandNames = new Set<string>();
    vendorBrands.forEach((b: any) => {
      if (b.brand_name) brandNames.add(b.brand_name);
    });
    return Array.from(brandNames).sort();
  }, [vendorBrands]);

  // Get brand variants for the selected brand name
  const brandVariantsForSelectedBrand = useMemo(() => {
    if (!item.selected_brand_name || !vendorBrands) return [];
    return vendorBrands.filter((b: any) => b.brand_name === item.selected_brand_name);
  }, [item.selected_brand_name, vendorBrands]);

  // Fetch price for the selected vendor + material + brand combination
  const { data: priceData, isLoading: isLoadingPrice } = useVendorMaterialPrice(
    vendorId,
    effectiveMaterialId,
    item.selected_brand_id
  );

  // Auto-fill price when price data is available and price is 0
  useEffect(() => {
    if (priceData?.price && item.unit_price === 0 && item.selected) {
      onPriceChange(priceData.price.toString());
    }
  }, [priceData, item.unit_price, item.selected, onPriceChange]);

  // Handle brand name selection
  const handleBrandNameChange = (brandName: string | null) => {
    if (!brandName) {
      onBrandChange(null, null);
      return;
    }

    // Find the brand record(s) for this brand name
    const brandsWithName = vendorBrands.filter((b: any) => b.brand_name === brandName);

    if (brandsWithName.length === 1) {
      // Single brand - auto-select it
      const brand = brandsWithName[0];
      onBrandChange(brand.id, brand.brand_name);
    } else if (brandsWithName.length > 1) {
      // Multiple variants - just set the brand name, user will select variant
      onBrandChange(null, brandName);
    }
  };

  // Handle brand variant selection
  const handleBrandVariantChange = (brand: MaterialBrand | null) => {
    if (!brand) {
      // Keep the brand name but clear the specific brand_id
      onBrandChange(null, item.selected_brand_name || null);
      return;
    }
    onBrandChange(brand.id, brand.brand_name);
  };

  // Calculate item total (including tax)
  const itemSubtotal = item.selected ? item.quantity_to_order * item.unit_price : 0;
  const itemTax = item.tax_rate ? (itemSubtotal * item.tax_rate) / 100 : 0;
  const itemTotal = itemSubtotal + itemTax;

  // Check if brand has variants
  const hasBrandVariants = brandVariantsForSelectedBrand.length > 1 ||
    (brandVariantsForSelectedBrand.length === 1 && (brandVariantsForSelectedBrand[0] as any).variant_name);

  // Find the currently selected brand variant
  const selectedBrandVariant = item.selected_brand_id
    ? vendorBrands.find((b: any) => b.id === item.selected_brand_id) as MaterialBrand | undefined
    : undefined;

  return (
    <TableRow
      sx={{
        opacity: isDisabled ? 0.5 : 1,
        bgcolor: item.selected && !isDisabled ? "action.selected" : undefined,
      }}
    >
      {/* Checkbox */}
      <TableCell padding="checkbox">
        <Checkbox
          checked={item.selected && !isDisabled}
          onChange={onToggle}
          disabled={isDisabled}
        />
      </TableCell>

      {/* Material with variant selection */}
      <TableCell>
        <Box>
          <Typography variant="body2">
            {item.material_name}
            {item.material_code && (
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ml: 1 }}
              >
                ({item.material_code})
              </Typography>
            )}
          </Typography>

          {/* Variant Selection - show if material has variants */}
          {item.has_variants && item.variants && item.variants.length > 0 && (
            <Autocomplete
              size="small"
              options={item.variants}
              getOptionLabel={(opt) => opt.name}
              value={item.variants.find(v => v.id === item.selected_variant_id) || null}
              onChange={(_, value) => {
                onVariantChange(value?.id || null, value?.name || null);
                // Clear brand when variant changes
                onBrandChange(null, null);
                // Reset price when variant changes
                onPriceChange("0");
              }}
              disabled={isDisabled || !item.selected}
              slotProps={{
                popper: { disablePortal: false }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select variant..."
                  size="small"
                  sx={{ mt: 0.5, maxWidth: 200 }}
                />
              )}
              sx={{ mt: 0.5 }}
            />
          )}

          {/* Show selected variant name if any */}
          {item.selected_variant_name && (
            <Typography variant="caption" color="primary.main" sx={{ display: "block", mt: 0.25 }}>
              Variant: {item.selected_variant_name}
            </Typography>
          )}
        </Box>
      </TableCell>

      {/* Brand Selection */}
      <TableCell>
        <Box sx={{ minWidth: 140 }}>
          {/* Brand name dropdown */}
          <Autocomplete
            size="small"
            options={uniqueBrandNames}
            value={item.selected_brand_name || null}
            onChange={(_, value) => handleBrandNameChange(value)}
            disabled={isDisabled || !item.selected || !vendorId}
            loading={isLoadingBrands}
            slotProps={{
              popper: { disablePortal: false }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={
                  !vendorId
                    ? "Select vendor"
                    : isLoadingBrands
                      ? "Loading..."
                      : uniqueBrandNames.length === 0
                        ? "No brands"
                        : "Select brand"
                }
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isLoadingBrands && <CircularProgress color="inherit" size={16} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          {/* Brand variant dropdown - show if brand has multiple variants */}
          {hasBrandVariants && item.selected_brand_name && (
            <Autocomplete
              size="small"
              options={brandVariantsForSelectedBrand as MaterialBrand[]}
              getOptionLabel={(opt) => (opt as any).variant_name || "Standard"}
              value={selectedBrandVariant || null}
              onChange={(_, value) => handleBrandVariantChange(value)}
              disabled={isDisabled || !item.selected}
              slotProps={{
                popper: { disablePortal: false }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select variant"
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              )}
              sx={{ mt: 0.5 }}
            />
          )}

          {/* Price loading indicator */}
          {isLoadingPrice && item.selected_brand_id && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
              <CircularProgress size={10} /> Loading price...
            </Typography>
          )}
        </Box>
      </TableCell>

      {/* Approved */}
      <TableCell align="right">
        {item.approved_qty} {item.unit}
      </TableCell>

      {/* Ordered */}
      <TableCell align="right">
        {item.already_ordered_qty > 0 ? (
          <Typography variant="body2" color="warning.main">
            {item.already_ordered_qty} {item.unit}
          </Typography>
        ) : (
          "-"
        )}
      </TableCell>

      {/* Remaining */}
      <TableCell align="right">
        {isDisabled ? (
          <Tooltip title="Already fully ordered">
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
              <WarningIcon fontSize="small" color="disabled" />
              <Typography variant="body2" color="text.disabled">
                0
              </Typography>
            </Box>
          </Tooltip>
        ) : (
          <Typography variant="body2" color="success.main" fontWeight={500}>
            {item.remaining_qty} {item.unit}
          </Typography>
        )}
      </TableCell>

      {/* Qty to Order */}
      <TableCell align="right">
        <TextField
          type="number"
          size="small"
          value={item.quantity_to_order || ""}
          onChange={(e) => onQuantityChange(e.target.value)}
          disabled={isDisabled || !item.selected}
          inputProps={{
            min: 0,
            max: item.remaining_qty,
            step: 1,
            style: { textAlign: "right", width: 60 },
          }}
        />
      </TableCell>

      {/* Unit Price */}
      <TableCell align="right">
        <TextField
          type="number"
          size="small"
          value={item.unit_price || ""}
          onChange={(e) => onPriceChange(e.target.value)}
          disabled={isDisabled || !item.selected}
          inputProps={{
            min: 0,
            step: 0.01,
            style: { textAlign: "right", width: 80 },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">₹</InputAdornment>
            ),
          }}
        />
        {/* Show last price hint if available */}
        {priceData?.price && item.unit_price !== priceData.price && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Last: {formatCurrency(priceData.price)}
          </Typography>
        )}
      </TableCell>

      {/* GST % */}
      <TableCell align="right">
        <TextField
          type="number"
          size="small"
          value={item.tax_rate || ""}
          onChange={(e) => onTaxRateChange(e.target.value)}
          disabled={isDisabled || !item.selected}
          inputProps={{
            min: 0,
            max: 100,
            step: 1,
            style: { textAlign: "right", width: 50 },
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">%</InputAdornment>
            ),
          }}
        />
      </TableCell>

      {/* Total */}
      <TableCell align="right">
        {item.selected && !isDisabled ? (
          <Typography variant="body2" fontWeight={500}>
            {formatCurrency(itemTotal)}
          </Typography>
        ) : (
          "-"
        )}
      </TableCell>
    </TableRow>
  );
}
