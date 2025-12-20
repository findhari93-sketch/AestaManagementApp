"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Divider,
} from "@mui/material";
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  AccountBalanceWallet as WalletIcon,
} from "@mui/icons-material";
import type { MoneySourceSummary } from "@/types/payment.types";
import { getPayerSourceColor } from "@/components/settlement/PayerSourceSelector";

// Helper to get valid LinearProgress color
function getProgressColor(source: MoneySourceSummary["source"]): "primary" | "secondary" | "success" | "warning" | "info" | "error" {
  const color = getPayerSourceColor(source);
  return color === "default" ? "primary" : color;
}

interface MoneySourceSummaryCardProps {
  summaries: MoneySourceSummary[];
  onSourceClick?: (source: string) => void;
  selectedSource?: string | null;
}

export default function MoneySourceSummaryCard({
  summaries,
  onSourceClick,
  selectedSource,
}: MoneySourceSummaryCardProps) {
  const [expanded, setExpanded] = useState(true);

  // Calculate total
  const totalAmount = summaries.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = summaries.reduce((sum, s) => sum + s.transactionCount, 0);
  const totalLaborers = summaries.reduce((sum, s) => sum + s.laborerCount, 0);

  if (summaries.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WalletIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>
              Money Source Breakdown
            </Typography>
            <Chip
              label={`Rs.${totalAmount.toLocaleString()}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          <IconButton size="small">
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </Box>

        {/* Expanded Content */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 2 }}>
            {summaries.map((summary) => {
              const percentage = totalAmount > 0 ? (summary.totalAmount / totalAmount) * 100 : 0;
              const isSelected = selectedSource === summary.source;

              return (
                <Box
                  key={summary.source + (summary.displayName || "")}
                  sx={{
                    mb: 1.5,
                    p: 1,
                    borderRadius: 1,
                    cursor: onSourceClick ? "pointer" : "default",
                    bgcolor: isSelected ? "action.selected" : "transparent",
                    "&:hover": onSourceClick ? { bgcolor: "action.hover" } : {},
                  }}
                  onClick={() => onSourceClick?.(summary.source)}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 0.5,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip
                        label={summary.displayName}
                        size="small"
                        color={getPayerSourceColor(summary.source)}
                        variant={isSelected ? "filled" : "outlined"}
                      />
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      Rs.{summary.totalAmount.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {summary.transactionCount} payment{summary.transactionCount !== 1 ? "s" : ""} | {summary.laborerCount} laborer{summary.laborerCount !== 1 ? "s" : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {percentage.toFixed(0)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={percentage}
                    color={getProgressColor(summary.source)}
                    sx={{ height: 4, borderRadius: 1 }}
                  />
                </Box>
              );
            })}

            {/* Total Row */}
            <Divider sx={{ my: 1.5 }} />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                Total
              </Typography>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="body2" fontWeight={600}>
                  Rs.{totalAmount.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {totalTransactions} payments | {totalLaborers} laborers
                </Typography>
              </Box>
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
