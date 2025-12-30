"use client";

import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  CircularProgress,
} from "@mui/material";
import {
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  Info as InfoIcon,
  Badge as BadgeIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  Warning as WarningIcon,
  Cached as CachedIcon,
  Build as BuildIcon,
} from "@mui/icons-material";
import { forceResetAllCache } from "@/lib/cache/persistor";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface AccountTabProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function AccountTab({ onSuccess, onError }: AccountTabProps) {
  const { userProfile, signOut } = useAuth();
  const router = useRouter();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to sign out");
    } finally {
      setLoading(false);
      setShowLogoutDialog(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const success = await forceResetAllCache();
      if (success) {
        onSuccess?.("Cache cleared successfully. Reloading page...");
        // Reload the page to apply changes
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        onError?.("Failed to clear cache. Please try again.");
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to clear cache");
    } finally {
      setClearingCache(false);
      setShowClearCacheDialog(false);
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      dateStyle: "medium",
    });
  };

  // Get role display name and color
  const getRoleInfo = (role: string) => {
    switch (role) {
      case "admin":
        return { label: "Administrator", color: "error" as const };
      case "office":
        return { label: "Office Staff", color: "primary" as const };
      case "site_engineer":
        return { label: "Site Engineer", color: "secondary" as const };
      default:
        return { label: role, color: "default" as const };
    }
  };

  const roleInfo = userProfile ? getRoleInfo(userProfile.role) : null;

  return (
    <Box>
      {/* Account Information */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ display: "flex", alignItems: "center", mb: 3 }}
        >
          <AccountIcon sx={{ mr: 1 }} />
          Account Information
        </Typography>

        <List disablePadding>
          <ListItem disablePadding sx={{ py: 1 }}>
            <ListItemIcon>
              <EmailIcon color="action" />
            </ListItemIcon>
            <ListItemText
              primary="Email Address"
              secondary={userProfile?.email || "N/A"}
            />
          </ListItem>

          <Divider component="li" />

          <ListItem disablePadding sx={{ py: 1 }}>
            <ListItemIcon>
              <BadgeIcon color="action" />
            </ListItemIcon>
            <ListItemText
              primary="Account Role"
              secondary={
                roleInfo && (
                  <Chip
                    label={roleInfo.label}
                    color={roleInfo.color}
                    size="small"
                    sx={{ mt: 0.5 }}
                  />
                )
              }
              secondaryTypographyProps={{ component: "div" }}
            />
          </ListItem>

          <Divider component="li" />

          <ListItem disablePadding sx={{ py: 1 }}>
            <ListItemIcon>
              <InfoIcon color="action" />
            </ListItemIcon>
            <ListItemText
              primary="Account Status"
              secondary={
                <Chip
                  label={userProfile?.status === "active" ? "Active" : "Inactive"}
                  color={userProfile?.status === "active" ? "success" : "default"}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              }
              secondaryTypographyProps={{ component: "div" }}
            />
          </ListItem>

          <Divider component="li" />

          <ListItem disablePadding sx={{ py: 1 }}>
            <ListItemIcon>
              <CalendarIcon color="action" />
            </ListItemIcon>
            <ListItemText
              primary="Member Since"
              secondary={formatDate(userProfile?.created_at || null)}
            />
          </ListItem>
        </List>
      </Paper>

      {/* Assigned Sites (for non-admin users) */}
      {userProfile?.role !== "admin" && userProfile?.assigned_sites && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography
            variant="h6"
            fontWeight={600}
            sx={{ display: "flex", alignItems: "center", mb: 2 }}
          >
            <InfoIcon sx={{ mr: 1 }} />
            Assigned Sites
          </Typography>

          {userProfile.assigned_sites.length > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {userProfile.assigned_sites.map((siteId: string, index: number) => (
                <Chip key={index} label={`Site ${index + 1}`} size="small" />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              You have access to all sites
            </Typography>
          )}
        </Paper>
      )}

      {/* Sign Out */}
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ display: "flex", alignItems: "center", mb: 2 }}
        >
          <LogoutIcon sx={{ mr: 1 }} />
          Session
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sign out from your account on this device. You will need to sign in again to access your account.
        </Typography>

        <Button
          variant="outlined"
          color="error"
          onClick={() => setShowLogoutDialog(true)}
          startIcon={<LogoutIcon />}
        >
          Sign Out
        </Button>
      </Paper>

      {/* Troubleshooting */}
      <Paper sx={{ p: 3, mt: 3, borderRadius: 3 }}>
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ display: "flex", alignItems: "center", mb: 2 }}
        >
          <BuildIcon sx={{ mr: 1 }} />
          Troubleshooting
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          If you are experiencing issues like frozen screens, data not loading, or operations getting stuck,
          try clearing the local cache. This will remove locally stored data and refresh the application.
        </Typography>

        <Button
          variant="outlined"
          color="primary"
          onClick={() => setShowClearCacheDialog(true)}
          startIcon={<CachedIcon />}
        >
          Clear Local Cache
        </Button>
      </Paper>

      {/* Danger Zone */}
      <Paper
        sx={{
          p: 3,
          mt: 3,
          borderRadius: 3,
          border: 1,
          borderColor: "error.light",
          bgcolor: "error.50",
        }}
      >
        <Typography
          variant="h6"
          fontWeight={600}
          color="error.dark"
          sx={{ display: "flex", alignItems: "center", mb: 2 }}
        >
          <WarningIcon sx={{ mr: 1 }} />
          Danger Zone
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          These actions are irreversible. Please contact an administrator if you need to delete your account or export your data.
        </Typography>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Button variant="outlined" color="error" disabled>
            Export Data (Coming Soon)
          </Button>
          <Button variant="outlined" color="error" disabled>
            Delete Account (Contact Admin)
          </Button>
        </Box>
      </Paper>

      {/* Sign Out Confirmation Dialog */}
      <Dialog
        open={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Sign Out?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to sign out? You will need to sign in again to access your account.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLogoutDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSignOut}
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <LogoutIcon />}
          >
            {loading ? "Signing Out..." : "Sign Out"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clear Cache Confirmation Dialog */}
      <Dialog
        open={showClearCacheDialog}
        onClose={() => setShowClearCacheDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear Local Cache?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will clear all locally cached data including session storage and cached queries.
            The page will reload after clearing. You will remain logged in.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearCacheDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleClearCache}
            color="primary"
            variant="contained"
            disabled={clearingCache}
            startIcon={clearingCache ? <CircularProgress size={20} /> : <CachedIcon />}
          >
            {clearingCache ? "Clearing..." : "Clear Cache"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
