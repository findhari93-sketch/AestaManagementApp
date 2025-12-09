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
  Divider,
  Alert,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  CalendarToday as CalendarIcon,
  LocationOn as LocationIcon,
  Category as SectionIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  Store as StoreIcon,
  LocalCafe as TeaIcon,
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
  const grandTotal = summary.totalExpense + teaShopTotal;

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
            bgcolor: "grey.50",
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

        {/* Laborers Summary Card */}
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
              bgcolor: "primary.50",
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Laborers Summary
            </Typography>
          </Box>

          {/* Daily Laborers */}
          {summary.dailyCount > 0 && (
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
                <PersonIcon fontSize="small" color="warning" />
                <Typography variant="body2">Daily Laborers</Typography>
                <Chip
                  label={summary.dailyCount}
                  size="small"
                  color="warning"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
              </Box>
              <Typography variant="body2" fontWeight={600}>
                ₹
                {(
                  summary.namedSalary -
                  (summary.namedSalary / summary.namedCount) *
                    summary.contractCount || 0
                ).toLocaleString()}
              </Typography>
            </Box>
          )}

          {/* Contract Laborers */}
          {summary.contractCount > 0 && (
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
                <PersonIcon fontSize="small" color="info" />
                <Typography variant="body2">Contract Laborers</Typography>
                <Chip
                  label={summary.contractCount}
                  size="small"
                  color="info"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
              </Box>
              <Typography variant="body2" fontWeight={600}>
                ₹
                {(
                  (summary.namedSalary / summary.namedCount) *
                    summary.contractCount || 0
                ).toLocaleString()}
              </Typography>
            </Box>
          )}

          {/* Market Laborers */}
          {summary.marketCount > 0 && (
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
                <StoreIcon fontSize="small" color="secondary" />
                <Typography variant="body2">Market Laborers</Typography>
                <Chip
                  label={summary.marketCount}
                  size="small"
                  color="secondary"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                />
              </Box>
              <Typography variant="body2" fontWeight={600}>
                ₹{summary.marketSalary.toLocaleString()}
              </Typography>
            </Box>
          )}

          {/* Tea Shop */}
          {teaShopTotal > 0 && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: "warning.50",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TeaIcon fontSize="small" sx={{ color: "warning.main" }} />
                <Typography variant="body2">Tea Shop</Typography>
              </Box>
              <Typography variant="body2" fontWeight={600} color="warning.main">
                ₹{teaShopTotal.toLocaleString()}
              </Typography>
            </Box>
          )}

          {/* Total */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 2,
              py: 2,
              bgcolor: "primary.main",
              color: "white",
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              TOTAL EXPENSE
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              ₹{grandTotal.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {/* Quick Stats */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            justifyContent: "center",
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              {summary.totalCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Workers
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h5" fontWeight={700} color="success.main">
              ₹{summary.totalSalary.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Labor Cost
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
