"use client";

import { useState } from "react";
import { Box, Grid, Typography } from "@mui/material";
import CalculatorWorkspace from "./CalculatorWorkspace";
import { EstimateBasketPanel } from "./EstimateBasketPanel";
import SitePickerForMR from "./SitePickerForMR";
import MaterialRequestDialog, {
  MRInitialItem,
} from "@/components/materials/MaterialRequestDialog";
import { useEstimateBasket } from "@/contexts/EstimateBasketContext";
import { getCalculatorTemplate } from "@/lib/category-calculator-templates";

function buildDimensionString(item: {
  categoryCode: string;
  inputs: Record<string, number>;
  units: Record<string, string>;
}): string {
  const template = getCalculatorTemplate(item.categoryCode);
  return template.inputs
    .map((field) => {
      const val = item.inputs[field.key];
      if (!val) return null;
      const unit = item.units[field.key] ?? field.defaultUnit;
      return `${field.label} ${val} ${unit}`;
    })
    .filter((p): p is string => p !== null)
    .join(" × ");
}

export default function CalculatorPageContent() {
  const [sitePickerOpen, setSitePickerOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [mrDialogOpen, setMrDialogOpen] = useState(false);
  const { items, clearBasket } = useEstimateBasket();

  const basketItems: MRInitialItem[] = items
    .map((item) => {
      const dims = buildDimensionString(item);
      const variant = item.pricingDimensionValue;
      const computed = `${item.computedOutput.toFixed(3)} ${item.outputUnit}`;
      const noteLines = [
        variant ? `${variant} — ${computed}` : computed,
        dims || null,
      ].filter((l): l is string => !!l);
      const selectedQuote = item.selectedVendorId
        ? item.vendorQuotes.find((q) => q.vendorId === item.selectedVendorId)
        : null;
      return {
        materialId: item.materialId ?? "",
        // Preserve the exact computed cft/ft figure — rounding to integers here
        // (the old `Math.ceil`) caused the MR row qty to be misread as piece
        // count when the priced unit is cft / ft, and the downstream PO line
        // multiplied the rounded count by the per-cft/ft rate.
        qty: parseFloat(item.computedOutput.toFixed(3)),
        brandId: item.brandId,
        unit: item.outputUnit,
        notes: noteLines.join("\n"),
        vendorId: item.selectedVendorId,
        unitPrice: selectedQuote?.unitPrice ?? null,
      };
    })
    .filter((i) => i.materialId !== "");

  function handleConvertToRequest() {
    setSitePickerOpen(true);
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 2, sm: 3 } }}>
      {/* Page header */}
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Material Cost Calculator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Estimate material costs and compare vendor prices before creating a
        request.
      </Typography>

      {/* Split-pane: calculator left, basket right */}
      <Grid container spacing={3} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 7 }}>
          <CalculatorWorkspace
            hideBasketControls
            onConvertToRequest={handleConvertToRequest}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <EstimateBasketPanel onConvertToRequest={handleConvertToRequest} />
        </Grid>
      </Grid>

      {/* Site picker + MR dialog */}
      <SitePickerForMR
        open={sitePickerOpen}
        onClose={() => setSitePickerOpen(false)}
        onSiteSelected={(siteId) => {
          setSelectedSiteId(siteId);
          setSitePickerOpen(false);
          setMrDialogOpen(true);
        }}
      />
      {selectedSiteId && (
        <MaterialRequestDialog
          open={mrDialogOpen}
          onClose={() => {
            setMrDialogOpen(false);
            clearBasket();
          }}
          request={null}
          siteId={selectedSiteId}
          initialItems={basketItems}
        />
      )}
    </Box>
  );
}
