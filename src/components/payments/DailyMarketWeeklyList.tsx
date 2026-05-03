"use client";

import React from "react";
import {
  Box,
  Skeleton,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import dayjs from "dayjs";
import type { DailyMarketWeekRow } from "@/hooks/queries/useDailyMarketWeeklyList";

interface DailyMarketWeeklyListProps {
  rows: DailyMarketWeekRow[];
  isLoading: boolean;
  onRowClick: (row: DailyMarketWeekRow) => void;
  // Switches the page back to "By date" with this week scrolled into view.
  // Used by the "Settle pending" affordance — bulk settle is intentionally
  // not exposed here (avoids regressing recent mesthri ledger fixes).
  onSettlePending: (row: DailyMarketWeekRow) => void;
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function DailyMarketWeeklyList({
  rows,
  isLoading,
  onRowClick,
  onSettlePending,
}: DailyMarketWeeklyListProps) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Box sx={{ p: 1.5 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 0.75 }} />
        ))}
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No daily or market wage entries in this period.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5 }}>
      {rows.map((week) => (
        <DailyMarketWeekRowView
          key={week.weekStart}
          week={week}
          onClick={() => onRowClick(week)}
          onSettlePending={() => onSettlePending(week)}
          theme={theme}
        />
      ))}
    </Box>
  );
}

function DailyMarketWeekRowView({
  week,
  onClick,
  onSettlePending,
  theme,
}: {
  week: DailyMarketWeekRow;
  onClick: () => void;
  onSettlePending: () => void;
  theme: Theme;
}) {
  const hasPending = week.pendingDates > 0;
  const range = `${dayjs(week.weekStart).format("DD MMM")} – ${dayjs(week.weekEnd).format("DD MMM")}`;

  return (
    <Box
      sx={{
        mb: 0.75,
        border: `1px solid ${theme.palette.divider}`,
        borderLeft: `3px solid ${
          hasPending ? theme.palette.warning.main : theme.palette.success.main
        }`,
        borderRadius: 1,
        bgcolor: "background.paper",
        overflow: "hidden",
        transition: "transform 80ms ease, box-shadow 80ms ease",
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: theme.shadows[1],
        },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        sx={{
          display: "grid",
          // strip | range | settled-fraction | amounts | action
          gridTemplateColumns: {
            xs: "auto 1fr auto",
            sm: "auto 1fr auto auto auto",
          },
          alignItems: "center",
          gap: { xs: 1, sm: 1.5 },
          px: 1.25,
          py: 1,
          cursor: "pointer",
          "&:focus-visible": {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
        }}
      >
        {/* 7-dot Sun-Sat strip — the at-a-glance settlement granularity */}
        <DotStrip week={week} theme={theme} />

        {/* Range + summary */}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {range}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", fontSize: 11 }}
          >
            {week.datesWorked} {week.datesWorked === 1 ? "date" : "dates"} ·{" "}
            {hasPending
              ? `${week.pendingDates} pending`
              : `all settled`}
          </Typography>
        </Box>

        {/* Settled fraction (sm+) */}
        <Box
          sx={{
            display: { xs: "none", sm: "block" },
            textAlign: "right",
            minWidth: 64,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", fontSize: 9.5, letterSpacing: 0.4 }}
          >
            SETTLED
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: hasPending ? "warning.dark" : "success.dark",
            }}
          >
            {week.settledDates}/{week.datesWorked}
          </Typography>
        </Box>

        {/* Amounts */}
        <Box
          sx={{
            textAlign: "right",
            minWidth: { xs: 88, sm: 110 },
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: "success.dark",
            }}
          >
            {formatINR(week.paid)}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "block",
              fontSize: 10.5,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            of {formatINR(week.wagesDue)}
          </Typography>
        </Box>

        {/* Settle pending affordance (sm+) — intentionally a no-op chip
            today; v1 just nudges the user back to the by-date list to
            settle pending dates one at a time. */}
        {hasPending && (
          <Box
            sx={{
              display: { xs: "none", sm: "inline-flex" },
            }}
          >
            <Box
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSettlePending();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onSettlePending();
                }
              }}
              sx={{
                fontSize: 11,
                fontWeight: 600,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                color: "warning.dark",
                bgcolor: alpha(theme.palette.warning.main, 0.12),
                border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                cursor: "pointer",
                "&:hover": {
                  bgcolor: alpha(theme.palette.warning.main, 0.2),
                },
                "&:focus-visible": {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              Settle pending
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// 7 dots, Sunday → Saturday. Each dot's color encodes that day's
// settlement status: green = settled, amber = pending, gray = no work.
// The differentiator from Contract waterfall: Daily + Market settles
// per-date, so a week is rarely "all or nothing" — the strip surfaces
// that granularity at a glance.
function DotStrip({
  week,
  theme,
}: {
  week: DailyMarketWeekRow;
  theme: Theme;
}) {
  const days: Array<{
    date: string;
    label: string;
    status: "settled" | "pending" | "none";
  }> = [];
  for (let i = 0; i < 7; i++) {
    const d = dayjs(week.weekStart).add(i, "day").format("YYYY-MM-DD");
    days.push({
      date: d,
      label: dayjs(d).format("ddd · DD MMM"),
      status: week.dayStatus[d] ?? "none",
    });
  }
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 8px)",
        gap: "3px",
        py: 0.25,
      }}
      aria-label={`Sun through Sat: ${days
        .map((d) => `${d.label} ${d.status}`)
        .join(", ")}`}
    >
      {days.map((d) => {
        const color =
          d.status === "settled"
            ? theme.palette.success.main
            : d.status === "pending"
              ? theme.palette.warning.main
              : alpha(theme.palette.text.disabled, 0.4);
        return (
          <Tooltip
            key={d.date}
            title={`${d.label} · ${d.status === "none" ? "no work" : d.status}`}
            arrow
            placement="top"
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: color,
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}
