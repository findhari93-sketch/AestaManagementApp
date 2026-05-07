"use client";

import React from "react";
import { Box, useTheme, alpha } from "@mui/material";

interface ListRowProps {
  image?: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  meta?: React.ReactNode;
  chips?: React.ReactNode;
  rightContent?: React.ReactNode;
  actionsMenu?: React.ReactNode;
  selected?: boolean;
  dense?: boolean;
  onClick?: () => void;
  /** Called once on first hover after a 300ms dwell — useful for prefetch */
  onHoverPrefetch?: () => void;
  ariaLabel?: string;
}

export function ListRow({
  image,
  primary,
  secondary,
  meta,
  chips,
  rightContent,
  actionsMenu,
  selected = false,
  dense = false,
  onClick,
  onHoverPrefetch,
  ariaLabel,
}: ListRowProps) {
  const theme = useTheme();
  const isInteractive = Boolean(onClick);
  const prefetchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = React.useRef(false);

  const handleMouseEnter = () => {
    if (!onHoverPrefetch || prefetchedRef.current) return;
    prefetchTimerRef.current = setTimeout(() => {
      onHoverPrefetch();
      prefetchedRef.current = true;
    }, 300);
  };
  const handleMouseLeave = () => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  };

  return (
    <Box
      role={isInteractive ? "button" : undefined}
      aria-label={ariaLabel}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(e) => {
        if (!isInteractive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      sx={{
        px: { xs: 1.25, sm: 1.75 },
        py: dense ? 1 : 1.25,
        cursor: isInteractive ? "pointer" : "default",
        bgcolor: selected
          ? alpha(theme.palette.primary.main, 0.06)
          : "background.paper",
        border: 1,
        borderColor: selected
          ? alpha(theme.palette.primary.main, 0.5)
          : "divider",
        borderRadius: 1.5,
        transition: "box-shadow 120ms, border-color 120ms, background-color 120ms",
        ...(isInteractive
          ? {
              "&:hover": {
                bgcolor: selected
                  ? alpha(theme.palette.primary.main, 0.08)
                  : "action.hover",
                boxShadow: 1,
                borderColor: alpha(theme.palette.primary.main, 0.4),
              },
              "&:focus-visible": {
                outline: 2,
                outlineColor: alpha(theme.palette.primary.main, 0.5),
                outlineOffset: 2,
              },
            }
          : {}),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 1.25, sm: 1.75 },
          minWidth: 0,
        }}
      >
        {image ? <Box sx={{ flexShrink: 0 }}>{image}</Box> : null}

        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.25 }}>
          <Box sx={{ minWidth: 0 }}>{primary}</Box>
          {secondary ? <Box sx={{ minWidth: 0 }}>{secondary}</Box> : null}
          {chips ? (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.5,
                mt: 0.25,
                "& .MuiChip-root": { height: 20 },
              }}
            >
              {chips}
            </Box>
          ) : null}
          {meta ? (
            <Box
              sx={{
                fontSize: 9.5,
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: 0.4,
                mt: 0.25,
              }}
            >
              {meta}
            </Box>
          ) : null}
        </Box>

        {rightContent ? (
          <Box
            sx={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 0.25,
              textAlign: "right",
            }}
          >
            {rightContent}
          </Box>
        ) : null}

        {actionsMenu ? (
          <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
            {actionsMenu}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
