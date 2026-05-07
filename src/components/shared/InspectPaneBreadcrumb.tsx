"use client";

import React from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  ChevronRight as ChevronRightIcon,
  Inventory2 as InventoryIcon,
  Storefront as StorefrontIcon,
} from "@mui/icons-material";

export interface BreadcrumbCrumb {
  kind: "material" | "vendor";
  title: string;
}

interface InspectPaneBreadcrumbProps {
  /** All entries except the final (current) one. Empty array means hide breadcrumb. */
  trail: BreadcrumbCrumb[];
  /** Click any segment to jump back to that index in the stack */
  onJumpTo: (index: number) => void;
  /** Click the back arrow to pop one level */
  onBack?: () => void;
}

/**
 * Compact breadcrumb header shown above the InspectPane title when a
 * navigation stack exists (i.e., the user pivoted from material → vendor or
 * vendor → material). Click any segment to jump back; the leftmost arrow
 * pops one level.
 */
export function InspectPaneBreadcrumb({
  trail,
  onJumpTo,
  onBack,
}: InspectPaneBreadcrumbProps) {
  const theme = useTheme();
  if (trail.length === 0) return null;

  const lastIndex = trail.length - 1;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        flexWrap: "wrap",
        mb: 0.75,
      }}
    >
      {onBack ? (
        <Box
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onBack();
            }
          }}
          aria-label="Back"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 0.75,
            cursor: "pointer",
            color: theme.palette.primary.dark,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.16) },
            mr: 0.25,
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
        </Box>
      ) : null}
      {trail.map((crumb, i) => {
        const Icon = crumb.kind === "material" ? InventoryIcon : StorefrontIcon;
        return (
          <React.Fragment key={`${i}-${crumb.title}`}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => onJumpTo(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onJumpTo(i);
                }
              }}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.4,
                px: 0.75,
                py: 0.25,
                borderRadius: 0.75,
                cursor: "pointer",
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                color: "text.secondary",
                transition: "background-color 120ms, color 120ms, border-color 120ms",
                "&:hover": {
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  color: theme.palette.primary.dark,
                  borderColor: alpha(theme.palette.primary.main, 0.4),
                },
              }}
            >
              <Icon sx={{ fontSize: 12 }} />
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {crumb.title}
              </Typography>
            </Box>
            {i < lastIndex ? (
              <ChevronRightIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            ) : null}
          </React.Fragment>
        );
      })}
      <ChevronRightIcon sx={{ fontSize: 14, color: "text.disabled" }} />
    </Box>
  );
}
