"use client";

import { useMemo } from "react";
import { Box, Typography, Tooltip, Chip } from "@mui/material";
import { Scale as ScaleIcon } from "@mui/icons-material";
import { calculateWeight, formatWeight } from "@/lib/weightCalculation";

interface WeightCalculationDisplayProps {
  weightPerUnit: number | null | undefined;
  weightUnit?: string | null;
  quantity: number;
  unit?: string;
  variant?: "inline" | "chip" | "full";
  showIcon?: boolean;
}

export default function WeightCalculationDisplay({
  weightPerUnit,
  weightUnit = "kg",
  quantity,
  unit = "pcs",
  variant = "inline",
  showIcon = true,
}: WeightCalculationDisplayProps) {
  const calculation = useMemo(() => {
    return calculateWeight(weightPerUnit, quantity, weightUnit || "kg");
  }, [weightPerUnit, quantity, weightUnit]);

  if (!calculation) return null;

  if (variant === "chip") {
    return (
      <Tooltip
        title={`${calculation.weightPerUnit} ${calculation.weightUnit}/${unit}`}
      >
        <Chip
          size="small"
          icon={showIcon ? <ScaleIcon /> : undefined}
          label={`${formatWeight(calculation.totalWeight)} ${calculation.weightUnit}`}
          variant="outlined"
          color="info"
        />
      </Tooltip>
    );
  }

  if (variant === "full") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {showIcon && <ScaleIcon fontSize="small" color="action" />}
        <Box>
          <Typography variant="body2">
            {quantity.toLocaleString("en-IN")} {unit} ={" "}
            {formatWeight(calculation.totalWeight)} {calculation.weightUnit}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({calculation.weightPerUnit} {calculation.weightUnit}/{unit})
          </Typography>
        </Box>
      </Box>
    );
  }

  // Default: inline - with tooltip indicating weight is approximate
  return (
    <Tooltip title="Approximate - actual weight may vary by ±5% based on brand/batch">
      <Typography
        component="span"
        variant="caption"
        color="text.secondary"
        sx={{ ml: 0.5, cursor: "help" }}
      >
        (~{formatWeight(calculation.totalWeight)} {calculation.weightUnit})
      </Typography>
    </Tooltip>
  );
}
