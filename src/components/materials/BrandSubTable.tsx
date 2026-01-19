"use client";

import { useMemo, useState, useCallback } from "react";
import { Box, Typography, Button, Skeleton, Grid } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { useMaterialBrandPrices } from "@/hooks/queries/useVendorInventory";
import type { MaterialWithDetails, BrandWithVariants } from "@/types/material.types";
import BrandCard from "./BrandCard";
import VendorDrawer from "./VendorDrawer";
import AddVendorToMaterialDialog from "./AddVendorToMaterialDialog";

interface BrandSubTableProps {
  material: MaterialWithDetails;
  onOpenVendorDrawer?: (material: MaterialWithDetails) => void;
}

// Group brands by brand_name (e.g., "Ultratech", "Ultratech Super", "Ultratech Premium" → single "Ultratech" group)
function groupBrandsWithVariants(
  brands: NonNullable<MaterialWithDetails["brands"]>
): BrandWithVariants[] {
  const groups = new Map<string, BrandWithVariants>();

  for (const brand of brands.filter((b) => b.is_active)) {
    const key = brand.brand_name.toLowerCase();

    if (!groups.has(key)) {
      groups.set(key, {
        brand_name: brand.brand_name,
        is_preferred: brand.is_preferred,
        variants: [],
      });
    }

    const group = groups.get(key)!;
    group.variants.push({
      id: brand.id,
      variant_name: brand.variant_name,
      quality_rating: brand.quality_rating,
      notes: brand.notes,
      is_active: brand.is_active,
    });

    // If any variant is preferred, mark the group as preferred
    if (brand.is_preferred) {
      group.is_preferred = true;
    }
  }

  // Sort: preferred first, then alphabetically
  return Array.from(groups.values()).sort((a, b) => {
    if (a.is_preferred && !b.is_preferred) return -1;
    if (!a.is_preferred && b.is_preferred) return 1;
    return a.brand_name.localeCompare(b.brand_name);
  });
}

export default function BrandSubTable({ material }: BrandSubTableProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [addVendorBrand, setAddVendorBrand] = useState<{
    brandId: string;
    brandName: string;
    variantName: string | null;
  } | null>(null);

  // Group brands by brand_name
  const brandGroups = useMemo(
    () => groupBrandsWithVariants(material.brands || []),
    [material.brands]
  );

  // Fetch brand prices for this material
  const { data: brandPrices = new Map(), isLoading } = useMaterialBrandPrices(material.id);

  // Count total variants
  const totalVariants = useMemo(
    () => brandGroups.reduce((sum, group) => sum + group.variants.length, 0),
    [brandGroups]
  );

  // Handle adding vendor to specific brand variant
  const handleAddVendor = useCallback(
    (brandId: string, brandName: string, variantName: string | null) => {
      setAddVendorBrand({ brandId, brandName, variantName });
      setAddVendorOpen(true);
    },
    []
  );

  // Handle viewing vendors for a specific brand
  const handleViewVendors = useCallback((brandId: string) => {
    setSelectedBrandId(brandId);
  }, []);

  // Find the selected brand's details for VendorDrawer
  const selectedBrandDetails = useMemo(() => {
    if (!selectedBrandId) return null;
    const brand = material.brands?.find((b) => b.id === selectedBrandId);
    return brand || null;
  }, [selectedBrandId, material.brands]);

  if (isLoading) {
    return (
      <Box sx={{ p: 2, bgcolor: "grey.50" }}>
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (brandGroups.length === 0) {
    return (
      <Box sx={{ p: 2, bgcolor: "grey.50", textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          No brands added yet
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAddVendorOpen(true)}
        >
          Add Brand & Vendor
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ p: 2, bgcolor: "grey.50" }}>
        {/* Header with counts */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {brandGroups.length} Brand{brandGroups.length !== 1 ? "s" : ""},{" "}
            {totalVariants} Variant{totalVariants !== 1 ? "s" : ""}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddVendorOpen(true)}
          >
            Add Vendor
          </Button>
        </Box>

        {/* Grid of brand cards */}
        <Grid container spacing={2}>
          {brandGroups.map((brandGroup) => (
            <Grid key={brandGroup.brand_name} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <BrandCard
                materialId={material.id}
                brandGroup={brandGroup}
                brandPrices={brandPrices}
                onAddVendor={handleAddVendor}
                onViewVendors={handleViewVendors}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Vendor Drawer - shows vendors for selected brand */}
      <VendorDrawer
        open={!!selectedBrandId}
        onClose={() => setSelectedBrandId(null)}
        material={material}
        filteredBrandId={selectedBrandId || undefined}
        filterBrandLabel={
          selectedBrandDetails
            ? selectedBrandDetails.variant_name
              ? `${selectedBrandDetails.brand_name} ${selectedBrandDetails.variant_name}`
              : selectedBrandDetails.brand_name
            : undefined
        }
      />

      {/* Add Vendor Dialog */}
      <AddVendorToMaterialDialog
        open={addVendorOpen}
        onClose={() => {
          setAddVendorOpen(false);
          setAddVendorBrand(null);
        }}
        material={material}
        preSelectedBrandId={addVendorBrand?.brandId}
      />
    </>
  );
}
