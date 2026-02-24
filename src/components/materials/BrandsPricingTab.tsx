"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Stack,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Star as StarIcon,
  History as HistoryIcon,
  EmojiEvents as TrophyIcon,
  CompareArrows as CompareIcon,
  ViewList as ListIcon,
  Add as AddIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { useMaterialVendors } from "@/hooks/queries/useVendorInventory";
import { useVendors } from "@/hooks/queries/useVendors";
import VendorAutocomplete from "@/components/common/VendorAutocomplete";
import PriceHistoryDialog from "./PriceHistoryDialog";
import QuickPriceEntryDialog from "./QuickPriceEntryDialog";
import type {
  MaterialWithDetails,
  MaterialBrand,
  VendorInventoryWithDetails,
  VendorWithCategories,
  BrandWithVariants,
} from "@/types/material.types";

interface BrandsPricingTabProps {
  material: MaterialWithDetails;
}

// Format currency
const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Group brands by brand_name with their variants
function groupBrandsWithVariants(brands: MaterialBrand[]): BrandWithVariants[] {
  const groups = new Map<string, BrandWithVariants>();

  for (const brand of brands.filter(b => b.is_active)) {
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
      image_url: brand.image_url,
      is_active: brand.is_active,
    });
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

// Get vendors for a specific brand (and optionally variant)
function getVendorsForBrand(
  vendors: VendorInventoryWithDetails[],
  brandName: string,
  variantName: string | null
): VendorInventoryWithDetails[] {
  return vendors.filter(v => {
    if (!v.brand) return false;
    const brandMatch = v.brand.brand_name.toLowerCase() === brandName.toLowerCase();
    if (variantName === null) {
      // Match any variant of this brand
      return brandMatch;
    }
    // Match specific variant
    return brandMatch && v.brand.variant_name === variantName;
  });
}

// Find best price among vendors
function findBestPrice(vendors: VendorInventoryWithDetails[]): VendorInventoryWithDetails | null {
  if (vendors.length === 0) return null;
  return vendors.reduce((best, current) => {
    const bestCost = best.total_landed_cost || best.current_price || Infinity;
    const currentCost = current.total_landed_cost || current.current_price || Infinity;
    return currentCost < bestCost ? current : best;
  }, vendors[0]);
}

