"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  TextField,
  Button,
  Avatar,
  Divider,
  Switch,
  FormControlLabel,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
} from "@mui/material";
import {
  Person,
  Email,
  Phone,
  Badge,
  Security,
  Notifications,
  Palette,
  Save,
  Logout as LogoutIcon,
  AdminPanelSettings,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { userProfile, signOut } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    darkMode: false,
  });

  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        name: userProfile.name || "",
        phone: userProfile.phone || "",
      });
    }
  }, [userProfile]);

  const handleUpdateProfile = async () => {
    if (!userProfile) return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const { error } = await (supabase.from("users") as any)
        .update({
          name: profileForm.name,
          phone: profileForm.phone,
        })
        .eq("id", userProfile.id);

      if (error) throw error;

      setSuccess("Profile updated successfully");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      setSuccess("Password changed successfully");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const getRoleColor = (role: string): any => {
    const colorMap: Record<string, any> = {
      admin: "error",
      office: "primary",
      site_engineer: "success",
    };
    return colorMap[role] || "default";
  };

  const getRoleLabel = (role: string) => {
    const labelMap: Record<string, string> = {
      admin: "Administrator",
      office: "Office Staff",
      site_engineer: "Site Engineer",
    };
    return labelMap[role] || role;
  };

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences"
        showBack
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ textAlign: "center", py: 4 }}>
              <Avatar
                sx={{
                  width: 100,
                  height: 100,
                  mx: "auto",
                  mb: 2,
                  bgcolor: "primary.main",
                  fontSize: 40,
                }}
              >
                {userProfile?.name?.charAt(0).toUpperCase() || "U"}
              </Avatar>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                {userProfile?.name || "User"}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {userProfile?.email}
              </Typography>
              <Chip
                label={getRoleLabel(userProfile?.role || "")}
                color={getRoleColor(userProfile?.role || "")}
                size="small"
                icon={<AdminPanelSettings />}
                sx={{ mt: 1 }}
              />
            </CardContent>
            <Divider />
            <CardContent>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Email fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Email"
                    secondary={userProfile?.email}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Phone fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Phone"
                    secondary={userProfile?.phone || "Not set"}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Badge fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Role"
                    secondary={getRoleLabel(userProfile?.role || "")}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Settings Forms */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Profile Settings */}
          <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
              <Person color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Profile Information
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, name: e.target.value })
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, phone: e.target.value })
                  }
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Email"
                  value={userProfile?.email || ""}
                  disabled
                  helperText="Email cannot be changed"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleUpdateProfile}
                  disabled={loading}
                >
                  Save Changes
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Security Settings */}
          <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
              <Security color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Change Password
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  type="password"
                  label="Current Password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="password"
                  label="New Password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm New Password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Button
                  variant="outlined"
                  onClick={handleChangePassword}
                  disabled={loading || !passwordForm.newPassword}
                >
                  Update Password
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Preferences */}
          <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
              <Palette color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Preferences
              </Typography>
            </Box>
            <List>
              <ListItem>
                <ListItemIcon>
                  <Notifications />
                </ListItemIcon>
                <ListItemText
                  primary="Email Notifications"
                  secondary="Receive email notifications for important updates"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.emailNotifications}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        emailNotifications: e.target.checked,
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Palette />
                </ListItemIcon>
                <ListItemText
                  primary="Dark Mode"
                  secondary="Use dark theme (Coming soon)"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.darkMode}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        darkMode: e.target.checked,
                      })
                    }
                    disabled
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>

          {/* Logout */}
          <Paper sx={{ p: 3, borderRadius: 3, bgcolor: "error.light" }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Sign Out
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sign out of your account on this device
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="error"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
              >
                Sign Out
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
