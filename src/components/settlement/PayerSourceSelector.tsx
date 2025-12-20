"use client";

import React from "react";
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Collapse,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  AccountBalance as OwnMoneyIcon,
  Business as ClientIcon,
  Person as PersonIcon,
  Edit as CustomIcon,
  LocationOn as SiteIcon,
} from "@mui/icons-material";
import type { PayerSource } from "@/types/settlement.types";

interface PayerSourceSelectorProps {
  value: PayerSource;
  customName: string;
  onChange: (source: PayerSource) => void;
  onCustomNameChange: (name: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

const PAYER_OPTIONS: { value: PayerSource; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { value: "own_money", label: "Own Money", shortLabel: "Own", icon: <OwnMoneyIcon fontSize="small" /> },
  { value: "amma_money", label: "Amma Money", shortLabel: "Amma", icon: <PersonIcon fontSize="small" /> },
  { value: "client_money", label: "Client Money", shortLabel: "Client", icon: <ClientIcon fontSize="small" /> },
  { value: "other_site_money", label: "Other Site", shortLabel: "Site", icon: <SiteIcon fontSize="small" /> },
  { value: "custom", label: "Other", shortLabel: "Other", icon: <CustomIcon fontSize="small" /> },
];

export default function PayerSourceSelector({
  value,
  customName,
  onChange,
  onCustomNameChange,
  disabled = false,
  compact = false,
}: PayerSourceSelectorProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box sx={{ mb: compact ? 1.5 : 2 }}>
      <Typography
        variant={compact ? "caption" : "subtitle2"}
        fontWeight={600}
        gutterBottom
        color="text.secondary"
      >
        Payment Source
      </Typography>

      <ToggleButtonGroup
        exclusive
        value={value}
        onChange={(_, newValue) => newValue && onChange(newValue)}
        size="small"
        disabled={disabled}
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          "& .MuiToggleButtonGroup-grouped": {
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px !important",
            m: 0,
            px: { xs: 1, sm: 1.5 },
            py: 0.5,
            "&.Mui-selected": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
              borderColor: "primary.main",
              "&:hover": {
                bgcolor: "primary.dark",
              },
            },
          },
        }}
      >
        {PAYER_OPTIONS.map((opt) => (
          <ToggleButton
            key={opt.value}
            value={opt.value}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              textTransform: "none",
            }}
          >
            {opt.icon}
            <Typography variant="caption" fontWeight={500}>
              {isMobile || compact ? opt.shortLabel : opt.label}
            </Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Collapse in={value === "custom" || value === "other_site_money"}>
        <TextField
          size="small"
          placeholder={value === "other_site_money" ? "Enter site name" : "Enter payer name"}
          value={customName}
          onChange={(e) => onCustomNameChange(e.target.value)}
          disabled={disabled}
          fullWidth
          sx={{ mt: 1.5 }}
          helperText={value === "other_site_money" ? "Specify which site's money" : "Specify whose money was used"}
        />
      </Collapse>
    </Box>
  );
}

/**
 * Get display label for a payer source
 */
export function getPayerSourceLabel(source: PayerSource, customName?: string): string {
  switch (source) {
    case "own_money":
      return "Own Money";
    case "amma_money":
      return "Amma Money";
    case "client_money":
      return "Client Money";
    case "other_site_money":
      return customName ? `Site: ${customName}` : "Other Site";
    case "mothers_money":
      return "Amma Money"; // Legacy support
    case "custom":
      return customName || "Other";
    default:
      return source;
  }
}

/**
 * Get color for a payer source chip
 */
export function getPayerSourceColor(source: PayerSource): "default" | "primary" | "secondary" | "success" | "warning" | "info" | "error" {
  switch (source) {
    case "own_money":
      return "primary";
    case "amma_money":
    case "mothers_money":
      return "secondary";
    case "client_money":
      return "success";
    case "other_site_money":
      return "warning";
    case "custom":
      return "info";
    default:
      return "default";
  }
}
