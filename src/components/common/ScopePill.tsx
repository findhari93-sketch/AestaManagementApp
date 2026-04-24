"use client";

import React from "react";
import { Box, Button, Typography } from "@mui/material";
import {
  CalendarMonth as CalendarMonthIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useDateRange } from "@/contexts/DateRangeContext";

function formatRange(
  startDate: Date,
  endDate: Date
): { text: string; isSingleDay: boolean } {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const isSingleDay = start.isSame(end, "day");

  if (isSingleDay) {
    return { text: "", isSingleDay: true };
  }

  const crossesYears = start.year() !== end.year();
  if (crossesYears) {
    return {
      text: `${start.format("MMM D, YYYY")} – ${end.format("MMM D, YYYY")}`,
      isSingleDay: false,
    };
  }
  return {
    text: `${start.format("MMM D")} – ${end.format("MMM D")}`,
    isSingleDay: false,
  };
}

export default function ScopePill() {
  const { isAllTime, startDate, endDate, label, setAllTime } = useDateRange();

  if (isAllTime || !startDate || !endDate) return null;

  const { text: rangeText, isSingleDay } = formatRange(startDate, endDate);

  return (
    <Box
      role="status"
      onClick={() => setAllTime()}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        px: 2,
        py: 0.75,
        bgcolor: "primary.50",
        borderBottom: 1,
        borderColor: "primary.100",
        cursor: "pointer",
        flexWrap: "wrap",
        transition: "background-color 0.15s",
        "&:hover": { bgcolor: "primary.100" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <CalendarMonthIcon sx={{ fontSize: 16, color: "primary.main" }} />
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: "primary.dark" }}
          noWrap
        >
          Showing: {label}
          {!isSingleDay && rangeText ? ` · ${rangeText}` : ""}
        </Typography>
      </Box>
      <Button
        size="small"
        startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
        onClick={(e) => {
          e.stopPropagation();
          setAllTime();
        }}
        aria-label="Clear date filter and show all time"
        sx={{
          textTransform: "none",
          color: "primary.main",
          fontWeight: 500,
          py: 0.25,
          minWidth: 0,
          "& .MuiButton-startIcon": { mr: 0.5 },
          "&:hover": { bgcolor: "primary.100" },
        }}
      >
        <Box
          component="span"
          sx={{ display: { xs: "none", sm: "inline" } }}
        >
          View All Time
        </Box>
        <Box
          component="span"
          sx={{ display: { xs: "inline", sm: "none" } }}
        >
          All Time
        </Box>
      </Button>
    </Box>
  );
}
