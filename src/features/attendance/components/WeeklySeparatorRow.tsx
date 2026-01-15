"use client";

import React, { memo } from "react";
import {
  Box,
  Button,
  Chip,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import {
  CalendarMonth,
  Payment as PaymentIcon,
} from "@mui/icons-material";

export interface WeeklySummary {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
  totalWorkDays: number;
  totalLaborers: number;
  pendingDailySalary: number;
  pendingContractSalary: number;
  pendingMarketSalary: number;
  teaShopExpenses: number;
  totalPending: number;
}

interface WeeklySeparatorRowProps {
  weeklySummary: WeeklySummary;
  canEdit: boolean;
  onSettlementClick: (summary: WeeklySummary) => void;
  colSpan?: number;
}

/**
 * Weekly Separator Row Component
 *
 * Displays a summary strip for a week in the attendance table:
 * - Week label with current week indicator
 * - Work days and laborers count
 * - Pending salary chips (daily, contract, market, tea shop)
 * - Weekly settlement button for completed weeks
 */
function WeeklySeparatorRowComponent({
  weeklySummary,
  canEdit,
  onSettlementClick,
  colSpan = 13,
}: WeeklySeparatorRowProps) {
  const isCurrentWeek = weeklySummary.isCurrentWeek;

  return (
    <TableRow
      sx={{
        bgcolor: isCurrentWeek ? "info.50" : "grey.100",
        borderTop: 2,
        borderBottom: 2,
        borderColor: isCurrentWeek ? "info.main" : "primary.main",
      }}
    >
      <TableCell colSpan={colSpan} sx={{ py: 1.5, px: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          {/* Week Info */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <CalendarMonth
              sx={{
                color: isCurrentWeek ? "info.main" : "primary.main",
                fontSize: 24,
              }}
            />
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  color={isCurrentWeek ? "info.main" : "primary.main"}
                >
                  {isCurrentWeek
                    ? weeklySummary.weekLabel
                    : `Week: ${weeklySummary.weekLabel}`}
                </Typography>
                {isCurrentWeek && (
                  <Chip
                    size="small"
                    label="In Progress"
                    color="info"
                    sx={{ height: 20, fontSize: "0.65rem" }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {weeklySummary.totalWorkDays} work day
                {weeklySummary.totalWorkDays !== 1 ? "s" : ""} •{" "}
                {weeklySummary.totalLaborers} laborers worked
              </Typography>
            </Box>
          </Box>

          {/* Summary Stats */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 1, sm: 2 },
              flexWrap: "wrap",
            }}
          >
            {weeklySummary.pendingDailySalary > 0 && (
              <Chip
                size="small"
                label={`Daily: ₹${weeklySummary.pendingDailySalary.toLocaleString()}`}
                color="info"
                variant="outlined"
              />
            )}
            {weeklySummary.pendingContractSalary > 0 && (
              <Chip
                size="small"
                label={`Contract: ₹${weeklySummary.pendingContractSalary.toLocaleString()}`}
                color="secondary"
                variant="outlined"
              />
            )}
            {weeklySummary.pendingMarketSalary > 0 && (
              <Chip
                size="small"
                label={`Market: ₹${weeklySummary.pendingMarketSalary.toLocaleString()}`}
                color="warning"
                variant="outlined"
              />
            )}
            {weeklySummary.teaShopExpenses > 0 && (
              <Chip
                size="small"
                label={`Tea: ₹${weeklySummary.teaShopExpenses.toLocaleString()}`}
                variant="outlined"
              />
            )}
          </Box>

          {/* Weekly Settlement Button - only show for completed weeks */}
          {canEdit && weeklySummary.totalPending > 0 && !isCurrentWeek && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<PaymentIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onSettlementClick(weeklySummary);
              }}
            >
              Weekly Settlement (₹{weeklySummary.totalPending.toLocaleString()})
            </Button>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}

// Memoize to prevent unnecessary re-renders
const WeeklySeparatorRow = memo(WeeklySeparatorRowComponent);
export default WeeklySeparatorRow;
