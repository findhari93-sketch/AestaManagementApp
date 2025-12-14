"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Popover,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from "@mui/icons-material";
import { useIsMobile } from "@/hooks/useIsMobile";
import { DateRange, Range, RangeKeyDict } from "react-date-range";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  addDays,
  differenceInDays,
} from "date-fns";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (startDate: Date, endDate: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

type PresetKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "last7days"
  | "lastWeek"
  | "last14days"
  | "thisMonth"
  | "last30days"
  | "lastMonth"
  | "allTime";

interface Preset {
  key: PresetKey;
  label: string;
  getRange: () => { start: Date; end: Date };
}

const presets: Preset[] = [
  {
    key: "today",
    label: "Today",
    getRange: () => ({
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
    }),
  },
  {
    key: "yesterday",
    label: "Yesterday",
    getRange: () => ({
      start: startOfDay(subDays(new Date(), 1)),
      end: endOfDay(subDays(new Date(), 1)),
    }),
  },
  {
    key: "thisWeek",
    label: "This week (Sun - Today)",
    getRange: () => ({
      start: startOfWeek(new Date()),
      end: endOfDay(new Date()),
    }),
  },
  {
    key: "last7days",
    label: "Last 7 days",
    getRange: () => ({
      start: startOfDay(subDays(new Date(), 6)),
      end: endOfDay(new Date()),
    }),
  },
  {
    key: "lastWeek",
    label: "Last week (Sun - Sat)",
    getRange: () => ({
      start: startOfWeek(subDays(new Date(), 7)),
      end: endOfWeek(subDays(new Date(), 7)),
    }),
  },
  {
    key: "last14days",
    label: "Last 14 days",
    getRange: () => ({
      start: startOfDay(subDays(new Date(), 13)),
      end: endOfDay(new Date()),
    }),
  },
  {
    key: "thisMonth",
    label: "This month",
    getRange: () => ({
      start: startOfMonth(new Date()),
      end: endOfDay(new Date()),
    }),
  },
  {
    key: "last30days",
    label: "Last 30 days",
    getRange: () => ({
      start: startOfDay(subDays(new Date(), 29)),
      end: endOfDay(new Date()),
    }),
  },
  {
    key: "lastMonth",
    label: "Last month",
    getRange: () => ({
      start: startOfMonth(subMonths(new Date(), 1)),
      end: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    key: "allTime",
    label: "All time",
    getRange: () => ({
      start: new Date(2020, 0, 1), // Far back date
      end: endOfDay(new Date()),
    }),
  },
];

// Find matching preset for current date range
const findMatchingPreset = (start: Date, end: Date): PresetKey | null => {
  for (const preset of presets) {
    const range = preset.getRange();
    if (
      format(start, "yyyy-MM-dd") === format(range.start, "yyyy-MM-dd") &&
      format(end, "yyyy-MM-dd") === format(range.end, "yyyy-MM-dd")
    ) {
      return preset.key;
    }
  }
  return null;
};

// Get label for current selection
const getSelectionLabel = (start: Date, end: Date): string => {
  const matchingPreset = findMatchingPreset(start, end);
  if (matchingPreset) {
    const preset = presets.find((p) => p.key === matchingPreset);
    if (preset && preset.key !== "allTime") {
      return preset.label;
    }
  }
  // Custom range - show dates
  const startStr = format(start, "MMM d, yyyy");
  const endStr = format(end, "MMM d, yyyy");
  if (startStr === endStr) return startStr;
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
};

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate = new Date(),
}: DateRangePickerProps) {
  const isMobile = useIsMobile();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const [tempRange, setTempRange] = useState<Range[]>([
    {
      startDate: startDate || new Date(),
      endDate: endDate || new Date(),
      key: "selection",
    },
  ]);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | null>(() =>
    startDate && endDate ? findMatchingPreset(startDate, endDate) : null
  );

  const open = Boolean(anchorEl);

  // Sync temp range when props change
  useEffect(() => {
    if (startDate && endDate) {
      setTempRange([
        {
          startDate: startDate,
          endDate: endDate,
          key: "selection",
        },
      ]);
      setSelectedPreset(findMatchingPreset(startDate, endDate));
    }
  }, [startDate, endDate]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    // Use current dates or default to last 7 days for picker
    const defaultStart = startDate || subDays(new Date(), 7);
    const defaultEnd = endDate || new Date();
    setTempRange([
      {
        startDate: defaultStart,
        endDate: defaultEnd,
        key: "selection",
      },
    ]);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleApply = () => {
    if (tempRange[0].startDate && tempRange[0].endDate) {
      onChange(tempRange[0].startDate, tempRange[0].endDate);
    }
    handleClose();
  };

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getRange();
    setTempRange([
      {
        startDate: range.start,
        endDate: range.end,
        key: "selection",
      },
    ]);
    setSelectedPreset(preset.key);

    // Auto-apply on mobile for quick preset selection
    if (isMobile) {
      onChange(range.start, range.end);
      handleClose();
    }
  };

  const handleRangeChange = (ranges: RangeKeyDict) => {
    const selection = ranges.selection;
    setTempRange([selection]);
    // Clear preset when manually selecting
    if (selection.startDate && selection.endDate) {
      setSelectedPreset(findMatchingPreset(selection.startDate, selection.endDate));
    }
  };

  // Check if dates are set (not "All Time" mode)
  const hasDates = startDate && endDate;

  // Check if it's a single date selection (not a range)
  const isSingleDate = hasDates &&
    format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");

  // Navigate dates based on selection type (disabled when no dates set)
  const handleNavigate = (direction: "prev" | "next") => {
    if (!hasDates) return;

    if (isSingleDate) {
      // Single date: move by 1 day in either direction
      if (direction === "prev") {
        const newDate = subDays(startDate, 1);
        onChange(newDate, newDate);
      } else {
        const newDate = addDays(startDate, 1);
        // Don't go past today
        if (newDate <= new Date()) {
          onChange(newDate, newDate);
        }
      }
    } else {
      // Date range: only allow going backwards, move by 1 day
      if (direction === "prev") {
        onChange(subDays(startDate, 1), subDays(endDate, 1));
      }
      // "next" does nothing for ranges (button is disabled)
    }
  };

  // Disable buttons when no dates are set (All Time mode)
  const isNextDisabled = !hasDates ||
    format(endDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ||
    !isSingleDate;

  const isPrevDisabled = !hasDates;

  // Current label - show "All Time" when no dates are set
  const currentLabel = hasDates ? getSelectionLabel(startDate, endDate) : "All Time";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 } }}>
      {/* Main dropdown trigger */}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {/* Prev arrow */}
        <IconButton
          size="small"
          onClick={() => handleNavigate("prev")}
          disabled={isPrevDisabled}
          sx={{ p: { xs: 0.25, sm: 0.5 } }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>

        {/* Date range button */}
        <Button
          variant="outlined"
          size="small"
          onClick={handleOpen}
          endIcon={<ArrowDownIcon />}
          sx={{
            textTransform: "none",
            minWidth: { xs: 120, sm: 180 },
            justifyContent: "space-between",
            px: { xs: 1, sm: 1.5 },
            py: 0.5,
            bgcolor: "background.paper",
            borderColor: "divider",
            color: "text.primary",
            fontSize: { xs: "0.75rem", sm: "0.875rem" },
            "&:hover": {
              bgcolor: "action.hover",
              borderColor: "divider",
            },
          }}
        >
          <Typography
            variant="body2"
            noWrap
            sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
          >
            {currentLabel}
          </Typography>
        </Button>

        {/* Next arrow - disabled for date ranges, only works for single date */}
        <IconButton
          size="small"
          onClick={() => handleNavigate("next")}
          disabled={isNextDisabled}
          sx={{ p: { xs: 0.25, sm: 0.5 } }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Popover with presets and calendar */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        PaperProps={{
          sx: {
            mt: 1,
            maxWidth: { xs: "95vw", sm: "auto" },
            maxHeight: { xs: "85vh", sm: "auto" },
            overflow: "hidden",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            minWidth: { xs: "auto", sm: 600 },
          }}
        >
          {/* Mobile: Horizontal scrollable preset chips */}
          <Box
            sx={{
              display: { xs: "flex", sm: "none" },
              overflowX: "auto",
              gap: 0.5,
              p: 1,
              pb: 0.5,
              borderBottom: 1,
              borderColor: "divider",
              WebkitOverflowScrolling: "touch",
              "&::-webkit-scrollbar": { display: "none" },
              scrollbarWidth: "none",
            }}
          >
            {presets.slice(0, 8).map((preset) => (
              <Chip
                key={preset.key}
                label={preset.label.replace(" (Sun - Today)", "").replace(" (Sun - Sat)", "")}
                size="small"
                variant={selectedPreset === preset.key ? "filled" : "outlined"}
                color={selectedPreset === preset.key ? "primary" : "default"}
                onClick={() => handlePresetClick(preset)}
                sx={{
                  flexShrink: 0,
                  fontSize: "0.7rem",
                  height: 26,
                }}
              />
            ))}
          </Box>

          {/* Desktop: Vertical presets list */}
          <Box
            sx={{
              display: { xs: "none", sm: "block" },
              width: 180,
              borderRight: 1,
              borderColor: "divider",
              maxHeight: 400,
              overflow: "auto",
            }}
          >
            <List dense disablePadding>
              {presets.map((preset) => (
                <ListItemButton
                  key={preset.key}
                  selected={selectedPreset === preset.key}
                  onClick={() => handlePresetClick(preset)}
                  sx={{
                    py: 0.75,
                    "&.Mui-selected": {
                      bgcolor: "primary.50",
                      color: "primary.main",
                      "&:hover": {
                        bgcolor: "primary.100",
                      },
                    },
                  }}
                >
                  <ListItemText
                    primary={preset.label}
                    primaryTypographyProps={{
                      fontSize: "0.8rem",
                      fontWeight: selectedPreset === preset.key ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          {/* Calendar */}
          <Box sx={{ p: { xs: 0.5, sm: 1 }, overflow: "auto" }}>
            <DateRange
              ranges={tempRange}
              onChange={handleRangeChange}
              months={1}
              direction="horizontal"
              maxDate={maxDate}
              minDate={minDate}
              rangeColors={["#1976d2"]}
              showDateDisplay={!isMobile}
              editableDateInputs={!isMobile}
            />
          </Box>
        </Box>

        {/* Actions - Hidden on mobile since presets auto-apply */}
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <Divider />
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              p: 1.5,
            }}
          >
            <Button size="small" onClick={handleClose}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={handleApply}>
              Apply
            </Button>
          </Box>
        </Box>

        {/* Mobile: Compact actions for custom calendar selection */}
        <Box
          sx={{
            display: { xs: "flex", sm: "none" },
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
            p: 1,
            pt: 0,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Tap preset to quick-apply
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button size="small" onClick={handleClose} sx={{ minWidth: 60, py: 0.25 }}>
              Close
            </Button>
            <Button size="small" variant="contained" onClick={handleApply} sx={{ minWidth: 60, py: 0.25 }}>
              Apply
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
