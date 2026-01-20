"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
  Button,
  TableRow,
  TableCell,
  Table,
  TableBody,
} from "@mui/material";
import {
  Store as StoreIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useMaterialVariants } from "@/hooks/queries/useMaterials";
import { useVendorsByVariants } from "@/hooks/queries/useVendorInventory";
import { formatCurrency } from "@/lib/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { hasEditPermission } from "@/lib/permissions";
import VendorDrawer from "./VendorDrawer";
import type { MaterialWithDetails } from "@/types/material.types";

interface VariantSubTableProps {
  parentMaterial: MaterialWithDetails;
}

const UNIT_LABELS: Record<string, string> = {
  kg: "Kg",
  g: "Gram",
  ton: "Ton",
  liter: "Ltr",
  ml: "ml",
  piece: "Pcs",
  bag: "Bag",
  bundle: "Bundle",
  sqft: "Sqft",
  sqm: "Sqm",
  cft: "Cft",
  cum: "Cum",
  nos: "Nos",
  rmt: "Rmt",
  box: "Box",
  set: "Set",
};

// Format variant specs for display (size/dimensions info)
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

export default function VariantSubTable({ parentMaterial }: VariantSubTableProps) {
  const router = useRouter();
  const { userProfile } = useAuth();
  const canEdit = hasEditPermission(userProfile?.role);
  const [selectedVariant, setSelectedVariant] = useState<MaterialWithDetails | null>(null);

  // Fetch variants for parent material
  const { data: variants = [], isLoading: isLoadingVariants } = useMaterialVariants(parentMaterial.id);

  // Get variant IDs for batch price fetching
  const variantIds = useMemo(() => variants.map((v) => v.id), [variants]);

  // Fetch vendor inventory for all variants
  const { data: variantInventory = [], isLoading: isLoadingInventory } = useVendorsByVariants(variantIds);

  // Build best prices map for each variant
  const variantPrices = useMemo(() => {
    const priceMap = new Map<string, { price: number; vendorName: string; vendorCount: number; includesGst: boolean }>();

    // Group inventory by variant
    const variantGroups = new Map<string, typeof variantInventory>();
    for (const inv of variantInventory) {
      const existing = variantGroups.get(inv.material_id) || [];
      existing.push(inv);
      variantGroups.set(inv.material_id, existing);
    }

    // Find best price for each variant
    for (const [variantId, invItems] of variantGroups) {
      let bestPrice = Infinity;
      let bestVendorName = "";
      let includesGst = false;

      // Count unique vendors (not total records, to handle duplicates)
      const uniqueVendorIds = new Set(invItems.map((inv) => inv.vendor_id));
      const uniqueVendorCount = uniqueVendorIds.size;

      for (const inv of invItems) {
        if (inv.current_price && inv.current_price < bestPrice) {
          bestPrice = inv.current_price;
          bestVendorName = inv.vendor?.name || "Unknown";
          includesGst = inv.price_includes_gst;
        }
      }

      if (bestPrice !== Infinity) {
        priceMap.set(variantId, {
          price: bestPrice,
          vendorName: bestVendorName,
          vendorCount: uniqueVendorCount,
          includesGst,
        });
      } else {
        priceMap.set(variantId, {
          price: 0,
          vendorName: "",
          vendorCount: uniqueVendorCount,
          includesGst: false,
        });
      }
    }

    return priceMap;
  }, [variantInventory]);

  const handleOpenVendorDrawer = useCallback((variant: MaterialWithDetails) => {
    setSelectedVariant(variant);
  }, []);

  // Format brand label helper (must be before early returns for hooks rules)
  const formatBrandLabel = useCallback((brand: { brand_name: string; variant_name?: string | null }) => {
    if (brand.variant_name) {
      return `${brand.brand_name} ${brand.variant_name}`;
    }
    return brand.brand_name;
  }, []);

  const isLoading = isLoadingVariants || (variantIds.length > 0 && isLoadingInventory);

  if (isLoading) {
    return (
      <Box sx={{ py: 1 }}>
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={40} sx={{ mt: 0.5 }} />
      </Box>
    );
  }

  if (variants.length === 0) {
    return null;
  }

  return (
    <>
      {/* Use MUI Table for proper alignment with parent MRT table */}
      <Table
        size="small"
        sx={{
          // Remove default table spacing to align with MRT
          "& .MuiTableCell-root": {
            py: 0.75,
            px: 1.5,
            fontSize: "0.8rem",
            borderBottom: "1px solid",
            borderColor: "divider",
          },
          // Match MRT's compact density
          tableLayout: "fixed",
        }}
      >
        <TableBody>
          {variants.map((variant, index) => {
            const priceInfo = variantPrices.get(variant.id);
            const specs = formatVariantSpecs(variant);
            const brands = variant.brands?.filter((b) => b.is_active) || [];

            return (
              <TableRow
                key={variant.id}
                hover
                sx={{
                  bgcolor: "action.hover",
                  "&:last-child .MuiTableCell-root": { borderBottom: "none" },
                }}
              >
                {/* Empty cell for expand button column alignment */}
                <TableCell sx={{ width: 48, p: 0 }} />

                {/* Material Column - 280px */}
                <TableCell sx={{ width: 280 }}>
                  <Box sx={{ pl: 2 }}>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{ color: "text.secondary" }}
                    >
                      {variant.name}
                    </Typography>
                    {variant.code && (
                      <Typography variant="caption" color="text.disabled" display="block">
                        {variant.code}
                      </Typography>
                    )}
                  </Box>
                </TableCell>

                {/* Unit Column - 70px */}
                <TableCell sx={{ width: 70 }}>
                  <Typography variant="body2" color="text.secondary">
                    {UNIT_LABELS[parentMaterial.unit] || parentMaterial.unit}
                  </Typography>
                </TableCell>

                {/* Sizes/Variants Column - 160px (shows specs) */}
                <TableCell sx={{ width: 160 }}>
                  {specs ? (
                    <Typography variant="caption" color="text.secondary">
                      {specs}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      -
                    </Typography>
                  )}
                </TableCell>

                {/* Vendors Column - 90px */}
                <TableCell sx={{ width: 90 }}>
                  {priceInfo && priceInfo.vendorCount > 0 ? (
                    <Chip
                      icon={<StoreIcon />}
                      label={priceInfo.vendorCount}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenVendorDrawer(variant);
                      }}
                      clickable
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="text"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenVendorDrawer(variant);
                      }}
                      sx={{ minWidth: 0, p: 0.5, fontSize: "0.75rem" }}
                    >
                      Add
                    </Button>
                  )}
                </TableCell>

                {/* Best Price Column - 130px */}
                <TableCell sx={{ width: 130 }}>
                  {priceInfo && priceInfo.price > 0 ? (
                    <Tooltip title={`${priceInfo.vendorName}${priceInfo.includesGst ? " (incl. GST)" : ""}`}>
                      <Box>
                        <Typography variant="body2" fontWeight={500} color="success.main">
                          {formatCurrency(priceInfo.price)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            maxWidth: 100,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block",
                          }}
                        >
                          {priceInfo.vendorName}
                        </Typography>
                      </Box>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      -
                    </Typography>
                  )}
                </TableCell>

                {/* Brands Column - 160px */}
                <TableCell sx={{ width: 160 }}>
                  {brands.length > 0 ? (
                    <Tooltip title={brands.map(b => formatBrandLabel(b)).join(", ")} placement="top">
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {brands.slice(0, 2).map((brand) => (
                          <Chip
                            key={brand.id}
                            label={formatBrandLabel(brand)}
                            size="small"
                            color={brand.is_preferred ? "primary" : "default"}
                            variant={brand.is_preferred ? "filled" : "outlined"}
                            sx={{
                              maxWidth: 100,
                              height: 20,
                              fontSize: "0.7rem",
                              "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis", px: 0.75 },
                            }}
                          />
                        ))}
                        {brands.length > 2 && (
                          <Chip
                            label={`+${brands.length - 2}`}
                            size="small"
                            sx={{ height: 20, fontSize: "0.7rem" }}
                          />
                        )}
                      </Box>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      -
                    </Typography>
                  )}
                </TableCell>

                {/* Actions Column - matches row actions */}
                <TableCell sx={{ width: 120 }}>
                  <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/company/materials/${variant.id}`)}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        disabled={!canEdit}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        disabled={!canEdit}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Vendor Drawer for selected variant */}
      <VendorDrawer
        open={!!selectedVariant}
        onClose={() => setSelectedVariant(null)}
        material={selectedVariant}
      />
    </>
  );
}
