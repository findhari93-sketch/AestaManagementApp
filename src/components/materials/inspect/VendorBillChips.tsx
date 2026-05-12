"use client";

import { Box, Chip, Tooltip, alpha, useTheme } from "@mui/material";
import {
  ReceiptLong as ReceiptIcon,
  AccountBalanceWallet as UpiIcon,
  Payments as CashIcon,
  WarningAmber as NoBillIcon,
} from "@mui/icons-material";
import type { VendorBillPolicy } from "@/types/material.types";

interface VendorBillChipsProps {
  billPolicy: VendorBillPolicy;
  acceptsCash: boolean;
  acceptsUpi: boolean;
  acceptsCredit: boolean;
  gstNumber: string | null;
  /** Hide the GST chip when GST is not interesting in this context. */
  showGst?: boolean;
  size?: "xs" | "sm";
}

const SIZE: Record<"xs" | "sm", { h: number; fs: number; px: number; icon: number }> = {
  xs: { h: 18, fs: 10, px: 0.6, icon: 11 },
  sm: { h: 22, fs: 11, px: 0.75, icon: 13 },
};

export function VendorBillChips({
  billPolicy,
  acceptsCash,
  acceptsUpi,
  acceptsCredit,
  gstNumber,
  showGst = true,
  size = "xs",
}: VendorBillChipsProps) {
  const theme = useTheme();
  const s = SIZE[size];

  const chips: Array<{
    key: string;
    label: string;
    tooltip: string;
    icon: React.ReactNode;
    bg: string;
    fg: string;
  }> = [];

  if (showGst && gstNumber) {
    chips.push({
      key: "gst",
      label: "GST",
      tooltip: `GST: ${gstNumber}`,
      icon: <ReceiptIcon sx={{ fontSize: s.icon }} />,
      bg: alpha(theme.palette.success.main, 0.12),
      fg: theme.palette.success.dark,
    });
  }

  if (billPolicy === "no_bills") {
    chips.push({
      key: "nobill",
      label: "No bill",
      tooltip: "Vendor never issues a bill (cash-only, no GST)",
      icon: <NoBillIcon sx={{ fontSize: s.icon }} />,
      bg: alpha(theme.palette.warning.main, 0.18),
      fg: theme.palette.warning.dark,
    });
  } else if (billPolicy === "bills_unless_cash") {
    chips.push({
      key: "billunlesscash",
      label: "No bill on cash",
      tooltip: "Vendor skips the bill when paid in cash (mandy dealer)",
      icon: <NoBillIcon sx={{ fontSize: s.icon }} />,
      bg: alpha(theme.palette.warning.main, 0.12),
      fg: theme.palette.warning.dark,
    });
  }

  if (acceptsCash) {
    chips.push({
      key: "cash",
      label: "Cash",
      tooltip: "Accepts cash",
      icon: <CashIcon sx={{ fontSize: s.icon }} />,
      bg: alpha(theme.palette.info.main, 0.1),
      fg: theme.palette.info.dark,
    });
  }
  if (acceptsUpi) {
    chips.push({
      key: "upi",
      label: "UPI",
      tooltip: "Accepts UPI",
      icon: <UpiIcon sx={{ fontSize: s.icon }} />,
      bg: alpha(theme.palette.info.main, 0.1),
      fg: theme.palette.info.dark,
    });
  }
  if (acceptsCredit) {
    chips.push({
      key: "credit",
      label: "Credit",
      tooltip: "Offers credit",
      icon: <ReceiptIcon sx={{ fontSize: s.icon }} />,
      bg: alpha(theme.palette.secondary.main, 0.1),
      fg: theme.palette.secondary.dark,
    });
  }

  if (chips.length === 0) return null;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
      {chips.map((c) => (
        <Tooltip key={c.key} title={c.tooltip} placement="top">
          <Chip
            icon={c.icon as any}
            label={c.label}
            size="small"
            sx={{
              height: s.h,
              fontSize: s.fs,
              fontWeight: 600,
              bgcolor: c.bg,
              color: c.fg,
              border: 0,
              "& .MuiChip-icon": { color: c.fg, ml: 0.5, mr: -0.25 },
              "& .MuiChip-label": { px: s.px },
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}
