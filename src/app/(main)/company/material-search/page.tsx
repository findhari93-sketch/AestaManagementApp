"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Skeleton,
  Alert,
  Rating,
  Button,
  Divider,
  IconButton,
  Tooltip,
  Stack,
} from "@mui/material";
import {
  Search as SearchIcon,
  Store as StoreIcon,
  LocalShipping as DealerIcon,
  Factory as FactoryIcon,
  Person as PersonIcon,
  LocalShipping as TransportIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  History as HistoryIcon,
  ShoppingCart as OrderIcon,
  FilterList as FilterIcon,
  Handyman as RentalIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import RelatedPages from "@/components/layout/RelatedPages";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useMaterials,
  useMaterialCategories,
} from "@/hooks/queries/useMaterials";
import {
  useMaterialVendors,
  usePriceTrend,
} from "@/hooks/queries/useVendorInventory";
import type {
  MaterialWithDetails,
  MaterialCategory,
  VendorInventoryWithDetails,
  VendorType,
} from "@/types/material.types";
import { VENDOR_TYPE_LABELS } from "@/types/material.types";
import PriceHistoryDialog from "@/components/materials/PriceHistoryDialog";

// Vendor type icons mapping
const vendorTypeIcons: Record<VendorType, React.ReactNode> = {
  shop: <StoreIcon fontSize="small" />,
  dealer: <DealerIcon fontSize="small" />,
  manufacturer: <FactoryIcon fontSize="small" />,
  individual: <PersonIcon fontSize="small" />,
  rental_store: <RentalIcon fontSize="small" />,
};

