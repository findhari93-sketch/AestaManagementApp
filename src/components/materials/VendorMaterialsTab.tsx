"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Stack,
  Grid,
  Paper,
  Skeleton,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from "@mui/icons-material";
import { type MRT_ColumnDef, type MRT_Row } from "material-react-table";
import DataTable from "@/components/common/DataTable";
import {
  useVendorInventory,
  useDeleteVendorInventory,
  usePriceHistory,
} from "@/hooks/queries/useVendorInventory";
import VendorInventoryDialog from "./VendorInventoryDialog";
import PriceHistoryDialog from "./PriceHistoryDialog";
import PriceHistoryChart from "./PriceHistoryChart";
import type {
  VendorWithCategories,
  VendorInventoryWithDetails,
} from "@/types/material.types";

interface VendorMaterialsTabProps {
  vendor: VendorWithCategories;
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

// Expandable Price Detail Panel Component
function PriceDetailPanel({
  vendorId,
  materialId,
  materialName,
  materialUnit,
}: {
  vendorId: string;
  materialId: string;
  materialName: string;
  materialUnit: string;
}) {
  const { data: priceHistory = [], isLoading } = usePriceHistory(
    vendorId,
    materialId
  );

  // Calculate stats from price history
  const stats = useMemo(() => {
    if (priceHistory.length === 0) return null;

    const prices = priceHistory.map((p) => p.price);
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Calculate trend
    const sortedByDate = [...priceHistory].sort(
      (a, b) => new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime()
    );
    const first = sortedByDate[0]?.price || 0;
    const last = sortedByDate[sortedByDate.length - 1]?.price || 0;
    const trend = first > 0 ? ((last - first) / first) * 100 : 0;
    const trendDirection: "up" | "down" | "flat" =
      trend > 2 ? "up" : trend < -2 ? "down" : "flat";

    return { avg, min, max, trend, trendDirection };
  }, [priceHistory]);

  // Transform for chart
  const chartData = useMemo(() => {
    return priceHistory.map((record) => ({
      id: record.id,
      effective_date: record.recorded_date,
      price: record.price,
    }));
  }, [priceHistory]);

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={180} />
      </Box>
    );
  }

  if (priceHistory.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography color="text.secondary" variant="body2">
          No price history available for {materialName}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: "grey.50" }}>
      <Grid container spacing={2}>
        {/* Stats Summary */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Price Statistics
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  Average
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatCurrency(stats?.avg)}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  Min
                </Typography>
                <Typography variant="body2" color="success.main">
                  {formatCurrency(stats?.min)}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  Max
                </Typography>
                <Typography variant="body2" color="error.main">
                  {formatCurrency(stats?.max)}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Trend
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {stats?.trendDirection === "up" && (
                    <TrendingUpIcon fontSize="small" color="error" />
                  )}
                  {stats?.trendDirection === "down" && (
                    <TrendingDownIcon fontSize="small" color="success" />
                  )}
                  {stats?.trendDirection === "flat" && (
                    <TrendingFlatIcon fontSize="small" color="disabled" />
                  )}
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    color={
                      stats?.trendDirection === "up"
                        ? "error.main"
                        : stats?.trendDirection === "down"
                        ? "success.main"
                        : "text.secondary"
                    }
                  >
                    {stats && stats.trend > 0 ? "+" : ""}
                    {stats?.trend.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Price Trend Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Price Trend
            </Typography>
            <PriceHistoryChart
              data={chartData}
              height={140}
              showAverage={false}
              materialUnit={materialUnit}
            />
          </Paper>
        </Grid>

        {/* Recent Prices */}
        <Grid size={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Recent Price Records ({priceHistory.length})
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              {priceHistory.slice(0, 5).map((record) => (
                <Chip
                  key={record.id}
                  label={`${formatCurrency(record.price)} on ${formatDate(record.recorded_date)}`}
                  size="small"
                  variant="outlined"
                />
              ))}
              {priceHistory.length > 5 && (
                <Chip
                  label={`+${priceHistory.length - 5} more`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function VendorMaterialsTab({ vendor }: VendorMaterialsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VendorInventoryWithDetails | null>(null);
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [historyMaterial, setHistoryMaterial] = useState<{
    id: string;
    name: string;
    unit: string;
  } | null>(null);

  const { data: inventory = [], isLoading, error } = useVendorInventory(vendor.id);
  const deleteInventory = useDeleteVendorInventory();

  const handleAdd = useCallback(() => {
    setSelectedItem(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((item: VendorInventoryWithDetails) => {
    setSelectedItem(item);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (item: VendorInventoryWithDetails) => {
    if (window.confirm(`Remove ${item.material?.name || "this material"} from ${vendor.name}?`)) {
      try {
        await deleteInventory.mutateAsync({
          id: item.id,
          vendorId: vendor.id,
          materialId: item.material_id || undefined,
        });
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    }
  }, [deleteInventory, vendor]);

  const handleViewPriceHistory = useCallback((item: VendorInventoryWithDetails) => {
    if (item.material) {
      setHistoryMaterial({
        id: item.material.id,
        name: item.material.name,
        unit: item.material.unit || "unit",
      });
      setPriceHistoryOpen(true);
    }
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setSelectedItem(null);
  }, []);

  const columns = useMemo<MRT_ColumnDef<VendorInventoryWithDetails>[]>(
    () => [
      {
        accessorKey: "material.name",
        header: "Material",
        size: 200,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {row.original.material?.name || row.original.custom_material_name || "-"}
            </Typography>
            {row.original.material?.code && (
              <Typography variant="caption" color="text.secondary">
                {row.original.material.code}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "brand.brand_name",
        header: "Brand",
        size: 120,
        Cell: ({ row }) =>
          row.original.brand?.brand_name ? (
            <Chip label={row.original.brand.brand_name} size="small" variant="outlined" />
          ) : (
            <Typography variant="caption" color="text.secondary">
              Any
            </Typography>
          ),
      },
      {
        accessorKey: "current_price",
        header: "Unit Price",
        size: 100,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {formatCurrency(row.original.current_price)}
            </Typography>
            {row.original.price_includes_gst && (
              <Typography variant="caption" color="text.secondary">
                incl. GST
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "total_landed_cost",
        header: "Total Cost",
        size: 100,
        Cell: ({ row }) => (
          <Typography variant="body2" color="primary.main" fontWeight={600}>
            {formatCurrency(row.original.total_landed_cost)}
          </Typography>
        ),
      },
      {
        accessorKey: "unit",
        header: "Unit",
        size: 80,
        Cell: ({ row }) =>
          row.original.unit || row.original.material?.unit || "-",
      },
      {
        accessorKey: "min_order_qty",
        header: "MOQ",
        size: 80,
        Cell: ({ row }) => row.original.min_order_qty || "-",
      },
      {
        accessorKey: "lead_time_days",
        header: "Lead Time",
        size: 100,
        Cell: ({ row }) =>
          row.original.lead_time_days
            ? `${row.original.lead_time_days} day${row.original.lead_time_days > 1 ? "s" : ""}`
            : "-",
      },
      {
        accessorKey: "is_available",
        header: "Status",
        size: 100,
        Cell: ({ row }) =>
          row.original.is_available ? (
            <Chip
              icon={<CheckCircleIcon />}
              label="Available"
              size="small"
              color="success"
              variant="outlined"
            />
          ) : (
            <Chip
              icon={<CancelIcon />}
              label="N/A"
              size="small"
              color="default"
              variant="outlined"
            />
          ),
      },
    ],
    []
  );

  if (error) {
    return (
      <Alert severity="error">
        Failed to load materials: {(error as Error).message}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Stack>
          <Typography variant="h6">Materials Supplied</Typography>
          <Typography variant="body2" color="text.secondary">
            {inventory.length} material{inventory.length !== 1 ? "s" : ""} in catalog
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          size="small"
        >
          Add Material
        </Button>
      </Box>

      {/* Materials Table */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : inventory.length === 0 ? (
        <Alert severity="info">
          No materials added yet. Click &quot;Add Material&quot; to add materials this vendor supplies.
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={inventory}
          enableRowActions
          enableExpanding
          renderDetailPanel={({ row }: { row: MRT_Row<VendorInventoryWithDetails> }) =>
            row.original.material_id ? (
              <PriceDetailPanel
                vendorId={vendor.id}
                materialId={row.original.material_id}
                materialName={row.original.material?.name || "Unknown"}
                materialUnit={row.original.material?.unit || "unit"}
              />
            ) : null
          }
          renderRowActions={({ row }) => (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="Price History">
                <IconButton
                  size="small"
                  onClick={() => handleViewPriceHistory(row.original)}
                  disabled={!row.original.material_id}
                >
                  <HistoryIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleEdit(row.original)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(row.original)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          enablePagination={inventory.length > 10}
          pageSize={10}
          showRecordCount={false}
        />
      )}

      {/* Add/Edit Dialog */}
      <VendorInventoryDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        vendor={vendor}
        inventoryItem={selectedItem}
      />

      {/* Price History Dialog */}
      {historyMaterial && (
        <PriceHistoryDialog
          open={priceHistoryOpen}
          onClose={() => {
            setPriceHistoryOpen(false);
            setHistoryMaterial(null);
          }}
          materialId={historyMaterial.id}
          vendorId={vendor.id}
          materialName={historyMaterial.name}
          materialUnit={historyMaterial.unit}
        />
      )}
    </Box>
  );
}
