"use client";

import React from "react";
import { Box, Stack, Typography, Chip, Button } from "@mui/material";
import {
  CalendarMonth as CalendarMonthIcon,
  TaskAlt as SettleIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";

interface TradeAttendanceWeekSeparatorProps {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
  isCurrentWeek: boolean;
  /** Right-side metadata chips (e.g. "Pending: 3 days" or "Labor: ₹4,025"). */
  rightChips?: Array<{ label: string; color?: "default" | "primary" | "warning" | "error" }>;
  /** Show the Settle Week button (only for completed past weeks with money to settle). */
  onSettle?: () => void;
  /** Label for the settle button (e.g. "Settle ₹4,025"). */
  settleLabel?: string;
}

function formatRange(start: string, end: string): string {
  const s = dayjs(start);
  const e = dayjs(end);
  if (s.month() === e.month()) {
    return `${s.format("D")} - ${e.format("D MMM YYYY")}`;
  }
  return `${s.format("D MMM")} - ${e.format("D MMM YYYY")}`;
}

/** Visual mirror of civil's weekly separator row (lines 3880-3979 of
 *  attendance-content.tsx). Renders a blue-tinted bar above each week's
 *  day rows in the trade attendance table. */
export function TradeAttendanceWeekSeparator({
  weekStart,
  weekEnd,
  isCurrentWeek,
  rightChips = [],
  onSettle,
  settleLabel,
}: TradeAttendanceWeekSeparatorProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      spacing={1}
      sx={{
        bgcolor: (theme) =>
          isCurrentWeek
            ? theme.palette.mode === "light"
              ? "info.50"
              : "rgba(33, 150, 243, 0.12)"
            : theme.palette.mode === "light"
            ? "grey.100"
            : "rgba(255,255,255,0.04)",
        px: 1.5,
        py: 1,
        borderRadius: 1,
        my: 0.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        <CalendarMonthIcon fontSize="small" sx={{ color: isCurrentWeek ? "info.main" : "text.secondary" }} />
        <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 0 }}>
          {isCurrentWeek ? "This Week: " : ""}{formatRange(weekStart, weekEnd)}
        </Typography>
        {isCurrentWeek && (
          <Chip label="In Progress" size="small" color="info" variant="outlined" />
        )}
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        {rightChips.map((c, i) => (
          <Chip key={i} label={c.label} size="small" color={c.color ?? "default"} variant="outlined" />
        ))}
        {onSettle && (
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<SettleIcon />}
            onClick={onSettle}
          >
            {settleLabel ?? "Settle Week"}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
