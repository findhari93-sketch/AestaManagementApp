"use client";

import React from "react";
import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import {
  ViewStream as ListIcon,
  GridView as GridIcon,
  TableRows as TableIcon,
} from "@mui/icons-material";

export type ViewMode = "list" | "grid" | "table";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  modes?: ViewMode[];
  size?: "small" | "medium";
}

const MODE_META: Record<ViewMode, { label: string; icon: React.ReactNode }> = {
  list: { label: "List view", icon: <ListIcon fontSize="small" /> },
  grid: { label: "Grid view", icon: <GridIcon fontSize="small" /> },
  table: { label: "Table view", icon: <TableIcon fontSize="small" /> },
};

export function ViewToggle({
  value,
  onChange,
  modes = ["list", "grid", "table"],
  size = "small",
}: ViewToggleProps) {
  return (
    <ToggleButtonGroup
      exclusive
      size={size}
      value={value}
      onChange={(_, next: ViewMode | null) => {
        if (next) onChange(next);
      }}
      sx={{
        "& .MuiToggleButton-root": {
          px: 1,
          py: 0.5,
          border: 1,
          borderColor: "divider",
        },
      }}
    >
      {modes.map((mode) => (
        <ToggleButton key={mode} value={mode} aria-label={MODE_META[mode].label}>
          <Tooltip title={MODE_META[mode].label} placement="top">
            <span style={{ display: "inline-flex" }}>{MODE_META[mode].icon}</span>
          </Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
