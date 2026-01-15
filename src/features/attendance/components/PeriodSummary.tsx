"use client";

import React, { useState, memo } from "react";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Typography,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";

export interface PeriodTotals {
  totalExpense: number;
  totalSalary: number;
  totalTeaShop: number;
  totalDailyAmount: number;
  totalContractAmount: number;
  totalMarketAmount: number;
  totalPaidAmount: number;
  totalPaidCount: number;
  totalPendingAmount: number;
  totalPendingCount: number;
  avgPerDay: number;
}

interface PeriodSummaryProps {
  periodTotals: PeriodTotals;
}

/**
 * Period Summary Component
 *
 * Displays period totals for attendance including:
 * - Total expense, salary, tea shop amounts
 * - Daily, contract, market breakdowns
 * - Paid vs pending with counts
 * - Average per day
 *
 * Mobile: Collapsible view with condensed info
 * Desktop: Full horizontal layout with all stats
 */
function PeriodSummaryComponent({ periodTotals }: PeriodSummaryProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  return (
    <Paper sx={{ p: { xs: 0.75, sm: 2 }, mb: { xs: 1, sm: 2 }, flexShrink: 0 }}>
      {/* Mobile: Collapsible Summary */}
      <Box sx={{ display: { xs: "block", sm: "none" } }}>
        {/* Collapsed Header - Always visible on mobile */}
        <Box
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            py: 0.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.65rem" }}
            >
              Total
            </Typography>
            <Typography
              sx={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "primary.main",
              }}
            >
              ₹{periodTotals.totalExpense.toLocaleString()}
            </Typography>
            <Chip
              label={`Paid: ₹${periodTotals.totalPaidAmount.toLocaleString()}`}
              size="small"
              color="success"
              sx={{ height: 18, fontSize: "0.55rem" }}
            />
            <Chip
              label={`Pending: ₹${periodTotals.totalPendingAmount.toLocaleString()}`}
              size="small"
              color="warning"
              sx={{ height: 18, fontSize: "0.55rem" }}
            />
          </Box>
          <IconButton size="small" sx={{ p: 0.25 }}>
            {summaryExpanded ? (
              <ExpandLess fontSize="small" />
            ) : (
              <ExpandMore fontSize="small" />
            )}
          </IconButton>
        </Box>

        {/* Expanded Content */}
        <Collapse in={summaryExpanded}>
          <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
            {/* Row 1: Salary, Tea Shop */}
            <Box sx={{ display: "flex", alignItems: "stretch", mb: 1 }}>
              <Box sx={{ flex: 1, textAlign: "center" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.6rem" }}
                >
                  Salary
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "success.main",
                  }}
                >
                  ₹{periodTotals.totalSalary.toLocaleString()}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Box sx={{ flex: 1, textAlign: "center" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.6rem" }}
                >
                  Tea Shop
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "secondary.main",
                  }}
                >
                  ₹{periodTotals.totalTeaShop.toLocaleString()}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 0.5 }} />

            {/* Row 2: Daily, Contract, Market */}
            <Box sx={{ display: "flex", alignItems: "stretch", mb: 1 }}>
              <Box sx={{ flex: 1, textAlign: "center" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.6rem" }}
                >
                  Daily
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "warning.main",
                  }}
                >
                  ₹{periodTotals.totalDailyAmount.toLocaleString()}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Box sx={{ flex: 1, textAlign: "center" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.6rem" }}
                >
                  Contract
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "info.main",
                  }}
                >
                  ₹{periodTotals.totalContractAmount.toLocaleString()}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Box sx={{ flex: 1, textAlign: "center" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.6rem" }}
                >
                  Market
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "secondary.main",
                  }}
                >
                  ₹{periodTotals.totalMarketAmount.toLocaleString()}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 0.5 }} />

            {/* Row 3: Avg/Day */}
            <Box sx={{ display: "flex", alignItems: "stretch" }}>
              <Box sx={{ flex: 1, textAlign: "center" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.6rem" }}
                >
                  Avg/Day
                </Typography>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
                  ₹
                  {periodTotals.avgPerDay.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Collapse>
      </Box>

      {/* Desktop: Always expanded with vertical separators */}
      <Box
        sx={{
          display: { xs: "none", sm: "flex" },
          alignItems: "stretch",
          gap: 2,
        }}
      >
        {/* Group 1: Period Total, Salary, Tea Shop */}
        <Box sx={{ display: "flex", flex: 1, gap: 2 }}>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              Period Total
            </Typography>
            <Typography
              sx={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "primary.main",
              }}
            >
              ₹{periodTotals.totalExpense.toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              Salary
            </Typography>
            <Typography
              sx={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "success.main",
              }}
            >
              ₹{periodTotals.totalSalary.toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              Tea Shop
            </Typography>
            <Typography
              sx={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "secondary.main",
              }}
            >
              ₹{periodTotals.totalTeaShop.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Group 2: Daily, Contract, Market */}
        <Box sx={{ display: "flex", flex: 1, gap: 2 }}>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              Daily
            </Typography>
            <Typography
              sx={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "warning.main",
              }}
            >
              ₹{periodTotals.totalDailyAmount.toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              Contract
            </Typography>
            <Typography
              sx={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "info.main",
              }}
            >
              ₹{periodTotals.totalContractAmount.toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              Market
            </Typography>
            <Typography
              sx={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "secondary.main",
              }}
            >
              ₹{periodTotals.totalMarketAmount.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Group 3: Paid, Pending, Avg/Day */}
        <Box sx={{ display: "flex", flex: 1, gap: 2 }}>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              Paid
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
              }}
            >
              <Typography
                sx={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "success.main",
                }}
              >
                ₹{periodTotals.totalPaidAmount.toLocaleString()}
              </Typography>
              <Chip
                label={periodTotals.totalPaidCount}
                size="small"
                color="success"
                variant="outlined"
                sx={{
                  height: 24,
                  "& .MuiChip-label": { px: 0.5, fontSize: "0.75rem" },
                }}
              />
            </Box>
          </Box>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              Pending
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
              }}
            >
              <Typography
                sx={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "warning.main",
                }}
              >
                ₹{periodTotals.totalPendingAmount.toLocaleString()}
              </Typography>
              <Chip
                label={periodTotals.totalPendingCount}
                size="small"
                color="warning"
                variant="outlined"
                sx={{
                  height: 24,
                  "& .MuiChip-label": { px: 0.5, fontSize: "0.75rem" },
                }}
              />
            </Box>
          </Box>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem" }}
            >
              Avg/Day
            </Typography>
            <Typography sx={{ fontSize: "1.125rem", fontWeight: 600 }}>
              ₹
              {periodTotals.avgPerDay.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

// Memoize to prevent unnecessary re-renders
const PeriodSummary = memo(PeriodSummaryComponent);
export default PeriodSummary;
