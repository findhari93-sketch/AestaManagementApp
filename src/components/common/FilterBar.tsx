"use client";

import React from "react";
import {
  Box,
  Chip,
  InputAdornment,
  MenuItem,
  TextField,
  alpha,
  useTheme,
} from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";

export interface FilterChipDef {
  key: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
}

export interface SortOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;

  filterChips?: FilterChipDef[];
  onFilterChipToggle?: (key: string) => void;

  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (v: string) => void;
  sortLabel?: string;

  viewToggle?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  filterChips,
  onFilterChipToggle,
  sortOptions,
  sortValue,
  onSortChange,
  sortLabel = "Sort by",
  viewToggle,
  rightSlot,
}: FilterBarProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        alignItems: { xs: "stretch", md: "center" },
        gap: 1,
        px: { xs: 1, sm: 1.5 },
        py: 1,
      }}
    >
      <TextField
        size="small"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
          endAdornment: searchValue ? (
            <InputAdornment position="end">
              <ClearIcon
                fontSize="small"
                sx={{ cursor: "pointer", color: "text.secondary", "&:hover": { color: "text.primary" } }}
                onClick={() => onSearchChange("")}
              />
            </InputAdornment>
          ) : null,
        }}
        sx={{
          flex: { xs: "0 0 auto", md: "1 1 280px" },
          maxWidth: { md: 360 },
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.paper",
            fontSize: 13,
          },
        }}
      />

      {filterChips && filterChips.length > 0 ? (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            alignItems: "center",
            flex: { md: "1 1 auto" },
            minWidth: 0,
          }}
        >
          {filterChips.map((chip) => {
            const active = chip.active;
            return (
              <Chip
                key={chip.key}
                size="small"
                label={chip.label}
                icon={chip.icon ? (chip.icon as React.ReactElement) : undefined}
                onClick={() => onFilterChipToggle?.(chip.key)}
                sx={{
                  height: 26,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  cursor: "pointer",
                  bgcolor: active ? alpha(theme.palette.primary.main, 0.18) : "background.paper",
                  color: active ? theme.palette.primary.dark : "text.secondary",
                  border: 1,
                  borderColor: active
                    ? alpha(theme.palette.primary.main, 0.4)
                    : "divider",
                  "&:hover": {
                    bgcolor: active
                      ? alpha(theme.palette.primary.main, 0.24)
                      : "action.hover",
                  },
                }}
              />
            );
          })}
        </Box>
      ) : null}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexShrink: 0,
          ml: { md: "auto" },
        }}
      >
        {sortOptions && sortOptions.length > 0 && onSortChange ? (
          <TextField
            select
            size="small"
            label={sortLabel}
            value={sortValue ?? ""}
            onChange={(e) => onSortChange(e.target.value)}
            sx={{
              minWidth: 160,
              "& .MuiOutlinedInput-root": { fontSize: 13, bgcolor: "background.paper" },
              "& .MuiInputLabel-root": { fontSize: 12 },
            }}
          >
            {sortOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        ) : null}

        {viewToggle}
        {rightSlot}
      </Box>
    </Box>
  );
}
