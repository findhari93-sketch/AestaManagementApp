"use client";

import { useMemo } from "react";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import {
  calculateSpentToDate,
  calculateExpectedRemaining,
  calculateDailyBurnRate,
} from "@/lib/utils/rentalCostUtils";
import type { RentalOrderWithDetails } from "@/types/rental.types";

interface ActiveOrderCostMeterProps {
  order: RentalOrderWithDetails;
  onExtendDate: () => void;
}

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

export function ActiveOrderCostMeter({ order, onExtendDate }: ActiveOrderCostMeterProps) {
  const today = new Date();
  const startDate = order.start_date ?? order.order_date;
  const returns = order.returns ?? [];
  const items = order.items ?? [];

  const daysElapsed = useMemo(() => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [startDate]);

  const spent = useMemo(
    () => calculateSpentToDate(items as any, returns, startDate, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, returns, startDate]
  );

  const remaining = useMemo(
    () =>
      order.expected_return_date
        ? calculateExpectedRemaining(items as any, startDate, order.expected_return_date, today)
        : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, startDate, order.expected_return_date]
  );

  const expectedTotal = spent + remaining;
  const burnRate = calculateDailyBurnRate(spent, daysElapsed);
  const progress = expectedTotal > 0 ? Math.min(100, (spent / expectedTotal) * 100) : 0;

  const expectedReturnDate = order.expected_return_date
    ? new Date(order.expected_return_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      })
    : "—";

  const daysLeft = order.expected_return_date
    ? Math.max(
        0,
        Math.floor(
          (new Date(order.expected_return_date).getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const isOverdue = daysLeft !== null && daysLeft === 0 && remaining === 0;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1, bgcolor: "success.light", borderRadius: 1.5, p: 1, textAlign: "center" }}>
          <Typography variant="caption" color="success.dark" fontWeight={700} display="block" sx={{ fontSize: 9 }}>
            SPENT TO DATE
          </Typography>
          <Typography variant="subtitle2" fontWeight={800}>₹{formatINR(spent)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
            {daysElapsed} days
          </Typography>
        </Box>
        <Box sx={{ flex: 1, bgcolor: "info.light", borderRadius: 1.5, p: 1, textAlign: "center" }}>
          <Typography variant="caption" color="info.dark" fontWeight={700} display="block" sx={{ fontSize: 9 }}>
            EXPECTED REMAINING
          </Typography>
          <Typography variant="subtitle2" fontWeight={800} color="warning.dark">
            ₹{formatINR(remaining)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
            {daysLeft !== null ? `${daysLeft} days left` : "—"}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, bgcolor: "action.hover", borderRadius: 1.5, p: 1, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ fontSize: 9 }}>
            EXPECTED TOTAL
          </Typography>
          <Typography variant="subtitle2" fontWeight={800}>₹{formatINR(expectedTotal)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
            if returned {expectedReturnDate}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ mb: 0.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            Day 1 ·{" "}
            {startDate
              ? new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
              : "—"}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            Day {daysElapsed + (daysLeft ?? 0)} · {expectedReturnDate}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={isOverdue ? "error" : "success"}
          sx={{ height: 10, borderRadius: 5 }}
        />
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
          <Typography variant="caption" color="success.main" fontWeight={600} sx={{ fontSize: 10 }}>
            ₹{formatINR(spent)} spent ({Math.round(progress)}%)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            ₹{formatINR(remaining)} remaining
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Daily burn: <strong>₹{formatINR(burnRate)}/day</strong>
        </Typography>
        <Button
          size="small"
          variant="outlined"
          color={isOverdue ? "error" : "warning"}
          startIcon={<CalendarMonthIcon sx={{ fontSize: 14 }} />}
          onClick={onExtendDate}
          sx={{ fontSize: 11 }}
        >
          {isOverdue ? "Overdue — Extend" : "Extend Date"}
        </Button>
      </Box>
    </Box>
  );
}
