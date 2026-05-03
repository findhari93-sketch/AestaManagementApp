"use client";

import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import type { SalarySliceSummary } from "@/hooks/queries/useSalarySliceSummary";
import { KpiTile, formatINR, type KpiTileProps } from "./KpiTile";
import { MobileCollapsibleHero } from "./MobileCollapsibleHero";

interface SalarySliceHeroProps {
  summary: SalarySliceSummary | undefined;
  isLoading: boolean;
}

export function SalarySliceHero({ summary, isLoading }: SalarySliceHeroProps) {
  const theme = useTheme();

  if (isLoading || !summary) {
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
              sm: "repeat(3, 1fr)",
              md: "repeat(5, 1fr)",
            },
            gap: 1.25,
            mb: 1.5,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
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

  const totalPaid = summary.settlementsTotal + summary.advancesTotal;
  const progressPct =
    summary.wagesDue > 0
      ? Math.min(100, Math.round((summary.paidToWeeks / summary.wagesDue) * 100))
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
  if (summary.futureCredit > 0) {
    statusLabel = "Excess Paid";
    statusVariant = "info";
    statusValue = formatINR(summary.futureCredit);
    statusSub = "rolls forward to future work";
  } else if (summary.mestriOwed > 0) {
    statusLabel = "Mestri Owed";
    statusVariant = "error";
    statusValue = formatINR(summary.mestriOwed);
    statusSub = "due based on work done";
  } else {
    statusLabel = "Settled";
    statusVariant = "success";
    statusValue = "₹0";
    statusSub = "fully paid up";
  }

  return (
    <MobileCollapsibleHero
      storageKey="payments.hero.contract.expanded"
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
        Salary slice — payments to mestri
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(3, 1fr)",
            md: "repeat(5, 1fr)",
          },
          gap: 1.25,
          mb: 1.5,
        }}
      >
        <KpiTile
          label="Wages Due"
          value={formatINR(summary.wagesDue)}
          sub="based on attendance"
          formula={`${summary.weeksCount} weeks`}
          variant="neutral"
        />
        <KpiTile
          label="Paid (waterfall)"
          value={formatINR(summary.settlementsTotal)}
          sub={`${summary.settlementCount} settlements`}
          variant="success"
        />
        <KpiTile
          label="Advances"
          value={formatINR(summary.advancesTotal)}
          sub={`${summary.advanceCount} records · separate`}
          variant="warning"
        />
        <KpiTile
          label="Total Paid"
          value={formatINR(totalPaid)}
          sub="waterfall + advance"
          variant="info"
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
          Salary progress
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
