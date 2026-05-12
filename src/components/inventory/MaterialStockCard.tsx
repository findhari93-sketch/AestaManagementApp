"use client";

import React from "react";
import { Box, Typography, Button, Chip } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import InventoryIcon from "@mui/icons-material/Inventory";
import { EntityImageAvatar } from "@/components/common/EntityImageAvatar";
import type { ConsolidatedStockItem } from "@/lib/utils/fifoAllocator";

export function getProgressColor(pct: number): string {
  if (pct < 0.2) return "#f44336";
  if (pct < 0.5) return "#ff9800";
  return "#4caf50";
}

interface Props {
  item: ConsolidatedStockItem;
  isLowStock: boolean;
  onRecordUsage: (item: ConsolidatedStockItem) => void;
}

export function MaterialStockCard({ item, isLowStock, onRecordUsage }: Props) {
  const pct =
    item.total_purchased > 0
      ? item.total_available_qty / item.total_purchased
      : 0;
  const color = getProgressColor(pct);
  const used = item.total_purchased - item.total_available_qty;
  const stockType =
    item.has_shared_batches && item.has_own_batches
      ? "mixed"
      : item.has_shared_batches
      ? "shared"
      : "own";

  return (
    <Box
      sx={{
        background: "#fff",
        borderRadius: 3,
        p: 1.5,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.15s, transform 0.1s",
        "&:hover": {
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          transform: "translateY(-1px)",
        },
      }}
    >
      {/* Header row */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
        <EntityImageAvatar
          src={null}
          name={item.material_name}
          size={36}
          radius={8}
          fallbackIcon={<InventoryIcon />}
          tint="primary"
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {item.material_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {[item.material_code, item.unit].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
      </Box>

      {/* Badges */}
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
        {stockType === "shared" && (
          <Chip
            label="Shared"
            size="small"
            sx={{ height: 18, fontSize: 9, bgcolor: "#e3f2fd", color: "#1565c0" }}
          />
        )}
        {stockType === "own" && (
          <Chip
            label="Own"
            size="small"
            sx={{ height: 18, fontSize: 9, bgcolor: "#e8f5e9", color: "#2e7d32" }}
          />
        )}
        {stockType === "mixed" && (
          <Chip
            label="Mixed"
            size="small"
            sx={{ height: 18, fontSize: 9, bgcolor: "#fff8e1", color: "#f57f17" }}
          />
        )}
        {isLowStock && (
          <Chip
            label="Low"
            size="small"
            sx={{ height: 18, fontSize: 9, bgcolor: "#ffebee", color: "#c62828" }}
          />
        )}
      </Box>

      {/* Available qty */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          mb: 0.5,
        }}
      >
        <Typography variant="h6" fontWeight={800} sx={{ color, lineHeight: 1 }}>
          {item.total_available_qty} {item.unit}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          of {item.total_purchased}
        </Typography>
      </Box>

      {/* Progress bar */}
      <Box
        sx={{
          bgcolor: "#f0f0f0",
          borderRadius: 1,
          height: 6,
          overflow: "hidden",
          mb: 0.5,
        }}
      >
        <Box
          sx={{
            width: `${Math.min(100, Math.round(pct * 100))}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}bb, ${color})`,
            borderRadius: 1,
          }}
        />
      </Box>

      {/* Meta */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Used: {used} {item.unit}
        </Typography>
        {item.weighted_avg_cost > 0 && (
          <Typography variant="caption" color="text.secondary">
            ₹
            {item.weighted_avg_cost.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
            /{item.unit}
          </Typography>
        )}
      </Box>

      {/* Record button */}
      <Button
        fullWidth
        variant="contained"
        size="small"
        startIcon={<PlayArrowIcon />}
        onClick={(e) => {
          e.stopPropagation();
          onRecordUsage(item);
        }}
        sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 11, py: 0.75 }}
      >
        Record Usage
      </Button>
    </Box>
  );
}
