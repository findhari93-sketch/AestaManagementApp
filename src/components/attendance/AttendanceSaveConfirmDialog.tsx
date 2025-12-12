"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  CalendarToday as CalendarIcon,
  LocationOn as LocationIcon,
  Category as SectionIcon,
  Groups as GroupsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";

export interface AttendanceSummary {
  namedCount: number;
  namedSalary: number;
  marketCount: number;
  marketSalary: number;
  dailyCount: number;
  contractCount: number;
  totalCount: number;
  totalSalary: number;
  totalExpense: number;
}

export interface AttendanceSaveConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  siteName: string;
  sectionName: string;
  date: string;
  summary: AttendanceSummary;
  teaShopTotal: number;
  hasExistingAttendance: boolean;
  saving: boolean;
}

export default function AttendanceSaveConfirmDialog({
  open,
  onClose,
  onConfirm,
  onEdit,
  siteName,
  sectionName,
  date,
  summary,
  teaShopTotal,
  hasExistingAttendance,
  saving,
}: AttendanceSaveConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <CheckIcon color="primary" />
        <Typography variant="h6" component="span" fontWeight={600}>
          Review Attendance
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Site/Date/Section Info Card */}
        <Box
          sx={{
            bgcolor: "action.hover",
            borderRadius: 2,
            p: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <LocationIcon fontSize="small" color="action" />
            <Typography variant="body1" fontWeight={600}>
              {siteName || "Unknown Site"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <CalendarIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {dayjs(date).format("dddd, DD MMMM YYYY")}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SectionIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              Section: {sectionName || "Not specified"}
            </Typography>
          </Box>
        </Box>

        {/* Warning for existing attendance */}
        {hasExistingAttendance && (
          <Alert
            severity="warning"
            icon={<WarningIcon />}
            sx={{ mb: 2, borderRadius: 2 }}
          >
            <Typography variant="body2" fontWeight={500}>
              Attendance exists for this date
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Previous records will be updated with the new data
            </Typography>
          </Alert>
        )}

        {/* Salary Summary Card */}
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
            mb: 2,
          }}
        >
          <Box
            sx={{
              bgcolor: "success.50",
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Attendance Summary
            </Typography>
          </Box>

          {/* Workers Count */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <GroupsIcon fontSize="small" color="primary" />
              <Typography variant="body2">Total Workers</Typography>
            </Box>
            <Chip
              label={summary.totalCount}
              size="small"
              color="primary"
              sx={{ fontWeight: 600 }}
            />
          </Box>

          {/* Total Salary */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 2,
              py: 2,
              bgcolor: "success.main",
              color: "white",
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              TOTAL SALARY
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              ₹{summary.totalSalary.toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onEdit} variant="outlined" disabled={saving}>
          Edit
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="primary"
          disabled={saving}
          startIcon={
            saving ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />
          }
          sx={{ minWidth: 120 }}
        >
          {saving ? "Saving..." : "Confirm"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
