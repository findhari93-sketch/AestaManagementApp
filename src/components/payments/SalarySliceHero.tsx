"use client";

import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import type { SalarySliceSummary } from "@/hooks/queries/useSalarySliceSummary";

interface SalarySliceHeroProps {
  summary: SalarySliceSummary | undefined;
  isLoading: boolean;
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  variant: "neutral" | "success" | "warning" | "info" | "error";
  formula?: string;
}

function KpiTile({ label, value, sub, variant, formula }: KpiTileProps) {
  const theme = useTheme();
  const palette = {
    neutral: {
      border: theme.palette.grey[600],
      bg: theme.palette.grey[50],
      val: theme.palette.text.primary,
    },
    success: {
      border: theme.palette.success.main,
      bg: theme.palette.success.light + "40",
      val: theme.palette.success.dark,
    },
    warning: {
      border: theme.palette.warning.main,
      bg: theme.palette.warning.light + "40",
      val: theme.palette.warning.dark,
    },
    info: {
      border: theme.palette.info.main,
      bg: theme.palette.info.light + "40",
      val: theme.palette.info.dark,
    },
    error: {
      border: theme.palette.error.main,
      bg: theme.palette.error.light + "40",
      val: theme.palette.error.dark,
    },
  }[variant];

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        p: 1.5,
        bgcolor: palette.bg,
        borderLeft: `3px solid ${palette.border}`,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "text.secondary",
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: 16, sm: 19 },
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: palette.val,
          lineHeight: 1.1,
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: 10.5, color: "text.secondary", mt: 0.25 }}>
          {sub}
        </Typography>
      )}
      {formula && (
        <Typography
          sx={{
            fontSize: 10,
            color: "text.disabled",
            fontStyle: "italic",
            mt: 0.25,
          }}
        >
          {formula}
        </Typography>
      )}
    </Box>
  );
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
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        mb: 1.5,
        bgcolor: "background.paper",
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
      }}
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
    </Box>
  );
}
