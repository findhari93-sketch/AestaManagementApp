"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Fab,
  Drawer,
  Divider,
  Chip,
  Alert,
  Autocomplete,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from "@mui/material";
import {
  Add as AddIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasEditPermission } from "@/lib/permissions";
import {
  useMaterialUsage,
  useTodayUsageSummary,
  useCreateMaterialUsage,
  useDeleteMaterialUsage,
} from "@/hooks/queries/useMaterialUsage";
import { useSiteStock } from "@/hooks/queries/useStockInventory";
import { useMaterialCategories } from "@/hooks/queries/useMaterials";
import type {
  DailyMaterialUsageWithDetails,
  StockInventoryWithDetails,
  MaterialUnit,
  UsageEntryFormData,
} from "@/types/material.types";
import dayjs from "dayjs";

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

export default function MaterialUsagePage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const { formatForApi, isAllTime } = useDateRange();
  const isMobile = useIsMobile();
  const canEdit = hasEditPermission(userProfile?.role) || userProfile?.role === "site_engineer";

  const { dateFrom, dateTo } = formatForApi();

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Calculate date range for queries
  const dateRange = useMemo(() => {
    if (isAllTime) {
      // For "All Time", use a very old start date
      return {
        startDate: "2020-01-01",
        endDate: dayjs().format("YYYY-MM-DD"),
      };
    }
    return {
      startDate: dateFrom || dayjs().format("YYYY-MM-DD"),
      endDate: dateTo || dayjs().format("YYYY-MM-DD"),
    };
  }, [dateFrom, dateTo, isAllTime]);

  const { data: usage = [], isLoading } = useMaterialUsage(selectedSite?.id, dateRange);
  const { data: todaySummary } = useTodayUsageSummary(selectedSite?.id);
  const { data: stock = [] } = useSiteStock(selectedSite?.id);
  const deleteUsage = useDeleteMaterialUsage();

  // Table columns
  const columns = useMemo<MRT_ColumnDef<DailyMaterialUsageWithDetails>[]>(
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

  // Row actions
  const renderRowActions = useCallback(
    ({ row }: { row: { original: DailyMaterialUsageWithDetails } }) => {
      const isToday =
        dayjs(row.original.usage_date).format("YYYY-MM-DD") ===
        dayjs().format("YYYY-MM-DD");

      return (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {isToday && canEdit && (
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
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      );
    },
    [canEdit, deleteUsage, selectedSite?.id]
  );

  return (
    <Box>
      <PageHeader
        title="Material Usage"
        actions={
          !isMobile && canEdit ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDrawerOpen(true)}
            >
              Record Usage
            </Button>
          ) : null
        }
      />

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 4 }}>
          <Card>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Today&apos;s Entries
              </Typography>
              <Typography variant="h5" fontWeight={600}>
                {todaySummary?.totalEntries || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Materials Used
              </Typography>
              <Typography variant="h5" fontWeight={600}>
                {todaySummary?.uniqueMaterials || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Today&apos;s Cost
              </Typography>
              <Typography variant="h5" fontWeight={600}>
                ₹{(todaySummary?.totalCost || 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={usage}
        isLoading={isLoading}
        enableRowActions={canEdit}
        renderRowActions={renderRowActions}
        mobileHiddenColumns={["total_cost", "section.name"]}
        initialState={{
          sorting: [
            { id: "usage_date", desc: true },
          ],
        }}
      />

      {/* Mobile FAB */}
      {isMobile && canEdit && (
        <Fab
          color="primary"
          sx={{ position: "fixed", bottom: 16, right: 16 }}
          onClick={() => setDrawerOpen(true)}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Usage Entry Drawer */}
      <UsageEntryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        siteId={selectedSite?.id || ""}
        stock={stock}
      />
    </Box>
  );
}

// Usage Entry Drawer Component (Mobile-optimized)
function UsageEntryDrawer({
  open,
  onClose,
  siteId,
  stock,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  stock: StockInventoryWithDetails[];
}) {
  const isMobile = useIsMobile();
  const { data: categories = [] } = useMaterialCategories();
  const createUsage = useCreateMaterialUsage();

  const [categoryFilter, setCategoryFilter] = useState("");
  const [form, setForm] = useState<UsageEntryFormData>({
    site_id: siteId,
    usage_date: dayjs().format("YYYY-MM-DD"),
    material_id: "",
    quantity: 0,
    work_description: "",
  });

  // Filter stock by category
  const filteredStock = useMemo(() => {
    if (!categoryFilter) return stock;
    return stock.filter(
      (s) => s.material?.category_id === categoryFilter
    );
  }, [stock, categoryFilter]);

  const selectedStock = stock.find((s) => s.material?.id === form.material_id);
  const selectedMaterial = selectedStock?.material;
  const unit = selectedMaterial?.unit || "piece";

  const handleSubmit = async () => {
    if (!form.material_id || form.quantity <= 0) {
      alert("Please select a material and enter quantity");
      return;
    }

    if (selectedStock && form.quantity > selectedStock.available_qty) {
      alert(
        `Insufficient stock. Available: ${selectedStock.available_qty} ${UNIT_LABELS[unit] || unit}`
      );
      return;
    }

    try {
      await createUsage.mutateAsync({
        ...form,
        site_id: siteId,
        unit_cost: selectedStock?.avg_unit_cost || 0,
        total_cost: (selectedStock?.avg_unit_cost || 0) * form.quantity,
      });

      // Reset form
      setForm({
        site_id: siteId,
        usage_date: dayjs().format("YYYY-MM-DD"),
        material_id: "",
        quantity: 0,
        work_description: "",
      });

      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to record usage";
      alert(message);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        "& .MuiDrawer-paper": {
          width: { xs: "100%", sm: "450px" },
          maxWidth: "100%",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="h6">Record Material Usage</Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Date */}
        <TextField
          fullWidth
          label="Date"
          type="date"
          value={form.usage_date}
          onChange={(e) => setForm({ ...form, usage_date: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        {/* Category Filter */}
        <FormControl fullWidth size="small">
          <InputLabel>Filter by Category</InputLabel>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            label="Filter by Category"
          >
            <MenuItem value="">All Categories</MenuItem>
            {categories
              .filter((c) => !c.parent_id)
              .map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {/* Material Selection */}
        <Autocomplete
          options={filteredStock}
          getOptionLabel={(option) =>
            `${option.material?.name}${option.brand ? ` - ${option.brand.brand_name}` : ""}`
          }
          value={filteredStock.find((s) => s.material?.id === form.material_id) || null}
          onChange={(_, value) =>
            setForm({ ...form, material_id: value?.material?.id || "" })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Material"
              placeholder="Search from available stock..."
              required
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.id}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">{option.material?.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Available: {option.available_qty}{" "}
                  {UNIT_LABELS[option.material?.unit || "piece"]}
                  {option.brand && ` | ${option.brand.brand_name}`}
                </Typography>
              </Box>
            </Box>
          )}
        />

        {/* Quantity with available stock info */}
        {selectedMaterial && (
          <>
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label={`Quantity (${UNIT_LABELS[unit] || unit})`}
                  type="number"
                  value={form.quantity || ""}
                  onChange={(e) =>
                    setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })
                  }
                  slotProps={{
                    input: {
                      inputProps: {
                        min: 0,
                        max: selectedStock?.available_qty || 9999,
                        step: 0.001,
                      },
                    },
                  }}
                  required
                />
              </Grid>
              <Grid size={6}>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Available
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    color={
                      form.quantity > (selectedStock?.available_qty || 0)
                        ? "error.main"
                        : "text.primary"
                    }
                  >
                    {selectedStock?.available_qty || 0} {UNIT_LABELS[unit] || unit}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Estimated Cost */}
            {selectedStock?.avg_unit_cost && form.quantity > 0 && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Estimated cost: ₹
                {(selectedStock.avg_unit_cost * form.quantity).toLocaleString()}
              </Alert>
            )}
          </>
        )}

        {/* Work Description */}
        <TextField
          fullWidth
          label="Work Description"
          value={form.work_description}
          onChange={(e) => setForm({ ...form, work_description: e.target.value })}
          multiline
          rows={isMobile ? 2 : 3}
          placeholder="What was the material used for?"
        />

        <Divider />

        {/* Submit Button */}
        <Button
          variant="contained"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
          disabled={createUsage.isPending || !form.material_id || form.quantity <= 0}
          fullWidth
          sx={{ py: 1.5 }}
        >
          {createUsage.isPending ? "Saving..." : "Record Usage"}
        </Button>
      </Box>
    </Drawer>
  );
}
