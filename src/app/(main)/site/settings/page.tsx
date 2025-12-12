"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Alert,
  Skeleton,
} from "@mui/material";
import { Construction as ConstructionIcon } from "@mui/icons-material";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import SiteSectionsManager from "@/components/site-settings/SiteSectionsManager";
import { createClient } from "@/lib/supabase/client";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export default function SiteSettingsPage() {
  const { selectedSite, refreshSites } = useSite();
  const { userProfile, loading: authLoading } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [defaultSectionId, setDefaultSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const siteId = selectedSite?.id;

  const fetchSiteSettings = useCallback(async () => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      // Note: Using type assertion until migration is run and types regenerated
      const { data } = await supabase
        .from("sites")
        .select("default_section_id")
        .eq("id", siteId)
        .single() as { data: { default_section_id: string | null } | null };

      setDefaultSectionId(data?.default_section_id || null);
    } catch (err) {
      console.error("Error fetching site settings:", err);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchSiteSettings();
  }, [fetchSiteSettings]);

  const handleDefaultChange = async () => {
    await fetchSiteSettings();
    await refreshSites();
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Loading state
  if (authLoading || !userProfile) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Skeleton variant="rounded" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={400} />
      </Box>
    );
  }

  // No site selected
  if (!selectedSite) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <PageHeader title="Site Settings" />
        <Alert severity="info">
          Please select a site from the header to view settings.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Site Settings"
        subtitle={selectedSite.name}
      />

      <Paper sx={{ mt: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": {
              textTransform: "none",
              minHeight: 48,
            },
          }}
        >
          <Tab
            icon={<ConstructionIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Work Sections"
          />
          {/* Future tabs can be added here */}
        </Tabs>

        {/* Work Sections Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ px: { xs: 1, sm: 2 }, pb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Manage work sections for this site. Sections are grouped by
              construction phase and can be set as the default for attendance
              and other forms.
            </Typography>

            {loading ? (
              <Box>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" height={60} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : (
              <SiteSectionsManager
                siteId={siteId || ""}
                defaultSectionId={defaultSectionId}
                onDefaultChange={handleDefaultChange}
              />
            )}
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}

export const dynamic = "force-dynamic";
