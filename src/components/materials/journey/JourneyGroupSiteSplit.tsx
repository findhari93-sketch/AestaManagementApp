"use client";

import React from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  alpha,
  useTheme,
} from "@mui/material";
import type { RequestJourney } from "@/types/journey.types";
import { formatCurrency } from "@/lib/formatters";

interface JourneyGroupSiteSplitProps {
  journey: RequestJourney;
}

const SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_settlement: "In Settlement",
  settled: "Settled",
  self_use: "Self Use",
};

const SETTLEMENT_STATUS_COLOR: Record<
  string,
  "default" | "warning" | "info" | "success" | "error"
> = {
  pending: "warning",
  in_settlement: "info",
  settled: "success",
  self_use: "default",
};

export function JourneyGroupSiteSplit({ journey }: JourneyGroupSiteSplitProps) {
  const theme = useTheme();
  const { batchUsage, expense } = journey;

  if (!journey.isGroupPO || batchUsage.length === 0) return null;

  const isVendorPaid = expense?.is_paid ?? false;

  // Group by usage_site_id
  const siteMap = new Map<
    string,
    {
      site_id: string;
      total_qty: number;
      total_cost: number;
      settlement_status: string;
      is_self_use: boolean;
    }
  >();

  for (const rec of batchUsage) {
    const existing = siteMap.get(rec.usage_site_id);
    if (existing) {
      existing.total_qty += rec.quantity;
      existing.total_cost += rec.total_cost;
      // If any record for this site has a better status, upgrade
      if (rec.settlement_status === "settled") {
        existing.settlement_status = "settled";
      } else if (
        rec.settlement_status === "in_settlement" &&
        existing.settlement_status !== "settled"
      ) {
        existing.settlement_status = "in_settlement";
      }
    } else {
      siteMap.set(rec.usage_site_id, {
        site_id: rec.usage_site_id,
        total_qty: rec.quantity,
        total_cost: rec.total_cost,
        settlement_status: rec.settlement_status,
        is_self_use: rec.is_self_use,
      });
    }
  }

  const siteRows = Array.from(siteMap.values());

  return (
    <Box
      sx={{
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.default, 0.4),
      }}
    >
      {/* Section header */}
      <Box sx={{ px: 2.5, pt: 1.75, pb: 0.75 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontSize: "0.8rem", fontWeight: 700, color: "text.primary" }}
        >
          Site Allocation
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
          How this group stock batch was split across sites
        </Typography>
      </Box>

      {!isVendorPaid ? (
        <Box
          sx={{
            mx: 2.5,
            mb: 1.5,
            p: 1.5,
            bgcolor: alpha(theme.palette.warning.main, 0.08),
            borderRadius: 1.5,
            border: `1px dashed ${alpha(theme.palette.warning.main, 0.4)}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontSize: "0.72rem", color: "warning.dark", fontWeight: 600 }}
          >
            Settlement amounts will finalize after vendor payment is recorded.
          </Typography>
        </Box>
      ) : null}

      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ py: 0.5, fontSize: "0.7rem", fontWeight: 700 }}>
                Site
              </TableCell>
              <TableCell align="right" sx={{ py: 0.5, fontSize: "0.7rem", fontWeight: 700 }}>
                Qty
              </TableCell>
              <TableCell align="right" sx={{ py: 0.5, fontSize: "0.7rem", fontWeight: 700 }}>
                Amount
              </TableCell>
              <TableCell align="center" sx={{ py: 0.5, fontSize: "0.7rem", fontWeight: 700 }}>
                Settlement
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {siteRows.map((row) => (
              <TableRow key={row.site_id}>
                <TableCell sx={{ py: 0.625, fontSize: "0.78rem" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {/* Site name not available directly on BatchUsageRecord; show site_id truncated */}
                    <Typography
                      variant="body2"
                      sx={{ fontSize: "0.76rem", fontFamily: "monospace" }}
                    >
                      {row.site_id.slice(0, 8)}…
                    </Typography>
                    {row.is_self_use && (
                      <Chip
                        label="Payer"
                        size="small"
                        color="success"
                        sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.5 } }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ py: 0.625, fontSize: "0.78rem" }}>
                  {row.total_qty.toFixed(2)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    py: 0.625,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: isVendorPaid ? "text.primary" : "text.disabled",
                  }}
                >
                  {isVendorPaid ? formatCurrency(row.total_cost) : "—"}
                </TableCell>
                <TableCell align="center" sx={{ py: 0.625 }}>
                  <Chip
                    label={
                      SETTLEMENT_STATUS_LABEL[row.settlement_status] ??
                      row.settlement_status
                    }
                    size="small"
                    color={
                      SETTLEMENT_STATUS_COLOR[row.settlement_status] ?? "default"
                    }
                    sx={{
                      height: 18,
                      fontSize: "0.65rem",
                      "& .MuiChip-label": { px: 0.75 },
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

export default JourneyGroupSiteSplit;
