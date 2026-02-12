"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  Alert,
  Chip,
  CircularProgress,
} from "@mui/material";
import { useReceiveEquipmentTransfer } from "@/hooks/queries/useEquipment";
import {
  EquipmentTransferWithDetails,
  EquipmentReceiveFormData,
  EquipmentCondition,
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_CONDITION_COLORS,
  TRANSFER_STATUS_LABELS,
  TRANSFER_STATUS_COLORS,
} from "@/types/equipment.types";

interface EquipmentReceiveDialogProps {
  open: boolean;
  onClose: () => void;
  transfer: EquipmentTransferWithDetails | null;
}

export default function EquipmentReceiveDialog({
  open,
  onClose,
  transfer,
}: EquipmentReceiveDialogProps) {
  const receiveTransfer = useReceiveEquipmentTransfer();

  const [formData, setFormData] = useState<EquipmentReceiveFormData>({
    transfer_id: "",
    condition_at_receipt: "good",
    is_working: true,
    condition_notes: "",
    receiving_photos: [],
  });

  // Reset form when dialog opens with new transfer
  useEffect(() => {
    if (transfer && open) {
      setFormData({
        transfer_id: transfer.id,
        condition_at_receipt: transfer.condition_at_handover || "good",
        is_working: true,
        condition_notes: "",
        receiving_photos: [],
      });
    }
  }, [transfer, open]);

  const handleClose = () => {
    setFormData({
      transfer_id: "",
      condition_at_receipt: "good",
      is_working: true,
      condition_notes: "",
      receiving_photos: [],
    });
    onClose();
  };

  const handleSubmit = async () => {
    if (!transfer) return;

    try {
      await receiveTransfer.mutateAsync({
        ...formData,
        transferId: transfer.id,
      });
      handleClose();
    } catch (error) {
      console.error("Failed to receive transfer:", error);
    }
  };

  if (!transfer) return null;

  const equipment = transfer.equipment;
  const conditionAtHandover = transfer.condition_at_handover;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Receive Equipment</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
          {/* Transfer Info */}
          <Box sx={{ bgcolor: "grey.50", p: 2, borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Transfer Details
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2">Equipment:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {equipment?.equipment_code} - {equipment?.name}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2">From:</Typography>
                <Typography variant="body2">
                  {transfer.from_location_type === "site"
                    ? transfer.from_site?.name || "Site"
                    : transfer.from_warehouse_location || "Warehouse"}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2">To:</Typography>
                <Typography variant="body2">
                  {transfer.to_location_type === "site"
                    ? transfer.to_site?.name || "Site"
                    : transfer.to_warehouse_location || "Warehouse"}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="body2">Status:</Typography>
                <Chip
                  label={TRANSFER_STATUS_LABELS[transfer.status]}
                  color={TRANSFER_STATUS_COLORS[transfer.status]}
                  size="small"
                />
              </Box>
              {conditionAtHandover && (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2">Condition at Handover:</Typography>
                  <Chip
                    label={EQUIPMENT_CONDITION_LABELS[conditionAtHandover]}
                    color={EQUIPMENT_CONDITION_COLORS[conditionAtHandover]}
                    size="small"
                  />
                </Box>
              )}
            </Box>
          </Box>

          <Alert severity="info">
            Please verify the equipment condition before accepting the transfer.
            Check if the equipment is working properly and note any issues.
          </Alert>

          {/* Condition at Receipt */}
          <FormControl fullWidth>
            <InputLabel>Condition at Receipt *</InputLabel>
            <Select
              value={formData.condition_at_receipt}
              label="Condition at Receipt *"
              onChange={(e) =>
                setFormData({ ...formData, condition_at_receipt: e.target.value as EquipmentCondition })
              }
            >
              {(Object.keys(EQUIPMENT_CONDITION_LABELS) as EquipmentCondition[]).map(
                (condition) => (
                  <MenuItem key={condition} value={condition}>
                    {EQUIPMENT_CONDITION_LABELS[condition]}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          {/* Is Working Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_working}
                onChange={(e) => setFormData({ ...formData, is_working: e.target.checked })}
              />
            }
            label={
              <Box component="span" sx={{ display: "flex", flexDirection: "column" }}>
                <Typography variant="body1">Equipment is working properly</Typography>
                <Typography variant="caption" color="text.secondary">
                  Uncheck if the equipment has functional issues
                </Typography>
              </Box>
            }
          />

          {/* Condition Notes */}
          <TextField
            label="Condition Notes"
            value={formData.condition_notes || ""}
            onChange={(e) => setFormData({ ...formData, condition_notes: e.target.value })}
            multiline
            rows={3}
            placeholder="Note any damages, issues, or discrepancies from handover condition..."
            helperText="Document any issues found during inspection"
          />

          {/* TODO: Photo upload for receiving_photos */}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={receiveTransfer.isPending}
          startIcon={receiveTransfer.isPending ? <CircularProgress size={20} /> : null}
        >
          {receiveTransfer.isPending ? "Receiving..." : "Confirm Receipt"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
