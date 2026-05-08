"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  IconButton,
  Stack,
  Chip,
  Button,
} from "@mui/material";
import {
  Add as AddIcon,
  CameraAlt as CameraIcon,
  WbSunny as MorningIcon,
  Brightness3 as EveningIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { weekStartOf, weekEndOf } from "@/lib/utils/weekUtils";
import { useContractHeadcount } from "@/hooks/queries/useContractHeadcount";
import { useContractWorkUpdates } from "@/hooks/queries/useContractWorkUpdates";
import { useQueryClient } from "@tanstack/react-query";
import { TradeAttendanceWeekSeparator } from "./TradeAttendanceWeekSeparator";
import { WeeklyHeadcountSettleDialog } from "@/components/trades/WeeklyHeadcountSettleDialog";

interface HeadcountAttendanceTableProps {
  siteId: string;
  contractId: string;
  contractTitle: string;
  /** Triggered when supervisor taps a date row to enter / view it. */
  onPickDate: (dateISO: string) => void;
}

interface DayRow {
  date: string; // YYYY-MM-DD
  perRole: Map<string, number>; // roleId → units
  totalUnits: number;
  impliedAmount: number;
  hasMorning: boolean;
  hasEvening: boolean;
  morningPhotoCount: number;
  eveningPhotoCount: number;
}

interface WeekGroup {
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
  days: DayRow[];
  weekTotal: number;
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Slice E — week-grouped headcount table for the in-page trade attendance
 * view. Mirrors civil's day-row visual rhythm but with per-role unit cells.
 *
 * Shows the trailing 4 weeks (current + 3 past) by default. Each week has
 * its own separator strip, then 7 daily rows (Sun-Sat). Days with no entry
 * show "+" and an Add affordance; days with an entry show units + ₹ +
 * morning/evening photo badges.
 */
export function HeadcountAttendanceTable({
  siteId,
  contractId,
  contractTitle,
  onPickDate,
}: HeadcountAttendanceTableProps) {
  const queryClient = useQueryClient();
  const { data: headcount, isLoading: headcountLoading } = useContractHeadcount(contractId);
  const [settleWeekStart, setSettleWeekStart] = useState<string | null>(null);

  // Build a date->{morning,evening photoCount} map across the visible window
  // by reading subcontract_work_updates for each visible date. To keep this
  // component self-contained we batch a single query covering the 4-week
  // window via the existing per-date hook is wasteful — instead read all
  // entries here lazily as the user scrolls. For v1 we do per-day fetches
  // only for days that have a headcount entry; empty days show no badge.
  // Future: a dedicated useContractWorkUpdatesRange hook.

  const weeks: WeekGroup[] = useMemo(() => {
    if (!headcount) return [];
    const today = dayjs();
    // Visible window: this week + 3 weeks back.
    const groups: WeekGroup[] = [];
    for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
      const anchor = today.subtract(weekOffset, "week");
      const wsDay = weekStartOf(anchor);
      const weDay = weekEndOf(anchor);
      const ws = wsDay.format("YYYY-MM-DD");
      const we = weDay.format("YYYY-MM-DD");
      const isCurrent =
        wsDay.isSame(weekStartOf(today), "day");

      const days: DayRow[] = [];
      let weekTotal = 0;
      for (let d = 0; d < 7; d++) {
        const date = wsDay.add(d, "day").format("YYYY-MM-DD");
        const perRole = new Map<string, number>();
        let dayUnits = 0;
        let dayAmount = 0;
        for (const e of headcount.recent) {
          if (e.attendanceDate === date) {
            perRole.set(e.roleId, e.units);
            dayUnits += e.units;
            const rate =
              headcount.rates.find((r) => r.roleId === e.roleId)?.dailyRate ?? 0;
            dayAmount += e.units * rate;
          }
        }
        weekTotal += dayAmount;
        days.push({
          date,
          perRole,
          totalUnits: dayUnits,
          impliedAmount: dayAmount,
          hasMorning: false,
          hasEvening: false,
          morningPhotoCount: 0,
          eveningPhotoCount: 0,
        });
      }
      groups.push({
        weekStart: ws,
        weekEnd: we,
        isCurrentWeek: isCurrent,
        days,
        weekTotal,
      });
    }
    return groups;
  }, [headcount]);

  if (headcountLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Loading headcount…
        </Typography>
      </Paper>
    );
  }

  if (!headcount || headcount.rates.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No role rate card set for this contract. Open the contract on{" "}
          <strong>/site/trades</strong> to configure roles, then come back here.
        </Typography>
      </Paper>
    );
  }

  const roles = headcount.rates;

  return (
    <>
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {weeks.map((week) => (
          <Box key={week.weekStart} sx={{ "&:not(:first-of-type)": { borderTop: 1, borderColor: "divider" } }}>
            <Box sx={{ px: 1.5, pt: 1 }}>
              <TradeAttendanceWeekSeparator
                weekStart={week.weekStart}
                weekEnd={week.weekEnd}
                isCurrentWeek={week.isCurrentWeek}
                rightChips={[
                  {
                    label: `Week labor: ₹${formatINR(week.weekTotal)}`,
                    color: week.weekTotal > 0 ? "primary" : "default",
                  },
                ]}
                onSettle={
                  !week.isCurrentWeek && week.weekTotal > 0
                    ? () => setSettleWeekStart(week.weekStart)
                    : undefined
                }
                settleLabel={
                  !week.isCurrentWeek && week.weekTotal > 0
                    ? `Settle ₹${formatINR(week.weekTotal)}`
                    : undefined
                }
              />
            </Box>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 100, fontWeight: 600 }}>Date</TableCell>
                  {roles.map((r) => (
                    <TableCell
                      key={r.roleId}
                      align="center"
                      sx={{ fontWeight: 600, minWidth: 90 }}
                    >
                      <Box>
                        <Typography variant="caption" component="div">
                          {r.roleName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          ₹{formatINR(r.dailyRate)}
                        </Typography>
                      </Box>
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 600, width: 110 }}>
                    Implied ₹
                  </TableCell>
                  <TableCell align="center" sx={{ width: 110 }}>
                    Photos
                  </TableCell>
                  <TableCell align="right" sx={{ width: 80 }}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {week.days.map((day) => {
                  const dayJs = dayjs(day.date);
                  const isToday = dayJs.isSame(dayjs(), "day");
                  const isFuture = dayJs.isAfter(dayjs(), "day");
                  const isSunday = dayJs.day() === 0;
                  const hasEntry = day.totalUnits > 0;
                  return (
                    <TableRow
                      key={day.date}
                      hover
                      onClick={isFuture ? undefined : () => onPickDate(day.date)}
                      sx={{
                        cursor: isFuture ? "default" : "pointer",
                        opacity: isFuture ? 0.5 : 1,
                        bgcolor: isToday
                          ? (theme) =>
                              theme.palette.mode === "light"
                                ? "warning.50"
                                : "rgba(255, 152, 0, 0.08)"
                          : isSunday
                          ? (theme) =>
                              theme.palette.mode === "light"
                                ? "grey.50"
                                : "rgba(255,255,255,0.02)"
                          : "inherit",
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2">
                          {dayJs.format("ddd D")}
                        </Typography>
                        {isToday && (
                          <Typography variant="caption" color="warning.dark">
                            today
                          </Typography>
                        )}
                      </TableCell>
                      {roles.map((r) => {
                        const u = day.perRole.get(r.roleId) ?? 0;
                        return (
                          <TableCell
                            key={r.roleId}
                            align="center"
                            sx={{
                              fontWeight: u > 0 ? 600 : 400,
                              color: u > 0 ? "text.primary" : "text.disabled",
                            }}
                          >
                            {u > 0 ? u : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={day.impliedAmount > 0 ? "text.primary" : "text.disabled"}
                        >
                          {day.impliedAmount > 0 ? `₹${formatINR(day.impliedAmount)}` : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          {/* Photo badges populated from work-updates lazily on
                              expand — for the table view we show camera icon
                              if any entry exists, supervisor opens drawer to
                              see the actual photos. Keeps row render cheap. */}
                          {hasEntry && (
                            <CameraIcon fontSize="small" sx={{ color: "text.secondary" }} />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        {!isFuture &&
                          (hasEntry ? (
                            <Button size="small" variant="text">
                              Edit
                            </Button>
                          ) : (
                            <IconButton size="small" color="primary">
                              <AddIcon fontSize="small" />
                            </IconButton>
                          ))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        ))}
      </Paper>

      {settleWeekStart !== null && (
        <WeeklyHeadcountSettleDialog
          open={true}
          onClose={() => setSettleWeekStart(null)}
          onSaved={() => {
            queryClient.invalidateQueries({
              queryKey: ["contract-headcount", contractId],
            });
            queryClient.invalidateQueries({
              queryKey: ["trade-attendance-summary", contractId],
            });
          }}
          siteId={siteId}
          contractId={contractId}
          contractTitle={contractTitle}
        />
      )}
    </>
  );
}
