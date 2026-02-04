"use client";

import { useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  Fab,
  Alert,
  Grid,
  Tabs,
  Tab,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  TrendingDown as TrendingDownIcon,
  Lock as DedicatedIcon,
  LockOpen as SharedIcon,
  Inventory as InventoryIcon,
  Groups as GroupsIcon,
  Domain as SiteIcon,
  History as HistoryIcon,
  PlayArrow as UseIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import RelatedPages from "@/components/layout/RelatedPages";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasEditPermission } from "@/lib/permissions";
import {
  useSiteStock,
  useLowStockAlerts,
  useStockAdjustment,
  useAddInitialStock,
  useCompletedStock,
  type ExtendedStockInventory,
  type CompletedStockItem,
} from "@/hooks/queries/useStockInventory";
import {
  useMaterialUsage,
  useTodayUsageSummary,
  useDeleteMaterialUsage,
} from "@/hooks/queries/useMaterialUsage";
import { useMaterials, useMaterialCategories } from "@/hooks/queries/useMaterials";
import type {
  StockInventoryWithDetails,
  DailyMaterialUsageWithDetails,
  MaterialUnit,
  MaterialWithDetails,
} from "@/types/material.types";
import dayjs from "dayjs";
import UsageEntryDrawer from "@/components/inventory/UsageEntryDrawer";

const UNIT_LABELS: Record<MaterialUnit, string> = {
  kg: "Kg",
  g: "Gram",
  ton: "Ton",
  liter: "Ltr",
  ml: "ml",
  piece: "Pcs",
  bag: "Bag",
  bundle: "Bundle",
  sqft: "Sqft",
  sqm: "Sqm",
  cft: "Cft",
  cum: "Cum",
  nos: "Nos",
  rmt: "Rmt",
  box: "Box",
  set: "Set",
};

type MainTabType = "stock" | "usage";
type StockTabType = "site" | "shared" | "all" | "completed";

