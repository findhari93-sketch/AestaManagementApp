"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Alert,
  Tabs,
  Tab,
  Skeleton,
} from "@mui/material";
import {
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import { useSite } from "@/contexts/SiteContext";
import PageHeader from "@/components/layout/PageHeader";
import { createClient } from "@/lib/supabase/client";
import PayerReport from "@/components/reports/PayerReport";

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

export default function SiteReportsPage() {
  const { selectedSite } = useSite();
  const supabase = createClient();

  const [tabValue, setTabValue] = useState(0);
  const [hasMultiplePayers, setHasMultiplePayers] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSiteSettings = async () => {
      if (!selectedSite) {
        setLoading(false);
        return;
      }

      try {
        // Note: Using type assertion until migration is run and types regenerated
        const { data } = await supabase
          .from("sites")
          .select("*")
          .eq("id", selectedSite.id)
          .single();

        setHasMultiplePayers((data as any)?.has_multiple_payers || false);
      } catch (err) {
        console.error("Error fetching site settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSiteSettings();
  }, [selectedSite]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Site Reports" />
        <Alert severity="warning">Please select a site</Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box>
        <PageHeader title="Site Reports" subtitle={selectedSite.name} />
        <Skeleton variant="rounded" height={48} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={400} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Site Reports"
        subtitle={`Reports and analytics for ${selectedSite.name}`}
      />

      <Paper sx={{ mb: 2 }}>
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
            icon={<AssessmentIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Overview"
          />
          {hasMultiplePayers && (
            <Tab
              icon={<PeopleIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Payer Report"
            />
          )}
        </Tabs>
      </Paper>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
          <TrendingUpIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Site Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Coming soon: Monthly expense summaries, labor cost trends, material usage analytics, and attendance reports.
          </Typography>
          {!hasMultiplePayers && (
            <Alert severity="info" sx={{ mt: 2, textAlign: "left" }}>
              <strong>Tip:</strong> Enable &quot;Multiple Payers Mode&quot; in Site Settings → Payers to track who pays for each expense and see detailed payer reports.
            </Alert>
          )}
        </Paper>
      </TabPanel>

      {/* Payer Report Tab */}
      {hasMultiplePayers && (
        <TabPanel value={tabValue} index={1}>
          <PayerReport siteId={selectedSite.id} />
        </TabPanel>
      )}
    </Box>
  );
}
