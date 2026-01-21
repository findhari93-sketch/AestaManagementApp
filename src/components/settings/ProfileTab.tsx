"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
  Chip,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Person as PersonIcon,
  Save as SaveIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import AvatarUploader from "@/components/profile/AvatarUploader";
import type { Database } from "@/types/database.types";

type User = Database["public"]["Tables"]["users"]["Row"];

interface ProfileTabProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function ProfileTab({ onSuccess, onError }: ProfileTabProps) {
  const { userProfile, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    display_name: "",
    phone: "",
    job_title: "",
  });

  const supabase = createClient();

  // Initialize form with user data
  useEffect(() => {
    if (userProfile) {
      setForm({
        name: userProfile.name || "",
        display_name: userProfile.display_name || "",
        phone: userProfile.phone || "",
        job_title: userProfile.job_title || "",
      });
    }
  }, [userProfile]);

  // Calculate profile completeness
  const calculateCompleteness = (): number => {
    if (!userProfile) return 0;
    const fields = [
      userProfile.name,
      userProfile.display_name,
      userProfile.phone,
      userProfile.avatar_url,
      userProfile.job_title,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  };

  const completeness = calculateCompleteness();

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!userProfile) return;

    setLoading(true);
    try {
      const { error } = await (supabase.from("users") as any)
        .update({
          name: form.name,
          display_name: form.display_name || null,
          phone: form.phone || null,
          job_title: form.job_title || null,
        })
        .eq("id", userProfile.id);

      if (error) throw error;

      await refreshUserProfile();
      onSuccess?.("Profile updated successfully");
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (url: string) => {
    if (!userProfile) return;

    try {
      const { error } = await (supabase.from("users") as any)
        .update({ avatar_url: url })
        .eq("id", userProfile.id);

      if (error) throw error;

      await refreshUserProfile();
      onSuccess?.("Profile photo updated");
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to update avatar");
    }
  };

  const handleAvatarRemove = async () => {
    if (!userProfile) return;

    try {
      const { error } = await (supabase.from("users") as any)
        .update({ avatar_url: null })
        .eq("id", userProfile.id);

      if (error) throw error;

      await refreshUserProfile();
      onSuccess?.("Profile photo removed");
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Failed to remove avatar");
    }
  };

  if (!userProfile) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Profile Completeness */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Profile Completeness
          </Typography>
          <Chip
            label={`${completeness}%`}
            size="small"
            color={completeness === 100 ? "success" : "primary"}
            sx={{ ml: 2 }}
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={completeness}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: "grey.200",
            "& .MuiLinearProgress-bar": {
              borderRadius: 4,
            },
          }}
        />
        {completeness < 100 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Complete your profile to help others identify you
          </Typography>
        )}
      </Paper>

      {/* Avatar Section */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ display: "flex", alignItems: "center", mb: 3 }}
        >
          <PersonIcon sx={{ mr: 1 }} />
          Profile Photo
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <AvatarUploader
            currentAvatarUrl={userProfile.avatar_url}
            userId={userProfile.id}
            userName={userProfile.name}
            onUploadSuccess={handleAvatarUpload}
            onUploadError={(error) => onError?.(error)}
            onRemove={userProfile.avatar_url ? handleAvatarRemove : undefined}
            size="large"
            supabase={supabase}
          />
          <Box>
            <Typography variant="body1" fontWeight={500}>
              {userProfile.display_name || userProfile.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click the camera icon to upload a new photo
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Recommended: Square image, at least 200x200px
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Profile Information */}
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ display: "flex", alignItems: "center", mb: 3 }}
        >
          <PersonIcon sx={{ mr: 1 }} />
          Personal Information
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Full Name"
              value={form.name}
              onChange={handleChange("name")}
              required
              helperText="Your legal name"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Display Name"
              value={form.display_name}
              onChange={handleChange("display_name")}
              helperText="How you want to be called (optional)"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Email"
              value={userProfile.email}
              disabled
              InputProps={{
                endAdornment: (
                  <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
                ),
              }}
              helperText="Email cannot be changed"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Phone Number"
              value={form.phone}
              onChange={handleChange("phone")}
              placeholder="+91 98765 43210"
              helperText="Optional contact number"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Job Title"
              value={form.job_title}
              onChange={handleChange("job_title")}
              placeholder="e.g., Site Engineer, Project Manager"
              helperText="Your role in the organization"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Role"
              value={
                userProfile.role === "admin"
                  ? "Administrator"
                  : userProfile.role === "office"
                  ? "Office Staff"
                  : "Site Engineer"
              }
              disabled
              helperText="Contact admin to change role"
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !form.name.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
