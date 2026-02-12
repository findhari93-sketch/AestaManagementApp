"use client";

import React, { useState } from "react";
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  EventBusy as AttendanceIcon,
  CheckCircle as CheckIcon,
  Circle as UnreadIcon,
  AccountBalanceWallet as PaymentIcon,
  TaskAlt as SettlementCompletedIcon,
} from "@mui/icons-material";
import { useNotifications, Notification } from "@/contexts/NotificationContext";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    handleNotificationClick,
  } = useNotifications();

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationItemClick = (notification: Notification) => {
    handleNotificationClick(notification);
    handleClose();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "attendance_reminder":
        return <AttendanceIcon color="warning" />;
      case "payment_settlement_pending":
        return <PaymentIcon color="warning" />;
      case "payment_settlement_completed":
        return <SettlementCompletedIcon color="success" />;
      default:
        return <NotificationsIcon color="action" />;
    }
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{
          color: "text.secondary",
          mr: { xs: 0.5, sm: 1 },
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          sx={{
            "& .MuiBadge-badge": {
              fontSize: "0.65rem",
              minWidth: 18,
              height: 18,
            },
          }}
        >
          {unreadCount > 0 ? (
            <NotificationsActiveIcon
              sx={{
                color: "warning.main",
                animation: unreadCount > 0 ? "pulse 2s infinite" : "none",
                "@keyframes pulse": {
                  "0%": { transform: "scale(1)" },
                  "50%": { transform: "scale(1.1)" },
                  "100%": { transform: "scale(1)" },
                },
              }}
            />
          ) : (
            <NotificationsIcon />
          )}
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: {
            width: { xs: 320, sm: 380 },
            maxHeight: 480,
            borderRadius: 2,
            mt: 1,
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <NotificationsIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                color="error"
                sx={{ height: 22, fontSize: "0.75rem" }}
              />
            )}
          </Box>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={markAllAsRead}
              startIcon={<CheckIcon />}
              sx={{ textTransform: "none" }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* Content */}
        {loading ? (
          <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={32} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <NotificationsIcon
              sx={{ fontSize: 48, color: "grey.300", mb: 1 }}
            />
            <Typography color="text.secondary">No notifications yet</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 360, overflow: "auto" }}>
            {notifications.slice(0, 20).map((notification, index) => (
              <React.Fragment key={notification.id}>
                {index > 0 && <Divider />}
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNotificationItemClick(notification)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      bgcolor: notification.is_read ? "transparent" : "primary.50",
                      "&:hover": {
                        bgcolor: notification.is_read ? "grey.100" : "primary.100",
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getNotificationIcon(notification.notification_type)}
                    </ListItemIcon>
                    <ListItemText
                      primaryTypographyProps={{ component: "div" }}
                      secondaryTypographyProps={{ component: "div" }}
                      primary={
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight={notification.is_read ? 400 : 600}
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                            }}
                          >
                            {notification.title}
                          </Typography>
                          {!notification.is_read && (
                            <UnreadIcon
                              sx={{
                                fontSize: 8,
                                color: "primary.main",
                              }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {notification.message}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ display: "block", mt: 0.5 }}
                          >
                            {dayjs(notification.created_at).fromNow()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Footer */}
        {notifications.length > 20 && (
          <Box
            sx={{
              p: 1.5,
              borderTop: 1,
              borderColor: "divider",
              textAlign: "center",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Showing latest 20 notifications
            </Typography>
          </Box>
        )}
      </Popover>
    </>
  );
}
