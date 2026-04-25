"use client";

import React from "react";
import { Chip, IconButton } from "@mui/material";
import {
  CalendarMonth as CalendarMonthIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useDateRange } from "@/contexts/DateRangeContext";

function formatRange(startDate: Date, endDate: Date): string {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  if (start.isSame(end, "day")) {
    return start.format("MMM D, YYYY");
  }
  if (start.year() !== end.year()) {
    return `${start.format("MMM D, YYYY")} – ${end.format("MMM D, YYYY")}`;
  }
  return `${start.format("MMM D")} – ${end.format("MMM D")}`;
}

export default function ScopeChip() {
  const { isAllTime, startDate, endDate, days, setAllTime, openPicker } =
    useDateRange();

  const isFiltered = !isAllTime && startDate && endDate && days != null;

  return (
    <Chip
      icon={<CalendarMonthIcon fontSize="small" />}
      label={
        isFiltered
          ? `${formatRange(startDate, endDate)} · ${days === 1 ? "1 day" : `${days} days`}`
          : "All Time"
      }
      size="small"
      color={isFiltered ? "primary" : "default"}
      variant="outlined"
      role="status"
      clickable
      onClick={() => openPicker()}
      aria-label={
        isFiltered
          ? "Open date filter"
          : "Date filter: All Time, click to change"
      }
      deleteIcon={
        isFiltered ? (
          <IconButton
            size="small"
            aria-label="Clear date filter and show all time"
            sx={{ p: 0 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : undefined
      }
      onDelete={isFiltered ? () => setAllTime() : undefined}
      sx={{
        height: 28,
        fontWeight: 500,
        maxWidth: { xs: 220, sm: "none" },
        "& .MuiChip-label": {
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
      }}
    />
  );
}
