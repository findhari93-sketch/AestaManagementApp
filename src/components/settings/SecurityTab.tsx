"use client";

import React, { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Divider,
  Link,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Security as SecurityIcon,
  Visibility,
  VisibilityOff,
  Check as CheckIcon,
  Close as CloseIcon,
  LockReset as LockResetIcon,
  AccessTime as AccessTimeIcon,
} from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface SecurityTabProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const PASSWORD_REQUIREMENTS = [
  { id: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "uppercase", label: "One uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "One lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "One number (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "One special character (!@#$%^&*)", test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export default function SecurityTab({ onSuccess, onError }: SecurityTabProps) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const supabase = createClient();

  // Check password requirements
  const passwordChecks = useMemo(() => {
    return PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      passed: req.test(form.newPassword),
    }));
  }, [form.newPassword]);

  const allRequirementsMet = passwordChecks.every((check) => check.passed);
  const passwordsMatch = form.newPassword === form.confirmPassword && form.confirmPassword.length > 0;

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!allRequirementsMet) {
      onError?.("Password does not meet all requirements");
      return;
    }

    if (!passwordsMatch) {
      onError?.("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: form.newPassword,
      });

      if (error) throw error;

      // Clear form
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      onSuccess?.("Password updated successfully");
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!userProfile?.email) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        userProfile.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      onSuccess?.("Password reset email sent. Check your inbox.");
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  // Format last login date
  const formatLastLogin = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <Box>
      {/* Last Login Info */}
      {userProfile?.last_login_at && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <AccessTimeIcon color="action" />
            <Box>
              <Typography variant="body2" color="text.secondary">
                Last login
              </Typography>
              <Typography variant="body1">
                {formatLastLogin(userProfile.last_login_at)}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Change Password */}
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ display: "flex", alignItems: "center", mb: 3 }}
        >
          <SecurityIcon sx={{ mr: 1 }} />
          Change Password
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Current Password"
              type={showCurrentPassword ? "text" : "password"}
              value={form.currentPassword}
              onChange={handleChange("currentPassword")}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      edge="end"
                    >
                      {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="New Password"
              type={showNewPassword ? "text" : "password"}
              value={form.newPassword}
              onChange={handleChange("newPassword")}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      edge="end"
                    >
                      {showNewPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Password Requirements */}
          {form.newPassword.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Paper
                variant="outlined"
                sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2 }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Password Requirements
                </Typography>
                <List dense disablePadding>
                  {passwordChecks.map((check) => (
                    <ListItem key={check.id} disablePadding sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {check.passed ? (
                          <CheckIcon color="success" fontSize="small" />
                        ) : (
                          <CloseIcon color="error" fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={check.label}
                        primaryTypographyProps={{
                          variant: "body2",
                          color: check.passed ? "success.main" : "text.secondary",
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Confirm New Password"
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={handleChange("confirmPassword")}
              error={form.confirmPassword.length > 0 && !passwordsMatch}
              helperText={
                form.confirmPassword.length > 0 && !passwordsMatch
                  ? "Passwords do not match"
                  : ""
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            component="button"
            variant="body2"
            onClick={handleForgotPassword}
            sx={{ cursor: "pointer" }}
          >
            Forgot your password?
          </Link>

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !allRequirementsMet || !passwordsMatch}
            startIcon={loading ? <CircularProgress size={20} /> : <LockResetIcon />}
          >
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </Box>
      </Paper>

      {/* Security Tips */}
      <Paper sx={{ p: 3, mt: 3, borderRadius: 3, bgcolor: "info.50" }}>
        <Typography variant="subtitle2" gutterBottom color="info.dark">
          Security Tips
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • Use a unique password that you don&apos;t use for other accounts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • Consider using a password manager
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • Never share your password with anyone
        </Typography>
      </Paper>
    </Box>
  );
}
