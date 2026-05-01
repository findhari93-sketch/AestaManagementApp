"use client";

import React from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import { WarningAmberRounded } from "@mui/icons-material";

export type UnsettledUnit = "dates" | "weeks" | "items";

interface UnsettledBannerProps {
  count: number;
  amount: number;
  unit: UnsettledUnit;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function pluralize(unit: UnsettledUnit, count: number): string {
  if (count === 1) {
    return unit === "dates" ? "date" : unit === "weeks" ? "week" : "item";
  }
  return unit;
}

export default function UnsettledBanner({
  count,
  amount,
  unit,
  ctaLabel,
  onCtaClick,
}: UnsettledBannerProps) {
  const theme = useTheme();
  if (count <= 0) return null;

  return (
    <Box
      role="status"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.625,
        bgcolor: alpha(theme.palette.warning.main, 0.08),
        borderTop: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
        borderBottom: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
        color: theme.palette.warning.dark,
        minHeight: 36,
        flexShrink: 0,
      }}
    >
      <WarningAmberRounded sx={{ fontSize: 16 }} />
      <Typography
        component="span"
        sx={{
          fontSize: 12.5,
          fontVariantNumeric: "tabular-nums",
          color: "text.primary",
        }}
      >
        <Box component="span" sx={{ fontWeight: 700 }}>
          {count}
        </Box>{" "}
        {pluralize(unit, count)} unsettled
        <Box
          component="span"
          sx={{ color: "text.secondary", mx: 0.75 }}
          aria-hidden
        >
          ·
        </Box>
        <Box component="span" sx={{ fontWeight: 600 }}>
          {formatINR(amount)}
        </Box>{" "}
        <Box component="span" sx={{ color: "text.secondary" }}>
          pending
        </Box>
      </Typography>
      <Box sx={{ flex: 1 }} />
      {ctaLabel && onCtaClick && (
        <Box
          component="button"
          type="button"
          onClick={onCtaClick}
          sx={{
            border: "none",
            background: "transparent",
            color: theme.palette.warning.dark,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            px: 0.5,
            py: 0.25,
            borderRadius: 0.5,
            "&:hover": {
              color: theme.palette.warning.main,
              textDecoration: "underline",
            },
            "&:focus-visible": {
              outline: `2px solid ${theme.palette.warning.main}`,
              outlineOffset: 2,
            },
          }}
        >
          {ctaLabel}
        </Box>
      )}
    </Box>
  );
}
