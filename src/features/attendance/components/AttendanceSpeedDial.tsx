"use client";

import React, { memo } from "react";
import {
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from "@mui/material";
import {
  WbSunny,
  EventNote,
  EventBusy as HolidayIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

interface AttendanceSpeedDialProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onMorningEntry: () => void;
  onFullDayEntry: () => void;
  onHolidayClick: () => void;
  todayIsHoliday: boolean;
  canEdit: boolean;
}

/**
 * Attendance Speed Dial Component
 *
 * Floating action button with options to:
 * - Start Day (Morning) Attendance
 * - Full Day Attendance
 * - Mark/Revoke Holiday
 *
 * Only visible when user has edit permissions.
 * Click-only interaction (no hover).
 */
function AttendanceSpeedDialComponent({
  open,
  onToggle,
  onClose,
  onMorningEntry,
  onFullDayEntry,
  onHolidayClick,
  todayIsHoliday,
  canEdit,
}: AttendanceSpeedDialProps) {
  if (!canEdit) {
    return null;
  }

  return (
    <SpeedDial
      ariaLabel="Add Attendance"
      open={open}
      onOpen={() => {}} // Disable hover open
      onClose={onClose}
      FabProps={{
        onClick: onToggle,
      }}
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        "& .MuiFab-primary": {
          bgcolor: "primary.main",
          "&:hover": { bgcolor: "primary.dark" },
        },
      }}
      icon={<SpeedDialIcon openIcon={<CloseIcon />} />}
    >
      <SpeedDialAction
        icon={<WbSunny />}
        tooltipTitle="Start Day Attendance"
        tooltipOpen
        onClick={onMorningEntry}
        sx={{
          "& .MuiSpeedDialAction-staticTooltipLabel": {
            whiteSpace: "nowrap",
            bgcolor: "warning.main",
            color: "warning.contrastText",
          },
        }}
      />
      <SpeedDialAction
        icon={<EventNote />}
        tooltipTitle="Full Day Attendance"
        tooltipOpen
        onClick={onFullDayEntry}
        sx={{
          "& .MuiSpeedDialAction-staticTooltipLabel": {
            whiteSpace: "nowrap",
            bgcolor: "primary.main",
            color: "primary.contrastText",
          },
        }}
      />
      <SpeedDialAction
        icon={<HolidayIcon />}
        tooltipTitle={todayIsHoliday ? "Revoke Holiday" : "Mark as Holiday"}
        tooltipOpen
        onClick={onHolidayClick}
        sx={{
          "& .MuiSpeedDialAction-staticTooltipLabel": {
            whiteSpace: "nowrap",
            bgcolor: todayIsHoliday ? "error.main" : "success.main",
            color: todayIsHoliday ? "error.contrastText" : "success.contrastText",
          },
        }}
      />
    </SpeedDial>
  );
}

// Memoize to prevent unnecessary re-renders
const AttendanceSpeedDial = memo(AttendanceSpeedDialComponent);
export default AttendanceSpeedDial;
