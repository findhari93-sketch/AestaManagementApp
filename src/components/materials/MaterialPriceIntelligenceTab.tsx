"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Autocomplete,
  TextField,
  Skeleton,
  Alert,
  Tooltip,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  EmojiEvents as TrophyIcon,
  ShowChart as ChartIcon,
  History as HistoryIcon,
  FileDownload as DownloadIcon,
  Description as CsvIcon,
  Print as PrintIcon,
  TableChart as TableIcon,
  NotificationsActive as AlertIcon,
} from "@mui/icons-material";
import {
  useMaterialPriceHistory,
  useMaterialVendors,
} from "@/hooks/queries/useVendorInventory";
import PriceHistoryChart from "./PriceHistoryChart";
import PriceHistoryDialog from "./PriceHistoryDialog";
import PriceAlertsDialog from "./PriceAlertsDialog";
import { useMaterialPriceAlerts } from "@/hooks/queries/usePriceAlerts";
import {
  exportPriceHistoryToCSV,
  exportVendorPricingToCSV,
  exportPriceReportForPrint,
} from "@/lib/utils/priceHistoryExport";
import type {
  MaterialWithDetails,
  MaterialBrand,
  PriceHistoryWithDetails,
  VendorInventoryWithDetails,
} from "@/types/material.types";

