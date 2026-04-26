"use client";

import React from "react";
import { Box, Skeleton, Typography, useTheme, alpha } from "@mui/material";
import dayjs from "dayjs";
import type { AdvanceRow } from "@/hooks/queries/useAdvances";

interface AdvancesListProps {
  advances: AdvanceRow[];
  isLoading: boolean;
  onRowClick: (advance: AdvanceRow) => void;
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function AdvancesList({
  advances,
  isLoading,
  onRowClick,
}: AdvancesListProps) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Box sx={{ p: 1.5 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 0.75 }} />
        ))}
      </Box>
    );
  }

  if (advances.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No outside-waterfall advances in this period.
        </Typography>
      </Box>
    );
  }

  const total = advances.reduce((s, a) => s + a.amount, 0);

  return (
    <Box>
      <Box
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: alpha(theme.palette.warning.main, 0.08),
          borderBottom: `1px solid ${theme.palette.warning.main}`,
          fontSize: 11,
          color: theme.palette.warning.dark,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
        }}
      >
        <span>💸 Outside-waterfall Advances</span>
        <span
          style={{
            fontWeight: 500,
            textTransform: "none",
            letterSpacing: 0,
            color: theme.palette.warning.dark,
            opacity: 0.8,
          }}
        >
          Emergency money — NOT deducted from salary
        </span>
      </Box>

      {advances.map((a) => (
        <Box
          key={a.id}
          onClick={() => onRowClick(a)}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "100px 1fr 90px", sm: "110px 1fr 110px" },
            gap: 1.25,
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${theme.palette.divider}`,
            cursor: "pointer",
            alignItems: "center",
            "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.06) },
          }}
        >
          <Box
            sx={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 10.5,
              fontWeight: 600,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              borderRadius: 0.5,
              px: 0.75,
              py: 0.25,
              textAlign: "center",
            }}
          >
            {a.settlementRef ?? "—"}
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>
              {a.forLabel}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: "text.secondary" }}>
              {dayjs(a.date).format("DD MMM YYYY")}
            </Typography>
          </Box>

          <Typography
            sx={{
              textAlign: "right",
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: "warning.dark",
            }}
          >
            {formatINR(a.amount)}
          </Typography>
        </Box>
      ))}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 1.25,
          px: 1.5,
          py: 1.25,
          bgcolor: alpha(theme.palette.warning.main, 0.12),
          borderTop: `1px solid ${theme.palette.warning.main}`,
          fontWeight: 700,
        }}
      >
        <Typography sx={{ fontSize: 12, color: "warning.dark" }}>
          Total · NOT deducted from salary above
        </Typography>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: "warning.dark",
            textAlign: "right",
          }}
        >
          {formatINR(total)}
        </Typography>
      </Box>
    </Box>
  );
}
