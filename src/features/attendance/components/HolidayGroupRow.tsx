"use client";

import React, { memo } from "react";
import {
  Box,
  Chip,
  TableCell,
  TableRow,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { BeachAccess as BeachAccessIcon } from "@mui/icons-material";
import type { HolidayGroup } from "@/lib/utils/holidayUtils";
import {
  formatHolidayDateRange,
  formatHolidayDayRange,
} from "@/lib/utils/holidayUtils";

interface HolidayGroupRowProps {
  group: HolidayGroup;
  colSpan?: number;
}

/**
 * Holiday Group Row Component
 *
 * Displays a grouped holiday entry in the attendance table.
 * Shows:
 * - Beach access icon
 * - Date range (formatted)
 * - Day range (e.g., "Mon - Fri")
 * - Day count chip
 * - Holiday reason (if any)
 */
function HolidayGroupRowComponent({ group, colSpan = 13 }: HolidayGroupRowProps) {
  const theme = useTheme();

  return (
    <TableRow
      sx={{
        bgcolor: alpha(theme.palette.warning.main, 0.08),
        "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.15) },
      }}
    >
      <TableCell
        colSpan={colSpan}
        sx={{
          py: 1.5,
          borderLeft: 4,
          borderLeftColor: "warning.main",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 1, sm: 1.5 },
            flexWrap: "wrap",
          }}
        >
          <BeachAccessIcon
            sx={{ color: "warning.main", fontSize: { xs: 20, sm: 24 } }}
          />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ lineHeight: 1.2 }}
            >
              {formatHolidayDateRange(group)}
            </Typography>
            {group.dayCount > 1 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ lineHeight: 1, display: { xs: "none", sm: "block" } }}
              >
                {formatHolidayDayRange(group)}
              </Typography>
            )}
          </Box>
          <Chip
            label={`${group.dayCount} ${group.dayCount === 1 ? "day" : "days"}`}
            size="small"
            color="warning"
            sx={{
              fontWeight: 600,
              height: 22,
              fontSize: "0.7rem",
            }}
          />
          {group.reason && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontStyle: "italic",
                ml: { xs: 0, sm: 1 },
                flex: { xs: "1 1 100%", sm: "0 1 auto" },
                mt: { xs: 0.5, sm: 0 },
              }}
            >
              {group.reason}
            </Typography>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}

// Memoize to prevent unnecessary re-renders
const HolidayGroupRow = memo(HolidayGroupRowComponent);
export default HolidayGroupRow;
