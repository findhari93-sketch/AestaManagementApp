"use client";

import React, { memo, useState } from "react";
import {
  Avatar,
  AvatarGroup,
  Tooltip,
  Box,
  Typography,
  Popover,
  Paper,
  Divider,
} from "@mui/material";
import {
  PersonAdd as CreatedIcon,
  Edit as EditedIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export interface AuditAvatarGroupProps {
  createdByName?: string | null;
  createdByAvatar?: string | null;
  createdAt?: string | null;
  updatedByName?: string | null;
  updatedByAvatar?: string | null;
  updatedAt?: string | null;
  size?: "small" | "medium";
  showTooltip?: boolean;
  compact?: boolean;
  maxAvatars?: number;
}

const getInitials = (name: string | null | undefined): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getAvatarColor = (name: string | null | undefined): string => {
  if (!name) return "#9e9e9e";
  const colors = [
    "#1976d2", "#388e3c", "#d32f2f", "#7b1fa2",
    "#c2185b", "#0097a7", "#f57c00", "#5d4037",
    "#303f9f", "#689f38", "#e64a19", "#512da8",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const AuditAvatarGroup = memo(function AuditAvatarGroup({
  createdByName,
  createdByAvatar,
  createdAt,
  updatedByName,
  updatedByAvatar,
  updatedAt,
  size = "small",
  showTooltip = true,
  compact = false,
  maxAvatars = 2,
}: AuditAvatarGroupProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const avatarSize = size === "small" ? 28 : 36;
  const fontSize = size === "small" ? "0.7rem" : "0.8rem";

  // Determine if there was an update by a different user
  const hasUpdate = updatedAt && updatedByName && updatedByName !== createdByName;
  // Same user edited
  const sameUserEdited = updatedAt && updatedByName && updatedByName === createdByName;

  const formatTime = (timestamp: string | null | undefined) => {
    if (!timestamp) return "";
    return dayjs(timestamp).format("DD MMM YYYY, hh:mm A");
  };

  const formatRelative = (timestamp: string | null | undefined) => {
    if (!timestamp) return "";
    return dayjs(timestamp).fromNow();
  };

  const tooltipContent = (
    <Box sx={{ p: 1.5, minWidth: 220, maxWidth: 280 }}>
      {/* Created info */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Avatar
          src={createdByAvatar || undefined}
          sx={{
            width: 32,
            height: 32,
            bgcolor: getAvatarColor(createdByName),
            fontSize: "0.75rem",
          }}
        >
          {getInitials(createdByName)}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <CreatedIcon sx={{ fontSize: 14, color: "success.main" }} />
            <Typography variant="caption" color="success.main" fontWeight={600}>
              Created
            </Typography>
          </Box>
          <Typography variant="body2" fontWeight={600}>
            {createdByName || "Unknown"}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {createdAt ? formatTime(createdAt) : "Unknown time"}
          </Typography>
          {createdAt && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
              ({formatRelative(createdAt)})
            </Typography>
          )}
        </Box>
      </Box>

      {/* Updated info (if different user or has update) */}
      {(hasUpdate || sameUserEdited) && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Avatar
              src={updatedByAvatar || undefined}
              sx={{
                width: 32,
                height: 32,
                bgcolor: getAvatarColor(updatedByName),
                fontSize: "0.75rem",
                border: "2px solid",
                borderColor: "warning.main",
              }}
            >
              {getInitials(updatedByName)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <EditedIcon sx={{ fontSize: 14, color: "warning.main" }} />
                <Typography variant="caption" color="warning.main" fontWeight={600}>
                  Last Edited
                </Typography>
              </Box>
              <Typography variant="body2" fontWeight={600}>
                {updatedByName}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {formatTime(updatedAt)}
              </Typography>
              {updatedAt && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                  ({formatRelative(updatedAt)})
                </Typography>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );

  // Compact mode: Single avatar with popover on click
  if (compact) {
    const displayName = hasUpdate ? updatedByName : createdByName;
    const displayAvatar = hasUpdate ? updatedByAvatar : createdByAvatar;
    const isEdited = hasUpdate || sameUserEdited;

    return (
      <>
        <Tooltip title={showTooltip ? tooltipContent : ""} arrow placement="top">
          <Avatar
            src={displayAvatar || undefined}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              width: avatarSize,
              height: avatarSize,
              fontSize,
              bgcolor: getAvatarColor(displayName),
              cursor: "pointer",
              border: isEdited ? "2px solid" : "none",
              borderColor: "warning.main",
              transition: "transform 0.2s",
              "&:hover": {
                transform: "scale(1.1)",
              },
            }}
          >
            {getInitials(displayName)}
          </Avatar>
        </Tooltip>

        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          transformOrigin={{ vertical: "top", horizontal: "center" }}
          slotProps={{
            paper: {
              sx: { mt: 0.5, borderRadius: 2 },
            },
          }}
        >
          <Paper elevation={0}>{tooltipContent}</Paper>
        </Popover>
      </>
    );
  }

  // Standard mode: Avatar group with tooltip
  return (
    <Tooltip title={showTooltip ? tooltipContent : ""} arrow placement="top">
      <AvatarGroup
        max={maxAvatars}
        sx={{
          "& .MuiAvatar-root": {
            width: avatarSize,
            height: avatarSize,
            fontSize,
            border: "2px solid white",
            cursor: "pointer",
          },
        }}
      >
        {/* Creator avatar */}
        <Avatar
          src={createdByAvatar || undefined}
          sx={{ bgcolor: getAvatarColor(createdByName) }}
        >
          {getInitials(createdByName)}
        </Avatar>

        {/* Editor avatar (if different) */}
        {hasUpdate && (
          <Avatar
            src={updatedByAvatar || undefined}
            sx={{
              bgcolor: getAvatarColor(updatedByName),
              border: "2px solid",
              borderColor: "warning.main",
            }}
          >
            {getInitials(updatedByName)}
          </Avatar>
        )}
      </AvatarGroup>
    </Tooltip>
  );
});

export default AuditAvatarGroup;
