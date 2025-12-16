"use client";

import React from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  useTheme,
  useMediaQuery,
  alpha,
} from "@mui/material";
import {
  CalendarMonth,
  Payment as PaymentIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
} from "@mui/icons-material";
import type { WeeklyPaymentSummary } from "@/lib/data/payments";

interface WeeklyPaymentStripProps {
  summary: WeeklyPaymentSummary;
  onSettleClick: (summary: WeeklyPaymentSummary) => void;
  disabled?: boolean;
}

export default function WeeklyPaymentStrip({
  summary,
  onSettleClick,
  disabled = false,
}: WeeklyPaymentStripProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const dailyMarketPending = summary.dailyLaborPending + summary.marketLaborPending;
  const hasPending = summary.totalPending > 0;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1, sm: 1.5 },
        mb: 1.5,
        bgcolor: summary.isCurrentWeek
          ? alpha(theme.palette.info.main, 0.08)
          : alpha(theme.palette.primary.main, 0.05),
        borderRadius: 2,
        border: "1px solid",
        borderColor: summary.isCurrentWeek
          ? alpha(theme.palette.info.main, 0.3)
          : alpha(theme.palette.primary.main, 0.2),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: { xs: "wrap", md: "nowrap" },
          gap: { xs: 1, sm: 2 },
        }}
      >
        {/* Week Label */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: { xs: "100%", sm: "auto" } }}>
          <CalendarMonth
            fontSize="small"
            color={summary.isCurrentWeek ? "info" : "primary"}
          />
          <Typography
            variant="subtitle2"
            fontWeight={600}
            sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
          >
            {summary.weekLabel}
          </Typography>
          {summary.isCurrentWeek && (
            <Chip
              label="Current"
              size="small"
              color="info"
              sx={{ height: 20, fontSize: "0.65rem" }}
            />
          )}
        </Box>

        {/* Pending Amounts - Most Important */}
        <Box
          sx={{
            display: "flex",
            gap: { xs: 1.5, sm: 3 },
            alignItems: "center",
            flexWrap: { xs: "wrap", sm: "nowrap" },
          }}
        >
          {/* Daily + Market (combined - most important for daily payment) */}
          <Box sx={{ textAlign: "center", minWidth: { xs: 80, sm: 100 } }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
              <PersonIcon sx={{ fontSize: 14, color: "text.secondary" }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: { xs: "0.6rem", sm: "0.7rem" } }}
              >
                Daily + Market
              </Typography>
            </Box>
            <Typography
              variant="body2"
              fontWeight={700}
              color={dailyMarketPending > 0 ? "warning.main" : "text.disabled"}
              sx={{ fontSize: { xs: "0.8rem", sm: "0.9rem" } }}
            >
              Rs.{dailyMarketPending.toLocaleString()}
            </Typography>
          </Box>

          {/* Contract Labor (separate) */}
          {summary.contractLaborPending > 0 && (
            <Box sx={{ textAlign: "center", minWidth: { xs: 70, sm: 90 } }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                <GroupsIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: "0.6rem", sm: "0.7rem" } }}
                >
                  Contract
                </Typography>
              </Box>
              <Typography
                variant="body2"
                fontWeight={600}
                color="info.main"
                sx={{ fontSize: { xs: "0.8rem", sm: "0.9rem" } }}
              >
                Rs.{summary.contractLaborPending.toLocaleString()}
              </Typography>
            </Box>
          )}

          {/* Total Pending */}
          <Box sx={{ textAlign: "center", minWidth: { xs: 80, sm: 100 } }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: { xs: "0.6rem", sm: "0.7rem" } }}
            >
              Total Pending
            </Typography>
            <Typography
              variant="body1"
              fontWeight={700}
              color={hasPending ? "error.main" : "success.main"}
              sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}
            >
              Rs.{summary.totalPending.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {/* Settle Button */}
        <Button
          variant="contained"
          size="small"
          color={summary.isCurrentWeek ? "info" : "primary"}
          onClick={() => onSettleClick(summary)}
          disabled={disabled || !hasPending}
          startIcon={<PaymentIcon sx={{ fontSize: 16 }} />}
          sx={{
            minWidth: { xs: "100%", sm: "auto" },
            px: { xs: 2, sm: 1.5 },
            py: 0.5,
            fontSize: { xs: "0.75rem", sm: "0.8rem" },
            mt: { xs: 0.5, sm: 0 },
          }}
        >
          {isMobile ? "Settle Week" : "Settle Week"}
        </Button>
      </Box>
    </Paper>
  );
}
