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
  { value: "client_money", label: "Client Money", shortLabel: "Client", icon: <ClientIcon fontSize="small" /> },
  { value: "mothers_money", label: "Mother's Money", shortLabel: "Mother", icon: <PersonIcon fontSize="small" /> },
  { value: "custom", label: "Custom", shortLabel: "Other", icon: <CustomIcon fontSize="small" /> },
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

      <Collapse in={value === "custom"}>
        <TextField
          size="small"
          placeholder="Enter payer name"
          value={customName}
          onChange={(e) => onCustomNameChange(e.target.value)}
          disabled={disabled}
          fullWidth
          sx={{ mt: 1.5 }}
          helperText="Specify whose money was used"
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
    case "client_money":
      return "Client Money";
    case "mothers_money":
      return "Mother's Money";
    case "custom":
      return customName || "Custom";
    default:
      return source;
  }
}
