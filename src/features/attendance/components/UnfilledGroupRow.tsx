"use client";

import React, { memo } from "react";
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  WarningAmber as WarningAmberIcon,
  BeachAccess as BeachAccessIcon,
  EditCalendar as EditCalendarIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import type { UnfilledGroup } from "@/lib/utils/unfilledDatesUtils";
import {
  formatUnfilledDateRange,
  formatUnfilledDayRange,
} from "@/lib/utils/unfilledDatesUtils";

interface UnfilledGroupRowProps {
  group: UnfilledGroup;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onFillDate: (date: string) => void;
  onMarkAsHoliday: (date: string) => void;
  colSpan?: number;
}

/**
 * Unfilled Group Row Component
 *
 * Displays a group of consecutive dates without attendance records.
 * Expandable to show individual dates with actions:
 * - Fill Attendance
 * - Mark as Holiday
 */
function UnfilledGroupRowComponent({
  group,
  isExpanded,
  onToggleExpand,
  onFillDate,
  onMarkAsHoliday,
  colSpan = 13,
}: UnfilledGroupRowProps) {
  const theme = useTheme();

  return (
    <>
      {/* Summary row - clickable to expand */}
      <TableRow
        onClick={onToggleExpand}
        sx={{
          bgcolor: alpha(theme.palette.error.main, 0.06),
          "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.12) },
          cursor: "pointer",
        }}
      >
        <TableCell
          colSpan={colSpan}
          sx={{
            py: 1.5,
            borderLeft: 4,
            borderLeftColor: "error.main",
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
            {isExpanded ? (
              <ExpandLess sx={{ color: "error.main", fontSize: { xs: 20, sm: 24 } }} />
            ) : (
              <ExpandMore sx={{ color: "error.main", fontSize: { xs: 20, sm: 24 } }} />
            )}
            <WarningAmberIcon
              sx={{ color: "error.main", fontSize: { xs: 20, sm: 24 } }}
            />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ lineHeight: 1.2 }}
              >
                {formatUnfilledDateRange(group)}
              </Typography>
              {group.dayCount > 1 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ lineHeight: 1, display: { xs: "none", sm: "block" } }}
                >
                  {formatUnfilledDayRange(group)}
                </Typography>
              )}
            </Box>
            <Chip
              label={`${group.dayCount} ${group.dayCount === 1 ? "day" : "days"} unfilled`}
              size="small"
              color="error"
              variant="outlined"
              sx={{
                fontWeight: 600,
                height: 22,
                fontSize: "0.7rem",
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                ml: "auto",
                display: { xs: "none", sm: "block" },
              }}
            >
              Click to expand
            </Typography>
          </Box>
        </TableCell>
      </TableRow>

      {/* Expanded individual date rows */}
      <TableRow>
        <TableCell colSpan={colSpan} sx={{ p: 0, border: 0 }}>
          <Collapse in={isExpanded} unmountOnExit>
            <Table size="small">
              <TableBody>
                {group.dates.map((date) => (
                  <TableRow
                    key={date}
                    sx={{
                      bgcolor: alpha(theme.palette.error.main, 0.03),
                      "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.08) },
                    }}
                  >
                    <TableCell sx={{ pl: 6, width: 150 }}>
                      <Typography variant="body2">
                        {dayjs(date).format("DD MMM")}
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 1 }}
                        >
                          {dayjs(date).format("ddd")}
                        </Typography>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        No entry recorded
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ pr: 2 }}>
                      <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                        <Tooltip title="Fill Attendance">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onFillDate(date);
                            }}
                          >
                            <EditCalendarIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Mark as Holiday">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkAsHoliday(date);
                            }}
                          >
                            <BeachAccessIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// Memoize to prevent unnecessary re-renders
const UnfilledGroupRow = memo(UnfilledGroupRowComponent);
export default UnfilledGroupRow;
