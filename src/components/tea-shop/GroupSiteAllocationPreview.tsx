"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Paper,
  InputAdornment,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  AutoAwesome as AutoIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { allocateAmounts } from "@/hooks/queries/useGroupTeaShop";

interface SiteAttendanceData {
  siteId: string;
  siteName: string;
  totalCount: number;
  namedLaborerCount: number;
  marketLaborerCount: number;
  percentage: number;
  allocatedAmount: number;
}

interface GroupSiteAllocationPreviewProps {
  sites: SiteAttendanceData[];
  totalAmount: number;
  onAllocationsChange: (allocations: SiteAttendanceData[]) => void;
  loading?: boolean;
  onAutoCalculate?: () => void;
  isOverride: boolean;
  onOverrideChange: (override: boolean) => void;
}

export default function GroupSiteAllocationPreview({
  sites,
  totalAmount,
  onAllocationsChange,
  loading = false,
  onAutoCalculate,
  isOverride,
  onOverrideChange,
}: GroupSiteAllocationPreviewProps) {
  const [localSites, setLocalSites] = useState<SiteAttendanceData[]>(sites);

  // Sync with parent when sites change
  useEffect(() => {
    setLocalSites(sites);
  }, [sites]);

  // Recalculate amounts when totalAmount or percentages change
  useEffect(() => {
    if (localSites.length === 0) return;

    const percentages = localSites.map((s) => s.percentage);
    const amounts = allocateAmounts(totalAmount, percentages);

    const updatedSites = localSites.map((site, index) => ({
      ...site,
      allocatedAmount: amounts[index],
    }));

    // Only update if amounts actually changed
    const amountsChanged = updatedSites.some(
      (s, i) => s.allocatedAmount !== localSites[i].allocatedAmount
    );

    if (amountsChanged) {
      setLocalSites(updatedSites);
      onAllocationsChange(updatedSites);
    }
  }, [totalAmount, localSites.map((s) => s.percentage).join(",")]);

  const handlePercentageChange = (siteId: string, value: string) => {
    const newPercentage = Math.max(0, Math.min(100, parseInt(value) || 0));

    const updatedSites = localSites.map((site) =>
      site.siteId === siteId ? { ...site, percentage: newPercentage } : site
    );

    setLocalSites(updatedSites);
    onAllocationsChange(updatedSites);
  };

  const totalPercentage = localSites.reduce((sum, s) => sum + s.percentage, 0);
  const totalWorkers = localSites.reduce((sum, s) => sum + s.totalCount, 0);
  const totalAllocated = localSites.reduce(
    (sum, s) => sum + s.allocatedAmount,
    0
  );

  const isPercentageValid = totalPercentage === 100;
  const hasNoAttendance = totalWorkers === 0;

  return (
    <Box>
      {/* Header with Override Toggle */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Site Allocation
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {onAutoCalculate && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AutoIcon />}
              onClick={onAutoCalculate}
              disabled={loading}
            >
              Auto-Calculate
            </Button>
          )}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={isOverride}
                onChange={(e) => onOverrideChange(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Override
              </Typography>
            }
          />
        </Box>
      </Box>

      {/* Warning if no attendance */}
      {hasNoAttendance && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No attendance found for any site on this date. Using equal split.
        </Alert>
      )}

      {/* Validation Error */}
      {!isPercentageValid && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Percentages must sum to 100% (currently {totalPercentage}%)
        </Alert>
      )}

      {/* Allocation Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 600 }}>Site</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.5,
                    }}
                  >
                    <PeopleIcon fontSize="small" />
                    Workers
                  </Box>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>
                  %
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Amount
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {localSites.map((site) => (
                <TableRow key={site.siteId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {site.siteName}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {site.totalCount > 0 ? (
                      <Chip
                        size="small"
                        label={`${site.namedLaborerCount}+${site.marketLaborerCount}`}
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: "0.75rem" }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        icon={<WarningIcon fontSize="small" />}
                        label="0"
                        color="warning"
                        variant="outlined"
                        sx={{ fontSize: "0.75rem" }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {isOverride ? (
                      <TextField
                        type="number"
                        size="small"
                        value={site.percentage}
                        onChange={(e) =>
                          handlePercentageChange(site.siteId, e.target.value)
                        }
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">%</InputAdornment>
                            ),
                            inputProps: { min: 0, max: 100, step: 1 },
                          },
                        }}
                        sx={{ width: 80 }}
                      />
                    ) : (
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color="primary"
                      >
                        {site.percentage}%
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color="success.main"
                    >
                      Rs {site.allocatedAmount.toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals Row */}
              <TableRow sx={{ bgcolor: "action.selected" }}>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>
                    Total
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" fontWeight={600}>
                    {totalWorkers}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    color={isPercentageValid ? "success.main" : "error.main"}
                  >
                    {totalPercentage}%
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>
                    Rs {totalAllocated.toLocaleString()}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Amount Mismatch Warning */}
      {totalAllocated !== totalAmount && totalAmount > 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Allocated: Rs {totalAllocated.toLocaleString()} (Total: Rs{" "}
          {totalAmount.toLocaleString()})
        </Alert>
      )}
    </Box>
  );
}
