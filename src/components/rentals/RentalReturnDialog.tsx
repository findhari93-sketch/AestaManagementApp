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
  Paper,
  InputAdornment,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRecordRentalReturn } from "@/hooks/queries/useRentals";
import type {
  RentalOrderWithDetails,
  RentalOrderItemWithDetails,
  RentalReturnFormData,
  ReturnCondition,
} from "@/types/rental.types";
import { RETURN_CONDITION_LABELS } from "@/types/rental.types";
import dayjs from "dayjs";

interface RentalReturnDialogProps {
  open: boolean;
  onClose: () => void;
  order: RentalOrderWithDetails;
  preselectedItem?: RentalOrderItemWithDetails;
}

export default function RentalReturnDialog({
  open,
  onClose,
  order,
  preselectedItem,
}: RentalReturnDialogProps) {
  const isMobile = useIsMobile();
  const recordReturn = useRecordRentalReturn();

  const [error, setError] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [formData, setFormData] = useState<Omit<RentalReturnFormData, "rental_order_id" | "rental_order_item_id">>({
    return_date: dayjs().format("YYYY-MM-DD"),
    quantity_returned: 1,
    condition: "good" as ReturnCondition,
    damage_description: "",
    damage_cost: 0,
    notes: "",
  });

  // Get items with outstanding quantity
  const returnableItems = (order.items || []).filter(
    (item) => (item.quantity_outstanding || item.quantity - item.quantity_returned) > 0
  );

  const selectedItem = returnableItems.find((item) => item.id === selectedItemId);
  const maxQuantity = selectedItem
    ? selectedItem.quantity_outstanding || selectedItem.quantity - selectedItem.quantity_returned
    : 0;

  useEffect(() => {
    if (open) {
      // Reset form
      setFormData({
        return_date: dayjs().format("YYYY-MM-DD"),
        quantity_returned: 1,
        condition: "good",
        damage_description: "",
        damage_cost: 0,
        notes: "",
      });
      setError("");

      // Preselect item if provided
      if (preselectedItem && returnableItems.some((i) => i.id === preselectedItem.id)) {
        setSelectedItemId(preselectedItem.id);
      } else if (returnableItems.length === 1) {
        setSelectedItemId(returnableItems[0].id);
      } else {
        setSelectedItemId("");
      }
    }
  }, [open, preselectedItem, returnableItems.length]);

  const handleChange = (field: keyof typeof formData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    if (!selectedItemId) {
      setError("Please select an item to return");
      return;
    }

    if (formData.quantity_returned <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }

    if (formData.quantity_returned > maxQuantity) {
      setError(`Cannot return more than ${maxQuantity} items`);
      return;
    }

    if (formData.condition === "damaged" && !formData.damage_description) {
      setError("Please describe the damage");
      return;
    }

    try {
      await recordReturn.mutateAsync({
        rental_order_id: order.id,
        rental_order_item_id: selectedItemId,
        return_date: formData.return_date,
        quantity_returned: formData.quantity_returned,
        condition: formData.condition,
        damage_description: formData.damage_description || undefined,
        damage_cost: formData.damage_cost || undefined,
        notes: formData.notes || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to record return");
    }
  };

  const isLoading = recordReturn.isPending;

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
          <Typography variant="h6">Record Return</Typography>
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

        {returnableItems.length === 0 ? (
          <Alert severity="info">
            All items have been returned. There are no outstanding items.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {/* Order Info */}
            <Grid size={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "grey.50" }}>
                <Typography variant="body2" color="text.secondary">
                  Order #{order.rental_order_number}
                </Typography>
                <Typography variant="subtitle2">
                  {order.vendor?.shop_name || order.vendor?.name}
                </Typography>
              </Paper>
            </Grid>

            {/* Select Item */}
            <Grid size={12}>
              <FormControl fullWidth required>
                <InputLabel>Select Item to Return</InputLabel>
                <Select
                  value={selectedItemId}
                  label="Select Item to Return"
                  onChange={(e) => setSelectedItemId(e.target.value)}
                >
                  {returnableItems.map((item) => {
                    const outstanding =
                      item.quantity_outstanding || item.quantity - item.quantity_returned;
                    return (
                      <MenuItem key={item.id} value={item.id}>
                        {item.rental_item?.name || "Unknown Item"} - {outstanding} outstanding
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            {selectedItem && (
              <>
                {/* Item Details */}
                <Grid size={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box display="flex" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Original Quantity
                        </Typography>
                        <Typography variant="h6">{selectedItem.quantity}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Already Returned
                        </Typography>
                        <Typography variant="h6">
                          {selectedItem.quantity_returned}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Outstanding
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {maxQuantity}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                {/* Return Date */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    type="date"
                    label="Return Date"
                    value={formData.return_date}
                    onChange={(e) => handleChange("return_date", e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>

                {/* Quantity */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label="Quantity Returning"
                    value={formData.quantity_returned}
                    onChange={(e) =>
                      handleChange(
                        "quantity_returned",
                        Math.min(maxQuantity, Math.max(1, parseInt(e.target.value) || 1))
                      )
                    }
                    slotProps={{
                      htmlInput: { min: 1, max: maxQuantity },
                    }}
                    helperText={`Max: ${maxQuantity}`}
                  />
                </Grid>

                {/* Condition */}
                <Grid size={12}>
                  <FormControl fullWidth required>
                    <InputLabel>Condition</InputLabel>
                    <Select
                      value={formData.condition}
                      label="Condition"
                      onChange={(e) =>
                        handleChange("condition", e.target.value as ReturnCondition)
                      }
                    >
                      {(Object.keys(RETURN_CONDITION_LABELS) as ReturnCondition[]).map(
                        (condition) => (
                          <MenuItem key={condition} value={condition}>
                            {RETURN_CONDITION_LABELS[condition]}
                          </MenuItem>
                        )
                      )}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Damage Details */}
                {(formData.condition === "damaged" || formData.condition === "lost") && (
                  <>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        required
                        multiline
                        rows={2}
                        label="Damage Description"
                        value={formData.damage_description}
                        onChange={(e) =>
                          handleChange("damage_description", e.target.value)
                        }
                        placeholder="Describe the damage or loss..."
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Damage Cost"
                        value={formData.damage_cost || ""}
                        onChange={(e) =>
                          handleChange(
                            "damage_cost",
                            e.target.value ? parseFloat(e.target.value) : 0
                          )
                        }
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">₹</InputAdornment>
                          ),
                        }}
                        helperText="Cost charged for damage/loss"
                      />
                    </Grid>
                  </>
                )}

                {/* Notes */}
                <Grid size={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Notes"
                    value={formData.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder="Any additional notes..."
                  />
                </Grid>
              </>
            )}
          </Grid>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isLoading || !selectedItemId || returnableItems.length === 0}
        >
          {isLoading ? "Recording..." : "Record Return"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
