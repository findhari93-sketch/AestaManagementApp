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
  Box,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import type { MaterialPurchaseExpenseWithDetails } from "@/types/material.types";

interface BatchUsageDialogProps {
  open: boolean;
  onClose: () => void;
  batch: MaterialPurchaseExpenseWithDetails | null;
  currentSiteId: string;
  sitesInGroup: Array<{ id: string; name: string }>;
  onSubmit: (data: {
    batch_ref_code: string;
    usage_site_id: string;
    quantity: number;
    usage_date: string;
    work_description?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export default function BatchUsageDialog({
  open,
  onClose,
  batch,
  currentSiteId,
  sitesInGroup,
  onSubmit,
  isSubmitting = false,
}: BatchUsageDialogProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(currentSiteId);
  const [quantity, setQuantity] = useState<string>("");
  const [usageDate, setUsageDate] = useState<Dayjs | null>(dayjs());
  const [workDescription, setWorkDescription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with new batch
  useEffect(() => {
    if (open && batch) {
      setSelectedSiteId(currentSiteId);
      setQuantity("");
      setUsageDate(dayjs());
      setWorkDescription("");
      setError(null);
    }
  }, [open, batch, currentSiteId]);

  const handleSubmit = async () => {
    if (!batch) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Please enter a valid quantity greater than 0");
      return;
    }

    const remaining = batch.remaining_qty ?? batch.original_qty ?? 0;
    if (qty > remaining) {
      setError(`Quantity cannot exceed remaining stock (${remaining})`);
      return;
    }

    if (!usageDate) {
      setError("Please select a usage date");
      return;
    }

    setError(null);

    try {
      await onSubmit({
        batch_ref_code: batch.ref_code,
        usage_site_id: selectedSiteId,
        quantity: qty,
        usage_date: usageDate.format("YYYY-MM-DD"),
        work_description: workDescription || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record usage");
    }
  };

  if (!batch) return null;

  // Get the first item's material info for display
  const firstItem = batch.items?.[0];
  const materialName = firstItem?.material?.name || "Unknown Material";
  const materialUnit = firstItem?.material?.unit || "piece";
  const remaining = batch.remaining_qty ?? batch.original_qty ?? 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Record Usage - {batch.ref_code}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}>
          {/* Batch Info */}
          <Alert severity="info" sx={{ mb: 1 }}>
            <Typography variant="body2">
              <strong>{materialName}</strong> - Remaining: {remaining} {materialUnit}
            </Typography>
            {batch.items && batch.items.length > 1 && (
              <Typography variant="caption" color="text.secondary">
                + {batch.items.length - 1} more material(s) in this batch
              </Typography>
            )}
          </Alert>

          {/* Site Selection */}
          <FormControl fullWidth>
            <InputLabel>Site that used the material</InputLabel>
            <Select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              label="Site that used the material"
            >
              {sitesInGroup.map((site) => (
                <MenuItem key={site.id} value={site.id}>
                  {site.name}
                  {site.id === currentSiteId && " (Current)"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Quantity */}
          <TextField
            label="Quantity Used"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            fullWidth
            InputProps={{
              endAdornment: (
                <Typography variant="body2" color="text.secondary">
                  {materialUnit}
                </Typography>
              ),
            }}
            helperText={`Available: ${remaining} ${materialUnit}`}
          />

          {/* Date */}
          <DatePicker
            label="Usage Date"
            value={usageDate}
            onChange={(newValue) => setUsageDate(newValue)}
            maxDate={dayjs()}
            slotProps={{
              textField: {
                fullWidth: true,
              },
            }}
          />

          {/* Work Description */}
          <TextField
            label="Work Description (Optional)"
            value={workDescription}
            onChange={(e) => setWorkDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="e.g., Foundation work, Column casting"
          />

          {/* Error */}
          {error && (
            <Alert severity="error">{error}</Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting || !quantity}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {isSubmitting ? "Recording..." : "Record Usage"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
