"use client";

import React from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Switch,
  FormControlLabel,
  TextField,
  Tooltip,
  IconButton,
} from "@mui/material";
import {
  Groups as GroupsIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import type { SiteDayUnitsData } from "@/hooks/queries/useCompanyTeaShops";

interface GroupAllocationSectionProps {
  isInGroup: boolean;
  dayUnitsData: SiteDayUnitsData[] | undefined;
  isLoadingDayUnits: boolean;
  totalCost: number;
  date: string;
  enableManualOverride: boolean;
  onManualOverrideChange: (enabled: boolean) => void;
  manualAllocations?: { siteId: string; percentage: number; amount: number }[];
  onManualAllocationsChange?: (allocations: { siteId: string; percentage: number; amount: number }[]) => void;
  siteGroup?: { name: string; sites?: { id: string; name: string }[] } | null;
}

export default function GroupAllocationSection({
  isInGroup,
  dayUnitsData,
  isLoadingDayUnits,
  totalCost,
  date,
  enableManualOverride,
  onManualOverrideChange,
  manualAllocations = [],
  onManualAllocationsChange,
  siteGroup,
}: GroupAllocationSectionProps) {
  // Don't show if not in a group
  if (!isInGroup) {
    return null;
  }

  // Calculate allocations based on day units
  const allocations = React.useMemo(() => {
    if (!dayUnitsData || dayUnitsData.length === 0) return [];

    const totalUnits = dayUnitsData.reduce((sum, s) => sum + s.totalUnits, 0);
    if (totalUnits === 0) return dayUnitsData.map(s => ({
      ...s,
      percentage: 0,
      amount: 0,
    }));

    // If manual override is enabled, use manual allocations
    if (enableManualOverride && manualAllocations.length > 0) {
      return dayUnitsData.map(s => {
        const manual = manualAllocations.find(m => m.siteId === s.siteId);
        return {
          ...s,
          percentage: manual?.percentage || 0,
          amount: manual?.amount || 0,
        };
      });
    }

    // Calculate percentages and amounts based on day units
    let remaining = totalCost;
    const results = dayUnitsData.map((s, idx) => {
      const percentage = Math.round((s.totalUnits / totalUnits) * 100);
      // For last item, use remaining to avoid rounding errors
      const amount = idx === dayUnitsData.length - 1
        ? remaining
        : Math.round((s.totalUnits / totalUnits) * totalCost);
      remaining -= amount;
      return {
        ...s,
        percentage,
        amount,
      };
    });

    return results;
  }, [dayUnitsData, totalCost, enableManualOverride, manualAllocations]);

  // Handle manual percentage change
  const handlePercentageChange = (siteId: string, newPercentage: number) => {
    if (!onManualAllocationsChange) return;

    // Calculate new amount
    const newAmount = Math.round((newPercentage / 100) * totalCost);

    const newAllocations = allocations.map(a => {
      if (a.siteId === siteId) {
        return { siteId: a.siteId, percentage: newPercentage, amount: newAmount };
      }
      return { siteId: a.siteId, percentage: a.percentage, amount: a.amount };
    });

    onManualAllocationsChange(newAllocations);
  };

  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <GroupsIcon color="secondary" fontSize="small" />
        <Typography variant="subtitle2" fontWeight={600}>
          Group Site Allocation
        </Typography>
        <Tooltip title="Costs are automatically split based on day units (worker attendance) for each site in the group.">
          <InfoIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'pointer' }} />
        </Tooltip>
      </Box>

      {isLoadingDayUnits ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : !dayUnitsData || dayUnitsData.length === 0 ? (
        <Alert severity="warning" sx={{ py: 1 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            No attendance data found for {date}
          </Typography>
          {siteGroup?.sites && siteGroup.sites.length > 0 ? (
            <>
              <Typography variant="caption" display="block" color="text.secondary">
                Sites: {siteGroup.sites.map(s => s.name).join(", ")}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                Entry will be split equally ({Math.round(100 / siteGroup.sites.length)}% each) across all sites.
              </Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Please ensure attendance is recorded for this date first.
            </Typography>
          )}
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Site</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Day Units</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>%</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allocations.map((alloc) => (
                  <TableRow key={alloc.siteId}>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      {alloc.siteName}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={`Named: ${alloc.namedLaborerUnits?.toFixed(1) || 0}, Market: ${alloc.marketLaborerUnits?.toFixed(1) || 0}`}>
                        <Chip
                          label={alloc.totalUnits.toFixed(1)}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      {enableManualOverride ? (
                        <TextField
                          type="number"
                          size="small"
                          value={alloc.percentage}
                          onChange={(e) => handlePercentageChange(alloc.siteId, parseInt(e.target.value) || 0)}
                          slotProps={{
                            input: {
                              inputProps: { min: 0, max: 100, style: { textAlign: 'center', padding: '2px 4px' } },
                              sx: { fontSize: '0.75rem', width: 50 },
                            },
                          }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          {alloc.percentage}%
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>
                        ₹{alloc.amount.toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow sx={{ bgcolor: 'action.selected' }}>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Total</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={dayUnitsData.reduce((sum, s) => sum + s.totalUnits, 0).toFixed(1)}
                      size="small"
                      color="primary"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={totalPercentage === 100 ? 'success.main' : 'error.main'}
                      sx={{ fontSize: '0.8rem' }}
                    >
                      {totalPercentage}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8rem' }}>
                      ₹{totalAmount.toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Manual Override Toggle */}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={enableManualOverride}
                onChange={(e) => onManualOverrideChange(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Override allocation manually
              </Typography>
            }
            sx={{ mt: 0.5 }}
          />

          {enableManualOverride && totalPercentage !== 100 && (
            <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
              <Typography variant="caption">
                Manual percentages should sum to 100% (currently {totalPercentage}%)
              </Typography>
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}
