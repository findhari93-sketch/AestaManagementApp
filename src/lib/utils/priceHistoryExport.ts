/**
 * Price History Export Utilities
 * Handles exporting price history data to CSV and PDF formats
 */

import Papa from "papaparse";
import type { PriceHistoryWithDetails, VendorInventoryWithDetails } from "@/types/material.types";

// Format currency for export
const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format date for export
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export interface PriceExportData {
  materialName: string;
  materialCode?: string;
  materialUnit: string;
  priceHistory: PriceHistoryWithDetails[];
  vendorInventory: VendorInventoryWithDetails[];
  selectedBrand?: string;
}

/**
 * Export price history to CSV format
 */
export function exportPriceHistoryToCSV(data: PriceExportData): void {
  const { materialName, materialCode, materialUnit, priceHistory, vendorInventory, selectedBrand } = data;

  // Prepare price history rows
  const historyRows = priceHistory.map((record) => ({
    Date: formatDate(record.recorded_date),
    Vendor: record.vendor?.name || "",
    Brand: record.brand?.brand_name || "Generic",
    "Variant": record.brand?.variant_name || "",
    "Base Price": record.price,
    "Price Incl. GST": record.price_includes_gst ? "Yes" : "No",
    "GST Rate %": record.gst_rate || "",
    "Landed Cost": record.total_landed_cost || record.price,
    Source: record.source || "",
    Reference: record.source_reference || "",
    Notes: record.notes || "",
  }));

  // Convert to CSV using Papa Parse
  const csvContent = Papa.unparse(historyRows);

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const brandSuffix = selectedBrand ? `_${selectedBrand.replace(/\s+/g, "_")}` : "";
  const filename = `${materialName.replace(/\s+/g, "_")}${brandSuffix}_Price_History_${new Date().toISOString().split("T")[0]}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export vendor pricing comparison to CSV
 */
export function exportVendorPricingToCSV(data: PriceExportData): void {
  const { materialName, materialCode, materialUnit, vendorInventory, selectedBrand } = data;

  // Prepare vendor inventory rows
  const vendorRows = vendorInventory.map((inv) => ({
    Vendor: inv.vendor?.name || "",
    Brand: inv.brand?.brand_name || "Generic",
    Variant: inv.brand?.variant_name || "",
    "Base Price": inv.current_price || "",
    Unit: inv.unit || materialUnit,
    "Price Incl. GST": inv.price_includes_gst ? "Yes" : "No",
    "GST Rate %": inv.gst_rate || "",
    "Transport Cost": inv.transport_cost || "",
    "Loading Cost": inv.loading_cost || "",
    "Unloading Cost": inv.unloading_cost || "",
    "Landed Cost": inv.total_landed_cost || inv.current_price || "",
    "Min Order Qty": inv.min_order_qty || "",
    "Lead Time (Days)": inv.lead_time_days || "",
    Available: inv.is_available ? "Yes" : "No",
    "Last Updated": formatDate(inv.last_price_update),
  }));

  // Convert to CSV
  const csvContent = Papa.unparse(vendorRows);

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const brandSuffix = selectedBrand ? `_${selectedBrand.replace(/\s+/g, "_")}` : "";
  const filename = `${materialName.replace(/\s+/g, "_")}${brandSuffix}_Vendor_Pricing_${new Date().toISOString().split("T")[0]}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Calculate price statistics for report
 */
function calculatePriceStats(prices: number[]): {
  avg: number;
  min: number;
  max: number;
  count: number;
} {
  if (prices.length === 0) {
    return { avg: 0, min: 0, max: 0, count: 0 };
  }
  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    avg: sum / prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    count: prices.length,
  };
}

/**
 * Export comprehensive price report to PDF-like format (HTML for printing)
 */
