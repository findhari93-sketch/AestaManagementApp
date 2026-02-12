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
  Autocomplete,
  Paper,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCreateMaintenance } from "@/hooks/queries/useEquipment";
import { useVendors } from "@/hooks/queries/useVendors";
import { createClient } from "@/lib/supabase/client";
import ImageUploadWithCrop from "@/components/common/ImageUploadWithCrop";
import type {
  EquipmentWithDetails,
  EquipmentMaintenanceFormData,
  MaintenanceType,
  EquipmentCondition,
} from "@/types/equipment.types";
import {
  MAINTENANCE_TYPE_LABELS,
  EQUIPMENT_CONDITION_LABELS,
} from "@/types/equipment.types";

interface MaintenanceDialogProps {
  open: boolean;
  onClose: () => void;
  equipment: EquipmentWithDetails | null;
}

export default function MaintenanceDialog({
  open,
  onClose,
  equipment,
}: MaintenanceDialogProps) {
  const isMobile = useIsMobile();
  const supabase = createClient();
  const { data: vendors = [] } = useVendors();
  const createMaintenance = useCreateMaintenance();

  const [error, setError] = useState("");
  const [formData, setFormData] = useState<EquipmentMaintenanceFormData>({
    equipment_id: "",
    maintenance_date: new Date().toISOString().split("T")[0],
    maintenance_type: "routine" as MaintenanceType,
  });

  useEffect(() => {
    if (equipment) {
      // Calculate suggested next maintenance date
      const maintenanceInterval =
        equipment.maintenance_interval_days ||
        equipment.category?.default_maintenance_interval_days ||
        90;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + maintenanceInterval);

      setFormData({
        equipment_id: equipment.id,
        maintenance_date: new Date().toISOString().split("T")[0],
        maintenance_type: "routine",
        condition_before: equipment.condition || undefined,
        next_maintenance_date: nextDate.toISOString().split("T")[0],
      });
    }
    setError("");
  }, [equipment, open]);

  const handleChange = (
    field: keyof EquipmentMaintenanceFormData,
    value: unknown
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    if (!formData.equipment_id) {
      setError("Equipment is required");
      return;
    }
    if (!formData.maintenance_date) {
      setError("Maintenance date is required");
      return;
    }

    try {
      await createMaintenance.mutateAsync(formData);
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to record maintenance");
    }
  };

  const isLoading = createMaintenance.isPending;

  if (!equipment) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" component="span">Record Maintenance</Typography>
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

        {/* Equipment Info */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: "grey.50" }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Equipment
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {equipment.equipment_code} - {equipment.name}
          </Typography>
          {equipment.last_maintenance_date && (
            <Typography variant="body2" color="text.secondary">
              Last maintenance: {equipment.last_maintenance_date}
            </Typography>
          )}
        </Paper>

        <Grid container spacing={2}>
          {/* Date and Type */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Maintenance Date"
              type="date"
              value={formData.maintenance_date}
              onChange={(e) => handleChange("maintenance_date", e.target.value)}
              fullWidth
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth required>
              <InputLabel>Maintenance Type</InputLabel>
              <Select
                value={formData.maintenance_type}
                label="Maintenance Type"
                onChange={(e) =>
                  handleChange(
                    "maintenance_type",
                    e.target.value as MaintenanceType
                  )
                }
              >
                {Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Condition Before/After */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Condition Before</InputLabel>
              <Select
                value={formData.condition_before || ""}
                label="Condition Before"
                onChange={(e) =>
                  handleChange(
                    "condition_before",
                    e.target.value as EquipmentCondition
                  )
                }
              >
                {Object.entries(EQUIPMENT_CONDITION_LABELS).map(
                  ([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Condition After</InputLabel>
              <Select
                value={formData.condition_after || ""}
                label="Condition After"
                onChange={(e) =>
                  handleChange(
                    "condition_after",
                    e.target.value as EquipmentCondition
                  )
                }
              >
                {Object.entries(EQUIPMENT_CONDITION_LABELS).map(
                  ([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>
          </Grid>

          {/* Cost */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Cost"
              type="number"
              value={formData.cost || ""}
              onChange={(e) =>
                handleChange(
                  "cost",
                  e.target.value ? parseFloat(e.target.value) : undefined
                )
              }
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                },
              }}
            />
          </Grid>

          {/* Vendor */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={vendors}
              getOptionLabel={(option) => option.name}
              value={vendors.find((v) => v.id === formData.vendor_id) || null}
              onChange={(_, newValue) =>
                handleChange("vendor_id", newValue?.id || undefined)
              }
              renderInput={(params) => (
                <TextField {...params} label="Service Provider" />
              )}
              slotProps={{ popper: { disablePortal: false } }}
            />
          </Grid>

          {/* Performed By */}
          <Grid size={12}>
            <TextField
              label="Performed By"
              value={formData.performed_by || ""}
              onChange={(e) => handleChange("performed_by", e.target.value)}
              fullWidth
              placeholder="Name of person who performed the maintenance"
            />
          </Grid>

          {/* Description */}
          <Grid size={12}>
            <TextField
              label="Description"
              value={formData.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="What work was done?"
            />
          </Grid>

          {/* Next Maintenance Date */}
          <Grid size={12}>
            <TextField
              label="Next Maintenance Date"
              type="date"
              value={formData.next_maintenance_date || ""}
              onChange={(e) =>
                handleChange("next_maintenance_date", e.target.value)
              }
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="When should the next maintenance be scheduled?"
            />
          </Grid>

          {/* Receipt */}
          <Grid size={12}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Receipt / Bill Photo
            </Typography>
            <ImageUploadWithCrop
              supabase={supabase}
              bucketName="equipment-photos"
              folderPath="maintenance-receipts"
              fileNamePrefix="receipt"
              value={formData.receipt_url || null}
              onChange={(url) => handleChange("receipt_url", url || "")}
              label="Receipt / Bill Photo"
              aspectRatio={4 / 3}
            />
          </Grid>

          {/* Notes */}
          <Grid size={12}>
            <TextField
              label="Notes"
              value={formData.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
          {isLoading ? "Saving..." : "Record Maintenance"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
