"use client";

import React from "react";
import {
  Box,
  Skeleton,
  Stack,
  Typography,
  useTheme,
  alpha,
} from "@mui/material";
import dayjs from "dayjs";
import type { InspectEntity } from "./types";
import { useAttendanceForDate } from "@/hooks/queries/useAttendanceForDate";
import {
  useLaborerWeek,
  type LaborerWeekDay,
} from "@/hooks/queries/useLaborerWeek";
import { useWeekAggregateAttendance } from "@/hooks/queries/useWeekAggregateAttendance";

// ----------------------------------------------------------------
// Shared sub-component
// ----------------------------------------------------------------

function TotalTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "warn" | "pos";
}) {
  const theme = useTheme();
  const color =
    accent === "warn"
      ? theme.palette.warning.main
      : accent === "pos"
        ? theme.palette.success.main
        : theme.palette.text.primary;
  return (
    <Box
      sx={{
        flex: 1,
        p: 1.25,
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: "block",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Typography>
      <Typography variant="subtitle2" fontWeight={700} sx={{ color }}>
        {value}
      </Typography>
    </Box>
  );
}

const SECTION_LABEL_SX = {
  display: "block",
  mb: 0.75,
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  fontWeight: 600,
} as const;

// ----------------------------------------------------------------
// Daily-shape: one date × all laborers
// ----------------------------------------------------------------

function DailyShape({
  entity,
}: {
  entity: Extract<InspectEntity, { kind: "daily-date" }>;
}) {
  const theme = useTheme();
  const { data, isLoading } = useAttendanceForDate(entity.siteId, entity.date);

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Skeleton variant="rounded" width="100%" height={56} />
          <Skeleton variant="rounded" width="100%" height={56} />
          <Skeleton variant="rounded" width="100%" height={56} />
        </Stack>
        <Skeleton variant="rounded" width="100%" height={140} />
      </Box>
    );
  }

  const dailyTotal = data?.dailyTotal ?? 0;
  const marketTotal = data?.marketTotal ?? 0;
  const teaTotal = data?.teaShopTotal ?? 0;
  const dailyLaborers = data?.dailyLaborers ?? [];
  const marketLaborers = data?.marketLaborers ?? [];

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TotalTile
          label="Daily"
          value={`₹${dailyTotal.toLocaleString("en-IN")}`}
        />
        <TotalTile
          label="Market"
          value={`₹${marketTotal.toLocaleString("en-IN")}`}
        />
        <TotalTile
          label="Tea"
          value={`₹${teaTotal.toLocaleString("en-IN")}`}
        />
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={SECTION_LABEL_SX}
      >
        Daily Laborers ({dailyLaborers.length})
      </Typography>
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        {dailyLaborers.slice(0, 4).map((lab) => (
          <Box
            key={lab.id}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              p: 0.75,
              px: 1.25,
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight={500}>
                {lab.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {lab.role} · {lab.fullDay ? "Full day" : "Half day"}
              </Typography>
            </Box>
            <Typography variant="body2" fontWeight={600} color="success.main">
              ₹{lab.amount.toLocaleString("en-IN")}
            </Typography>
          </Box>
        ))}
        {dailyLaborers.length > 4 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ pl: 1 }}
          >
            … {dailyLaborers.length - 4} more
          </Typography>
        )}
        {dailyLaborers.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            No daily laborers recorded for this date.
          </Typography>
        )}
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={SECTION_LABEL_SX}
      >
        Market Laborers ({marketLaborers.length})
      </Typography>
      <Stack spacing={0.5}>
        {marketLaborers.slice(0, 4).map((mkt) => (
          <Box
            key={mkt.id}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              p: 0.75,
              px: 1.25,
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight={500}>
                {mkt.role}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {mkt.count} {mkt.count === 1 ? "person" : "people"}
              </Typography>
            </Box>
            <Typography variant="body2" fontWeight={600} color="success.main">
              ₹{mkt.amount.toLocaleString("en-IN")}
            </Typography>
          </Box>
        ))}
        {marketLaborers.length > 4 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ pl: 1 }}
          >
            … {marketLaborers.length - 4} more
          </Typography>
        )}
        {marketLaborers.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            No market laborers recorded for this date.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

// ----------------------------------------------------------------
// Weekly-shape: one laborer × one week (Mon–Sun or Sun–Sat)
// ----------------------------------------------------------------

function WeeklyShape({
  entity,
}: {
  entity: Extract<InspectEntity, { kind: "weekly-week" }>;
}) {
  const theme = useTheme();
  const { data, isLoading } = useLaborerWeek(
    entity.siteId,
    entity.laborerId,
    entity.weekStart,
    entity.weekEnd
  );

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Skeleton variant="rounded" width="100%" height={56} />
          <Skeleton variant="rounded" width="100%" height={56} />
          <Skeleton variant="rounded" width="100%" height={56} />
        </Stack>
        <Skeleton variant="rounded" width="100%" height={100} />
      </Box>
    );
  }

  const dailySalary = data?.dailySalary ?? 0;
  const contractAmount = data?.contractAmount ?? 0;
  const total = data?.total ?? 0;
  const days = data?.days ?? [];
  const daysNotWorked = data?.daysNotWorked ?? [];

  const workedCount = days.filter(
    (d) => d.status === "full" || d.status === "half"
  ).length;

  const statusColor = (
    s: LaborerWeekDay["status"]
  ): { bg: string; border: string } => {
    if (s === "full") {
      return {
        bg: alpha(theme.palette.success.main, 0.12),
        border: theme.palette.success.main,
      };
    }
    if (s === "half") {
      return {
        bg: alpha(theme.palette.warning.main, 0.12),
        border: theme.palette.warning.main,
      };
    }
    if (s === "holiday") {
      return {
        bg: "transparent",
        border: theme.palette.secondary.main,
      };
    }
    // off
    return {
      bg: theme.palette.background.default,
      border: theme.palette.divider,
    };
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TotalTile
          label="Daily Sal."
          value={`₹${dailySalary.toLocaleString("en-IN")}`}
        />
        {contractAmount > 0 && (
          <TotalTile
            label="Contract"
            value={`₹${contractAmount.toLocaleString("en-IN")}`}
          />
        )}
        <TotalTile
          label="Total"
          value={`₹${total.toLocaleString("en-IN")}`}
          accent="pos"
        />
      </Stack>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={SECTION_LABEL_SX}
      >
        Per-day breakdown ({workedCount} of 7 days)
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.5,
          mb: 2,
        }}
      >
        {days.map((d) => {
          const c = statusColor(d.status);
          return (
            <Box
              key={d.date}
              sx={{
                p: 0.75,
                borderRadius: 1,
                border: `1px solid ${c.border}`,
                bgcolor: c.bg,
                textAlign: "center",
                minHeight: 80,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 8.5,
                    color: "text.secondary",
                    textTransform: "uppercase",
                  }}
                >
                  {d.dayName}
                </Typography>
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ display: "block" }}
                >
                  {dayjs(d.date).format("DD")}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 8,
                    fontWeight: 600,
                    color:
                      d.status === "full"
                        ? "success.dark"
                        : d.status === "half"
                          ? "warning.dark"
                          : "text.disabled",
                  }}
                >
                  {d.status.toUpperCase()}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    fontSize: 9,
                    fontWeight: 600,
                    color: d.amount > 0 ? "success.main" : "text.disabled",
                  }}
                >
                  {d.amount > 0 ? `₹${d.amount}` : "—"}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={SECTION_LABEL_SX}
      >
        Salary breakdown
      </Typography>
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Box
          sx={{
            p: 0.75,
            px: 1.25,
            bgcolor: "background.paper",
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="body2">Daily salary</Typography>
            <Typography variant="caption" color="text.secondary">
              {workedCount} day(s) worked
            </Typography>
          </Box>
          <Typography variant="body2" fontWeight={600} color="success.main">
            ₹{dailySalary.toLocaleString("en-IN")}
          </Typography>
        </Box>
        <Box
          sx={{
            p: 0.75,
            px: 1.25,
            bgcolor: "background.paper",
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="body2">Contract / piece-rate</Typography>
          <Typography variant="body2" fontWeight={600} color="success.main">
            ₹{contractAmount.toLocaleString("en-IN")}
          </Typography>
        </Box>
        <Box
          sx={{
            p: 0.75,
            px: 1.25,
            bgcolor: alpha(theme.palette.warning.main, 0.08),
            border: `1px solid ${theme.palette.warning.main}`,
            borderRadius: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="body2" fontWeight={700} color="warning.dark">
            Total settled
          </Typography>
          <Typography variant="body2" fontWeight={700} color="warning.dark">
            ₹{total.toLocaleString("en-IN")}
          </Typography>
        </Box>
      </Stack>

      {daysNotWorked.length > 0 && (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={SECTION_LABEL_SX}
          >
            Days didn&apos;t work
          </Typography>
          <Stack spacing={0.5}>
            {daysNotWorked.map((d) => (
              <Box
                key={d.date}
                sx={{
                  p: 0.75,
                  px: 1.25,
                  bgcolor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" fontWeight={500}>
                  {dayjs(d.date).format("ddd DD MMM")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.reason}
                </Typography>
              </Box>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------
// Weekly-aggregate shape: one subcontract (or all) × one week
// Per-day attendance roll-up across all contract laborers
// ----------------------------------------------------------------

function WeeklyAggregateShape({
  entity,
}: {
  entity: Extract<InspectEntity, { kind: "weekly-aggregate" }>;
}) {
  const theme = useTheme();
  const { data, isLoading } = useWeekAggregateAttendance(
    entity.siteId,
    entity.subcontractId,
    entity.weekStart,
    entity.weekEnd
  );

  // Click a day chip to expand a per-laborer breakdown for that date below.
  // Click again to collapse.
  const [expandedDate, setExpandedDate] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={56} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={140} />
      </Box>
    );
  }

  const days = data?.days ?? [];
  const holidays = data?.holidays ?? [];

  return (
    <Box sx={{ p: 2 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={SECTION_LABEL_SX}
      >
        Per-day attendance · {data?.totalLaborers ?? 0} contract laborers worked · tap a day for details
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.5,
          mb: 2,
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => {
          const dt = dayjs(entity.weekStart).add(i, "day").format("YYYY-MM-DD");
          const day = days.find((d) => d.date === dt);
          const holiday = holidays.find((h) => h.date === dt);
          const isExpanded = expandedDate === dt;
          // Holiday styling overrides empty styling but is overridden by worked-day
          // (holidays where someone still worked are rare but valid).
          const bg = day
            ? alpha(theme.palette.success.main, 0.12)
            : holiday
              ? alpha(theme.palette.info.main, 0.12)
              : "background.default";
          const borderColor = isExpanded
            ? theme.palette.primary.main
            : day
              ? theme.palette.success.main
              : holiday
                ? theme.palette.info.main
                : theme.palette.divider;
          return (
            <Box
              key={dt}
              role="button"
              tabIndex={0}
              aria-pressed={isExpanded}
              onClick={() =>
                setExpandedDate((prev) => (prev === dt ? null : dt))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedDate((prev) => (prev === dt ? null : dt));
                }
              }}
              sx={{
                p: 0.75,
                borderRadius: 1,
                textAlign: "center",
                bgcolor: bg,
                border: `${isExpanded ? 2 : 1}px solid ${borderColor}`,
                minHeight: 80,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "transform 80ms ease",
                "&:hover": { transform: "translateY(-1px)" },
                "&:focus-visible": {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 1,
                },
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontSize: 8.5,
                    color: "text.secondary",
                    textTransform: "uppercase",
                  }}
                >
                  {dayjs(dt).format("ddd")}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {dayjs(dt).format("DD")}
                </Typography>
              </Box>
              {day ? (
                <Box>
                  <Typography
                    sx={{
                      fontSize: 8.5,
                      color: "success.dark",
                      fontWeight: 600,
                    }}
                  >
                    {day.laborersWorked} lab.
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 9,
                      color: "success.main",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ₹{day.totalEarnings.toLocaleString("en-IN")}
                  </Typography>
                </Box>
              ) : holiday ? (
                <Box>
                  <Typography
                    sx={{
                      fontSize: 8.5,
                      color: "info.dark",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                    }}
                  >
                    Holiday
                  </Typography>
                  {holiday.reason && (
                    <Typography
                      sx={{
                        fontSize: 8,
                        color: "info.dark",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {holiday.reason}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography sx={{ fontSize: 9, color: "text.disabled" }}>
                  —
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Expanded per-day breakdown */}
      {expandedDate && (
        <Box sx={{ mb: 2 }}>
          <DayDetailExpansion
            siteId={entity.siteId}
            subcontractId={entity.subcontractId}
            date={expandedDate}
            holiday={holidays.find((h) => h.date === expandedDate)}
          />
        </Box>
      )}

      <Box
        sx={{
          bgcolor: "background.paper",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1.5,
          p: 1.25,
          fontSize: 12.5,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            py: 0.5,
          }}
        >
          <span style={{ color: theme.palette.text.secondary }}>
            Worked this week
          </span>
          <span
            style={{
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {data?.totalLaborers ?? 0} laborers
          </span>
        </Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            py: 0.5,
          }}
        >
          <span style={{ color: theme.palette.text.secondary }}>
            Total wages this week
          </span>
          <span
            style={{
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ₹{(data?.totalEarnings ?? 0).toLocaleString("en-IN")}
          </span>
        </Box>
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------
// Per-day expansion: when a day chip in WeeklyAggregateShape is clicked,
// show the laborer-by-laborer breakdown for that single date.
// Reuses useAttendanceForDate which the DailyShape also uses.
// ----------------------------------------------------------------

import type { WeekHoliday } from "@/hooks/queries/useWeekAggregateAttendance";

function DayDetailExpansion({
  siteId,
  subcontractId,
  date,
  holiday,
}: {
  siteId: string;
  subcontractId: string | null;
  date: string;
  holiday?: WeekHoliday;
}) {
  void subcontractId; // Per-day RPC is not subcontract-scoped today; whole site
  const theme = useTheme();
  const { data, isLoading } = useAttendanceForDate(siteId, date);

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: `1px solid ${theme.palette.primary.main}`,
        borderRadius: 1.5,
        p: 1.25,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          ...SECTION_LABEL_SX,
          color: "primary.main",
        }}
      >
        {dayjs(date).format("dddd, DD MMM")}
        {holiday && " · Holiday"}
      </Typography>

      {holiday && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            color: "info.dark",
            mb: 1,
          }}
        >
          {holiday.reason ?? "Holiday"}
          {holiday.isPaid && " (paid)"}
        </Typography>
      )}

      {isLoading ? (
        <Skeleton variant="rounded" height={64} />
      ) : (
        <>
          {(data?.dailyLaborers?.length ?? 0) === 0 &&
          (data?.marketLaborers?.length ?? 0) === 0 ? (
            <Typography variant="caption" color="text.disabled">
              No attendance recorded on this day.
            </Typography>
          ) : (
            <>
              {(data?.dailyLaborers?.length ?? 0) > 0 && (
                <>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "block",
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      fontWeight: 600,
                      mt: 1,
                      mb: 0.5,
                    }}
                  >
                    Daily Laborers ({data!.dailyLaborers.length})
                  </Typography>
                  <Stack spacing={0.5}>
                    {data!.dailyLaborers.map((lab) => (
                      <Box
                        key={lab.id}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          p: 0.75,
                          px: 1.25,
                          bgcolor: theme.palette.background.default,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 1,
                        }}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {lab.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {lab.role} · {lab.fullDay ? "Full day" : "Half day"}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color="success.main"
                        >
                          ₹{lab.amount.toLocaleString("en-IN")}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </>
              )}

              {(data?.marketLaborers?.length ?? 0) > 0 && (
                <>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "block",
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      fontWeight: 600,
                      mt: 1,
                      mb: 0.5,
                    }}
                  >
                    Market Laborers ({data!.marketLaborers.length})
                  </Typography>
                  <Stack spacing={0.5}>
                    {data!.marketLaborers.map((mkt) => (
                      <Box
                        key={mkt.id}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          p: 0.75,
                          px: 1.25,
                          bgcolor: theme.palette.background.default,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 1,
                        }}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {mkt.role}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {mkt.count}{" "}
                            {mkt.count === 1 ? "person" : "people"}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color="success.main"
                        >
                          ₹{mkt.amount.toLocaleString("en-IN")}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------
// Default export: branch by entity.kind
// ----------------------------------------------------------------

export default function AttendanceTab({ entity }: { entity: InspectEntity }) {
  if (entity.kind === "daily-date") return <DailyShape entity={entity} />;
  if (entity.kind === "weekly-week") return <WeeklyShape entity={entity} />;
  if (entity.kind === "weekly-aggregate")
    return <WeeklyAggregateShape entity={entity} />;
  // 'advance' — Attendance tab is not surfaced for this kind by InspectPane.tsx
  return null;
}
