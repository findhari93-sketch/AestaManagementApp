"use client";

export const dynamic = "force-dynamic";

import { Box } from "@mui/material";
import PageHeader from "@/components/layout/PageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";

export default function SettingsPage() {
  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences"
        showBack
      />
      <SettingsTabs />
    </Box>
  );
}