interface MaterialPriceIntelligenceTabProps {
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

// Format date
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Calculate relative date
const getRelativeTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

export default function MaterialPriceIntelligenceTab({
  material,
}: MaterialPriceIntelligenceTabProps) {
  const [selectedBrand, setSelectedBrand] = useState<MaterialBrand | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyVendorId, setHistoryVendorId] = useState<string | null>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);

  const { data: priceHistory = [], isLoading: historyLoading } = useMaterialPriceHistory(
    material.id
  );
  const { data: vendorInventory = [], isLoading: inventoryLoading } = useMaterialVendors(
    material.id
  );
  const { data: alerts = [] } = useMaterialPriceAlerts(material.id);

  const isLoading = historyLoading || inventoryLoading;
  const activeAlertCount = alerts.filter((a) => a.is_active).length;
  const brands = material.brands?.filter((b) => b.is_active) || [];

  // Filter price history by selected brand
  const filteredHistory = useMemo(() => {
    if (!selectedBrand) return priceHistory;
    return priceHistory.filter((p) => p.brand_id === selectedBrand.id);
  }, [priceHistory, selectedBrand]);

  // Filter vendor inventory by selected brand
  const filteredInventory = useMemo(() => {
    if (!selectedBrand) return vendorInventory;
    return vendorInventory.filter((v) => v.brand_id === selectedBrand.id);
  }, [vendorInventory, selectedBrand]);

  // Transform price history for chart
  const chartData = useMemo(() => {
    return filteredHistory.map((record) => ({
      id: record.id,
      effective_date: record.recorded_date,
      price: record.price,
      vendor_name: record.vendor?.name,
    }));
  }, [filteredHistory]);

  // Calculate price statistics
  const priceStats = useMemo(() => {
    if (filteredHistory.length === 0) {
      return { avg: 0, min: 0, max: 0, trend: 0, trendDirection: "flat" as const };
    }

    const prices = filteredHistory.map((p) => p.price);
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Calculate trend from first to last (sorted by date desc, so reversed)
    const sorted = [...filteredHistory].sort(
      (a, b) => new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime()
    );
    const firstPrice = sorted[0]?.price || 0;
    const lastPrice = sorted[sorted.length - 1]?.price || 0;
    const trend = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
    const trendDirection: "up" | "down" | "flat" =
      trend > 2 ? "up" : trend < -2 ? "down" : "flat";

    return { avg, min, max, trend, trendDirection };
  }, [filteredHistory]);

  // Find best price vendor
  const bestPriceVendor = useMemo(() => {
    if (filteredInventory.length === 0) return null;
    return filteredInventory.reduce((best, current) => {
      const bestPrice = best.total_landed_cost || best.current_price || Infinity;
      const currentPrice = current.total_landed_cost || current.current_price || Infinity;
      return currentPrice < bestPrice ? current : best;
    }, filteredInventory[0]);
  }, [filteredInventory]);

  // Group recent prices by vendor for comparison
  const vendorPriceComparison = useMemo(() => {
    const vendorMap = new Map<string, {
      vendor: VendorInventoryWithDetails;
      latestHistory?: PriceHistoryWithDetails;
      priceCount: number;
    }>();

    // Add current vendor inventory
    filteredInventory.forEach((inv) => {
      if (inv.vendor?.name) {
        vendorMap.set(inv.vendor_id, {
          vendor: inv,
          priceCount: 0,
        });
      }
    });

    // Count price history entries per vendor
    filteredHistory.forEach((record) => {
      const entry = vendorMap.get(record.vendor_id);
      if (entry) {
        entry.priceCount++;
        if (!entry.latestHistory) {
          entry.latestHistory = record;
        }
      }
    });

    return Array.from(vendorMap.values())
      .sort((a, b) => {
        const aPrice = a.vendor.total_landed_cost || a.vendor.current_price || Infinity;
        const bPrice = b.vendor.total_landed_cost || b.vendor.current_price || Infinity;
        return aPrice - bPrice;
      });
  }, [filteredInventory, filteredHistory]);

  const handleViewHistory = (vendorId: string) => {
    setHistoryVendorId(vendorId);
    setHistoryDialogOpen(true);
  };

  const handleExportClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportMenuAnchor(null);
  };

  const getExportData = () => ({
    materialName: material.name,
    materialCode: material.code || undefined,
    materialUnit: material.unit,
    priceHistory: filteredHistory,
    vendorInventory: filteredInventory,
    selectedBrand: selectedBrand?.brand_name,
  });

  const handleExportPriceHistory = () => {
    exportPriceHistoryToCSV(getExportData());
    handleExportClose();
  };

  const handleExportVendorPricing = () => {
    exportVendorPricingToCSV(getExportData());
    handleExportClose();
  };

  const handleExportPrintReport = () => {
    exportPriceReportForPrint(getExportData());
    handleExportClose();
  };

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={60} />
        <Skeleton variant="rounded" height={300} />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  if (priceHistory.length === 0 && vendorInventory.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
        <ChartIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
        <Typography color="text.secondary">
          No price data available for this material yet.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Price data will appear here when vendors are added or prices are recorded.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Use the &quot;Brands &amp; Pricing&quot; tab to add vendor prices.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Header with Brand Filter and Export */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {brands.length > 0 ? (
            <>
              <Grid size={{ xs: 12, md: 4 }}>
                <Autocomplete
                  options={[{ id: "", brand_name: "All Brands" } as MaterialBrand, ...brands]}
                  getOptionLabel={(brand) =>
                    brand.id === ""
                      ? "All Brands"
                      : brand.variant_name
                      ? `${brand.brand_name} ${brand.variant_name}`
                      : brand.brand_name
                  }
                  value={selectedBrand}
                  onChange={(_, value) => {
                    setSelectedBrand(value?.id === "" ? null : value);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Filter by Brand" size="small" />
                  )}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {brands.slice(0, 5).map((brand) => (
                    <Chip
                      key={brand.id}
                      label={brand.brand_name}
                      size="small"
                      variant={selectedBrand?.id === brand.id ? "filled" : "outlined"}
                      color={selectedBrand?.id === brand.id ? "primary" : "default"}
                      onClick={() => setSelectedBrand(selectedBrand?.id === brand.id ? null : brand)}
                    />
                  ))}
                  {brands.length > 5 && (
                    <Chip label={`+${brands.length - 5} more`} size="small" variant="outlined" />
                  )}
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 2 }} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                <Tooltip title="Price Alerts">
                  <Button
                    variant={activeAlertCount > 0 ? "contained" : "outlined"}
                    size="small"
                    color={activeAlertCount > 0 ? "warning" : "inherit"}
                    onClick={() => setAlertsDialogOpen(true)}
                    sx={{ minWidth: "auto", px: 1 }}
                  >
                    <AlertIcon fontSize="small" />
                    {activeAlertCount > 0 && (
                      <Chip
                        label={activeAlertCount}
                        size="small"
                        color="warning"
                        sx={{ ml: 0.5, height: 18, minWidth: 18 }}
                      />
                    )}
                  </Button>
                </Tooltip>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportClick}
                  disabled={filteredHistory.length === 0 && filteredInventory.length === 0}
                >
                  Export
                </Button>
              </Grid>
            </>
          ) : (
            <Grid size={12} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Tooltip title="Price Alerts">
                <Button
                  variant={activeAlertCount > 0 ? "contained" : "outlined"}
                  size="small"
                  color={activeAlertCount > 0 ? "warning" : "inherit"}
                  onClick={() => setAlertsDialogOpen(true)}
                  sx={{ minWidth: "auto", px: 1 }}
                >
                  <AlertIcon fontSize="small" />
                  {activeAlertCount > 0 && (
                    <Chip
                      label={activeAlertCount}
                      size="small"
                      color="warning"
                      sx={{ ml: 0.5, height: 18, minWidth: 18 }}
                    />
                  )}
                </Button>
              </Tooltip>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleExportClick}
                disabled={priceHistory.length === 0 && vendorInventory.length === 0}
              >
                Export
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleExportClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleExportPriceHistory} disabled={filteredHistory.length === 0}>
          <ListItemIcon>
            <CsvIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Price History (CSV)"
            secondary={`${filteredHistory.length} records`}
          />
        </MenuItem>
        <MenuItem onClick={handleExportVendorPricing} disabled={filteredInventory.length === 0}>
          <ListItemIcon>
            <TableIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Vendor Pricing (CSV)"
            secondary={`${filteredInventory.length} vendors`}
          />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleExportPrintReport}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Print Report"
            secondary="Full report for printing/PDF"
          />
        </MenuItem>
      </Menu>

      {/* Price Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Average Price
            </Typography>
            <Typography variant="h5" fontWeight={600}>
              {formatCurrency(priceStats.avg)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              /{material.unit}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Price Range
            </Typography>
            <Typography variant="h6">
              <Typography component="span" color="success.main" fontWeight={600}>
                {formatCurrency(priceStats.min)}
              </Typography>
              {" - "}
              <Typography component="span" color="error.main" fontWeight={600}>
                {formatCurrency(priceStats.max)}
              </Typography>
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Price Trend
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
              {priceStats.trendDirection === "up" && (
                <TrendingUpIcon color="error" />
              )}
              {priceStats.trendDirection === "down" && (
                <TrendingDownIcon color="success" />
              )}
              {priceStats.trendDirection === "flat" && (
                <TrendingFlatIcon color="disabled" />
              )}
              <Typography
                variant="h5"
                fontWeight={600}
                color={
                  priceStats.trendDirection === "up"
                    ? "error.main"
                    : priceStats.trendDirection === "down"
                    ? "success.main"
                    : "text.primary"
                }
              >
                {priceStats.trend > 0 ? "+" : ""}
                {priceStats.trend.toFixed(1)}%
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              textAlign: "center",
              bgcolor: bestPriceVendor ? "success.50" : undefined,
              borderColor: bestPriceVendor ? "success.main" : undefined,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Best Price
            </Typography>
            {bestPriceVendor ? (
              <>
                <Typography variant="h5" fontWeight={600} color="success.main">
                  {formatCurrency(bestPriceVendor.total_landed_cost || bestPriceVendor.current_price)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  @ {bestPriceVendor.vendor?.name}
                </Typography>
              </>
            ) : (
              <Typography variant="h6" color="text.disabled">
                -
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Price Trend Chart */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Price Trend (Last 6 Months)
        </Typography>
        {chartData.length > 0 ? (
          <PriceHistoryChart
            data={chartData}
            height={280}
            showAverage
            materialUnit={material.unit}
          />
        ) : (
          <Box
            sx={{
              height: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "action.hover",
              borderRadius: 1,
            }}
          >
            <Typography color="text.secondary">
              {selectedBrand
                ? "No price history for this brand"
                : "No price history available"}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Vendor Price Comparison */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Vendor Price Comparison
        </Typography>

        {vendorPriceComparison.length > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Vendor</TableCell>
                <TableCell>Brand</TableCell>
                <TableCell align="right">Base Price</TableCell>
                <TableCell align="right">Landed Cost</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="center">History</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vendorPriceComparison.map(({ vendor, latestHistory, priceCount }, index) => {
                const isBest = bestPriceVendor?.id === vendor.id;
                return (
                  <TableRow
                    key={vendor.id}
                    sx={{
                      bgcolor: isBest ? "success.50" : undefined,
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {isBest && (
                          <Tooltip title="Best Price">
                            <TrophyIcon fontSize="small" color="warning" />
                          </Tooltip>
                        )}
                        <Typography variant="body2" fontWeight={isBest ? 600 : 400}>
                          {vendor.vendor?.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {vendor.brand ? (
                        <Chip
                          label={
                            vendor.brand.variant_name
                              ? `${vendor.brand.brand_name} ${vendor.brand.variant_name}`
                              : vendor.brand.brand_name
                          }
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Generic
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatCurrency(vendor.current_price)}
                        {vendor.price_includes_gst && (
                          <Typography component="span" variant="caption" color="text.secondary">
                            {" "}(incl. GST)
                          </Typography>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={isBest ? 600 : 400}
                        color={isBest ? "success.main" : "inherit"}
                      >
                        {formatCurrency(vendor.total_landed_cost || vendor.current_price)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {getRelativeTime(vendor.last_price_update)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {priceCount > 0 ? (
                        <Tooltip title={`View ${priceCount} price records`}>
                          <Chip
                            icon={<HistoryIcon sx={{ fontSize: 14 }} />}
                            label={priceCount}
                            size="small"
                            onClick={() => handleViewHistory(vendor.vendor_id)}
                            clickable
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          -
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <Alert severity="info">
            No vendor pricing available for this material
            {selectedBrand ? " with the selected brand" : ""}.
          </Alert>
        )}
      </Paper>

      {/* Price History Dialog */}
      {historyVendorId && (
        <PriceHistoryDialog
          open={historyDialogOpen}
          onClose={() => {
            setHistoryDialogOpen(false);
            setHistoryVendorId(null);
          }}
          materialId={material.id}
          materialName={material.name}
          vendorId={historyVendorId}
          materialUnit={material.unit}
        />
      )}

      {/* Price Alerts Dialog */}
      <PriceAlertsDialog
        open={alertsDialogOpen}
        onClose={() => setAlertsDialogOpen(false)}
        material={material}
      />
    </Box>
  );
}