export function exportPriceReportForPrint(data: PriceExportData): void {
  const { materialName, materialCode, materialUnit, priceHistory, vendorInventory, selectedBrand } = data;

  const prices = priceHistory.map((p) => p.price);
  const stats = calculatePriceStats(prices);

  // Find best price vendor
  const bestVendor = vendorInventory.reduce(
    (best, current) => {
      const bestPrice = best?.total_landed_cost || best?.current_price || Infinity;
      const currentPrice = current.total_landed_cost || current.current_price || Infinity;
      return currentPrice < bestPrice ? current : best;
    },
    vendorInventory[0] || null
  );

  // Group history by month for summary
  const monthlyData = priceHistory.reduce((acc, record) => {
    const month = new Date(record.recorded_date).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
    if (!acc[month]) {
      acc[month] = { prices: [], count: 0 };
    }
    acc[month].prices.push(record.price);
    acc[month].count++;
    return acc;
  }, {} as Record<string, { prices: number[]; count: number }>);

  // Generate HTML content
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Price Report - ${materialName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 1000px; margin: 0 auto; }
    h1 { color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; }
    h2 { color: #424242; margin-top: 30px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .stat-card { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1976d2; }
    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    .best-price { background: #e8f5e9 !important; }
    .summary-table { margin-bottom: 30px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Price Intelligence Report</h1>
  <div class="meta">
    <strong>Material:</strong> ${materialName} ${materialCode ? `(${materialCode})` : ""}<br>
    <strong>Unit:</strong> ${materialUnit}<br>
    ${selectedBrand ? `<strong>Brand Filter:</strong> ${selectedBrand}<br>` : ""}
    <strong>Report Date:</strong> ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
  </div>

  <h2>Price Statistics</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(stats.avg)}</div>
      <div class="stat-label">Average Price</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(stats.min)}</div>
      <div class="stat-label">Minimum Price</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(stats.max)}</div>
      <div class="stat-label">Maximum Price</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.count}</div>
      <div class="stat-label">Price Records</div>
    </div>
  </div>

  ${
    bestVendor
      ? `
  <h2>Best Price Vendor</h2>
  <table class="summary-table">
    <tr>
      <th>Vendor</th>
      <td>${bestVendor.vendor?.name || "-"}</td>
    </tr>
    <tr>
      <th>Brand</th>
      <td>${bestVendor.brand?.brand_name || "Generic"}${bestVendor.brand?.variant_name ? ` ${bestVendor.brand.variant_name}` : ""}</td>
    </tr>
    <tr>
      <th>Landed Cost</th>
      <td><strong>${formatCurrency(bestVendor.total_landed_cost || bestVendor.current_price)}</strong> per ${materialUnit}</td>
    </tr>
    <tr>
      <th>Last Updated</th>
      <td>${formatDate(bestVendor.last_price_update)}</td>
    </tr>
  </table>
  `
      : ""
  }

  <h2>Vendor Price Comparison</h2>
  <table>
    <thead>
      <tr>
        <th>Vendor</th>
        <th>Brand</th>
        <th>Base Price</th>
        <th>Landed Cost</th>
        <th>Last Updated</th>
      </tr>
    </thead>
    <tbody>
      ${vendorInventory
        .sort((a, b) => {
          const aPrice = a.total_landed_cost || a.current_price || Infinity;
          const bPrice = b.total_landed_cost || b.current_price || Infinity;
          return aPrice - bPrice;
        })
        .map(
          (inv, idx) => `
        <tr ${idx === 0 ? 'class="best-price"' : ""}>
          <td>${inv.vendor?.name || "-"}</td>
          <td>${inv.brand?.brand_name || "Generic"}${inv.brand?.variant_name ? ` ${inv.brand.variant_name}` : ""}</td>
          <td>${formatCurrency(inv.current_price)}</td>
          <td><strong>${formatCurrency(inv.total_landed_cost || inv.current_price)}</strong></td>
          <td>${formatDate(inv.last_price_update)}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  ${
    Object.keys(monthlyData).length > 0
      ? `
  <h2>Monthly Price Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th>Records</th>
        <th>Avg Price</th>
        <th>Min Price</th>
        <th>Max Price</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(monthlyData)
        .sort((a, b) => {
          // Sort by date (newest first)
          const dateA = new Date(a[0]);
          const dateB = new Date(b[0]);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 12)
        .map(([month, data]) => {
          const monthStats = calculatePriceStats(data.prices);
          return `
          <tr>
            <td>${month}</td>
            <td>${data.count}</td>
            <td>${formatCurrency(monthStats.avg)}</td>
            <td>${formatCurrency(monthStats.min)}</td>
            <td>${formatCurrency(monthStats.max)}</td>
          </tr>
        `;
        })
        .join("")}
    </tbody>
  </table>
  `
      : ""
  }

  <h2>Recent Price History</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Vendor</th>
        <th>Brand</th>
        <th>Price</th>
        <th>Landed Cost</th>
        <th>Source</th>
      </tr>
    </thead>
    <tbody>
      ${priceHistory
        .slice(0, 50)
        .map(
          (record) => `
        <tr>
          <td>${formatDate(record.recorded_date)}</td>
          <td>${record.vendor?.name || "-"}</td>
          <td>${record.brand?.brand_name || "Generic"}</td>
          <td>${formatCurrency(record.price)}</td>
          <td>${formatCurrency(record.total_landed_cost || record.price)}</td>
          <td>${record.source || "-"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <div class="no-print" style="margin-top: 30px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>
</body>
</html>
  `;

  // Open in new window for printing
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
