"use client";

import React, { memo, useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";

export interface AttendanceRecord {
  id: string;
  date: string;
  laborer_id: string;
  laborer_name: string;
  laborer_type: string | null;
  work_days: number;
  daily_rate_applied: number;
  daily_earnings: number;
  is_paid: boolean;
}

interface EditForm {
  work_days: number;
  daily_rate_applied: number;
}

interface EditAttendanceDialogProps {
  open: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  loading?: boolean;
  onSubmit: (recordId: string, form: EditForm) => Promise<void>;
}

/**
 * Edit Attendance Dialog Component
 *
 * Allows editing of attendance records:
 * - Work days (W/D units)
 * - Daily rate
 * - Shows calculated total salary
 */
function EditAttendanceDialogComponent({
  open,
  onClose,
  record,
  loading = false,
  onSubmit,
}: EditAttendanceDialogProps) {
  const [editForm, setEditForm] = useState<EditForm>({
    work_days: 1,
    daily_rate_applied: 0,
  });

  // Reset form when record changes
  useEffect(() => {
    if (record) {
      setEditForm({
        work_days: record.work_days,
        daily_rate_applied: record.daily_rate_applied,
      });
    }
  }, [record]);

  const handleSubmit = async () => {
    if (!record) return;
    await onSubmit(record.id, editForm);
  };

  const calculatedSalary = editForm.work_days * editForm.daily_rate_applied;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Attendance</DialogTitle>
      <DialogContent>
        {record && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <Alert severity="info">
              Editing attendance for <strong>{record.laborer_name}</strong> on{" "}
              {dayjs(record.date).format("DD MMM YYYY")}
            </Alert>

            <FormControl fullWidth size="small">
              <InputLabel>W/D Units</InputLabel>
              <Select
                value={editForm.work_days}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    work_days: e.target.value as number,
                  })
                }
                label="W/D Units"
              >
                <MenuItem value={0.5}>0.5 (Half Day)</MenuItem>
                <MenuItem value={1}>1 (Full Day)</MenuItem>
                <MenuItem value={1.5}>1.5</MenuItem>
                <MenuItem value={2}>2</MenuItem>
                <MenuItem value={2.5}>2.5 (Extra)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Daily Rate"
              type="number"
              size="small"
              value={editForm.daily_rate_applied}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  daily_rate_applied: Number(e.target.value),
                })
              }
              slotProps={{
                input: {
                  startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography>,
                },
              }}
            />

            <Box
              sx={{
                p: 2,
                bgcolor: "action.selected",
                borderRadius: 1,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Total Salary:
              </Typography>
              <Typography variant="body1" fontWeight={700} color="success.main">
                ₹{calculatedSalary.toLocaleString()}
              </Typography>
            </Box>

            {record.laborer_type !== "contract" && !record.is_paid && (
              <Alert severity="info" sx={{ mt: 1 }}>
                To record payment, close this dialog and click the &quot;Pay&quot;
                button or the PENDING chip.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          Update
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Memoize to prevent unnecessary re-renders
const EditAttendanceDialog = memo(EditAttendanceDialogComponent);
export default EditAttendanceDialog;
