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
  Autocomplete,
  Paper,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useCreateEquipmentTransfer,
  useEquipmentCategories,
} from "@/hooks/queries/useEquipment";
import { useSitesData } from "@/contexts/SiteContext";
import { useUsers } from "@/hooks/queries/useUsers";
import { useLaborers } from "@/hooks/queries/useLaborers";
import type {
  EquipmentWithDetails,
  EquipmentTransferFormData,
  EquipmentLocationType,
  EquipmentCondition,
} from "@/types/equipment.types";
import {
  LOCATION_TYPE_LABELS,
  WAREHOUSE_LOCATIONS,
  EQUIPMENT_CONDITION_LABELS,
} from "@/types/equipment.types";

interface EquipmentTransferDialogProps {
  open: boolean;
  onClose: () => void;
  equipment: EquipmentWithDetails | null;
}

export default function EquipmentTransferDialog({
  open,
  onClose,
  equipment,
}: EquipmentTransferDialogProps) {
  const isMobile = useIsMobile();
  const { sites = [] } = useSitesData();
  const { data: users = [] } = useUsers();
  const { data: laborers = [] } = useLaborers();
  const createTransfer = useCreateEquipmentTransfer();

  const [error, setError] = useState("");
  const [formData, setFormData] = useState<EquipmentTransferFormData>({
    equipment_id: "",
    to_location_type: "site" as EquipmentLocationType,
    transfer_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (equipment) {
      setFormData({
        equipment_id: equipment.id,
        to_location_type:
          equipment.current_location_type === "warehouse" ? "site" : "warehouse",
        transfer_date: new Date().toISOString().split("T")[0],
        condition_at_handover: equipment.condition || undefined,
      });
    }
    setError("");
  }, [equipment, open]);

  const handleChange = (
    field: keyof EquipmentTransferFormData,
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
    if (
      formData.to_location_type === "site" &&
      !formData.to_site_id
    ) {
      setError("Destination site is required");
      return;
    }

    try {
      await createTransfer.mutateAsync(formData);
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to create transfer");
    }
  };

  const isLoading = createTransfer.isPending;

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
          <Typography variant="h6" component="span">Transfer Equipment</Typography>
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

        {/* Current Equipment Info */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: "grey.50" }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Equipment
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {equipment.equipment_code} - {equipment.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Current location:{" "}
            {equipment.current_location_type === "site"
              ? equipment.current_site?.name || "Site"
              : equipment.warehouse_location || "Warehouse"}
          </Typography>
        </Paper>

        <Grid container spacing={2}>
          {/* Transfer Date */}
          <Grid size={12}>
            <TextField
              label="Transfer Date"
              type="date"
              value={formData.transfer_date}
              onChange={(e) => handleChange("transfer_date", e.target.value)}
              fullWidth
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>

          {/* Current Condition */}
          <Grid size={12}>
            <FormControl fullWidth>
              <InputLabel>Condition at Handover</InputLabel>
              <Select
                value={formData.condition_at_handover || ""}
                label="Condition at Handover"
                onChange={(e) =>
                  handleChange(
                    "condition_at_handover",
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

          {/* Destination */}
          <Grid size={12}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Destination
            </Typography>
          </Grid>

          <Grid size={12}>
            <FormControl fullWidth>
              <InputLabel>Destination Type</InputLabel>
              <Select
                value={formData.to_location_type}
                label="Destination Type"
                onChange={(e) =>
                  handleChange(
                    "to_location_type",
                    e.target.value as EquipmentLocationType
                  )
                }
              >
                {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {formData.to_location_type === "site" ? (
            <Grid size={12}>
              <Autocomplete
                options={sites}
                getOptionLabel={(option) => option.name}
                value={sites.find((s) => s.id === formData.to_site_id) || null}
                onChange={(_, newValue) =>
                  handleChange("to_site_id", newValue?.id || undefined)
                }
                renderInput={(params) => (
                  <TextField {...params} label="Destination Site" required />
                )}
                slotProps={{ popper: { disablePortal: false } }}
              />
            </Grid>
          ) : (
            <Grid size={12}>
              <FormControl fullWidth>
                <InputLabel>Storage Area</InputLabel>
                <Select
                  value={formData.to_warehouse_location || "Storeroom"}
                  label="Storage Area"
                  onChange={(e) =>
                    handleChange("to_warehouse_location", e.target.value)
                  }
                >
                  {WAREHOUSE_LOCATIONS.map((loc) => (
                    <MenuItem key={loc} value={loc}>
                      {loc}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          {/* Responsible Person */}
          <Grid size={12}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Assign Responsibility To
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={users}
              getOptionLabel={(option) => option.name || option.email}
              value={
                users.find((u) => u.id === formData.to_responsible_user_id) ||
                null
              }
              onChange={(_, newValue) => {
                handleChange("to_responsible_user_id", newValue?.id || undefined);
                if (newValue) {
                  handleChange("to_responsible_laborer_id", undefined);
                }
              }}
              renderInput={(params) => (
                <TextField {...params} label="User (Staff/Engineer)" />
              )}
              slotProps={{ popper: { disablePortal: false } }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={laborers}
              getOptionLabel={(option) => option.name}
              value={
                laborers.find(
                  (l) => l.id === formData.to_responsible_laborer_id
                ) || null
              }
              onChange={(_, newValue) => {
                handleChange(
                  "to_responsible_laborer_id",
                  newValue?.id || undefined
                );
                if (newValue) {
                  handleChange("to_responsible_user_id", undefined);
                }
              }}
              renderInput={(params) => (
                <TextField {...params} label="Laborer" />
              )}
              slotProps={{ popper: { disablePortal: false } }}
            />
          </Grid>

          {/* Reason */}
          <Grid size={12}>
            <TextField
              label="Reason for Transfer"
              value={formData.reason || ""}
              onChange={(e) => handleChange("reason", e.target.value)}
              fullWidth
              multiline
              rows={2}
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
          {isLoading ? "Creating..." : "Create Transfer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
