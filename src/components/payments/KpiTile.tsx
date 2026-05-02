"use client";

import React from "react";
import { Box, Typography, useTheme } from "@mui/material";

export type KpiTileVariant = "neutral" | "success" | "warning" | "info" | "error";

export interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  variant: KpiTileVariant;
  formula?: string;
}

export function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function KpiTile({ label, value, sub, variant, formula }: KpiTileProps) {
  const theme = useTheme();
  const palette = {
    neutral: {
      border: theme.palette.grey[600],
      bg: theme.palette.grey[50],
      val: theme.palette.text.primary,
    },
    success: {
      border: theme.palette.success.main,
      bg: theme.palette.success.light + "40",
      val: theme.palette.success.dark,
    },
    warning: {
      border: theme.palette.warning.main,
      bg: theme.palette.warning.light + "40",
      val: theme.palette.warning.dark,
    },
    info: {
      border: theme.palette.info.main,
      bg: theme.palette.info.light + "40",
      val: theme.palette.info.dark,
    },
    error: {
      border: theme.palette.error.main,
      bg: theme.palette.error.light + "40",
      val: theme.palette.error.dark,
    },
  }[variant];

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        p: 1.5,
        bgcolor: palette.bg,
        borderLeft: `3px solid ${palette.border}`,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "text.secondary",
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: 16, sm: 19 },
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: palette.val,
          lineHeight: 1.1,
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: 10.5, color: "text.secondary", mt: 0.25 }}>
          {sub}
        </Typography>
      )}
      {formula && (
        <Typography
          sx={{
            fontSize: 10,
            color: "text.disabled",
            fontStyle: "italic",
            mt: 0.25,
          }}
        >
          {formula}
        </Typography>
      )}
    </Box>
  );
}
