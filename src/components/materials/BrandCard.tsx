"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Collapse,
} from "@mui/material";
import {
  Star as StarIcon,
  Store as StoreIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { formatCurrency } from "@/lib/formatters";
import type { BrandWithVariants } from "@/types/material.types";

interface BrandPriceInfo {
  bestPrice: number;
  vendorName: string;
  vendorCount: number;
  includesGst: boolean;
}

interface BrandCardProps {
  materialId: string;
  brandGroup: BrandWithVariants;
  brandPrices: Map<string, BrandPriceInfo>; // brandId (variant id) → price info
  onAddVendor: (brandId: string, brandName: string, variantName: string | null) => void;
  onViewVendors: (brandId: string) => void;
}

export default function BrandCard({
  materialId,
  brandGroup,
  brandPrices,
  onAddVendor,
  onViewVendors,
}: BrandCardProps) {
  const [expanded, setExpanded] = useState(true);

  // Calculate aggregated best price across all variants
  const aggregatedInfo = useMemo(() => {
    let bestPrice = Infinity;
    let bestVendorName = "";
    let totalVendorCount = 0;
    let includesGst = false;

    for (const variant of brandGroup.variants) {
      const priceInfo = brandPrices.get(variant.id);
      if (priceInfo) {
        totalVendorCount += priceInfo.vendorCount;
        if (priceInfo.bestPrice > 0 && priceInfo.bestPrice < bestPrice) {
          bestPrice = priceInfo.bestPrice;
          bestVendorName = priceInfo.vendorName;
          includesGst = priceInfo.includesGst;
        }
      }
    }

    return {
      bestPrice: bestPrice === Infinity ? 0 : bestPrice,
      bestVendorName,
      totalVendorCount,
      includesGst,
    };
  }, [brandGroup.variants, brandPrices]);

  const hasMultipleVariants = brandGroup.variants.length > 1;
  const shouldCollapse = brandGroup.variants.length > 4;

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderColor: brandGroup.is_preferred ? "primary.main" : "divider",
        borderWidth: brandGroup.is_preferred ? 2 : 1,
      }}
    >
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        {/* Brand Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {brandGroup.is_preferred && (
              <Tooltip title="Preferred Brand">
                <StarIcon sx={{ fontSize: 16, color: "warning.main" }} />
              </Tooltip>
            )}
            <Typography variant="subtitle2" fontWeight={600}>
              {brandGroup.brand_name}
            </Typography>
          </Box>
          {aggregatedInfo.bestPrice > 0 && (
            <Typography variant="subtitle2" fontWeight={600} color="success.main">
              {formatCurrency(aggregatedInfo.bestPrice)}
            </Typography>
          )}
        </Box>

        {/* Best vendor info */}
        {aggregatedInfo.bestVendorName && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Best @ {aggregatedInfo.bestVendorName}
            {aggregatedInfo.includesGst && " (incl. GST)"}
          </Typography>
        )}

        {aggregatedInfo.totalVendorCount === 0 && (
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
            No prices yet
          </Typography>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Variants List */}
        <Collapse in={expanded || !shouldCollapse} collapsedSize={shouldCollapse ? 100 : 0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {brandGroup.variants.map((variant) => {
              const priceInfo = brandPrices.get(variant.id);
              const displayName = variant.variant_name || "Standard";

              return (
                <Box
                  key={variant.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 0.5,
                    px: 1,
                    bgcolor: "grey.50",
                    borderRadius: 1,
                    gap: 1,
                  }}
                >
                  {/* Variant Name */}
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    • {displayName}
                  </Typography>

                  {/* Price */}
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    color={priceInfo?.bestPrice ? "success.main" : "text.disabled"}
                    sx={{ minWidth: 60, textAlign: "right" }}
                  >
                    {priceInfo?.bestPrice ? formatCurrency(priceInfo.bestPrice) : "-"}
                  </Typography>

                  {/* Vendor Count */}
                  {priceInfo && priceInfo.vendorCount > 0 ? (
                    <Chip
                      icon={<StoreIcon />}
                      label={priceInfo.vendorCount}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewVendors(variant.id);
                      }}
                      clickable
                      sx={{ height: 22, "& .MuiChip-label": { px: 0.5 } }}
                    />
                  ) : (
                    <Box sx={{ width: 40 }} /> // Spacer for alignment
                  )}

                  {/* Add Vendor Button */}
                  <Tooltip title="Add Vendor Price">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddVendor(variant.id, brandGroup.brand_name, variant.variant_name);
                      }}
                      sx={{ p: 0.25 }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        </Collapse>

        {/* Expand/Collapse Button for many variants */}
        {shouldCollapse && (
          <Button
            size="small"
            onClick={() => setExpanded(!expanded)}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ mt: 1, width: "100%" }}
          >
            {expanded ? "Show Less" : `Show All ${brandGroup.variants.length} Variants`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
