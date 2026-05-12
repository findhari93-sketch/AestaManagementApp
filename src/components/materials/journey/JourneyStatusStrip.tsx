"use client";

import React from "react";
import { Box, Typography, Divider, Chip, alpha, useTheme } from "@mui/material";
import type { RequestJourney } from "@/types/journey.types";
import { formatCurrency } from "@/lib/formatters";

interface JourneyStatusStripProps {
  journey: RequestJourney;
}

interface StripItem {
  label: string;
  content: React.ReactNode;
}

export function JourneyStatusStrip({ journey }: JourneyStatusStripProps) {
  const theme = useTheme();
  const { po, expense, isGroupPO } = journey;

  const totalValue = po?.total_amount ?? expense?.total_amount ?? null;
  const vendorDisplay = expense?.vendor_name ?? po?.vendor_id ?? "—";

  const amountPaid = expense?.amount_paid ?? null;
  const isPaid = expense?.is_paid ?? false;

  const items: StripItem[] = [
    {
      label: "Order Value",
      content: (
        <Typography
          variant="body2"
          sx={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: theme.palette.warning.dark,
          }}
        >
          {totalValue != null ? formatCurrency(totalValue) : "—"}
        </Typography>
      ),
    },
    {
      label: "Vendor",
      content: (
        <Typography
          variant="body2"
          sx={{ fontSize: "0.78rem", fontWeight: 500, color: "text.primary" }}
          noWrap
        >
          {vendorDisplay}
        </Typography>
      ),
    },
    {
      label: "PO Type",
      content: isGroupPO ? (
        <Chip
          label="GROUP STOCK"
          size="small"
          sx={{
            height: 18,
            fontSize: "0.65rem",
            fontWeight: 700,
            bgcolor: "purple",
            color: "white",
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
      ) : (
        <Chip
          label="OWN SITE"
          size="small"
          color="info"
          sx={{
            height: 18,
            fontSize: "0.65rem",
            fontWeight: 700,
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
      ),
    },
    {
      label: "Vendor Paid",
      content: (
        <Typography
          variant="body2"
          sx={{
            fontSize: "0.78rem",
            fontWeight: 600,
            color: isPaid
              ? theme.palette.success.main
              : theme.palette.error.main,
          }}
        >
          {amountPaid != null && totalValue != null
            ? `${formatCurrency(amountPaid)} / ${formatCurrency(totalValue)}`
            : isPaid
            ? "Paid"
            : expense
            ? "Unpaid"
            : "—"}
        </Typography>
      ),
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, 0.8),
        overflowX: "auto",
        "&::-webkit-scrollbar": { height: 0 },
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Divider
              orientation="vertical"
              flexItem
              sx={{ mx: 0, my: 0.75, alignSelf: "stretch" }}
            />
          )}
          <Box
            sx={{
              flex: 1,
              minWidth: 72,
              px: 1.5,
              py: 1,
              display: "flex",
              flexDirection: "column",
              gap: 0.25,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.62rem",
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                display: "block",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </Typography>
            {item.content}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
}

export default JourneyStatusStrip;
