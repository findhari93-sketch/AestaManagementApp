"use client";

import { Alert, Avatar, AvatarGroup, Box, Chip, Tooltip } from "@mui/material";
import { Visibility } from "@mui/icons-material";

interface PresenceUser {
  id: string;
  name: string;
  joinedAt: string;
}

interface PresenceIndicatorProps {
  activeUsers: PresenceUser[];
  variant?: "alert" | "chip" | "avatars";
  showIcon?: boolean;
}

export default function PresenceIndicator({
  activeUsers,
  variant = "alert",
  showIcon = true,
}: PresenceIndicatorProps) {
  if (activeUsers.length === 0) {
    return null;
  }

  const userNames = activeUsers.map((u) => u.name);
  const displayText =
    userNames.length === 1
      ? `${userNames[0]} is also viewing this page`
      : userNames.length === 2
      ? `${userNames[0]} and ${userNames[1]} are also viewing this page`
      : `${userNames[0]} and ${userNames.length - 1} others are also viewing this page`;

  if (variant === "chip") {
    return (
      <Tooltip title={userNames.join(", ")}>
        <Chip
          icon={showIcon ? <Visibility fontSize="small" /> : undefined}
          label={`${activeUsers.length} viewing`}
          color="info"
          size="small"
          variant="outlined"
        />
      </Tooltip>
    );
  }

  if (variant === "avatars") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <AvatarGroup max={3} sx={{ "& .MuiAvatar-root": { width: 28, height: 28, fontSize: "0.75rem" } }}>
          {activeUsers.map((user) => (
            <Tooltip key={user.id} title={user.name}>
              <Avatar sx={{ bgcolor: "info.main" }}>
                {user.name.charAt(0).toUpperCase()}
              </Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
        {showIcon && (
          <Tooltip title={displayText}>
            <Visibility fontSize="small" color="info" />
          </Tooltip>
        )}
      </Box>
    );
  }

  // Default: alert variant
  return (
    <Alert
      severity="info"
      icon={showIcon ? <Visibility /> : false}
      sx={{ mb: 2 }}
    >
      {displayText}
    </Alert>
  );
}
