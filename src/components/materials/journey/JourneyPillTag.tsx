// src/components/materials/journey/JourneyPillTag.tsx
"use client";

import React from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import {
  ChevronLeft as OpenIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import type { JourneyOverallStatus } from "@/types/journey.types";

interface JourneyPillTagProps {
  overallStatus: JourneyOverallStatus | null;
  onOpen: () => void;
  onDismiss: () => void;
}

function statusDotColor(status: JourneyOverallStatus | null): string {
  if (!status) return "#9e9e9e";
  if (status === "complete" || status === "settlement_done") return "#4caf50";
  return "#ff9800"; // in-progress / pending states
}

export function JourneyPillTag({ overallStatus, onOpen, onDismiss }: JourneyPillTagProps) {
  const isComplete = overallStatus === "complete" || overallStatus === "settlement_done";
  const dotColor = statusDotColor(overallStatus);

  return (
    <Box
      sx={{
        position: "fixed",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 40,
        bgcolor: "background.paper",
        borderRadius: "8px 0 0 8px",
        border: "1px solid",
        borderRight: "none",
        borderColor: "divider",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      {/* Dismiss button — only when journey is complete */}
      {isComplete && (
        <Tooltip title="Close journey tracker" placement="left">
          <IconButton size="small" onClick={onDismiss} sx={{ width: 40, height: 36, borderRadius: 0 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Open button */}
      <Tooltip title="View request journey" placement="left">
        <IconButton size="small" onClick={onOpen} sx={{ width: 40, height: 36, borderRadius: 0 }}>
          <OpenIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      {/* Label */}
      <Box
        sx={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          fontSize: "0.6rem",
          fontWeight: 700,
          color: "text.secondary",
          letterSpacing: "0.08em",
          py: 0.75,
          userSelect: "none",
        }}
      >
        MR
      </Box>

      {/* Status dot */}
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: dotColor,
          mb: 1,
          boxShadow: `0 0 0 2px ${dotColor}33`,
        }}
      />
    </Box>
  );
}
