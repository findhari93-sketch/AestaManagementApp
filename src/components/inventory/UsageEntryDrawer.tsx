"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Drawer,
  Divider,
  Chip,
  Alert,
  Autocomplete,
} from "@mui/material";
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Inventory as InventoryIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMaterialCategories } from "@/hooks/queries/useMaterials";
import { useCreateMaterialUsage } from "@/hooks/queries/useMaterialUsage";
import type { ExtendedStockInventory } from "@/hooks/queries/useStockInventory";
import type {
  MaterialUnit,
  UsageEntryFormData,
  MaterialCategory,
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

interface UsageEntryDrawerProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  stock: ExtendedStockInventory[];
  preSelectedStock?: ExtendedStockInventory | null;
}

export default function UsageEntryDrawer({
  open,
  onClose,
  siteId,
  stock,
  preSelectedStock,
}: UsageEntryDrawerProps) {
  const isMobile = useIsMobile();
  const { data: categories = [] } = useMaterialCategories();
  const createUsage = useCreateMaterialUsage();
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedStockId, setSelectedStockId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UsageEntryFormData>({
    site_id: siteId,
    usage_date: dayjs().format("YYYY-MM-DD"),
    material_id: "",
    quantity: 0,
    work_description: "",
  });

  // Handle pre-selected stock
  useEffect(() => {
    if (open && preSelectedStock) {
      setSelectedStockId(preSelectedStock.id);
      setForm((prev) => ({
        ...prev,
        site_id: siteId,
        material_id: preSelectedStock.material?.id || "",
      }));
      // Focus quantity input after drawer opens
      setTimeout(() => {
        quantityInputRef.current?.focus();
      }, 300);
    }
  }, [open, preSelectedStock, siteId]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!open) {
      setSelectedStockId("");
      setCategoryFilter("");
      setError(null);
      setForm({
        site_id: siteId,
        usage_date: dayjs().format("YYYY-MM-DD"),
        material_id: "",
        quantity: 0,
        work_description: "",
      });
    }
  }, [open, siteId]);

  // Filter stock by category
  const filteredStock = useMemo(() => {
    if (!categoryFilter) return stock;

    const childCategoryIds = categories
      .filter((c) => c.parent_id === categoryFilter)
      .map((c) => c.id);

    const validCategoryIds = [categoryFilter, ...childCategoryIds];

    return stock.filter(
      (s) =>
        validCategoryIds.includes(s.material?.category_id || "") ||
        !s.material?.category_id
    );
  }, [stock, categoryFilter, categories]);

  // Find selected stock
  const selectedStock = stock.find((s) => s.id === selectedStockId);
  const selectedMaterial = selectedStock?.material;
  const unit = selectedMaterial?.unit || "piece";

  // Calculate effective cost per piece (handles per-kg pricing and shared stock)
  const getEffectiveCostPerPiece = () => {
    // Both avg_unit_cost (from DB) and batch_unit_cost (computed with GST) are already GST-inclusive.
    // Use batch_unit_cost for shared stock to ensure consistent pricing across sites.
    const baseCost = (selectedStock?.is_shared && selectedStock?.batch_unit_cost)
      ? selectedStock.batch_unit_cost
      : selectedStock?.avg_unit_cost;

    if (!baseCost) return 0;

    // For per-kg pricing, convert per-kg rate to per-piece cost
    if (selectedStock?.pricing_mode === "per_kg" && selectedStock?.total_weight && selectedStock?.current_qty > 0) {
      const weightPerPiece = selectedStock.total_weight / selectedStock.current_qty;
      return weightPerPiece * baseCost;
    }

    return baseCost;
  };

  const effectiveCostPerPiece = getEffectiveCostPerPiece();
  const estimatedCost = effectiveCostPerPiece * form.quantity;
  const isPerKgPricing = selectedStock?.pricing_mode === "per_kg";

  const handleSubmit = async () => {
    setError(null);

    if (!form.material_id || form.quantity <= 0) {
      setError("Please select a material and enter quantity");
      return;
    }

    if (selectedStock && form.quantity > selectedStock.available_qty) {
      setError(
        `Insufficient stock. Available: ${selectedStock.available_qty} ${UNIT_LABELS[unit] || unit}`
      );
      return;
    }

    try {
      await createUsage.mutateAsync({
        ...form,
        site_id: siteId,
        brand_id: selectedStock?.brand_id || undefined,
        inventory_id: selectedStock?.id,
        unit_cost: effectiveCostPerPiece,
        total_cost: estimatedCost,
      });

      onClose();
    } catch (err: unknown) {
      console.error("Failed to record usage:", err);
      let message = "Failed to record usage. Please try again.";
      if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === "object") {
        const error = err as Record<string, unknown>;
        if (error.code === "23503") {
          message = "Database constraint error. Please contact support.";
        } else if (error.code === "409" || error.status === 409) {
          message = "A conflict occurred. The stock may have been modified. Please refresh and try again.";
        } else if (error.message) {
          message = String(error.message);
        }
      }
      setError(message);
    }
  };

  const isPreSelected = !!preSelectedStock;

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
        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ mb: 1 }}
          >
            {error}
          </Alert>
        )}

        {/* Pre-selected Material Info */}
        {isPreSelected && selectedStock && (
          <Alert
            severity="info"
            icon={<InventoryIcon />}
            sx={{ mb: 1 }}
          >
            <Typography variant="body2" fontWeight={500}>
              {selectedStock.material?.name}
              {selectedStock.brand && ` - ${selectedStock.brand.brand_name}`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Available: {selectedStock.available_qty} {UNIT_LABELS[unit] || unit}
            </Typography>
          </Alert>
        )}

        {/* Date */}
        <TextField
          fullWidth
          label="Date"
          type="date"
          value={form.usage_date}
          onChange={(e) => setForm({ ...form, usage_date: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        {/* Category Filter - Hidden when pre-selected */}
        {!isPreSelected && (
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
        )}

        {/* Material Selection - Disabled when pre-selected */}
        {!isPreSelected && (
          <Autocomplete
            options={filteredStock}
            getOptionLabel={(option) =>
              `${option.material?.name}${option.brand ? ` - ${option.brand.brand_name}` : ""}`
            }
            value={filteredStock.find((s) => s.id === selectedStockId) || null}
            onChange={(_, value) => {
              setSelectedStockId(value?.id || "");
              setForm({ ...form, material_id: value?.material?.id || "" });
            }}
            slotProps={{
              popper: { disablePortal: false }, // Required inside Drawer to prevent aria-hidden conflict
            }}
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
        )}

        {/* Quantity with available stock info */}
        {selectedMaterial && (
          <>
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  fullWidth
                  inputRef={quantityInputRef}
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
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    Estimated cost: ₹{estimatedCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isPerKgPricing ? (
                      <>
                        @ ₹{selectedStock.avg_unit_cost.toLocaleString()}/kg × {((selectedStock.total_weight || 0) / selectedStock.current_qty).toFixed(2)} kg/pc
                      </>
                    ) : (
                      <>
                        @ ₹{selectedStock.avg_unit_cost.toLocaleString()}/{UNIT_LABELS[unit] || unit}
                      </>
                    )}
                    {" (avg. rate)"}
                    {selectedStock.brand && ` | ${selectedStock.brand.brand_name}`}
                  </Typography>
                </Box>
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
