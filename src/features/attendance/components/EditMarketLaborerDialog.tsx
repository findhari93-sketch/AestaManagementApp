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
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";

export interface MarketLaborerRecord {
  id: string;
  date: string;
  roleName: string;
  groupCount: number;
  count?: number; // Optional - defaults to groupCount if not provided
  dayUnits: number;
  ratePerPerson: number;
  totalCost?: number; // Optional - can be calculated
  dailyEarnings?: number; // Alternative to totalCost
}

interface EditForm {
  count: number;
  day_units: number;
  rate_per_person: number;
}

interface EditMarketLaborerDialogProps {
  open: boolean;
  onClose: () => void;
  record: MarketLaborerRecord | null;
  loading?: boolean;
  onSubmit: (recordId: string, form: EditForm) => Promise<void>;
}

/**
 * Edit Market Laborer Dialog Component
 *
 * Allows editing of market laborer attendance records:
 * - Number of workers
 * - W/D units
 * - Rate per person
 * - Shows calculated per-person and total amounts
 */
function EditMarketLaborerDialogComponent({
  open,
  onClose,
  record,
  loading = false,
  onSubmit,
}: EditMarketLaborerDialogProps) {
  const [editForm, setEditForm] = useState<EditForm>({
    count: 1,
    day_units: 1,
    rate_per_person: 0,
  });

  // Reset form when record changes
  useEffect(() => {
    if (record) {
      setEditForm({
        count: record.count ?? record.groupCount,
        day_units: record.dayUnits,
        rate_per_person: record.ratePerPerson,
      });
    }
  }, [record]);

  const handleSubmit = async () => {
    if (!record) return;
    await onSubmit(record.id, editForm);
  };

  const perPersonAmount = editForm.rate_per_person * editForm.day_units;
  const totalAmount = editForm.count * perPersonAmount;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit Market Laborer
        {record && record.groupCount > 1 && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            (All {record.groupCount} {record.roleName}s)
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {record && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <Alert severity="info">
              Editing <strong>{record.roleName}</strong> on{" "}
              {dayjs(record.date).format("DD MMM YYYY")}
              {record.groupCount > 1 && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  This will update all {record.groupCount} workers in this group.
                </Typography>
              )}
            </Alert>

            <TextField
              fullWidth
              label="Number of Workers"
              type="number"
              size="small"
              value={editForm.count}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  count: Math.max(1, Number(e.target.value)),
                })
              }
              slotProps={{
                input: { inputProps: { min: 1 } },
              }}
            />

            <FormControl fullWidth size="small">
              <InputLabel>W/D Units</InputLabel>
              <Select
                value={editForm.day_units}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    day_units: e.target.value as number,
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
              label="Rate per Person"
              type="number"
              size="small"
              value={editForm.rate_per_person}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  rate_per_person: Number(e.target.value),
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
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Per Person:
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  ₹{perPersonAmount.toLocaleString()}
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body1" fontWeight={600}>
                  Total ({editForm.count} workers):
                </Typography>
                <Typography variant="body1" fontWeight={700} color="success.main">
                  ₹{totalAmount.toLocaleString()}
                </Typography>
              </Box>
            </Box>
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
const EditMarketLaborerDialog = memo(EditMarketLaborerDialogComponent);
export default EditMarketLaborerDialog;
