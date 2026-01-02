"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Box,
  Typography,
  IconButton,
  Alert,
  InputAdornment,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useCreateRentalItem,
  useUpdateRentalItem,
  useRentalCategories,
} from "@/hooks/queries/useRentals";
import type {
  RentalItemWithDetails,
  RentalItemFormData,
  RentalType,
} from "@/types/rental.types";
import { RENTAL_TYPE_LABELS } from "@/types/rental.types";

const UNITS = [
  { value: "piece", label: "Piece" },
  { value: "nos", label: "Numbers (nos)" },
  { value: "set", label: "Set" },
  { value: "sqft", label: "Square Feet (sqft)" },
  { value: "rmt", label: "Running Meter (rmt)" },
  { value: "bundle", label: "Bundle" },
];

interface RentalItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: RentalItemWithDetails | null;
}

export default function RentalItemDialog({
  open,
  onClose,
  item,
}: RentalItemDialogProps) {
  const isMobile = useIsMobile();
  const isEdit = !!item;

  const { data: categories = [] } = useRentalCategories();
  const createItem = useCreateRentalItem();
  const updateItem = useUpdateRentalItem();

  const [error, setError] = useState("");
  const [formData, setFormData] = useState<RentalItemFormData>({
    name: "",
    code: "",
    local_name: "",
    category_id: "",
    description: "",
    rental_type: "scaffolding" as RentalType,
    unit: "piece",
    specifications: {},
    default_daily_rate: undefined,
    image_url: "",
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        code: item.code || "",
        local_name: item.local_name || "",
        category_id: item.category_id || "",
        description: item.description || "",
        rental_type: item.rental_type,
        unit: item.unit,
        specifications: item.specifications || {},
        default_daily_rate: item.default_daily_rate || undefined,
        image_url: item.image_url || "",
      });
    } else {
      setFormData({
        name: "",
        code: "",
        local_name: "",
        category_id: "",
        description: "",
        rental_type: "scaffolding",
        unit: "piece",
        specifications: {},
        default_daily_rate: undefined,
        image_url: "",
      });
    }
    setError("");
  }, [item, open]);

  const handleChange = (field: keyof RentalItemFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      if (isEdit && item) {
        await updateItem.mutateAsync({ id: item.id, data: formData });
      } else {
        await createItem.mutateAsync(formData);
      }
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to save rental item");
    }
  };

  const isLoading = createItem.isPending || updateItem.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {isEdit ? "Edit Rental Item" : "Add Rental Item"}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField
              fullWidth
              required
              label="Item Name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., 4ft Scaffolding Sheet"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Code"
              value={formData.code}
              onChange={(e) => handleChange("code", e.target.value)}
              placeholder="Auto-generated if empty"
              helperText="Leave empty for auto-generation"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Local Name"
              value={formData.local_name}
              onChange={(e) => handleChange("local_name", e.target.value)}
              placeholder="Name in local language"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Rental Type</InputLabel>
              <Select
                value={formData.rental_type}
                label="Rental Type"
                onChange={(e) => handleChange("rental_type", e.target.value)}
              >
                {(Object.keys(RENTAL_TYPE_LABELS) as RentalType[]).map((type) => (
                  <MenuItem key={type} value={type}>
                    {RENTAL_TYPE_LABELS[type]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category_id || ""}
                label="Category"
                onChange={(e) => handleChange("category_id", e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <Select
                value={formData.unit}
                label="Unit"
                onChange={(e) => handleChange("unit", e.target.value)}
              >
                {UNITS.map((u) => (
                  <MenuItem key={u.value} value={u.value}>
                    {u.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              type="number"
              label="Default Daily Rate"
              value={formData.default_daily_rate || ""}
              onChange={(e) =>
                handleChange(
                  "default_daily_rate",
                  e.target.value ? parseFloat(e.target.value) : undefined
                )
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">₹</InputAdornment>
                ),
              }}
              placeholder="0"
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Additional details about the item"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isLoading || !formData.name.trim()}
        >
          {isLoading ? "Saving..." : isEdit ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
