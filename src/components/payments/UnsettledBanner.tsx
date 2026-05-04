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
  /** When provided AND > 0, the banner renders an inline "Legacy: N unit · ₹X"
   *  segment in front of the existing "N unit unsettled · ₹X pending" line.
   *  Used for sites in audit mode so the user can see both pools at a glance.
   *  Setting either to 0 hides the legacy segment. */
  legacyCount?: number;
  legacyAmount?: number;
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
  legacyCount,
  legacyAmount,
}: UnsettledBannerProps) {
  const theme = useTheme();
  const hasLegacy = (legacyCount ?? 0) > 0 && (legacyAmount ?? 0) > 0;
  // Hide the strip only when BOTH pools are empty.
  if (count <= 0 && !hasLegacy) return null;

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
        {hasLegacy && (
          <>
            <Box component="span" sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "warning.dark", mr: 0.5 }}>
              Legacy:
            </Box>
            <Box component="span" sx={{ fontWeight: 700 }}>
              {legacyCount}
            </Box>{" "}
            {pluralize(unit, legacyCount ?? 0)}
            <Box component="span" sx={{ color: "text.secondary", mx: 0.5 }} aria-hidden>·</Box>
            <Box component="span" sx={{ fontWeight: 600 }}>
              {formatINR(legacyAmount ?? 0)}
            </Box>
            {count > 0 && (
              <Box component="span" sx={{ color: "text.secondary", mx: 0.75 }} aria-hidden>┃</Box>
            )}
          </>
        )}
        {count > 0 && (
          <>
            {hasLegacy && (
              <Box component="span" sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "text.secondary", mr: 0.5 }}>
                Current:
              </Box>
            )}
            <Box component="span" sx={{ fontWeight: 700 }}>
              {count}
            </Box>{" "}
            {pluralize(unit, count)} unsettled
            <Box component="span" sx={{ color: "text.secondary", mx: 0.75 }} aria-hidden>·</Box>
            <Box component="span" sx={{ fontWeight: 600 }}>
              {formatINR(amount)}
            </Box>{" "}
            <Box component="span" sx={{ color: "text.secondary" }}>pending</Box>
          </>
        )}
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
