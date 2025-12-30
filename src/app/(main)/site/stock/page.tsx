"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Fab,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Tabs,
  Tab,
  Paper,
} from "@mui/material";
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  TrendingDown as TrendingDownIcon,
  SwapHoriz as TransferIcon,
  Lock as DedicatedIcon,
  LockOpen as SharedIcon,
  Inventory as InventoryIcon,
  Groups as GroupsIcon,
  Domain as SiteIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import RelatedPages from "@/components/layout/RelatedPages";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasEditPermission } from "@/lib/permissions";
import {
  useSiteStock,
  useLowStockAlerts,
  useStockAdjustment,
  useAddInitialStock,
} from "@/hooks/queries/useStockInventory";
import { useMaterials, useMaterialCategories } from "@/hooks/queries/useMaterials";
import type {
  StockInventoryWithDetails,
  MaterialUnit,
  MaterialWithDetails,
} from "@/types/material.types";

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

type StockTabType = "site" | "shared" | "all";

export default function StockPage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const isMobile = useIsMobile();
  const canEdit = hasEditPermission(userProfile?.role);

  const [searchTerm, setSearchTerm] = useState("");
  const [stockTab, setStockTab] = useState<StockTabType>("all");
  const [adjustmentDialog, setAdjustmentDialog] = useState<{
    open: boolean;
    stock: StockInventoryWithDetails | null;
    type: "add" | "remove";
  }>({ open: false, stock: null, type: "add" });
  const [addStockDialog, setAddStockDialog] = useState(false);

  const { data: stock = [], isLoading } = useSiteStock(selectedSite?.id);
  const { data: lowStockAlerts = [] } = useLowStockAlerts(selectedSite?.id);
  const { data: materials = [] } = useMaterials();
  const stockAdjustment = useStockAdjustment();
  const addInitialStock = useAddInitialStock();

  // Filter stock by search term and tab
  const filteredStock = useMemo(() => {
    let filtered = stock;

    // Apply tab filter (placeholder - will use actual is_dedicated field when available)
    // For now, treat all stock as "site" stock
    if (stockTab === "site") {
      // Site-specific stock (dedicated to this site or not shared)
      filtered = filtered.filter((s) => !(s as StockInventoryWithDetails & { is_shared?: boolean }).is_shared);
    } else if (stockTab === "shared") {
      // Shared stock from site group
      filtered = filtered.filter((s) => (s as StockInventoryWithDetails & { is_shared?: boolean }).is_shared);
    }
    // "all" shows everything

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.material?.name?.toLowerCase().includes(term) ||
          s.material?.code?.toLowerCase().includes(term) ||
          s.brand?.brand_name?.toLowerCase().includes(term) ||
          (s as StockInventoryWithDetails & { batch_code?: string }).batch_code?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [stock, searchTerm, stockTab]);

  // Calculate shared stock count (placeholder)
  const sharedStockCount = useMemo(() => {
    return stock.filter((s) => (s as StockInventoryWithDetails & { is_shared?: boolean }).is_shared).length;
  }, [stock]);

  // Calculate total stock value
  const totalStockValue = useMemo(() => {
    return stock.reduce(
      (sum, s) => sum + s.current_qty * (s.avg_unit_cost || 0),
      0
    );
  }, [stock]);

  // Extended stock type for batch/shared info
  type ExtendedStock = StockInventoryWithDetails & {
    batch_code?: string;
    is_shared?: boolean;
    is_dedicated?: boolean;
    paid_by_site_name?: string;
  };

  // Table columns
  const columns = useMemo<MRT_ColumnDef<StockInventoryWithDetails>[]>(
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
          const value =
            row.original.current_qty * (row.original.avg_unit_cost || 0);
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
          return (
            <Chip
              label="Site"
              size="small"
              variant="outlined"
            />
          );
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

  // Row actions
  const renderRowActions = useCallback(
    ({ row }: { row: { original: StockInventoryWithDetails } }) => (
      <Box sx={{ display: "flex", gap: 0.5 }}>
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

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Stock Inventory"
        actions={
          !isMobile && canEdit ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddStockDialog(true)}
            >
              Add Stock
            </Button>
          ) : null
        }
      />

      <RelatedPages />

      {/* Summary Cards */}
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
                <GroupsIcon fontSize="small" color="info" />
                <Typography variant="caption" color="text.secondary">
                  Shared Stock
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={600} color="info.main">
                {sharedStockCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Low Stock Alert */}
      {lowStockAlerts.length > 0 && (
        <Alert
          severity="warning"
          icon={<TrendingDownIcon />}
          sx={{ mb: 2 }}
          action={
            <Button
              size="small"
              onClick={() => setSearchTerm("")}
            >
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

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredStock}
        isLoading={isLoading}
        enableRowActions={canEdit}
        renderRowActions={renderRowActions}
        mobileHiddenColumns={["batch_code", "avg_unit_cost", "value", "paid_by", "stock_type", "location.name"]}
        initialState={{
          sorting: [{ id: "material.name", desc: false }],
        }}
      />

      {/* Mobile FAB */}
      {isMobile && canEdit && (
        <Fab
          color="primary"
          sx={{ position: "fixed", bottom: 16, right: 16 }}
          onClick={() => setAddStockDialog(true)}
        >
          <AddIcon />
        </Fab>
      )}

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
            adjustment_qty:
              adjustmentDialog.type === "add" ? qty : -qty,
            adjustment_type:
              adjustmentDialog.type === "add" ? "adjustment" : "wastage",
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

// Add Initial Stock Dialog Component
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
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Stock to Site</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
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
          {isSubmitting ? "Adding..." : "Add Stock"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
