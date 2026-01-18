"use client";

import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from "@mui/material";
import {
  Close as CloseIcon,
  Phone as PhoneIcon,
  WhatsApp as WhatsAppIcon,
  CheckCircle as BestPriceIcon,
  TrendingDown as LowerPriceIcon,
  Inventory as ProductIcon,
  OpenInNew as OpenIcon,
  LocalOffer as PriceIcon,
  Category as CategoryIcon,
  Store as StoreIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useMaterialPriceComparison } from "@/hooks/queries/useStoreCatalog";
import { usePriceHistory } from "@/hooks/queries/useVendorInventory";
import type { StoreCatalogItem, VendorInventoryWithDetails } from "@/types/material.types";

interface ProductDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  product: StoreCatalogItem | null;
  vendorId: string;
  vendorName: string;
}

export default function ProductDetailDrawer({
  open,
  onClose,
  product,
  vendorId,
  vendorName,
}: ProductDetailDrawerProps) {
  const router = useRouter();

  const materialId = product?.material_id || undefined;
  const brandId = product?.brand_id || undefined;

  // Pass brandId to compare prices only within the same brand
  const { data: competingVendors = [], isLoading: vendorsLoading } =
    useMaterialPriceComparison(materialId, brandId);

  const { data: priceHistory = [], isLoading: historyLoading } =
    usePriceHistory(vendorId, materialId);

  if (!product) return null;

  const productName = product.material?.name || product.custom_material_name || "Unknown Product";
  const productCode = product.material?.code;
  const unit = product.material?.unit || product.unit || "unit";
  const imageUrl = product.material?.image_url;
  const description = product.material?.description;
  const categoryName = product.category?.name;

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return "N/A";
    return `₹${price.toLocaleString("en-IN")}`;
  };

  // Filter out current vendor from competing list
  const otherVendors = competingVendors.filter((v: VendorInventoryWithDetails) => v.vendor_id !== vendorId);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 420 },
          p: 0,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
          position: "sticky",
          top: 0,
          bgcolor: "background.paper",
          zIndex: 1,
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Product Details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {vendorName}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2, pb: 4, overflowY: "auto" }}>
        {/* Product Image */}
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={productName}
            sx={{
              width: "100%",
              height: 200,
              objectFit: "cover",
              borderRadius: 2,
              mb: 2,
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: 200,
              bgcolor: "grey.100",
              borderRadius: 2,
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ProductIcon sx={{ fontSize: 64, color: "grey.400" }} />
          </Box>
        )}

        {/* Product Name & Code */}
        <Typography variant="h5" fontWeight={600} gutterBottom>
          {productName}
        </Typography>
        {productCode && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Code: {productCode}
          </Typography>
        )}

        {/* Category & Brand */}
        <Stack direction="row" spacing={1} mb={2}>
          {categoryName && (
            <Chip
              size="small"
              icon={<CategoryIcon />}
              label={categoryName}
              variant="outlined"
            />
          )}
          {product.brand && (
            <Chip
              size="small"
              label={product.brand.brand_name}
              color="primary"
              variant="outlined"
            />
          )}
        </Stack>

        {/* Description */}
        {description && (
          <Typography variant="body2" color="text.secondary" mb={2}>
            {description}
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Price Section */}
        <Card variant="outlined" sx={{ mb: 2, bgcolor: "primary.50" }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Price at {vendorName}
            </Typography>
            <Box display="flex" alignItems="baseline" gap={1}>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {formatPrice(product.current_price)}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                /{unit}
              </Typography>
            </Box>

            {/* Price Breakdown */}
            <Box mt={2}>
              <Stack spacing={0.5}>
                {product.gst_rate && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      GST Rate
                    </Typography>
                    <Typography variant="body2">
                      {product.gst_rate}%
                      {product.price_includes_gst && " (included)"}
                    </Typography>
                  </Box>
                )}
                {product.transport_cost && !product.price_includes_transport && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Transport
                    </Typography>
                    <Typography variant="body2">
                      {formatPrice(product.transport_cost)}
                    </Typography>
                  </Box>
                )}
                {product.loading_cost && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Loading
                    </Typography>
                    <Typography variant="body2">
                      {formatPrice(product.loading_cost)}
                    </Typography>
                  </Box>
                )}
                {product.unloading_cost && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Unloading
                    </Typography>
                    <Typography variant="body2">
                      {formatPrice(product.unloading_cost)}
                    </Typography>
                  </Box>
                )}
                <Divider sx={{ my: 0.5 }} />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={600}>
                    Total Landed Cost
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatPrice(product.total_landed_cost)}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Best Price Badge */}
            <Box mt={2}>
              {product.isBestPrice ? (
                <Chip
                  icon={<BestPriceIcon />}
                  label="Best Price in Market"
                  color="success"
                  size="small"
                />
              ) : product.lowestCompetingPrice ? (
                <Chip
                  icon={<LowerPriceIcon />}
                  label={`Lower at ${product.lowestCompetingPrice.vendorName}: ${formatPrice(product.lowestCompetingPrice.price)}`}
                  color="warning"
                  size="small"
                />
              ) : null}
            </Box>
          </CardContent>
        </Card>

        {/* Other Vendors Selling This */}
        {materialId && (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Price Comparison ({otherVendors.length} other vendor{otherVendors.length !== 1 ? "s" : ""})
            </Typography>

            {vendorsLoading ? (
              <Stack spacing={1}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
                ))}
              </Stack>
            ) : otherVendors.length === 0 ? (
              <Card variant="outlined" sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  No other vendors sell this product
                </Typography>
              </Card>
            ) : (
              <List disablePadding>
                {otherVendors.slice(0, 5).map((vendor: VendorInventoryWithDetails, index: number) => (
                  <ListItem
                    key={vendor.id}
                    sx={{
                      bgcolor: index === 0 ? "success.50" : "transparent",
                      borderRadius: 1,
                      mb: 0.5,
                      border: 1,
                      borderColor: index === 0 ? "success.main" : "divider",
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <StoreIcon fontSize="small" color="action" />
                          <Typography variant="body2" fontWeight={500}>
                            {vendor.vendor?.shop_name || vendor.vendor?.name}
                          </Typography>
                          {index === 0 && (
                            <Chip size="small" label="Lowest" color="success" sx={{ height: 18, fontSize: "0.65rem" }} />
                          )}
                        </Box>
                      }
                      secondary={vendor.vendor?.city}
                    />
                    <ListItemSecondaryAction>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {formatPrice(vendor.current_price)}
                      </Typography>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Stack spacing={1}>
          {product.material_id && (
            <Button
              variant="outlined"
              startIcon={<OpenIcon />}
              onClick={() => router.push(`/company/materials/${product.material_id}`)}
              fullWidth
            >
              View Material Details
            </Button>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
