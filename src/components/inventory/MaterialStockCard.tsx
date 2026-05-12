"use client";

import React, { useState } from "react";
import { Box, Typography, Button, Chip, alpha, useTheme } from "@mui/material";
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
  const theme = useTheme();
  const [imgFailed, setImgFailed] = useState(false);

  const pct =
    item.total_purchased > 0
      ? item.total_available_qty / item.total_purchased
      : 0;
  const color = getProgressColor(pct);
  const used = Math.max(0, item.total_purchased - item.total_available_qty);

  return (
    <Box
      sx={{
        background: "#fff",
        borderRadius: 3,
        overflow: "hidden",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.15s, transform 0.1s",
        "&:hover": {
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          transform: "translateY(-1px)",
        },
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Banner image (4:3 aspect via padding-top trick) */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          pt: "75%",
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {item.image_url && !imgFailed ? (
            <Box
              component="img"
              src={item.image_url}
              alt={item.material_name}
              loading="lazy"
              onError={() => setImgFailed(true)}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <EntityImageAvatar
              src={null}
              name={item.material_name}
              size={72}
              fallbackIcon={<InventoryIcon />}
              tint="primary"
            />
          )}
        </Box>

        {isLowStock && (
          <Chip
            label="Low"
            size="small"
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              height: 22,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: "#ffebee",
              color: "#c62828",
              border: "1px solid #ef9a9a",
            }}
          />
        )}
      </Box>

      {/* Details */}
      <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {item.material_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {[item.material_code, item.unit].filter(Boolean).join(" · ")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Typography variant="subtitle1" fontWeight={800} sx={{ color, lineHeight: 1.1 }}>
            {item.total_available_qty} {item.unit}
          </Typography>
          {item.total_purchased > 0 && (
            <Typography variant="caption" color="text.secondary">
              of {item.total_purchased}
            </Typography>
          )}
        </Box>

        <Box sx={{ bgcolor: "#f0f0f0", borderRadius: 1, height: 6, overflow: "hidden" }}>
          <Box
            sx={{
              width: `${Math.min(100, Math.round(pct * 100))}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${color}bb, ${color})`,
              borderRadius: 1,
            }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" noWrap>
          Used: {used} {item.unit}
          {item.weighted_avg_cost > 0 && (
            <>
              {" · ₹"}
              {item.weighted_avg_cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              /{item.unit}
            </>
          )}
        </Typography>

        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon />}
          onClick={(e) => {
            e.stopPropagation();
            onRecordUsage(item);
          }}
          sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 11, py: 0.75, mt: 0.25 }}
        >
          Record Usage
        </Button>
      </Box>
    </Box>
  );
}