export default function BrandsPricingTab({ material }: BrandsPricingTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "compare">("list");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [historyVendorId, setHistoryVendorId] = useState<string | null>(null);

  // State for Quick Price Entry Dialog
  const [priceEntryOpen, setPriceEntryOpen] = useState(false);
  const [priceEntryData, setPriceEntryData] = useState<{
    vendor: VendorWithCategories;
    brand: MaterialBrand;
    existingInventory?: VendorInventoryWithDetails;
  } | null>(null);

  // State for Add Vendor dialog
  const [addVendorDialogOpen, setAddVendorDialogOpen] = useState(false);
  const [selectedNewVendorId, setSelectedNewVendorId] = useState<string | null>(null);
  const [selectedNewVendor, setSelectedNewVendor] = useState<VendorWithCategories | null>(null);

  const { data: vendors = [], isLoading, refetch: refetchVendors } = useMaterialVendors(material.id);
  const { data: allSystemVendors = [] } = useVendors();
  const brands = material.brands || [];

  // Group brands with variants
  const groupedBrands = useMemo(() => groupBrandsWithVariants(brands), [brands]);

  // Get all unique vendors for comparison view (with full vendor info)
  const allVendorsMap = useMemo(() => {
    const vendorMap = new Map<string, VendorWithCategories>();
    vendors.forEach(v => {
      if (v.vendor && !vendorMap.has(v.vendor_id)) {
        vendorMap.set(v.vendor_id, v.vendor as VendorWithCategories);
      }
    });
    return vendorMap;
  }, [vendors]);

  const allVendors = useMemo(() => {
    return Array.from(allVendorsMap.values())
      .map(v => ({ id: v.id, name: v.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allVendorsMap]);

  // Get MaterialBrand object by id
  const getBrandById = useCallback((brandId: string): MaterialBrand | undefined => {
    return brands.find(b => b.id === brandId);
  }, [brands]);

  // Get MaterialBrand by name and variant
  const getBrandByNameVariant = useCallback((brandName: string, variantName: string | null): MaterialBrand | undefined => {
    return brands.find(b =>
      b.brand_name.toLowerCase() === brandName.toLowerCase() &&
      b.variant_name === variantName &&
      b.is_active
    );
  }, [brands]);

  // Handler for opening price entry dialog
  const handleAddPrice = useCallback((vendorId: string, brandId: string, existingInv?: VendorInventoryWithDetails) => {
    const vendor = allVendorsMap.get(vendorId);
    const brand = getBrandById(brandId);
    if (vendor && brand) {
      setPriceEntryData({ vendor, brand, existingInventory: existingInv });
      setPriceEntryOpen(true);
    }
  }, [allVendorsMap, getBrandById]);

  // Handler for add price by brand name/variant
  const handleAddPriceByName = useCallback((vendorId: string, brandName: string, variantName: string | null, existingInv?: VendorInventoryWithDetails) => {
    const vendor = allVendorsMap.get(vendorId);
    const brand = getBrandByNameVariant(brandName, variantName);
    if (vendor && brand) {
      setPriceEntryData({ vendor, brand, existingInventory: existingInv });
      setPriceEntryOpen(true);
    }
  }, [allVendorsMap, getBrandByNameVariant]);

  // Get existing vendor IDs (to exclude from "add vendor" autocomplete)
  const existingVendorIds = useMemo(() => {
    return Array.from(allVendorsMap.keys());
  }, [allVendorsMap]);

  // Handler for vendor selection in Add Vendor dialog
  const handleVendorSelect = useCallback((
    value: string | string[] | null,
    vendor?: VendorWithCategories | VendorWithCategories[] | null
  ) => {
    if (typeof value === "string") {
      setSelectedNewVendorId(value);
      setSelectedNewVendor(vendor as VendorWithCategories || null);
    } else {
      setSelectedNewVendorId(null);
      setSelectedNewVendor(null);
    }
  }, []);

  // Handler for adding a new vendor's price - opens QuickPriceEntryDialog for first brand
  const handleAddNewVendorPrice = useCallback(() => {
    if (!selectedNewVendor) return;
    // Get the first active brand to start adding prices
    const firstBrand = brands.find(b => b.is_active);
    if (firstBrand) {
      setPriceEntryData({ vendor: selectedNewVendor, brand: firstBrand });
      setPriceEntryOpen(true);
    }
    setAddVendorDialogOpen(false);
    setSelectedNewVendorId(null);
    setSelectedNewVendor(null);
  }, [selectedNewVendor, brands]);

  // Get all brand/variant combinations for comparison
  const allBrandVariants = useMemo(() => {
    const results: Array<{ brandName: string; variantName: string | null; displayName: string }> = [];
    groupedBrands.forEach(group => {
      group.variants.forEach(variant => {
        results.push({
          brandName: group.brand_name,
          variantName: variant.variant_name,
          displayName: variant.variant_name
            ? `${group.brand_name} ${variant.variant_name}`
            : group.brand_name,
        });
      });
    });
    return results;
  }, [groupedBrands]);

  const toggleBrandExpanded = useCallback((brandName: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brandName)) {
        next.delete(brandName);
      } else {
        next.add(brandName);
      }
      return next;
    });
  }, []);

  const handleViewPriceHistory = useCallback((vendorId: string) => {
    setHistoryVendorId(vendorId);
    setPriceHistoryOpen(true);
  }, []);

  // Get price for a specific vendor and brand/variant
  const getVendorPrice = useCallback((
    vendorId: string,
    brandName: string,
    variantName: string | null
  ): VendorInventoryWithDetails | undefined => {
    return vendors.find(v => {
      if (v.vendor_id !== vendorId) return false;
      if (!v.brand) return false;
      const brandMatch = v.brand.brand_name.toLowerCase() === brandName.toLowerCase();
      if (variantName === null) {
        return brandMatch && !v.brand.variant_name;
      }
      return brandMatch && v.brand.variant_name === variantName;
    });
  }, [vendors]);

  if (brands.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">
          No brands added for this material yet.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Add brands in the Edit Material dialog to track prices by brand.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Header with View Mode Toggle and Add Button */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Brands & Pricing ({groupedBrands.length} brands, {allBrandVariants.length} variants)
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setAddVendorDialogOpen(true)}
          >
            Add Vendor Price
          </Button>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="list">
              <Tooltip title="Grouped by Brand">
                <ListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="compare">
              <Tooltip title="Price Comparison Matrix">
              <CompareIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
        </Box>
      </Box>

      {/* List View - Grouped by Brand */}
      {viewMode === "list" && (
        <Stack spacing={1}>
          {groupedBrands.map((group) => {
            const isExpanded = expandedBrands.has(group.brand_name);
            const brandVendors = getVendorsForBrand(vendors, group.brand_name, null);
            const bestPriceVendor = findBestPrice(brandVendors);

            return (
              <Paper key={group.brand_name} variant="outlined" sx={{ overflow: "hidden" }}>
                {/* Brand Header */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    px: 2,
                    py: 1.5,
                    bgcolor: group.is_preferred ? "primary.50" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleBrandExpanded(group.brand_name)}
                >
                  <IconButton size="small" sx={{ mr: 1 }}>
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>

                  {group.is_preferred && (
                    <Tooltip title="Preferred Brand">
                      <StarIcon fontSize="small" color="warning" sx={{ mr: 1 }} />
                    </Tooltip>
                  )}

                  <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                    {group.brand_name}
                  </Typography>

                  {group.variants.length > 1 && (
                    <Chip
                      label={`${group.variants.filter(v => v.variant_name).length} variants`}
                      size="small"
                      sx={{ mr: 2 }}
                    />
                  )}

                  {bestPriceVendor && (
                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        {formatCurrency(bestPriceVendor.total_landed_cost || bestPriceVendor.current_price)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Best @ {bestPriceVendor.vendor?.name}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Expanded Content - Variants and Vendors */}
                <Collapse in={isExpanded}>
                  <Box sx={{ px: 2, py: 1.5, bgcolor: "grey.50" }}>
                    {group.variants.map((variant, idx) => {
                      const variantVendors = getVendorsForBrand(
                        vendors,
                        group.brand_name,
                        variant.variant_name
                      );
                      const variantBestPrice = findBestPrice(variantVendors);

                      return (
                        <Box key={variant.id} sx={{ mb: idx < group.variants.length - 1 ? 2 : 0 }}>
                          {/* Variant Name */}
                          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {variant.variant_name || "Standard"}
                            </Typography>
                            {variantBestPrice && (
                              <Chip
                                icon={<TrophyIcon sx={{ fontSize: 14 }} />}
                                label={`Best: ${formatCurrency(variantBestPrice.total_landed_cost || variantBestPrice.current_price)}`}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Box>

                          {/* Vendors for this variant */}
                          {variantVendors.length > 0 ? (
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Vendor</TableCell>
                                  <TableCell align="right">Price</TableCell>
                                  <TableCell align="right">Landed Cost</TableCell>
                                  <TableCell align="center">Actions</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {variantVendors
                                  .sort((a, b) => (a.total_landed_cost || a.current_price || 999999) - (b.total_landed_cost || b.current_price || 999999))
                                  .map((inv) => {
                                    const isBest = variantBestPrice?.id === inv.id;
                                    return (
                                      <TableRow key={inv.id}>
                                        <TableCell>
                                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                            {isBest && <TrophyIcon fontSize="small" color="warning" />}
                                            <Typography variant="body2" fontWeight={isBest ? 600 : 400}>
                                              {inv.vendor?.name}
                                            </Typography>
                                          </Box>
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography variant="body2">
                                            {formatCurrency(inv.current_price)}
                                            {inv.price_includes_gst && (
                                              <Typography component="span" variant="caption" color="text.secondary">
                                                {" "}(incl. GST)
                                              </Typography>
                                            )}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography variant="body2" fontWeight={500} color={isBest ? "success.main" : "inherit"}>
                                            {formatCurrency(inv.total_landed_cost)}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                                            <Tooltip title="Edit Price">
                                              <IconButton
                                                size="small"
                                                onClick={() => handleAddPrice(
                                                  inv.vendor_id,
                                                  inv.brand_id!,
                                                  inv
                                                )}
                                              >
                                                <EditIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                            <Tooltip title="View Price History">
                                              <IconButton
                                                size="small"
                                                onClick={() => handleViewPriceHistory(inv.vendor_id)}
                                              >
                                                <HistoryIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                              </TableBody>
                            </Table>
                          ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                              No vendors have pricing for this variant yet
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Comparison View - Matrix */}
      {viewMode === "compare" && (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, minWidth: 150, position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1 }}>
                  Brand / Variant
                </TableCell>
                {allVendors.map(vendor => (
                  <TableCell key={vendor.id} align="center" sx={{ fontWeight: 600, minWidth: 100 }}>
                    {vendor.name}
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ fontWeight: 600, minWidth: 120, bgcolor: "success.50" }}>
                  Best Price
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allBrandVariants.map((bv) => {
                const rowVendors = allVendors.map(vendor => ({
                  vendor,
                  price: getVendorPrice(vendor.id, bv.brandName, bv.variantName),
                }));
                const bestInRow = rowVendors.reduce<{ vendor: typeof allVendors[0]; price: VendorInventoryWithDetails } | null>((best, curr) => {
                  if (!curr.price) return best;
                  if (!best) return curr as { vendor: typeof allVendors[0]; price: VendorInventoryWithDetails };
                  const bestCost = best.price.total_landed_cost || best.price.current_price || Infinity;
                  const currCost = curr.price.total_landed_cost || curr.price.current_price || Infinity;
                  return currCost < bestCost ? curr as { vendor: typeof allVendors[0]; price: VendorInventoryWithDetails } : best;
                }, null);

                return (
                  <TableRow key={`${bv.brandName}-${bv.variantName}`}>
                    <TableCell sx={{ position: "sticky", left: 0, bgcolor: "background.paper", fontWeight: 500 }}>
                      {bv.displayName}
                    </TableCell>
                    {rowVendors.map(({ vendor, price }) => {
                      const isBest = bestInRow?.vendor.id === vendor.id && !!price;
                      return (
                        <TableCell
                          key={vendor.id}
                          align="center"
                          sx={{
                            bgcolor: isBest ? "success.50" : undefined,
                            fontWeight: isBest ? 600 : 400,
                          }}
                        >
                          {price ? (
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                              <Tooltip title={`Click to edit price`}>
                                <Box
                                  sx={{ cursor: "pointer" }}
                                  onClick={() => handleAddPriceByName(vendor.id, bv.brandName, bv.variantName, price)}
                                >
                                  <Typography variant="body2" fontWeight={isBest ? 600 : 400} color={isBest ? "success.main" : "inherit"}>
                                    {formatCurrency(price.total_landed_cost || price.current_price)}
                                  </Typography>
                                  {isBest && <TrophyIcon sx={{ fontSize: 14, color: "warning.main" }} />}
                                </Box>
                              </Tooltip>
                            </Box>
                          ) : (
                            <Tooltip title={`Add price for ${vendor.name}`}>
                              <IconButton
                                size="small"
                                onClick={() => handleAddPriceByName(vendor.id, bv.brandName, bv.variantName)}
                                sx={{ color: "primary.main" }}
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ bgcolor: "success.50" }}>
                      {bestInRow ? (
                        <Box>
                          <Typography variant="body2" fontWeight={600} color="success.main">
                            {formatCurrency(bestInRow.price.total_landed_cost || bestInRow.price.current_price)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {bestInRow.vendor.name}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Price History Dialog */}
      {historyVendorId && (
        <PriceHistoryDialog
          open={priceHistoryOpen}
          onClose={() => {
            setPriceHistoryOpen(false);
            setHistoryVendorId(null);
          }}
          materialId={material.id}
          materialName={material.name}
          vendorId={historyVendorId}
          materialUnit={material.unit}
        />
      )}

      {/* Quick Price Entry Dialog */}
      {priceEntryData && (
        <QuickPriceEntryDialog
          open={priceEntryOpen}
          onClose={() => {
            setPriceEntryOpen(false);
            setPriceEntryData(null);
          }}
          material={material}
          vendor={priceEntryData.vendor}
          brand={priceEntryData.brand}
          existingInventory={priceEntryData.existingInventory}
          onSuccess={() => refetchVendors()}
        />
      )}

      {/* Add Vendor Price Dialog */}
      <Dialog
        open={addVendorDialogOpen}
        onClose={() => {
          setAddVendorDialogOpen(false);
          setSelectedNewVendorId(null);
          setSelectedNewVendor(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Vendor Price</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            Select a vendor to add prices for their brand offerings.
          </Alert>
          <VendorAutocomplete
            value={selectedNewVendorId}
            onChange={handleVendorSelect}
            excludeVendorIds={existingVendorIds}
            label="Select Vendor"
            placeholder="Search for a vendor..."
          />
          {selectedNewVendor && (
            <Alert severity="success" sx={{ mt: 2 }}>
              You'll add a price for <strong>{selectedNewVendor.name}</strong> starting with the first brand.
              After adding, you can continue adding prices for other brands.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddVendorDialogOpen(false);
            setSelectedNewVendorId(null);
            setSelectedNewVendor(null);
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddNewVendorPrice}
            disabled={!selectedNewVendor}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
