"use client";

import { Box, Typography, Tooltip } from "@mui/material";
import { formatCurrency } from "@/lib/formatters";

interface VariantPrice {
  variantId: string;
  variantName: string;
  price: number | null;
  priceIncludesGst: boolean;
  pricingMode?: 'per_piece' | 'per_kg' | null;
  unit?: string;
  // TMT-specific fields
  weightPerUnit?: number | null; // kg per meter
  lengthPerPiece?: number | null;
  lengthUnit?: string | null;
  rodsPerBundle?: number | null;
  pieceWeight?: number | null; // calculated kg per piece
}

interface VendorVariantPricesProps {
  variantPrices: VariantPrice[];
}

// Extract size label from variant name (e.g., "TMT Rods 8mm" -> "8mm")
function extractSizeLabel(variantName: string): string {
  const match = variantName.match(/(\d+)\s*mm/i);
  return match ? `${match[1]}mm` : variantName;
}

// Extract numeric size for sorting
function extractSize(variantName: string): number {
  const match = variantName.match(/(\d+)\s*mm/i);
  return match ? parseInt(match[1], 10) : 999;
}

// Format price compactly (₹307 instead of ₹307.00)
function formatCompactPrice(price: number): string {
  if (price >= 1000) {
    return `₹${(price / 1000).toFixed(1)}k`;
  }
  return price % 1 === 0 ? `₹${price}` : `₹${price.toFixed(1)}`;
}

export default function VendorVariantPrices({ variantPrices }: VendorVariantPricesProps) {
  if (variantPrices.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No variant prices available
      </Typography>
    );
  }

  // Sort variants by size (8mm, 10mm, 12mm, 16mm, 20mm)
  const sortedVariants = [...variantPrices].sort((a, b) =>
    extractSize(a.variantName) - extractSize(b.variantName)
  );

  // Check if any variant has TMT data (weight/bundle info)
  const hasTmtData = sortedVariants.some(vp => vp.pieceWeight || vp.rodsPerBundle);

  // Pre-calculate all prices
  const calculatedPrices = sortedVariants.map((vp) => {
    let pricePerPiece: number | null = null;
    let pricePerKg: number | null = null;
    let pricePerBundle: number | null = null;

    if (vp.price && vp.price > 0) {
      if (vp.pricingMode === 'per_kg' && vp.pieceWeight) {
        pricePerKg = vp.price;
        pricePerPiece = vp.price * vp.pieceWeight;
      } else {
        pricePerPiece = vp.price;
        if (vp.pieceWeight && vp.pieceWeight > 0) {
          pricePerKg = vp.price / vp.pieceWeight;
        }
      }
      if (pricePerPiece && vp.rodsPerBundle) {
        pricePerBundle = pricePerPiece * vp.rodsPerBundle;
      }
    }

    return {
      ...vp,
      pricePerPiece,
      pricePerKg,
      pricePerBundle,
      sizeLabel: extractSizeLabel(vp.variantName),
    };
  });

  return (
    <Box sx={{ mt: 0.5 }}>
      {/* Horizontal table layout */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `auto repeat(${sortedVariants.length}, 1fr)`,
          gap: 0,
          bgcolor: "grey.50",
          borderRadius: 1,
          overflow: "hidden",
          fontSize: "0.75rem",
        }}
      >
        {/* Header row - Size labels */}
        <Box sx={{ p: 0.5, fontWeight: 600, bgcolor: "grey.100" }} />
        {calculatedPrices.map((vp) => (
          <Box
            key={`header-${vp.variantId}`}
            sx={{
              p: 0.5,
              textAlign: "center",
              fontWeight: 600,
              bgcolor: "grey.100",
              borderLeft: "1px solid",
              borderColor: "grey.200",
            }}
          >
            <Typography variant="caption" fontWeight={600}>
              {vp.sizeLabel}
            </Typography>
          </Box>
        ))}

        {/* Price per piece row */}
        <Box sx={{ p: 0.5, fontWeight: 500, color: "text.secondary" }}>
          <Typography variant="caption">/pc</Typography>
        </Box>
        {calculatedPrices.map((vp) => (
          <Box
            key={`pc-${vp.variantId}`}
            sx={{
              p: 0.5,
              textAlign: "center",
              borderLeft: "1px solid",
              borderColor: "grey.200",
            }}
          >
            <Typography variant="caption" fontWeight={600} color="primary.main">
              {vp.pricePerPiece ? formatCompactPrice(vp.pricePerPiece) : "-"}
            </Typography>
          </Box>
        ))}

        {/* Price per kg row - only for TMT */}
        {hasTmtData && (
          <>
            <Box sx={{ p: 0.5, fontWeight: 500, color: "text.secondary", borderTop: "1px solid", borderColor: "grey.200" }}>
              <Typography variant="caption">/kg</Typography>
            </Box>
            {calculatedPrices.map((vp) => (
              <Tooltip
                key={`kg-${vp.variantId}`}
                title={vp.pricingMode === 'per_kg' ? "Billed rate" : "Calculated"}
              >
                <Box
                  sx={{
                    p: 0.5,
                    textAlign: "center",
                    borderLeft: "1px solid",
                    borderTop: "1px solid",
                    borderColor: "grey.200",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: vp.pricingMode === 'per_kg' ? 600 : 400,
                      color: vp.pricingMode === 'per_kg' ? "success.main" : "text.secondary",
                    }}
                  >
                    {vp.pricePerKg ? formatCompactPrice(vp.pricePerKg) : "-"}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </>
        )}

        {/* Price per bundle row - only for TMT */}
        {hasTmtData && (
          <>
            <Box sx={{ p: 0.5, fontWeight: 500, color: "text.secondary", borderTop: "1px solid", borderColor: "grey.200" }}>
              <Typography variant="caption">/bdl</Typography>
            </Box>
            {calculatedPrices.map((vp) => (
              <Tooltip
                key={`bdl-${vp.variantId}`}
                title={vp.rodsPerBundle ? `${vp.rodsPerBundle} rods/bundle` : ""}
              >
                <Box
                  sx={{
                    p: 0.5,
                    textAlign: "center",
                    borderLeft: "1px solid",
                    borderTop: "1px solid",
                    borderColor: "grey.200",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {vp.pricePerBundle ? formatCompactPrice(vp.pricePerBundle) : "-"}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}
