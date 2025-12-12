"use client";

import React from "react";
import {
  Box,
  TextField,
  Typography,
  InputAdornment,
  Divider,
} from "@mui/material";
import { LocalCafe } from "@mui/icons-material";
import PercentageSplitInput from "./PercentageSplitInput";
import MultiSiteSplitSection from "./MultiSiteSplitSection";
import type { Site, LaborGroupPercentageSplit } from "@/types/database.types";

interface SimpleEntryModeContentProps {
  date: string;
  onDateChange: (date: string) => void;
  totalCost: number;
  onTotalCostChange: (cost: number) => void;
  percentageSplit: LaborGroupPercentageSplit;
  onPercentageSplitChange: (split: LaborGroupPercentageSplit) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  // Multi-site props
  enableMultiSite: boolean;
  onEnableMultiSiteChange: (enabled: boolean) => void;
  primarySite: Site;
  secondarySite: Site | null;
  onSecondarySiteChange: (site: Site | null) => void;
  primarySitePercent: number;
  secondarySitePercent: number;
  onSitePercentChange: (primary: number, secondary: number) => void;
  availableSites: Site[];
}

export default function SimpleEntryModeContent({
  date,
  onDateChange,
  totalCost,
  onTotalCostChange,
  percentageSplit,
  onPercentageSplitChange,
  notes,
  onNotesChange,
  enableMultiSite,
  onEnableMultiSiteChange,
  primarySite,
  secondarySite,
  onSecondarySiteChange,
  primarySitePercent,
  secondarySitePercent,
  onSitePercentChange,
  availableSites,
}: SimpleEntryModeContentProps) {
  // Calculate the effective total for this site (after multi-site split)
  const effectiveTotal = enableMultiSite && secondarySite
    ? Math.round((primarySitePercent / 100) * totalCost)
    : totalCost;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Date Input */}
      <TextField
        label="Date"
        type="date"
        size="small"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        fullWidth
        slotProps={{
          inputLabel: { shrink: true },
        }}
      />

      {/* Total Cost Input - Prominent */}
      <Box>
        <Typography
          variant="subtitle2"
          sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
        >
          <LocalCafe fontSize="small" color="primary" />
          Total T&S Cost
        </Typography>
        <TextField
          type="number"
          size="medium"
          value={totalCost || ""}
          onChange={(e) => onTotalCostChange(parseFloat(e.target.value) || 0)}
          placeholder="Enter total cost"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">₹</InputAdornment>
              ),
              inputProps: { min: 0, step: 10 },
              sx: { fontSize: "1.25rem", fontWeight: 500 },
            },
          }}
        />
        {enableMultiSite && secondarySite && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            This site&apos;s share: ₹{effectiveTotal.toLocaleString()} ({primarySitePercent}%)
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Labor Group Percentage Split */}
      <PercentageSplitInput
        daily={percentageSplit.daily}
        contract={percentageSplit.contract}
        market={percentageSplit.market}
        totalCost={effectiveTotal}
        onChange={onPercentageSplitChange}
      />

      <Divider />

      {/* Multi-Site Split Section */}
      <MultiSiteSplitSection
        enabled={enableMultiSite}
        onEnabledChange={onEnableMultiSiteChange}
        primarySite={primarySite}
        secondarySite={secondarySite}
        onSecondarySiteChange={onSecondarySiteChange}
        primaryPercent={primarySitePercent}
        secondaryPercent={secondarySitePercent}
        onPercentChange={onSitePercentChange}
        totalCost={totalCost}
        availableSites={availableSites}
        date={date}
      />

      {/* Notes */}
      <TextField
        label="Notes (Optional)"
        multiline
        rows={2}
        size="small"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Any additional notes..."
        fullWidth
      />
    </Box>
  );
}
