"use client";

import React, { useMemo } from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from "@mui/icons-material";
import { formatCurrency } from "@/lib/formatters";

interface PricePoint {
  date: string;
  price: number;
}

interface PriceHistorySparklineProps {
  points: PricePoint[];
  width?: number;
  height?: number;
  /** Optional label shown next to the trend (e.g., "30d trend") */
  label?: string;
}

export function PriceHistorySparkline({
  points,
  width = 120,
  height = 36,
  label,
}: PriceHistorySparklineProps) {
  const theme = useTheme();

  const { path, area, min, max, current, change, changePct, trend } = useMemo(() => {
    if (points.length === 0) {
      return {
        path: "",
        area: "",
        min: 0,
        max: 0,
        current: 0,
        change: 0,
        changePct: 0,
        trend: "flat" as const,
      };
    }
    const sorted = [...points].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const prices = sorted.map((p) => p.price);
    const minVal = Math.min(...prices);
    const maxVal = Math.max(...prices);
    const range = maxVal - minVal || 1;

    const xStep = sorted.length > 1 ? width / (sorted.length - 1) : width;
    const padY = 3;
    const innerH = height - padY * 2;

    const coords = sorted.map((p, i) => {
      const x = i * xStep;
      const y = padY + innerH - ((p.price - minVal) / range) * innerH;
      return { x, y };
    });

    const linePath = coords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");

    const areaPath = `${linePath} L${width.toFixed(1)},${height} L0,${height} Z`;

    const first = sorted[0].price;
    const cur = sorted[sorted.length - 1].price;
    const ch = cur - first;
    const chPct = first ? (ch / first) * 100 : 0;
    const tr = ch > 0 ? "up" : ch < 0 ? "down" : "flat";

    return {
      path: linePath,
      area: areaPath,
      min: minVal,
      max: maxVal,
      current: cur,
      change: ch,
      changePct: chPct,
      trend: tr as "up" | "down" | "flat",
    };
  }, [points, width, height]);

  if (points.length === 0) {
    return (
      <Typography sx={{ fontSize: 11, color: "text.disabled", fontStyle: "italic" }}>
        No price history
      </Typography>
    );
  }

  const trendColor =
    trend === "up"
      ? theme.palette.error
      : trend === "down"
        ? theme.palette.success
        : theme.palette.info;

  const TrendIcon =
    trend === "up" ? TrendingUpIcon : trend === "down" ? TrendingDownIcon : TrendingFlatIcon;

  const lineColor = trendColor.main;
  const fillColor = alpha(trendColor.main, 0.14);

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <Box
        component="svg"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        sx={{ flexShrink: 0, overflow: "visible" }}
      >
        {points.length > 1 ? (
          <>
            <path d={area} fill={fillColor} stroke="none" />
            <path
              d={path}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <circle cx={width / 2} cy={height / 2} r={3} fill={lineColor} />
        )}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: trendColor.dark,
            }}
          >
            {formatCurrency(current)}
          </Typography>
          <TrendIcon sx={{ fontSize: 13, color: trendColor.main }} />
        </Box>
        <Typography
          sx={{
            fontSize: 9.5,
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {label
            ? label
            : `${change >= 0 ? "+" : ""}${changePct.toFixed(1)}% · ${formatCurrency(min)}–${formatCurrency(max)}`}
        </Typography>
      </Box>
    </Box>
  );
}
