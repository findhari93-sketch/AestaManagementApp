"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from "@mui/material";
import {
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  Receipt as BatchIcon,
  Undo as UndoIcon,
  Block as BlockIcon,
} from "@mui/icons-material";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { GroupedUsageRecord } from "@/types/material.types";

interface UsageDeleteConfirmDialogProps {
  open: boolean;
  usageRecord: GroupedUsageRecord | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  isGroupStock?: boolean;
  isSettled?: boolean;
}

export default function UsageDeleteConfirmDialog({
  open,
  usageRecord,
  onClose,
  onConfirm,
  isDeleting,
  isGroupStock = false,
  isSettled = false,
}: UsageDeleteConfirmDialogProps) {
  if (!usageRecord) return null;

  const materialName =
    (usageRecord.material as { name?: string })?.name ||
    usageRecord.material_id;
  const brandName = (usageRecord.brand as { brand_name?: string })?.brand_name;
  const unit =
    (usageRecord.material as { unit?: string })?.unit || "nos";

  return (
    <Dialog
      open={open}
      onClose={isDeleting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderTop: 4, borderColor: isSettled ? "warning.main" : "error.main" },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {isSettled ? <BlockIcon color="warning" /> : <WarningIcon color="error" />}
        {isSettled ? "Cannot Delete Usage Record" : "Delete Usage Record"}
      </DialogTitle>

      <DialogContent>
        {/* Usage Record Details */}
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
                Quantity
              </Typography>
              <Typography variant="body2" fontWeight={600} color="error.main">
                {usageRecord.total_quantity} {unit}
              </Typography>
              {usageRecord.is_grouped && (
                <Typography variant="caption" color="text.secondary">
                  ({usageRecord.child_count} batch allocations)
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
                Cost
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {formatCurrency(usageRecord.total_cost || 0)}
              </Typography>
            </Box>
          </Box>
          {usageRecord.work_description && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Work Description
              </Typography>
              <Typography variant="body2">
                {usageRecord.work_description}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Settled Record Warning */}
        {isSettled ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={500}>
              This usage is part of a completed settlement and cannot be
              modified or deleted.
            </Typography>
            <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
              To make changes, the settlement must first be reversed.
            </Typography>
          </Alert>
        ) : (
          <>
            {/* Grouped record warning */}
            {usageRecord.is_grouped && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={500}>
                  This will delete all {usageRecord.child_count} batch allocations
                  totaling {usageRecord.total_quantity} {unit} and restore the
                  quantities to their respective inventory batches.
                </Typography>
              </Alert>
            )}

            {/* Impact List */}
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              This will:
            </Typography>
            <List dense disablePadding>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <UndoIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{ component: "div" }}
                  primary={
                    <Typography variant="body2" component="span">
                      Restore{" "}
                      <Chip
                        label={`+${usageRecord.total_quantity} ${unit}`}
                        size="small"
                        color="success"
                        sx={{ height: 20 }}
                      />{" "}
                      to stock inventory
                    </Typography>
                  }
                />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <InventoryIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Create reversal transaction for audit trail"
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItem>
              {isGroupStock && (
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <BatchIcon color="warning" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Remove batch usage record (affects inter-site settlement)"
                    primaryTypographyProps={{ variant: "body2" }}
                  />
                </ListItem>
              )}
            </List>

            {isGroupStock && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  This material is from a group stock batch. Deleting will
                  update the batch usage tracking for inter-site settlement.
                </Typography>
              </Alert>
            )}

            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight={500}>
                This action cannot be undone.
              </Typography>
            </Alert>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isDeleting}>
          {isSettled ? "Close" : "Cancel"}
        </Button>
        {!isSettled && (
          <Button
            variant="contained"
            color="error"
            onClick={onConfirm}
            disabled={isDeleting}
            startIcon={
              isDeleting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
