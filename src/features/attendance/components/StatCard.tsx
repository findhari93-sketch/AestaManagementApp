"use client";

import React, { memo } from "react";
import { Paper, Typography } from "@mui/material";

interface StatCardProps {
  label: string;
  value: string | number;
  color?: "primary" | "secondary" | "success" | "error" | "warning" | "info";
  prefix?: string;
}

/**
 * Stat Card Component
 *
 * A simple card for displaying statistics in a grid layout.
 * Used in summary dialogs and dashboard displays.
 */
function StatCardComponent({
  label,
  value,
  color,
  prefix = "",
}: StatCardProps) {
  return (
    <Paper sx={{ p: { xs: 1, sm: 2 }, textAlign: "center" }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: { xs: "0.65rem", sm: "0.75rem" } }}
      >
        {label}
      </Typography>
      <Typography
        variant="h4"
        fontWeight={700}
        color={color ? `${color}.main` : undefined}
        sx={{ fontSize: { xs: "1.5rem", sm: "2.125rem" } }}
      >
        {prefix}
        {typeof value === "number" ? value.toLocaleString() : value}
      </Typography>
    </Paper>
  );
}

// Memoize to prevent unnecessary re-renders
const StatCard = memo(StatCardComponent);
export default StatCard;
