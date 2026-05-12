"use client";

import React from "react";
import {
  Box,
  Typography,
  Paper,
  alpha,
  useTheme,
} from "@mui/material";
import type { RequestJourney } from "@/types/journey.types";
import { formatCurrency } from "@/lib/formatters";
import dayjs from "dayjs";

interface JourneyExpenseSectionProps {
  journey: RequestJourney;
}

interface ExpenseCardData {
  siteLabel: string;
  qty: number | null;
  unitCost: number | null;
  totalCost: number;
  isPending: boolean;
}

export function JourneyExpenseSection({ journey }: JourneyExpenseSectionProps) {
  const theme = useTheme();
  const { expense, batchUsage, isGroupPO } = journey;

  if (!expense) {
    // No expense yet — show a placeholder
    return (
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.background.default, 0.4),
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontSize: "0.8rem", fontWeight: 700, mb: 0.5 }}
        >
          Expense
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
          No expense recorded yet.
        </Typography>
      </Box>
    );
  }

  const isPending = !expense.is_paid;

  let cards: ExpenseCardData[];

  if (isGroupPO && batchUsage.length > 0) {
    // Group by site
    const siteMap = new Map<string, { qty: number; totalCost: number }>();
    for (const rec of batchUsage) {
      const existing = siteMap.get(rec.usage_site_id);
      if (existing) {
        existing.qty += rec.quantity;
        existing.totalCost += rec.total_cost;
      } else {
        siteMap.set(rec.usage_site_id, {
          qty: rec.quantity,
          totalCost: rec.total_cost,
        });
      }
    }
    cards = Array.from(siteMap.entries()).map(([siteId, data]) => ({
      siteLabel: siteId.slice(0, 8) + "…",
      qty: data.qty,
      unitCost: data.qty > 0 ? data.totalCost / data.qty : null,
      totalCost: data.totalCost,
      isPending,
    }));
  } else {
    // Own-site: single card
    const firstUsage = batchUsage[0];
    cards = [
      {
        siteLabel: "This Site",
        qty: expense.original_qty ?? firstUsage?.quantity ?? null,
        unitCost:
          expense.original_qty && expense.total_amount
            ? expense.total_amount / expense.original_qty
            : null,
        totalCost: expense.amount_paid ?? expense.total_amount,
        isPending,
      },
    ];
  }

  return (
    <Box
      sx={{
        px: 2.5,
        py: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.default, 0.4),
      }}
    >
      {/* Section header */}
      <Box sx={{ mb: 1.25 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontSize: "0.8rem", fontWeight: 700 }}
        >
          Expense Summary
        </Typography>
        {expense.paid_date && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.68rem" }}
          >
            Paid on {dayjs(expense.paid_date).format("DD MMM YYYY")}
            {expense.payment_mode ? ` · ${expense.payment_mode.replace(/_/g, " ")}` : ""}
          </Typography>
        )}
      </Box>

      {/* Cards */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {cards.map((card, i) => (
          <Paper
            key={i}
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              opacity: card.isPending ? 0.55 : 1,
              bgcolor: card.isPending
                ? alpha(theme.palette.action.disabledBackground, 0.5)
                : "background.paper",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                mb: 0.5,
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontSize: "0.78rem", fontWeight: 600, color: "text.primary" }}
              >
                {card.siteLabel}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: card.isPending
                    ? "text.disabled"
                    : theme.palette.warning.dark,
                }}
              >
                {card.isPending ? "Pending" : formatCurrency(card.totalCost)}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 2 }}>
              {card.qty != null && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.62rem",
                      color: "text.secondary",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    Qty
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: "0.76rem", fontWeight: 500 }}
                  >
                    {card.qty.toFixed(2)}
                  </Typography>
                </Box>
              )}
              {card.unitCost != null && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.62rem",
                      color: "text.secondary",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    Unit Cost
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: "0.76rem", fontWeight: 500 }}
                  >
                    {formatCurrency(card.unitCost)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

export default JourneyExpenseSection;
