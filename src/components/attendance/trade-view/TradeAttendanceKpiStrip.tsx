"use client";

import React from "react";
import { Box, Paper, Stack, Typography, Divider, Tooltip, Chip } from "@mui/material";
import {
  CheckCircle as OnTrackIcon,
  Warning as AmberIcon,
  ErrorOutline as RedIcon,
} from "@mui/icons-material";
import type { LaborTrackingMode } from "@/types/trade.types";
import type { TradeAttendanceSummary } from "@/hooks/queries/useTradeAttendanceSummary";

interface TradeAttendanceKpiStripProps {
  summary: TradeAttendanceSummary | undefined;
  mode: LaborTrackingMode;
  isLoading?: boolean;
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

interface Tile {
  label: string;
  value: string;
  hint?: string;
  color?: "default" | "success" | "warning" | "error";
  badge?: React.ReactNode;
}

/** Visual mirror of civil's KPI strip (line ~2925 of attendance-content) but
 *  with mode-aware tile composition. Each tile is a small bordered box with
 *  a caption label and a bold value, dividers between on desktop. */
export function TradeAttendanceKpiStrip({
  summary,
  mode,
  isLoading,
}: TradeAttendanceKpiStripProps) {
  if (isLoading || !summary) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Loading summary…
        </Typography>
      </Paper>
    );
  }

  const tiles = buildTiles(summary, mode);

  return (
    <Paper variant="outlined" sx={{ mb: 2, overflow: "hidden" }}>
      <Stack
        direction="row"
        divider={<Divider orientation="vertical" flexItem />}
        sx={{
          overflowX: "auto",
          // Mobile: horizontal scroll; desktop: even spread.
          "& > *": { flex: { xs: "0 0 auto", md: 1 }, minWidth: { xs: 110, md: "auto" } },
        }}
      >
        {tiles.map((tile, i) => (
          <KpiTile key={`${tile.label}-${i}`} tile={tile} />
        ))}
      </Stack>
    </Paper>
  );
}

function KpiTile({ tile }: { tile: Tile }) {
  const colorMap = {
    default: "text.primary",
    success: "success.main",
    warning: "warning.dark",
    error: "error.main",
  } as const;
  const fg = colorMap[tile.color ?? "default"];

  const content = (
    <Box sx={{ p: 1.25, py: 1, textAlign: "left" }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", lineHeight: 1.2, fontSize: "0.7rem" }}
      >
        {tile.label}
      </Typography>
      <Stack direction="row" alignItems="baseline" spacing={0.75}>
        <Typography variant="body1" fontWeight={600} sx={{ color: fg }}>
          {tile.value}
        </Typography>
        {tile.badge}
      </Stack>
    </Box>
  );

  return tile.hint ? (
    <Tooltip title={tile.hint} placement="top" arrow>
      {content}
    </Tooltip>
  ) : (
    content
  );
}

function buildTiles(s: TradeAttendanceSummary, mode: LaborTrackingMode): Tile[] {
  const balance = s.quotedAmount - s.amountPaid;
  const balanceTile: Tile = {
    label: "Balance",
    value: `₹${formatINR(Math.abs(balance))}${balance < 0 ? " over" : ""}`,
    color: balance < 0 ? "error" : balance === 0 ? "default" : "default",
  };

  if (mode === "headcount") {
    const labor = s.laborDoneHeadcount;
    const variance = s.amountPaid - labor;
    const variancePct = labor > 0 ? Math.round((variance / labor) * 100) : 0;
    let varianceColor: "success" | "warning" | "error" = "success";
    let varianceIcon = <OnTrackIcon fontSize="small" sx={{ color: "success.main" }} />;
    if (labor > 0) {
      if (variance > 0 && Math.abs(variancePct) > 20) {
        varianceColor = "error";
        varianceIcon = <RedIcon fontSize="small" sx={{ color: "error.main" }} />;
      } else if (variance > 0) {
        varianceColor = "warning";
        varianceIcon = <AmberIcon fontSize="small" sx={{ color: "warning.dark" }} />;
      }
    }
    return [
      { label: "Quoted", value: `₹${formatINR(s.quotedAmount)}` },
      {
        label: "Paid",
        value: `₹${formatINR(s.amountPaid)}`,
        hint: `Payments ₹${formatINR(s.amountPaidBreakdown.payments)} + Settlements ₹${formatINR(
          s.amountPaidBreakdown.settlements
        )} + Extras ₹${formatINR(s.amountPaidBreakdown.extras)}`,
      },
      balanceTile,
      {
        label: "Labor done",
        value: `₹${formatINR(labor)}`,
        hint: "Sum of headcount × per-role rate across all entered days",
      },
      {
        label: "Variance",
        value: labor === 0
          ? "—"
          : variance === 0
          ? "On track"
          : `${variance > 0 ? "+" : "−"}₹${formatINR(Math.abs(variance))}`,
        color: labor === 0 ? "default" : varianceColor,
        badge: labor === 0 ? null : varianceIcon,
        hint:
          labor === 0
            ? "Enter today's headcount to see variance"
            : `Paid is ${variance > 0 ? "ahead" : "behind"} labor done by ${Math.abs(variancePct)}%`,
      },
      {
        label: "Days entered",
        value: String(s.daysHeadcountEntered),
      },
      {
        label: "Avg labor / day",
        value:
          s.daysHeadcountEntered > 0
            ? `₹${formatINR(labor / s.daysHeadcountEntered)}`
            : "—",
      },
      {
        label: "Last paid",
        value: formatDate(s.lastPaymentDate),
      },
    ];
  }

  if (mode === "mesthri_only") {
    return [
      { label: "Quoted", value: `₹${formatINR(s.quotedAmount)}` },
      {
        label: "Paid",
        value: `₹${formatINR(s.amountPaid)}`,
        hint: `Payments ₹${formatINR(s.amountPaidBreakdown.payments)} + Settlements ₹${formatINR(
          s.amountPaidBreakdown.settlements
        )} + Extras ₹${formatINR(s.amountPaidBreakdown.extras)}`,
      },
      balanceTile,
      { label: "Days paid", value: String(s.daysPaymentsRecorded) },
      { label: "Last payment", value: formatDate(s.lastPaymentDate) },
      {
        label: "Avg payment",
        value:
          s.avgPaymentAmount > 0 ? `₹${formatINR(s.avgPaymentAmount)}` : "—",
      },
    ];
  }

  // detailed (non-civil)
  return [
    { label: "Quoted", value: `₹${formatINR(s.quotedAmount)}` },
    {
      label: "Paid",
      value: `₹${formatINR(s.amountPaid)}`,
      hint: `Payments ₹${formatINR(s.amountPaidBreakdown.payments)} + Settlements ₹${formatINR(
        s.amountPaidBreakdown.settlements
      )} + Extras ₹${formatINR(s.amountPaidBreakdown.extras)}`,
    },
    balanceTile,
    {
      label: "Labor done",
      value: `₹${formatINR(s.laborDoneDetailed)}`,
      hint: "Sum of per-laborer daily earnings",
    },
    { label: "Days worked", value: String(s.daysDetailedEntered) },
    { label: "Last paid", value: formatDate(s.lastPaymentDate) },
  ];
}