// Format currency
const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "N/A";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Vendor Card Component
function VendorCard({
  vendorInventory,
  onViewHistory,
  onOrder,
}: {
  vendorInventory: VendorInventoryWithDetails;
  onViewHistory: () => void;
  onOrder: () => void;
}) {
  const vendor = vendorInventory.vendor;
  if (!vendor) return null;

  const totalCost =
    (vendorInventory.current_price || 0) +
    (vendorInventory.transport_cost || 0) +
    (vendorInventory.loading_cost || 0);

  return (
    <Card
      variant="outlined"
      sx={{
        "&:hover": { borderColor: "primary.main", boxShadow: 1 },
        transition: "all 0.2s",
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {vendorTypeIcons[vendor.vendor_type || "dealer"]}
              <Typography variant="subtitle1" fontWeight="medium">
                {vendor.shop_name || vendor.name}
              </Typography>
            </Box>
            {vendor.rating && (
              <Rating value={vendor.rating} size="small" readOnly precision={0.5} />
            )}
          </Box>

          {/* Vendor Type & Location */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip
              label={VENDOR_TYPE_LABELS[vendor.vendor_type || "dealer"]}
              size="small"
              variant="outlined"
            />
            {vendor.city && (
              <Chip label={vendor.city} size="small" variant="outlined" />
            )}
          </Box>

          <Divider />

          {/* Pricing */}
          <Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Unit Price:
              </Typography>
              <Typography variant="h6" color="primary.main" fontWeight="bold">
                {formatCurrency(vendorInventory.current_price)}
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                >
                  /{vendorInventory.unit || "unit"}
                </Typography>
              </Typography>
            </Box>

            {(vendorInventory.transport_cost ?? 0) > 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mt: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  + Transport:
                </Typography>
                <Typography variant="caption">
                  {formatCurrency(vendorInventory.transport_cost)}
                </Typography>
              </Box>
            )}

            {(vendorInventory.loading_cost ?? 0) > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary">
                  + Loading:
                </Typography>
                <Typography variant="caption">
                  {formatCurrency(vendorInventory.loading_cost)}
                </Typography>
              </Box>
            )}

            {((vendorInventory.transport_cost ?? 0) > 0 ||
              (vendorInventory.loading_cost ?? 0) > 0) && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mt: 0.5,
                  pt: 0.5,
                  borderTop: 1,
                  borderColor: "divider",
                }}
              >
                <Typography variant="body2" fontWeight="medium">
                  Total:
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="success.main">
                  {formatCurrency(totalCost)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Services */}
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {vendor.provides_transport && (
              <Chip
                icon={<TransportIcon fontSize="small" />}
                label="Transport"
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {vendor.provides_loading && (
              <Chip label="Loading" size="small" color="info" variant="outlined" />
            )}
            {vendorInventory.price_includes_gst && (
              <Chip label="GST Incl." size="small" variant="outlined" />
            )}
          </Box>

          {/* Min Order */}
          {(vendorInventory.min_order_qty ?? 0) > 0 && (
            <Typography variant="caption" color="text.secondary">
              Min Order: {vendorInventory.min_order_qty} {vendorInventory.unit}
            </Typography>
          )}

          {/* Actions */}
          <Box sx={{ display: "flex", gap: 1, pt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={onViewHistory}
              sx={{ flex: 1 }}
            >
              History
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<OrderIcon />}
              onClick={onOrder}
              sx={{ flex: 1 }}
            >
              Order
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// Main Page Component
export default function MaterialSearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] =
    useState<MaterialWithDetails | null>(null);
  const [sortBy, setSortBy] = useState<"price" | "rating" | "name">("price");
  const [vendorTypeFilter, setVendorTypeFilter] = useState<string>("");
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  const { userProfile } = useAuth();
  const isMobile = useIsMobile();
  const router = useRouter();

  // Fetch data
  const { data: materials = [], isLoading: materialsLoading } = useMaterials(
    selectedCategory || null
  );
  const { data: categories = [] } = useMaterialCategories();
  const { data: vendorInventories = [], isLoading: vendorsLoading } =
    useMaterialVendors(selectedMaterial?.id);

  // Filter materials by search
  const filteredMaterials = useMemo(() => {
    if (!searchTerm) return materials;
    const term = searchTerm.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.code?.toLowerCase().includes(term) ||
        m.local_name?.toLowerCase().includes(term)
    );
  }, [materials, searchTerm]);

  // Filter and sort vendors
  const sortedVendors = useMemo(() => {
    let filtered = vendorInventories;

    // Filter by vendor type
    if (vendorTypeFilter) {
      filtered = filtered.filter(
        (vi) => vi.vendor?.vendor_type === vendorTypeFilter
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price":
          return (a.current_price || 0) - (b.current_price || 0);
        case "rating":
          return (b.vendor?.rating || 0) - (a.vendor?.rating || 0);
        case "name":
          return (a.vendor?.name || "").localeCompare(b.vendor?.name || "");
        default:
          return 0;
      }
    });
  }, [vendorInventories, vendorTypeFilter, sortBy]);

  const handleMaterialSelect = useCallback(
    (material: MaterialWithDetails) => {
      setSelectedMaterial(material);
    },
    []
  );

  const handleViewHistory = useCallback((vendorId: string) => {
    setSelectedVendorId(vendorId);
    setPriceHistoryOpen(true);
  }, []);

  const handleOrder = useCallback((vendorId: string) => {
    if (!selectedMaterial) return;

    // Build URL params for pre-filling the PO page
    const params = new URLSearchParams({
      new: "true",
      vendorId,
      materialId: selectedMaterial.id,
      materialName: selectedMaterial.name,
      unit: selectedMaterial.unit,
      source: "material-search",
    });

    router.push(`/site/purchase-orders?${params.toString()}`);
  }, [selectedMaterial, router]);

  // Get parent categories only
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Price Comparison"
        subtitle="Search materials and compare vendor prices across suppliers"
      />

      <RelatedPages />

      <Grid container spacing={3}>
        {/* Search & Filters Panel */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle2" color="text.secondary">
                  Search Materials
                </Typography>

                <TextField
                  fullWidth
                  placeholder="Search by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    },
                  }}
                  size="small"
                />

                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {parentCategories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Divider />

                {/* Material List */}
                <Typography variant="subtitle2" color="text.secondary">
                  Materials ({filteredMaterials.length})
                </Typography>

                <Box
                  sx={{
                    maxHeight: isMobile ? 300 : 500,
                    overflow: "auto",
                    pr: 1,
                  }}
                >
                  {materialsLoading ? (
                    <Stack spacing={1}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} height={60} variant="rounded" />
                      ))}
                    </Stack>
                  ) : filteredMaterials.length === 0 ? (
                    <Alert severity="info">No materials found</Alert>
                  ) : (
                    <Stack spacing={1}>
                      {filteredMaterials.map((material) => (
                        <Card
                          key={material.id}
                          variant="outlined"
                          onClick={() => handleMaterialSelect(material)}
                          sx={{
                            cursor: "pointer",
                            bgcolor:
                              selectedMaterial?.id === material.id
                                ? "action.selected"
                                : "background.paper",
                            "&:hover": {
                              bgcolor: "action.hover",
                            },
                          }}
                        >
                          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                            <Typography variant="body2" fontWeight="medium">
                              {material.name}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
                              {material.code && (
                                <Chip
                                  label={material.code}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              <Chip
                                label={material.unit}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Vendor Comparison Panel */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              {!selectedMaterial ? (
                <Box
                  sx={{
                    py: 8,
                    textAlign: "center",
                    color: "text.secondary",
                  }}
                >
                  <SearchIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                  <Typography variant="h6">Select a Material</Typography>
                  <Typography variant="body2">
                    Choose a material from the list to compare vendor prices
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {/* Selected Material Info */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Box>
                      <Typography variant="h6">
                        {selectedMaterial.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedMaterial.category?.name} | Unit:{" "}
                        {selectedMaterial.unit}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${sortedVendors.length} vendors`}
                      color="primary"
                    />
                  </Box>

                  <Divider />

                  {/* Filters */}
                  <Box
                    sx={{
                      display: "flex",
                      gap: 2,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Sort By</InputLabel>
                      <Select
                        value={sortBy}
                        onChange={(e) =>
                          setSortBy(e.target.value as "price" | "rating" | "name")
                        }
                        label="Sort By"
                      >
                        <MenuItem value="price">Lowest Price</MenuItem>
                        <MenuItem value="rating">Highest Rating</MenuItem>
                        <MenuItem value="name">Name</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Vendor Type</InputLabel>
                      <Select
                        value={vendorTypeFilter}
                        onChange={(e) => setVendorTypeFilter(e.target.value)}
                        label="Vendor Type"
                      >
                        <MenuItem value="">All Types</MenuItem>
                        <MenuItem value="shop">Shop</MenuItem>
                        <MenuItem value="dealer">Dealer</MenuItem>
                        <MenuItem value="manufacturer">Manufacturer</MenuItem>
                        <MenuItem value="individual">Individual</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Vendor Cards */}
                  {vendorsLoading ? (
                    <Grid container spacing={2}>
                      {[1, 2, 3, 4].map((i) => (
                        <Grid key={i} size={{ xs: 12, sm: 6 }}>
                          <Skeleton height={280} variant="rounded" />
                        </Grid>
                      ))}
                    </Grid>
                  ) : sortedVendors.length === 0 ? (
                    <Alert severity="info">
                      No vendors found selling this material. Add vendor
                      inventory to track prices.
                    </Alert>
                  ) : (
                    <Grid container spacing={2}>
                      {sortedVendors.map((vi) => (
                        <Grid key={vi.id} size={{ xs: 12, sm: 6 }}>
                          <VendorCard
                            vendorInventory={vi}
                            onViewHistory={() =>
                              handleViewHistory(vi.vendor_id)
                            }
                            onOrder={() => handleOrder(vi.vendor_id)}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Price History Dialog */}
      {selectedMaterial && selectedVendorId && (
        <PriceHistoryDialog
          open={priceHistoryOpen}
          onClose={() => setPriceHistoryOpen(false)}
          materialId={selectedMaterial.id}
          vendorId={selectedVendorId}
          materialName={selectedMaterial.name}
        />
      )}
    </Box>
  );
}
