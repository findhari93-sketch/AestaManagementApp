"use client";

import React, { useState } from "react";
import { Box, Typography, Chip } from "@mui/material";
import { MaterialStockCard } from "./MaterialStockCard";
import {
  CATEGORY_TAB_MAPPING,
  CATEGORY_TABS,
  CATEGORY_COLORS,
  type CategoryTabId,
} from "@/lib/constants/materialCategories";
import type { ConsolidatedStockItem } from "@/lib/utils/fifoAllocator";

/** Filter items to only those matching a category tab (by material_code prefix) */
export function filterByCategory(
  items: ConsolidatedStockItem[],
  category: CategoryTabId,
): ConsolidatedStockItem[] {
  if (category === "all") return items;
  const codes = CATEGORY_TAB_MAPPING[category] ?? [];
  return items.filter(
    (item) => item.material_code && codes.some((c) => item.material_code!.startsWith(c)),
  );
}

/** Group items by category tab key. Items with no matching category go under 'general'. */
export function groupByCategory(
  items: ConsolidatedStockItem[],
): Record<string, ConsolidatedStockItem[]> {
  const groups: Record<string, ConsolidatedStockItem[]> = {};

  for (const item of items) {
    let placed = false;
    for (const [tabId, codes] of Object.entries(CATEGORY_TAB_MAPPING)) {
      if (tabId === "all") continue;
      if (item.material_code && codes.some((c) => item.material_code!.startsWith(c))) {
        groups[tabId] = [...(groups[tabId] ?? []), item];
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.general = [...(groups.general ?? []), item];
    }
  }

  return groups;
}

interface Props {
  items: ConsolidatedStockItem[];
  lowStockIds: Set<string>;
  onRecordUsage: (item: ConsolidatedStockItem) => void;
}

export function InventoryCardGrid({ items, lowStockIds, onRecordUsage }: Props) {
  const [activeCategory, setActiveCategory] = useState<CategoryTabId>("all");

  const filtered = filterByCategory(items, activeCategory);

  // Build chip list — only show categories that have stock
  const chipTabs = CATEGORY_TABS.filter((tab) => {
    if (tab.id === "all") return true;
    return filterByCategory(items, tab.id as CategoryTabId).length > 0;
  });

  // When showing "All", group into sections
  const groups = activeCategory === "all" ? groupByCategory(filtered) : null;

  const categoryOrder = [
    ...CATEGORY_TABS.map((t) => t.id).filter((id) => id !== "all"),
    "general",
  ];

  return (
    <Box>
      {/* Category chips */}
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "nowrap", overflowX: "auto", mb: 2, pb: 0.5 }}>
        {chipTabs.map((tab) => {
          const count = filterByCategory(items, tab.id as CategoryTabId).length;
          const isActive = activeCategory === tab.id;
          return (
            <Chip
              key={tab.id}
              label={`${tab.icon} ${tab.label} ${count}`}
              onClick={() => setActiveCategory(tab.id as CategoryTabId)}
              sx={{
                fontWeight: 600,
                fontSize: 11,
                bgcolor: isActive ? "#1565c0" : "#fff",
                color: isActive ? "#fff" : "#555",
                border: isActive ? "1.5px solid #1565c0" : "1.5px solid #e0e0e0",
                "&:hover": { bgcolor: isActive ? "#1565c0" : "#f5f5f5" },
              }}
            />
          );
        })}
      </Box>

      {/* Grouped sections (All view) */}
      {groups
        ? categoryOrder
            .filter((key) => groups[key]?.length)
            .map((key) => {
              const tabMeta = CATEGORY_TABS.find((t) => t.id === key);
              const clr = CATEGORY_COLORS[key] ?? CATEGORY_COLORS.general;
              const sectionItems = groups[key];
              const lowCount = sectionItems.filter((i) => lowStockIds.has(i.material_id)).length;

              return (
                <Box key={key} mb={2.5}>
                  {/* Section header */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      bgcolor: clr.bg,
                      color: clr.color,
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.75,
                      mb: 1.25,
                    }}
                  >
                    <Typography sx={{ fontSize: 16 }}>{tabMeta?.icon ?? "📦"}</Typography>
                    <Typography variant="body2" fontWeight={800}>
                      {tabMeta?.label ?? "General"}
                    </Typography>
                    <Typography variant="caption" fontWeight={600} sx={{ opacity: 0.65 }}>
                      · {sectionItems.length} items
                    </Typography>
                    {lowCount > 0 && (
                      <Chip
                        label={`⚠️ ${lowCount} low`}
                        size="small"
                        sx={{ ml: "auto", height: 20, fontSize: 10, fontWeight: 700, bgcolor: "#ffebee", color: "#c62828" }}
                      />
                    )}
                  </Box>

                  {/* Card grid */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
                      gap: 1.25,
                    }}
                  >
                    {sectionItems.map((item) => (
                      <MaterialStockCard
                        key={item.key}
                        item={item}
                        isLowStock={lowStockIds.has(item.material_id)}
                        onRecordUsage={onRecordUsage}
                      />
                    ))}
                  </Box>
                </Box>
              );
            })
        : /* Single-category view — no section headers */
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
              gap: 1.25,
            }}
          >
            {filtered.map((item) => (
              <MaterialStockCard
                key={item.key}
                item={item}
                isLowStock={lowStockIds.has(item.material_id)}
                onRecordUsage={onRecordUsage}
              />
            ))}
          </Box>
      }

      {filtered.length === 0 && (
        <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
          <Typography variant="body2">No materials in this category</Typography>
        </Box>
      )}
    </Box>
  );
}
