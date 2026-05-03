"use client";

import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { KpiTile, formatINR, type KpiTileProps } from "./KpiTile";
import { MobileCollapsibleHero } from "./MobileCollapsibleHero";

interface DailyMarketHeroProps {
  paidAmount: number;
  paidCount: number;
  pendingAmount: number;
  pendingCount: number;
  isLoading: boolean;
}

export function DailyMarketHero({
  paidAmount,
  paidCount,
  pendingAmount,
  pendingCount,
  isLoading,
}: DailyMarketHeroProps) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Box
        sx={{
          p: { xs: 1.5, sm: 2 },
          mb: 1.5,
          bgcolor: "background.paper",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1.5,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
            gap: 1.25,
            mb: 1.5,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={72}
              data-testid="kpi-skeleton"
            />
          ))}
        </Box>
        <Skeleton variant="rounded" height={10} />
      </Box>
    );
  }

  const wagesDue = paidAmount + pendingAmount;
  const totalDates = paidCount + pendingCount;
  const progressPct =
    wagesDue > 0
      ? Math.min(100, Math.round((paidAmount / wagesDue) * 100))
      : 0;
  const progressColor =
    progressPct < 50
      ? theme.palette.error.main
      : progressPct < 80
        ? theme.palette.warning.main
        : theme.palette.success.main;

  let statusLabel: string;
  let statusVariant: KpiTileProps["variant"];
  let statusValue: string;
  let statusSub: string;
  if (pendingAmount === 0 && wagesDue > 0) {
    statusLabel = "Settled";
    statusVariant = "success";
    statusValue = "₹0";
    statusSub = "fully paid up";
  } else if (pendingCount > 0) {
    statusLabel = "Pending";
    statusVariant = "warning";
    statusValue = `${pendingCount} ${pendingCount === 1 ? "date" : "dates"}`;
    statusSub = "awaiting settlement";
  } else {
    statusLabel = "No Wages";
    statusVariant = "neutral";
    statusValue = "—";
    statusSub = "no attendance in range";
  }

  return (
    <MobileCollapsibleHero
      storageKey="payments.hero.daily-market.expanded"
      statusLabel={statusLabel}
      statusValue={statusValue}
      statusVariant={statusVariant}
      progressPct={progressPct}
      progressColor={progressColor}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          mb: 1,
        }}
      >
        Daily + Market — wages per attendance
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(2, 1fr)",
            md: "repeat(4, 1fr)",
          },
          gap: 1.25,
          mb: 1.5,
        }}
      >
        <KpiTile
          label="Wages Due"
          value={formatINR(wagesDue)}
          sub="based on attendance"
          formula={`${totalDates} ${totalDates === 1 ? "date" : "dates"}`}
          variant="neutral"
        />
        <KpiTile
          label="Paid"
          value={formatINR(paidAmount)}
          sub={`${paidCount} ${paidCount === 1 ? "date" : "dates"} settled`}
          variant="success"
        />
        <KpiTile
          label="Pending"
          value={formatINR(pendingAmount)}
          sub={`${pendingCount} ${pendingCount === 1 ? "date" : "dates"} unsettled`}
          variant="warning"
        />
        <KpiTile
          label={statusLabel}
          value={statusValue}
          sub={statusSub}
          variant={statusVariant}
        />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Typography
          sx={{ fontSize: 11, color: "text.secondary", minWidth: 110 }}
        >
          Settled progress
        </Typography>
        <Box
          sx={{
            flex: 1,
            height: 10,
            borderRadius: 1,
            bgcolor: "divider",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${progressPct}%`,
              bgcolor: progressColor,
              transition: "width 200ms",
            }}
          />
        </Box>
        <Typography
          sx={{
            fontSize: 12.5,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {progressPct}%
        </Typography>
      </Box>
    </MobileCollapsibleHero>
  );
}