export default function InventoryPage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const { formatForApi, isAllTime } = useDateRange();
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit = hasEditPermission(userProfile?.role) || userProfile?.role === "site_engineer";

  // Main tab state from URL
  const mainTab = (searchParams.get("tab") as MainTabType) || "stock";
  const setMainTab = (tab: MainTabType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "stock") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.push(`/site/inventory${params.toString() ? `?${params.toString()}` : ""}`);
  };

  // Stock view state
  const [searchTerm, setSearchTerm] = useState("");
  const [stockTab, setStockTab] = useState<StockTabType>("all");
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    open: boolean;
    stock: StockInventoryWithDetails | null;
    type: "add" | "remove";
  }>({ open: false, stock: null, type: "add" });
  const [addStockDialog, setAddStockDialog] = useState(false);

  // Usage entry drawer state
  const [usageDrawerOpen, setUsageDrawerOpen] = useState(false);
  const [preSelectedStock, setPreSelectedStock] = useState<StockInventoryWithDetails | null>(null);

  // Date range for usage
  const { dateFrom, dateTo } = formatForApi();
  const dateRange = useMemo(() => {
    if (isAllTime) {
      return {
        startDate: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
        endDate: dayjs().format("YYYY-MM-DD"),
      };
    }
    return {
      startDate: dateFrom || dayjs().format("YYYY-MM-DD"),
      endDate: dateTo || dayjs().format("YYYY-MM-DD"),
    };
  }, [dateFrom, dateTo, isAllTime]);

  // Data queries
  // is_shared is determined by batch_code in useSiteStock (batch_code = group purchase = shared)
  const { data: stock = [], isLoading: stockLoading } = useSiteStock(selectedSite?.id);
  const { data: completedStock = [], isLoading: completedLoading } = useCompletedStock(selectedSite?.id);
  const { data: lowStockAlerts = [] } = useLowStockAlerts(selectedSite?.id);
  const { data: materials = [] } = useMaterials();
  const { data: usage = [], isLoading: usageLoading } = useMaterialUsage(selectedSite?.id, dateRange);
  const { data: todaySummary } = useTodayUsageSummary(selectedSite?.id);

  const stockAdjustment = useStockAdjustment();
  const addInitialStock = useAddInitialStock();
  const deleteUsage = useDeleteMaterialUsage();

  // Filter stock by search term and tab
  const filteredStock = useMemo(() => {
    // Completed tab uses different data source
    if (stockTab === "completed") {
      return [] as ExtendedStockInventory[];
    }

    let filtered = stock as ExtendedStockInventory[];

    if (stockTab === "site") {
      filtered = filtered.filter((s) => !s.is_shared);
    } else if (stockTab === "shared") {
      filtered = filtered.filter((s) => s.is_shared);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.material?.name?.toLowerCase().includes(term) ||
          s.material?.code?.toLowerCase().includes(term) ||
          s.brand?.brand_name?.toLowerCase().includes(term) ||
          s.batch_code?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [stock, searchTerm, stockTab]);

  // Filter completed stock by search term
  const filteredCompletedStock = useMemo(() => {
    if (!searchTerm) return completedStock;

    const term = searchTerm.toLowerCase();
    return completedStock.filter(
      (s) =>
        s.material_name?.toLowerCase().includes(term) ||
        s.material_code?.toLowerCase().includes(term) ||
        s.brand_name?.toLowerCase().includes(term) ||
        s.batch_code?.toLowerCase().includes(term)
    );
  }, [completedStock, searchTerm]);

  // Calculate stats
  const sharedStockCount = useMemo(() => {
    return (stock as ExtendedStockInventory[]).filter((s) => s.is_shared).length;
  }, [stock]);

  const totalStockValue = useMemo(() => {
    return stock.reduce((sum, s) => {
      const extendedStock = s as ExtendedStockInventory;
      // For per-kg pricing, use total_weight; for per-piece, use current_qty
      if (extendedStock.pricing_mode === "per_kg" && extendedStock.total_weight) {
        return sum + extendedStock.total_weight * (s.avg_unit_cost || 0);
      }
      return sum + s.current_qty * (s.avg_unit_cost || 0);
    }, 0);
  }, [stock]);

  // Use the extended stock type from the hook
  type ExtendedStock = ExtendedStockInventory;

  // Handle opening usage drawer with pre-selected stock
  const handleRecordUsage = (stockItem?: StockInventoryWithDetails) => {
    setPreSelectedStock(stockItem || null);
    setUsageDrawerOpen(true);
  };

  // Stock table columns
  const stockColumns = useMemo<MRT_ColumnDef<StockInventoryWithDetails>[]>(
    () => [
      {
        accessorKey: "material.name",
        header: "Material",
        size: 200,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {row.original.material?.name}
            </Typography>
            {row.original.material?.code && (
              <Typography variant="caption" color="text.secondary">
                {row.original.material.code}
              </Typography>
            )}
            {row.original.brand && (
              <Chip
                label={row.original.brand.brand_name}
                size="small"
                variant="outlined"
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        ),
      },
      {
        id: "batch_code",
        header: "Batch",
        size: 120,
        Cell: ({ row }) => {
          const batchCode = (row.original as ExtendedStock).batch_code;
          return batchCode ? (
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                bgcolor: "action.hover",
                px: 1,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              {batchCode}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.disabled">
              -
            </Typography>
          );
        },
      },
      {
        accessorKey: "current_qty",
        header: "Current Stock",
        size: 120,
        Cell: ({ row }) => {
          const unit = row.original.material?.unit || "piece";
          const isLow = lowStockAlerts.some((a) => a.id === row.original.id);
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                color={isLow ? "error.main" : "text.primary"}
              >
                {row.original.current_qty.toLocaleString()}{" "}
                {UNIT_LABELS[unit] || unit}
              </Typography>
              {isLow && (
                <Tooltip title="Low Stock">
                  <WarningIcon fontSize="small" color="error" />
                </Tooltip>
              )}
            </Box>
          );
        },
      },
      {
        accessorKey: "available_qty",
        header: "Available",
        size: 100,
        Cell: ({ row }) => {
          const unit = row.original.material?.unit || "piece";
          return (
            <Typography variant="body2">
              {row.original.available_qty.toLocaleString()}{" "}
              {UNIT_LABELS[unit] || unit}
            </Typography>
          );
        },
      },
      {
        accessorKey: "avg_unit_cost",
        header: "Avg Cost",
        size: 100,
        Cell: ({ row }) =>
          row.original.avg_unit_cost
            ? `₹${row.original.avg_unit_cost.toLocaleString()}`
            : "-",
      },
      {
        id: "value",
        header: "Value",
        size: 120,
        Cell: ({ row }) => {
          const extendedStock = row.original as ExtendedStock;
          // For per-kg pricing, use total_weight; for per-piece, use current_qty
          let value: number;
          if (extendedStock.pricing_mode === "per_kg" && extendedStock.total_weight) {
            value = extendedStock.total_weight * (row.original.avg_unit_cost || 0);
          } else {
            value = row.original.current_qty * (row.original.avg_unit_cost || 0);
          }
          return `₹${value.toLocaleString()}`;
        },
      },
      {
        id: "paid_by",
        header: "Paid By",
        size: 120,
        Cell: ({ row }) => {
          const paidBy = (row.original as ExtendedStock).paid_by_site_name;
          return paidBy ? (
            <Chip
              icon={<SiteIcon />}
              label={paidBy}
              size="small"
              variant="outlined"
              color="primary"
            />
          ) : (
            <Chip
              label={selectedSite?.name || "This Site"}
              size="small"
              variant="outlined"
            />
          );
        },
      },
      {
        id: "stock_type",
        header: "Type",
        size: 100,
        Cell: ({ row }) => {
          const isShared = (row.original as ExtendedStock).is_shared;
          const isDedicated = (row.original as ExtendedStock).is_dedicated;
          if (isDedicated) {
            return (
              <Tooltip title="Dedicated to this site only">
                <Chip
                  icon={<DedicatedIcon />}
                  label="Dedicated"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              </Tooltip>
            );
          }
          if (isShared) {
            return (
              <Tooltip title="Shared across site group">
                <Chip
                  icon={<SharedIcon />}
                  label="Shared"
                  size="small"
                  color="info"
                  variant="outlined"
                />
              </Tooltip>
            );
          }
          return <Chip label="Site" size="small" variant="outlined" />;
        },
      },
      {
        accessorKey: "location.name",
        header: "Location",
        size: 120,
        Cell: ({ row }) => row.original.location?.name || "Default",
      },
    ],
    [lowStockAlerts, selectedSite?.name]
  );

  // Completed stock table columns
  const completedStockColumns = useMemo<MRT_ColumnDef<CompletedStockItem>[]>(
    () => [
      {
        accessorKey: "material_name",
        header: "Material",
        size: 200,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {row.original.material_name}
            </Typography>
            {row.original.material_code && (
              <Typography variant="caption" color="text.secondary">
                {row.original.material_code}
              </Typography>
            )}
            {row.original.brand_name && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {row.original.brand_name}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "batch_code",
        header: "Batch",
        size: 100,
        Cell: ({ row }) => row.original.batch_code || "-",
      },
      {
        accessorKey: "avg_unit_cost",
        header: "Avg Cost",
        size: 100,
        Cell: ({ row }) =>
          row.original.avg_unit_cost
            ? `₹${row.original.avg_unit_cost.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "-",
      },
      {
        accessorKey: "completion_date",
        header: "Completed On",
        size: 120,
        Cell: ({ row }) =>
          row.original.completion_date
            ? dayjs(row.original.completion_date).format("DD MMM YYYY")
            : "-",
      },
      {
        accessorKey: "last_received_date",
        header: "Received On",
        size: 120,
        Cell: ({ row }) =>
          row.original.last_received_date
            ? dayjs(row.original.last_received_date).format("DD MMM YYYY")
            : "-",
      },
      {
        id: "stock_type",
        header: "Type",
        size: 100,
        Cell: ({ row }) =>
          row.original.is_shared ? (
            <Chip label="Group" size="small" color="info" variant="outlined" />
          ) : (
            <Chip label="Site" size="small" variant="outlined" />
          ),
      },
    ],
    []
  );

  // Stock row actions - with Use button
  const renderStockRowActions = useCallback(
    ({ row }: { row: { original: StockInventoryWithDetails } }) => (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <Tooltip title="Record Usage">
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleRecordUsage(row.original)}
            disabled={!canEdit || row.original.available_qty <= 0}
          >
            <UseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add Stock">
          <IconButton
            size="small"
            color="success"
            onClick={() =>
              setAdjustmentDialog({
                open: true,
                stock: row.original,
                type: "add",
              })
            }
            disabled={!canEdit}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Remove Stock">
          <IconButton
            size="small"
            color="error"
            onClick={() =>
              setAdjustmentDialog({
                open: true,
                stock: row.original,
                type: "remove",
              })
            }
            disabled={!canEdit}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    [canEdit]
  );

  // Usage table columns
  const usageColumns = useMemo<MRT_ColumnDef<DailyMaterialUsageWithDetails>[]>(
    () => [
      {
        accessorKey: "usage_date",
        header: "Date",
        size: 100,
        Cell: ({ row }) => dayjs(row.original.usage_date).format("DD MMM"),
      },
      {
        accessorKey: "material.name",
        header: "Material",
        size: 180,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {row.original.material?.name}
            </Typography>
            {row.original.brand && (
              <Typography variant="caption" color="text.secondary">
                {row.original.brand.brand_name}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        size: 100,
        Cell: ({ row }) => {
          const unit = row.original.material?.unit || "piece";
          return `${row.original.quantity} ${UNIT_LABELS[unit] || unit}`;
        },
      },
      {
        accessorKey: "total_cost",
        header: "Cost",
        size: 100,
        Cell: ({ row }) =>
          row.original.total_cost
            ? `₹${row.original.total_cost.toLocaleString()}`
            : "-",
      },
      {
        accessorKey: "work_description",
        header: "Work",
        size: 150,
        Cell: ({ row }) => (
          <Typography
            variant="body2"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 150,
            }}
          >
            {row.original.work_description || "-"}
          </Typography>
        ),
      },
      {
        accessorKey: "section.name",
        header: "Section",
        size: 120,
        Cell: ({ row }) => row.original.section?.name || "-",
      },
    ],
    []
  );

  // Usage row actions
  const renderUsageRowActions = useCallback(
    ({ row }: { row: { original: DailyMaterialUsageWithDetails } }) => {
      const isToday =
        dayjs(row.original.usage_date).format("YYYY-MM-DD") ===
        dayjs().format("YYYY-MM-DD");

      return (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {isToday && canEdit && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  if (confirm("Delete this usage entry?")) {
                    deleteUsage.mutate({
                      id: row.original.id,
                      siteId: selectedSite?.id || "",
                    });
                  }
                }}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      );
    },
    [canEdit, deleteUsage, selectedSite?.id]
  );

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Inventory"
        actions={
          !isMobile && canEdit ? (
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<UseIcon />}
                onClick={() => handleRecordUsage()}
              >
                Record Usage
              </Button>
              {mainTab === "stock" && (
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setAddStockDialog(true)}
                >
                  Manual Adjustment
                </Button>
              )}
            </Box>
          ) : null
        }
      />

      <RelatedPages />

      {/* Unified Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <InventoryIcon fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary">
                  Total Items
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600}>
                {stock.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Stock Value
              </Typography>
              <Typography variant="h5" fontWeight={600}>
                ₹{totalStockValue.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ borderLeft: 3, borderColor: "error.main" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Low Stock Items
              </Typography>
              <Typography variant="h5" fontWeight={600} color="error.main">
                {lowStockAlerts.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card sx={{ borderLeft: 3, borderColor: "info.main" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <HistoryIcon fontSize="small" color="info" />
                <Typography variant="caption" color="text.secondary">
                  Today&apos;s Usage
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600} color="info.main">
                {todaySummary?.totalEntries || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Tabs: Stock | Usage History */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={mainTab}
          onChange={(_, newValue) => setMainTab(newValue as MainTabType)}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab
            label="Stock Inventory"
            value="stock"
            icon={<InventoryIcon />}
            iconPosition="start"
          />
          <Tab
            label="Usage History"
            value="usage"
            icon={<HistoryIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Stock Tab Content */}
      {mainTab === "stock" && (
        <>
          {/* Low Stock Alert */}
          {lowStockAlerts.length > 0 && (
            <Alert
              severity="warning"
              icon={<TrendingDownIcon />}
              sx={{ mb: 2 }}
              action={
                <Button size="small" onClick={() => setSearchTerm("")}>
                  View All
                </Button>
              }
            >
              {lowStockAlerts.length} item(s) are below reorder level:{" "}
              {lowStockAlerts
                .slice(0, 3)
                .map((a) => a.material_name)
                .join(", ")}
              {lowStockAlerts.length > 3 && ` and ${lowStockAlerts.length - 3} more`}
            </Alert>
          )}

          {/* Stock Type Tabs */}
          <Paper sx={{ mb: 2 }}>
            <Tabs
              value={stockTab}
              onChange={(_, newValue) => setStockTab(newValue as StockTabType)}
              sx={{ borderBottom: 1, borderColor: "divider" }}
            >
              <Tab
                label="All Stock"
                value="all"
                icon={<InventoryIcon />}
                iconPosition="start"
              />
              <Tab
                label="Site Stock"
                value="site"
                icon={<SiteIcon />}
                iconPosition="start"
              />
              <Tab
                label={`Shared Stock${sharedStockCount > 0 ? ` (${sharedStockCount})` : ""}`}
                value="shared"
                icon={<GroupsIcon />}
                iconPosition="start"
              />
              <Tab
                label={`Completed${completedStock.length > 0 ? ` (${completedStock.length})` : ""}`}
                value="completed"
                icon={<HistoryIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Paper>

          {/* Search */}
          <Box sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search materials, batch codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ minWidth: 300 }}
            />
          </Box>

          {/* Stock Table - Active Stock */}
          {stockTab !== "completed" && (
            <DataTable
              columns={stockColumns}
              data={filteredStock}
              isLoading={stockLoading}
              enableRowActions={canEdit}
              renderRowActions={renderStockRowActions}
              mobileHiddenColumns={["batch_code", "avg_unit_cost", "value", "paid_by", "stock_type", "location.name"]}
              initialState={{
                sorting: [{ id: "material.name", desc: false }],
              }}
            />
          )}

          {/* Stock Table - Completed Stock */}
          {stockTab === "completed" && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Showing materials that have been fully consumed (current quantity = 0). This helps track historical purchases and usage patterns.
              </Alert>
              <DataTable
                columns={completedStockColumns}
                data={filteredCompletedStock}
                isLoading={completedLoading}
                enableRowActions={false}
                mobileHiddenColumns={["avg_unit_cost", "last_received_date"]}
                initialState={{
                  sorting: [{ id: "completion_date", desc: true }],
                }}
              />
            </>
          )}
        </>
      )}

      {/* Usage History Tab Content */}
      {mainTab === "usage" && (
        <DataTable
          columns={usageColumns}
          data={usage}
          isLoading={usageLoading}
          enableRowActions={canEdit}
          renderRowActions={renderUsageRowActions}
          mobileHiddenColumns={["total_cost", "section.name"]}
          initialState={{
            sorting: [{ id: "usage_date", desc: true }],
          }}
        />
      )}

      {/* Mobile FAB */}
      {isMobile && canEdit && (
        <Fab
          color="primary"
          sx={{ position: "fixed", bottom: 16, right: 16 }}
          onClick={() => handleRecordUsage()}
        >
          <UseIcon />
        </Fab>
      )}

      {/* Usage Entry Drawer */}
      <UsageEntryDrawer
        open={usageDrawerOpen}
        onClose={() => {
          setUsageDrawerOpen(false);
          setPreSelectedStock(null);
        }}
        siteId={selectedSite?.id || ""}
        stock={stock}
        preSelectedStock={preSelectedStock}
      />

      {/* Stock Adjustment Dialog */}
      <StockAdjustmentDialog
        open={adjustmentDialog.open}
        onClose={() =>
          setAdjustmentDialog({ open: false, stock: null, type: "add" })
        }
        stock={adjustmentDialog.stock}
        type={adjustmentDialog.type}
        onSubmit={async (qty, notes) => {
          if (!adjustmentDialog.stock) return;
          await stockAdjustment.mutateAsync({
            inventory_id: adjustmentDialog.stock.id,
            adjustment_qty: adjustmentDialog.type === "add" ? qty : -qty,
            adjustment_type: adjustmentDialog.type === "add" ? "adjustment" : "wastage",
            notes,
          });
          setAdjustmentDialog({ open: false, stock: null, type: "add" });
        }}
        isSubmitting={stockAdjustment.isPending}
      />

      {/* Add Initial Stock Dialog */}
      <AddStockDialog
        open={addStockDialog}
        onClose={() => setAddStockDialog(false)}
        siteId={selectedSite?.id || ""}
        materials={materials}
        onSubmit={async (data) => {
          await addInitialStock.mutateAsync(data);
          setAddStockDialog(false);
        }}
        isSubmitting={addInitialStock.isPending}
      />
    </Box>
  );
}

// Stock Adjustment Dialog Component
function StockAdjustmentDialog({
  open,
  onClose,
  stock,
  type,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  stock: StockInventoryWithDetails | null;
  type: "add" | "remove";
  onSubmit: (qty: number, notes: string) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    const quantity = parseFloat(qty);
    if (isNaN(quantity) || quantity <= 0) return;
    await onSubmit(quantity, notes);
    setQty("");
    setNotes("");
  };

  if (!stock) return null;

  const unit = stock.material?.unit || "piece";
  const maxRemove = type === "remove" ? stock.available_qty : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {type === "add" ? "Add Stock" : "Remove Stock"}: {stock.material?.name}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Current stock: {stock.current_qty} {UNIT_LABELS[unit] || unit}
          </Typography>

          <TextField
            fullWidth
            label={`Quantity (${UNIT_LABELS[unit] || unit})`}
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            slotProps={{
              input: {
                inputProps: {
                  min: 0.001,
                  max: maxRemove,
                  step: 0.001,
                },
              },
            }}
            autoFocus
          />

          <TextField
            fullWidth
            label="Notes / Reason"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={2}
            placeholder={
              type === "remove"
                ? "e.g., Damaged, Lost, Correction"
                : "e.g., Purchase, Return, Correction"
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={type === "add" ? "success" : "error"}
          onClick={handleSubmit}
          disabled={isSubmitting || !qty || parseFloat(qty) <= 0}
        >
          {isSubmitting ? "Saving..." : type === "add" ? "Add" : "Remove"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Adjustment reasons for manual stock entry
const ADJUSTMENT_REASONS = [
  { value: "initial_setup", label: "Initial Setup", description: "Setting up inventory for the first time" },
  { value: "count_correction", label: "Physical Count Correction", description: "Discrepancy found during physical count" },
  { value: "transfer_in", label: "Transfer In", description: "Received from another site without PO" },
  { value: "donation", label: "Donation/Gift", description: "Received without purchase" },
  { value: "other", label: "Other", description: "Other reason (specify in notes)" },
] as const;

// Manual Stock Adjustment Dialog Component (renamed from Add Stock)
function AddStockDialog({
  open,
  onClose,
  siteId,
  materials,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  materials: MaterialWithDetails[];
  onSubmit: (data: {
    site_id: string;
    material_id: string;
    quantity: number;
    unit_cost: number;
  }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState<string>("initial_setup");

  const selectedMaterial = materials.find((m) => m.id === materialId);
  const unit = selectedMaterial?.unit || "piece";

  const handleSubmit = async () => {
    const quantity = parseFloat(qty);
    const cost = parseFloat(unitCost);
    if (!materialId || isNaN(quantity) || quantity <= 0 || isNaN(cost) || cost < 0)
      return;

    await onSubmit({
      site_id: siteId,
      material_id: materialId,
      quantity,
      unit_cost: cost,
    });

    setMaterialId("");
    setQty("");
    setUnitCost("");
    setReason("initial_setup");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Manual Stock Adjustment</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            Use this for stock not from purchases. For materials ordered through vendors, use Purchase Orders &rarr; Delivery &rarr; Verification flow.
          </Alert>

          <FormControl fullWidth>
            <InputLabel>Reason for Adjustment</InputLabel>
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              label="Reason for Adjustment"
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Material</InputLabel>
            <Select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              label="Material"
            >
              {materials.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name} {m.code ? `(${m.code})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label={`Quantity (${UNIT_LABELS[unit] || unit})`}
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            slotProps={{
              input: {
                inputProps: { min: 0.001, step: 0.001 },
              },
            }}
          />

          <TextField
            fullWidth
            label="Unit Cost (₹)"
            type="number"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            slotProps={{
              input: {
                inputProps: { min: 0, step: 0.01 },
                startAdornment: (
                  <InputAdornment position="start">₹</InputAdornment>
                ),
              },
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            isSubmitting ||
            !materialId ||
            !qty ||
            parseFloat(qty) <= 0 ||
            !unitCost
          }
        >
          {isSubmitting ? "Adding..." : "Add Adjustment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
