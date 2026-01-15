"use client";

import React, { memo } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from "@mui/material";
import { Delete } from "@mui/icons-material";
import dayjs from "dayjs";

export interface DeleteDialogData {
  date: string;
  siteName: string;
  dailyCount: number;
  marketCount: number;
  totalAmount: number;
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  data: DeleteDialogData | null;
  loading?: boolean;
  onConfirm: () => Promise<void>;
}

/**
 * Delete Confirmation Dialog Component
 *
 * Confirms deletion of all attendance records for a date.
 * Shows:
 * - Warning about irreversible action
 * - Site name and date
 * - Laborer counts (daily, market)
 * - Total amount being deleted
 */
function DeleteConfirmDialogComponent({
  open,
  onClose,
  data,
  loading = false,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          color: "error.main",
        }}
      >
        <Delete />
        Delete Attendance Record
      </DialogTitle>
      <DialogContent>
        {data && (
          <Box sx={{ mt: 1 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              You are about to delete <strong>ALL</strong> attendance records for
              this date. This action cannot be undone.
            </Alert>

            <Box sx={{ bgcolor: "action.hover", p: 2, borderRadius: 1, mb: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ minWidth: 80 }}
                >
                  Site:
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {data.siteName}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ minWidth: 80 }}
                >
                  Date:
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {dayjs(data.date).format("dddd, DD MMMM YYYY")}
                </Typography>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ minWidth: 80 }}
                >
                  Laborers:
                </Typography>
                <Typography variant="body1">
                  {data.dailyCount} daily
                  {data.marketCount > 0 && `, ${data.marketCount} market`}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ minWidth: 80 }}
                >
                  Total:
                </Typography>
                <Typography variant="body1" fontWeight={700} color="error.main">
                  ₹{data.totalAmount.toLocaleString()}
                </Typography>
              </Box>
            </Box>

            <Typography variant="caption" color="text.secondary">
              This will also delete all tea shop entries and work summaries for
              this date.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          startIcon={<Delete />}
          disabled={loading}
        >
          Delete All
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Memoize to prevent unnecessary re-renders
const DeleteConfirmDialog = memo(DeleteConfirmDialogComponent);
export default DeleteConfirmDialog;
