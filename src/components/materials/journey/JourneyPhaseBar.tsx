"use client";

import React from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import type { JourneyPhaseStatus } from "@/types/journey.types";

export interface PhaseBarStep {
  name: string;
  status: JourneyPhaseStatus;
}

interface JourneyPhaseBarProps {
  phases: PhaseBarStep[];
}

const DOT_COLOR: Record<JourneyPhaseStatus, string> = {
  done: "#2e7d32",
  active: "#1565c0",
  pending: "#bdbdbd",
  blocked: "#c62828",
};

const LINE_COLOR: Record<JourneyPhaseStatus, string> = {
  done: "#2e7d32",
  active: "#90caf9",
  pending: "#e0e0e0",
  blocked: "#ef9a9a",
};

const DOT_SIZE = 10;

export function JourneyPhaseBar({ phases }: JourneyPhaseBarProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        px: 2.5,
        py: 1.25,
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.default, 0.4),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          position: "relative",
          justifyContent: "space-between",
        }}
      >
        {phases.map((phase, index) => (
          <Box
            key={index}
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
            }}
          >
            {/* Connector line to the right (not for last item) */}
            {index < phases.length - 1 && (
              <Box
                sx={{
                  position: "absolute",
                  top: DOT_SIZE / 2 - 1,
                  left: "50%",
                  right: `-50%`,
                  height: 2,
                  zIndex: 0,
                  bgcolor:
                    phase.status === "done"
                      ? LINE_COLOR.done
                      : phases[index + 1]?.status === "active"
                      ? LINE_COLOR.active
                      : LINE_COLOR.pending,
                }}
              />
            )}

            {/* Dot */}
            <Box
              sx={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: "50%",
                bgcolor: DOT_COLOR[phase.status],
                zIndex: 1,
                position: "relative",
                boxShadow:
                  phase.status === "active"
                    ? `0 0 0 3px ${alpha(DOT_COLOR.active, 0.25)}`
                    : phase.status === "done"
                    ? `0 0 0 2px ${alpha(DOT_COLOR.done, 0.2)}`
                    : undefined,
                transition: "box-shadow 0.2s",
              }}
            />

            {/* Label */}
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.62rem",
                mt: 0.5,
                textAlign: "center",
                lineHeight: 1.2,
                fontWeight: phase.status === "active" ? 700 : 500,
                color:
                  phase.status === "active"
                    ? "primary.main"
                    : phase.status === "done"
                    ? "success.dark"
                    : phase.status === "blocked"
                    ? "error.main"
                    : "text.secondary",
                maxWidth: 56,
                wordBreak: "break-word",
              }}
            >
              {phase.name}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default JourneyPhaseBar;
