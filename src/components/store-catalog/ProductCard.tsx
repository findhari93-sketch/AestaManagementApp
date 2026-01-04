"use client";

import {
  Card,
  CardContent,
  CardMedia,
  Box,
  Typography,
  Chip,
  Skeleton,
} from "@mui/material";
import {
  LocalOffer as PriceIcon,
  CheckCircle as BestPriceIcon,
  TrendingDown as LowerPriceIcon,
  Inventory as ProductIcon,
} from "@mui/icons-material";
import type { StoreCatalogItem } from "@/types/material.types";

interface ProductCardProps {
  product: StoreCatalogItem;
  onClick?: () => void;
  compact?: boolean;
}

export default function ProductCard({
  product,
  onClick,
  compact = false,
}: ProductCardProps) {
  const productName = product.material?.name || product.custom_material_name || "Unknown Product";
  const productCode = product.material?.code || null;
  const unit = product.material?.unit || product.unit || "unit";
  const imageUrl = product.material?.image_url || null;
  const brandName = product.brand?.brand_name;
  const categoryName = product.category?.name;

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return "Price N/A";
    return `₹${price.toLocaleString("en-IN")}`;
  };

  return (
    <Card
      variant="outlined"
      sx={{
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease-in-out",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        "&:hover": onClick
          ? {
              boxShadow: 3,
              transform: "translateY(-2px)",
            }
          : {},
      }}
      onClick={onClick}
    >
      {/* Product Image */}
      {imageUrl ? (
        <CardMedia
          component="img"
          height={compact ? 100 : 140}
          image={imageUrl}
          alt={productName}
          sx={{
            objectFit: "cover",
            bgcolor: "grey.100",
          }}
        />
      ) : (
        <Box
          sx={{
            height: compact ? 100 : 140,
            bgcolor: "grey.100",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ProductIcon
            sx={{
              fontSize: compact ? 40 : 56,
              color: "grey.400",
            }}
          />
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1.5, pt: 1.5 }}>
        {/* Product Name & Code */}
        <Box mb={0.5}>
          <Typography
            variant="subtitle2"
            fontWeight={600}
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.3,
              minHeight: compact ? "2.6em" : "auto",
            }}
          >
            {productName}
          </Typography>
          {productCode && (
            <Typography variant="caption" color="text.secondary">
              {productCode}
            </Typography>
          )}
        </Box>

        {/* Price Section */}
        <Box
          sx={{
            bgcolor: "primary.50",
            borderRadius: 1,
            p: 1,
            mb: 1,
          }}
        >
          <Box display="flex" alignItems="baseline" gap={0.5}>
            <Typography
              variant="h6"
              fontWeight={700}
              color="primary.main"
              sx={{ fontSize: compact ? "1rem" : "1.25rem" }}
            >
              {formatPrice(product.current_price)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              /{unit}
            </Typography>
          </Box>

          {/* Price Comparison Badge */}
          {product.isBestPrice ? (
            <Chip
              size="small"
              icon={<BestPriceIcon sx={{ fontSize: 14 }} />}
              label="Best Price"
              color="success"
              sx={{
                mt: 0.5,
                height: 22,
                fontSize: "0.7rem",
                fontWeight: 600,
              }}
            />
          ) : product.lowestCompetingPrice ? (
            <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
              <LowerPriceIcon sx={{ fontSize: 14, color: "warning.main" }} />
              <Typography variant="caption" color="warning.main" fontWeight={500}>
                Lowest: {formatPrice(product.lowestCompetingPrice.price)} at{" "}
                {product.lowestCompetingPrice.vendorName}
              </Typography>
            </Box>
          ) : null}
        </Box>

        {/* Tags */}
        <Box display="flex" flexWrap="wrap" gap={0.5}>
          {brandName && (
            <Chip
              size="small"
              label={brandName}
              variant="outlined"
              sx={{ height: 20, fontSize: "0.65rem" }}
            />
          )}
          {categoryName && !compact && (
            <Chip
              size="small"
              label={categoryName}
              sx={{
                height: 20,
                fontSize: "0.65rem",
                bgcolor: "grey.100",
              }}
            />
          )}
          {product.gst_rate && !compact && (
            <Chip
              size="small"
              label={`${product.gst_rate}% GST`}
              sx={{
                height: 20,
                fontSize: "0.65rem",
                bgcolor: "grey.100",
              }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// Loading skeleton for the card
export function ProductCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <Skeleton
        variant="rectangular"
        height={compact ? 100 : 140}
        animation="wave"
      />
      <CardContent>
        <Skeleton variant="text" width="80%" height={24} />
        <Skeleton variant="text" width="40%" height={16} />
        <Box sx={{ bgcolor: "grey.50", borderRadius: 1, p: 1, my: 1 }}>
          <Skeleton variant="text" width="60%" height={28} />
          <Skeleton variant="rectangular" width={80} height={22} sx={{ mt: 0.5, borderRadius: 1 }} />
        </Box>
        <Box display="flex" gap={0.5}>
          <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={50} height={20} sx={{ borderRadius: 1 }} />
        </Box>
      </CardContent>
    </Card>
  );
}
