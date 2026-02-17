"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  Edit as EditIcon,
  Block as BlockIcon,
} from "@mui/icons-material";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { GroupedUsageRecord } from "@/types/material.types";

interface UsageEditDialogProps {
  open: boolean;
  usageRecord: GroupedUsageRecord | null;
  currentStockQty: number;
  onClose: () => void;
  onSave: (data: { quantity: number; work_description: string }) => void;
  isSaving: boolean;
  isGroupStock?: boolean;
  isSettled?: boolean;
}

export default function UsageEditDialog({
  open,
  usageRecord,
  currentStockQty,
  onClose,
  onSave,
  isSaving,
  isGroupStock = false,
  isSettled = false,
}: UsageEditDialogProps) {
  const [quantity, setQuantity] = useState<number>(0);
  const [workDescription, setWorkDescription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Initialize form when dialog opens
  useEffect(() => {
    if (open && usageRecord) {
      setQuantity(usageRecord.total_quantity);
      setWorkDescription(usageRecord.work_description || "");
      setError(null);
    }
  }, [open, usageRecord]);

  if (!usageRecord) return null;

  const materialName =
    (usageRecord.material as { name?: string })?.name || usageRecord.material_id;
  const brandName = (usageRecord.brand as { brand_name?: string })?.brand_name;
  const unit = (usageRecord.material as { unit?: string })?.unit || "nos";
  const unitCost = usageRecord.representative.unit_cost || 0;

  // For grouped records, quantity editing is disabled
  const isQuantityDisabled = usageRecord.is_grouped;

  // Calculate available stock for validation
  const originalQuantity = usageRecord.total_quantity;
  const quantityDelta = quantity - originalQuantity;
  const availableForIncrease = currentStockQty;

  // Validate quantity
  const validateQuantity = () => {
    if (isQuantityDisabled) return null; // Skip validation for grouped records
    if (quantity <= 0) {
      return "Quantity must be greater than 0";
    }
    if (quantityDelta > 0 && quantityDelta > availableForIncrease) {
      return `Not enough stock. Available: ${availableForIncrease} ${unit}`;
    }
    return null;
  };

  const validationError = validateQuantity();
  const hasChanges = (!isQuantityDisabled && quantity !== originalQuantity) ||
    workDescription !== (usageRecord.work_description || "");

  const handleSave = () => {
    const err = validateQuantity();
    if (err) {
      setError(err);
      return;
    }
    onSave({ quantity, work_description: workDescription });
  };

  // Calculate new total cost
  const newTotalCost = isQuantityDisabled ? usageRecord.total_cost : quantity * unitCost;

  return (
    <Dialog
      open={open}
      onClose={isSaving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderTop: 4, borderColor: isSettled ? "warning.main" : "primary.main" },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {isSettled ? <BlockIcon color="warning" /> : <EditIcon color="primary" />}
        {isSettled ? "Cannot Edit Usage Record" : "Edit Usage Record"}
      </DialogTitle>

      <DialogContent>
        {/* Usage Record Info (Read-only) */}
        <Box
          sx={{
            p: 2,
            bgcolor: "action.hover",
            borderRadius: 1,
            mb: 2,
          }}
        >
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Material
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {materialName}
              </Typography>
              {brandName && (
                <Typography variant="caption" color="text.secondary">
                  {brandName}
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Date
              </Typography>
              <Typography variant="body2">
                {formatDate(usageRecord.usage_date)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Quantity
              </Typography>
              <Typography variant="body2">
                {usageRecord.total_quantity} {unit}
                {usageRecord.is_grouped && (
                  <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 0.5 }}>
                    ({usageRecord.child_count} batches)
                  </Typography>
                )}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Cost
              </Typography>
              <Typography variant="body2">
                {formatCurrency(usageRecord.total_cost || 0)}
              </Typography>
            </Box>
          </Box>
          {isGroupStock && (
            <Chip
              label="Group Stock"
              size="small"
              color="info"
              variant="outlined"
              sx={{ mt: 1 }}
            />
          )}
        </Box>

        {/* Settled Record Warning */}
        {isSettled ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={500}>
              This usage is part of a completed settlement and cannot be modified.
            </Typography>
            <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
              To make changes, the settlement must first be reversed.
            </Typography>
          </Alert>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Grouped record info */}
            {usageRecord.is_grouped && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Quantity cannot be changed for multi-batch usage. Delete and re-record to change quantity.
                </Typography>
              </Alert>
            )}

            {/* Editable Fields */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {!isQuantityDisabled && (
                <TextField
                  label={`Quantity (${unit})`}
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(Number(e.target.value));
                    setError(null);
                  }}
                  error={!!validationError}
                  helperText={validationError || `Original: ${originalQuantity} ${unit}`}
                  fullWidth
                  inputProps={{ min: 0.001, step: 0.001 }}
                />
              )}

              <TextField
                label="Work Description"
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="e.g., foundation, plastering, etc."
              />
            </Box>

            {/* Change Summary */}
            {hasChanges && (
              <Box sx={{ mt: 2, p: 2, bgcolor: "info.50", borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Changes:
                </Typography>
                {!isQuantityDisabled && quantity !== originalQuantity && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Typography variant="body2">Quantity:</Typography>
                    <Chip
                      label={`${originalQuantity} → ${quantity} ${unit}`}
                      size="small"
                      color={quantityDelta > 0 ? "error" : "success"}
                    />
                    {quantityDelta !== 0 && (
                      <Typography variant="caption" color={quantityDelta > 0 ? "error.main" : "success.main"}>
                        ({quantityDelta > 0 ? "+" : ""}{quantityDelta} {unit})
                      </Typography>
                    )}
                  </Box>
                )}
                {!isQuantityDisabled && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2">New Total Cost:</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {formatCurrency(newTotalCost || 0)}
                    </Typography>
                    {(newTotalCost || 0) !== (usageRecord.total_cost || 0) && (
                      <Typography variant="caption" color="text.secondary">
                        (was {formatCurrency(usageRecord.total_cost || 0)})
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {isGroupStock && hasChanges && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  This will also update the batch usage record for inter-site settlement.
                </Typography>
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSaving}>
          {isSettled ? "Close" : "Cancel"}
        </Button>
        {!isSettled && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={isSaving || !hasChanges || !!validationError}
            startIcon={
              isSaving ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <EditIcon />
              )
            }
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
