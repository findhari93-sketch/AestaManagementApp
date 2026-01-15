"use client";

import React, { memo } from "react";
import {
  Box,
  Button,
  Divider,
  Popover,
  Typography,
} from "@mui/material";
import { Groups as GroupsIcon } from "@mui/icons-material";
import dayjs from "dayjs";

export interface TeaShopPopoverData {
  teaTotal: number;
  snacksTotal: number;
  total: number;
  workingCount: number;
  workingTotal: number;
  nonWorkingCount: number;
  nonWorkingTotal: number;
  marketCount: number;
  marketTotal: number;
  isGroupEntry?: boolean;
  entryId?: string;
}

interface SiteAllocation {
  site_id: string;
  site?: { name: string };
  allocated_amount: number;
}

interface TeaShopPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  date: string | null;
  data: TeaShopPopoverData | null;
  groupAllocations?: SiteAllocation[] | null;
  onEdit: (date: string, isGroupEntry: boolean, entryId?: string) => void;
}

/**
 * Tea Shop Popover Component
 *
 * Displays tea shop expense details for a date:
 * - Tea and snacks breakdown (for non-group entries)
 * - Consumption by category (working, non-working, market)
 * - Group allocations (for group entries)
 * - Edit button to modify the entry
 */
function TeaShopPopoverComponent({
  anchorEl,
  onClose,
  date,
  data,
  groupAllocations,
  onEdit,
}: TeaShopPopoverProps) {
  if (!date || !data) {
    return null;
  }

  const handleEdit = () => {
    onClose();
    onEdit(date, !!data.isGroupEntry, data.entryId);
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "center",
      }}
    >
      <Box sx={{ p: 2, minWidth: 280 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          {data.isGroupEntry && (
            <GroupsIcon fontSize="small" color="primary" />
          )}
          <Typography variant="subtitle2" fontWeight={700}>
            {data.isGroupEntry ? "Group T&S" : "Tea Shop"}: {dayjs(date).format("DD MMM YYYY")}
          </Typography>
        </Box>

        {data.isGroupEntry && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            This site&apos;s allocated share from group entry
          </Typography>
        )}

        <Divider sx={{ mb: 1.5 }} />

        {!data.isGroupEntry && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2">Tea:</Typography>
              <Typography variant="body2" fontWeight={500}>
                ₹{data.teaTotal.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2">Snacks:</Typography>
              <Typography variant="body2" fontWeight={500}>
                ₹{data.snacksTotal.toLocaleString()}
              </Typography>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.5 }}
            >
              Consumption Breakdown:
            </Typography>

            {data.workingCount > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                <Typography variant="caption">
                  Working ({data.workingCount}):
                </Typography>
                <Typography variant="caption">
                  ₹{data.workingTotal.toLocaleString()}
                </Typography>
              </Box>
            )}

            {data.nonWorkingCount > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                <Typography variant="caption">
                  Non-Working ({data.nonWorkingCount}):
                </Typography>
                <Typography variant="caption">
                  ₹{data.nonWorkingTotal.toLocaleString()}
                </Typography>
              </Box>
            )}

            {data.marketCount > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                <Typography variant="caption">
                  Market ({data.marketCount}):
                </Typography>
                <Typography variant="caption">
                  ₹{data.marketTotal.toLocaleString()}
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 1 }} />
          </>
        )}

        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" fontWeight={700}>
            {data.isGroupEntry ? "Allocated Amount:" : "Total:"}
          </Typography>
          <Typography variant="body2" fontWeight={700} color="primary.main">
            ₹{data.total.toLocaleString()}
          </Typography>
        </Box>

        {/* Show all site allocations for group entries */}
        {data.isGroupEntry && groupAllocations && groupAllocations.length > 0 && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              All Sites:
            </Typography>
            {groupAllocations.map((alloc) => (
              <Box key={alloc.site_id} sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
                <Typography variant="caption">{alloc.site?.name || "Unknown"}</Typography>
                <Typography variant="caption">₹{(alloc.allocated_amount || 0).toLocaleString()}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="caption" fontWeight={600}>Total:</Typography>
              <Typography variant="caption" fontWeight={600} color="success.main">
                ₹{groupAllocations.reduce((sum, a) => sum + (a.allocated_amount || 0), 0).toLocaleString()}
              </Typography>
            </Box>
          </Box>
        )}

        <Button
          fullWidth
          size="small"
          variant="outlined"
          sx={{ mt: 1.5 }}
          onClick={handleEdit}
        >
          Edit
        </Button>
      </Box>
    </Popover>
  );
}

// Memoize to prevent unnecessary re-renders
const TeaShopPopover = memo(TeaShopPopoverComponent);
export default TeaShopPopover;
