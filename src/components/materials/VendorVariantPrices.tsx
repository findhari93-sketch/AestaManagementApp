"use client";

import { Box, Typography, Chip } from "@mui/material";
import { formatCurrency } from "@/lib/formatters";

interface VariantPrice {
  variantId: string;
  variantName: string;
  price: number | null;
  priceIncludesGst: boolean;
  unit?: string;
}

interface VendorVariantPricesProps {
  variantPrices: VariantPrice[];
}

export default function VendorVariantPrices({ variantPrices }: VendorVariantPricesProps) {
  if (variantPrices.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No variant prices available
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
        Variant Prices:
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {variantPrices.map((vp, index) => (
          <Box
            key={vp.variantId}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 0.5,
              pl: 1,
              borderLeft: index === variantPrices.length - 1 ? "none" : "1px solid",
              borderColor: "divider",
              "&::before": {
                content: index === variantPrices.length - 1 ? '"└─"' : '"├─"',
                fontFamily: "monospace",
                color: "text.secondary",
                mr: 1,
              },
            }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>
              {vp.variantName}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography
                variant="body2"
                fontWeight={500}
                color={vp.price ? "primary.main" : "text.secondary"}
              >
                {vp.price ? formatCurrency(vp.price) : "N/A"}
                {vp.unit && vp.price && `/${vp.unit}`}
              </Typography>
              {vp.priceIncludesGst && vp.price && (
                <Chip
                  label="GST"
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: "0.65rem" }}
                />
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
