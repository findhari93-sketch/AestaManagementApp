"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  TextField,
  Autocomplete,
  Button,
  InputAdornment,
  Grid,
  Paper,
  Chip,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  LocationOn as LocationIcon,
  AutoAwesome as AutoIcon,
  People as PeopleIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

type Site = Database["public"]["Tables"]["sites"]["Row"];

interface MultiSiteSplitSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  primarySite: Site;
  secondarySite: Site | null;
  onSecondarySiteChange: (site: Site | null) => void;
  primaryPercent: number;
  secondaryPercent: number;
  onPercentChange: (primary: number, secondary: number) => void;
  totalCost: number;
  availableSites: Site[];
  date: string;
}

export default function MultiSiteSplitSection({
  enabled,
  onEnabledChange,
  primarySite,
  secondarySite,
  onSecondarySiteChange,
  primaryPercent,
  secondaryPercent,
  onPercentChange,
  totalCost,
  availableSites,
  date,
}: MultiSiteSplitSectionProps) {
  const [primaryLaborerCount, setPrimaryLaborerCount] = useState<number>(0);
  const [secondaryLaborerCount, setSecondaryLaborerCount] = useState<number>(0);
  const [loadingCounts, setLoadingCounts] = useState(false);

  const supabase = createClient();

  // Fetch laborer counts for both sites when secondary site is selected
  useEffect(() => {
    const fetchLaborerCounts = async () => {
      if (!secondarySite || !date) return;

      setLoadingCounts(true);
      try {
        // Fetch primary site attendance count
        const { data: primaryData } = await supabase
          .from("daily_attendance")
          .select("id", { count: "exact" })
          .eq("site_id", primarySite.id)
          .eq("date", date)
          .eq("is_deleted", false);

        // Fetch market laborers for primary site
        const { data: primaryMarket } = await supabase
          .from("market_laborer_attendance")
          .select("count")
          .eq("site_id", primarySite.id)
          .eq("date", date)
          .eq("is_deleted", false);

        const primaryMarketCount = primaryMarket?.reduce(
          (sum, m) => sum + (m.count || 0),
          0
        ) || 0;
        setPrimaryLaborerCount((primaryData?.length || 0) + primaryMarketCount);

        // Fetch secondary site attendance count
        const { data: secondaryData } = await supabase
          .from("daily_attendance")
          .select("id", { count: "exact" })
          .eq("site_id", secondarySite.id)
          .eq("date", date)
          .eq("is_deleted", false);

        // Fetch market laborers for secondary site
        const { data: secondaryMarket } = await supabase
          .from("market_laborer_attendance")
          .select("count")
          .eq("site_id", secondarySite.id)
          .eq("date", date)
          .eq("is_deleted", false);

        const secondaryMarketCount = secondaryMarket?.reduce(
          (sum, m) => sum + (m.count || 0),
          0
        ) || 0;
        setSecondaryLaborerCount(
          (secondaryData?.length || 0) + secondaryMarketCount
        );
      } catch (error) {
        console.error("Error fetching laborer counts:", error);
      } finally {
        setLoadingCounts(false);
      }
    };

    fetchLaborerCounts();
  }, [secondarySite, date, primarySite.id, supabase]);

  const handleAutoSuggest = () => {
    const total = primaryLaborerCount + secondaryLaborerCount;
    if (total === 0) {
      // Default 50/50 if no attendance data
      onPercentChange(50, 50);
      return;
    }

    const primaryPct = Math.round((primaryLaborerCount / total) * 100);
    const secondaryPct = 100 - primaryPct;
    onPercentChange(primaryPct, secondaryPct);
  };

  const handlePrimaryChange = (value: string) => {
    const primary = Math.max(0, Math.min(100, parseInt(value) || 0));
    onPercentChange(primary, 100 - primary);
  };

  const handleSecondaryChange = (value: string) => {
    const secondary = Math.max(0, Math.min(100, parseInt(value) || 0));
    onPercentChange(100 - secondary, secondary);
  };

  const calculateAmount = (percentage: number): string => {
    if (totalCost <= 0) return "₹0";
    return `₹${Math.round((percentage / 100) * totalCost).toLocaleString()}`;
  };

  // Filter out the primary site from available sites
  const filteredSites = availableSites.filter(
    (site) => site.id !== primarySite.id
  );

  return (
    <Accordion
      expanded={enabled}
      onChange={(_, expanded) => onEnabledChange(expanded)}
      sx={{
        border: "1px solid",
        borderColor: enabled ? "primary.main" : "divider",
        borderRadius: 1,
        "&:before": { display: "none" },
        boxShadow: "none",
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LocationIcon color={enabled ? "primary" : "action"} />
          <Typography variant="subtitle2">
            Split Across Sites (Optional)
          </Typography>
          {enabled && secondarySite && (
            <Chip
              size="small"
              label={`${primaryPercent}% / ${secondaryPercent}%`}
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Site Selector */}
          <Autocomplete
            options={filteredSites}
            value={secondarySite}
            onChange={(_, site) => onSecondarySiteChange(site)}
            getOptionLabel={(site) => site.name}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Secondary Site"
                size="small"
                placeholder="Choose site to split with..."
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
          />

          {secondarySite && (
            <>
              {/* Auto-suggest Button */}
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutoIcon />}
                onClick={handleAutoSuggest}
                disabled={loadingCounts}
                sx={{ alignSelf: "flex-start" }}
              >
                Auto-Suggest from Laborer Count
              </Button>

              {/* Site Split Cards */}
              <Grid container spacing={2}>
                {/* Primary Site */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderColor: "primary.main",
                      bgcolor: "primary.50",
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 0.5 }}
                    >
                      Primary Site
                    </Typography>
                    <Typography variant="subtitle2" noWrap>
                      {primarySite.name}
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mt: 1,
                      }}
                    >
                      <TextField
                        type="number"
                        size="small"
                        value={primaryPercent}
                        onChange={(e) => handlePrimaryChange(e.target.value)}
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">%</InputAdornment>
                            ),
                            inputProps: { min: 0, max: 100 },
                          },
                        }}
                        sx={{ width: 90 }}
                      />
                      <Typography variant="body2" color="success.main">
                        {calculateAmount(primaryPercent)}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mt: 0.5,
                      }}
                    >
                      <PeopleIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        {loadingCounts ? "..." : `${primaryLaborerCount} laborers`}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                {/* Secondary Site */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderColor: "secondary.main",
                      bgcolor: "secondary.50",
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 0.5 }}
                    >
                      Secondary Site
                    </Typography>
                    <Typography variant="subtitle2" noWrap>
                      {secondarySite.name}
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mt: 1,
                      }}
                    >
                      <TextField
                        type="number"
                        size="small"
                        value={secondaryPercent}
                        onChange={(e) => handleSecondaryChange(e.target.value)}
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">%</InputAdornment>
                            ),
                            inputProps: { min: 0, max: 100 },
                          },
                        }}
                        sx={{ width: 90 }}
                      />
                      <Typography variant="body2" color="success.main">
                        {calculateAmount(secondaryPercent)}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mt: 0.5,
                      }}
                    >
                      <PeopleIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        {loadingCounts ? "..." : `${secondaryLaborerCount} laborers`}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
