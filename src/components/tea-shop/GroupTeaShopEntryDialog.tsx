"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  Divider,
} from "@mui/material";
import { Close as CloseIcon, Groups as GroupsIcon } from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/types/database.types";

type TeaShopAccount = Database["public"]["Tables"]["tea_shop_accounts"]["Row"];
type TeaShopGroupEntry = Database["public"]["Tables"]["tea_shop_group_entries"]["Row"];

interface TeaShopGroupEntryWithAllocations extends TeaShopGroupEntry {
  allocations?: any[];
}
interface SiteAttendanceData {
  siteId: string;
  siteName: string;
  totalCount: number;
  namedLaborerCount: number;
  marketLaborerCount: number;
  percentage: number;
  allocatedAmount: number;
}
interface LaborGroupPercentageSplit {
  daily: number;
  contract: number;
  market: number;
}
import type { SiteGroupWithSites } from "@/types/material.types";
import GroupSiteAllocationPreview from "./GroupSiteAllocationPreview";
import PercentageSplitInput from "./PercentageSplitInput";
import {
  useGroupAttendanceCounts,
  useCreateGroupTeaShopEntry,
  useUpdateGroupTeaShopEntry,
  allocateAmounts,
} from "@/hooks/queries/useGroupTeaShop";
import dayjs from "dayjs";

interface GroupTeaShopEntryDialogProps {
  open: boolean;
  onClose: () => void;
  shop: TeaShopAccount;
  siteGroup: SiteGroupWithSites;
  entry?: TeaShopGroupEntryWithAllocations | null;
  onSuccess?: () => void;
  initialDate?: string;
}

export default function GroupTeaShopEntryDialog({
  open,
  onClose,
  shop,
  siteGroup,
  entry,
  onSuccess,
  initialDate,
}: GroupTeaShopEntryDialogProps) {
  const { userProfile } = useAuth();

  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [totalAmount, setTotalAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [isOverride, setIsOverride] = useState(false);
  const [allocations, setAllocations] = useState<SiteAttendanceData[]>([]);
  const [percentageSplit, setPercentageSplit] =
    useState<LaborGroupPercentageSplit>({
      daily: 40,
      contract: 35,
      market: 25,
    });
  const [error, setError] = useState<string | null>(null);

  // Fetch attendance counts for the group
  const {
    data: attendanceData,
    isLoading: loadingAttendance,
    refetch: refetchAttendance,
  } = useGroupAttendanceCounts(siteGroup.id, date);

  // Mutations
  const createEntry = useCreateGroupTeaShopEntry();
  const updateEntry = useUpdateGroupTeaShopEntry();

  const isLoading = createEntry.isPending || updateEntry.isPending;

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (entry) {
        // Editing existing entry
        setDate(entry.date);
        setTotalAmount(entry.total_amount);
        setNotes(entry.notes || "");
        setIsOverride(entry.is_percentage_override);
        if (entry.percentage_split) {
          setPercentageSplit(entry.percentage_split as unknown as LaborGroupPercentageSplit);
        }

        // Restore allocations from entry
        if (entry.allocations && entry.allocations.length > 0) {
          const restored: SiteAttendanceData[] = entry.allocations.map(
            (alloc) => ({
              siteId: alloc.site_id,
              siteName: alloc.site?.name || "Unknown",
              namedLaborerCount: alloc.named_laborer_count,
              marketLaborerCount: alloc.market_laborer_count,
              totalCount: alloc.attendance_count,
              percentage: alloc.allocation_percentage,
              allocatedAmount: alloc.allocated_amount,
            })
          );
          setAllocations(restored);
        }
      } else {
        // New entry
        setDate(initialDate || dayjs().format("YYYY-MM-DD"));
        setTotalAmount(0);
        setNotes("");
        setIsOverride(false);
        setPercentageSplit({ daily: 40, contract: 35, market: 25 });
        setAllocations([]);
      }
      setError(null);
    }
  }, [open, entry, initialDate]);

  // Update allocations when attendance data loads
  useEffect(() => {
    if (attendanceData && attendanceData.length > 0 && !entry) {
      // Calculate amounts based on current total
      const percentages = attendanceData.map((s) => s.percentage);
      const amounts = allocateAmounts(totalAmount, percentages);

      const withAmounts = attendanceData.map((site, i) => ({
        ...site,
        allocatedAmount: amounts[i],
      }));

      setAllocations(withAmounts);
    }
  }, [attendanceData, entry]);

  const handleAutoCalculate = () => {
    refetchAttendance();
  };

  const handleAllocationsChange = (newAllocations: SiteAttendanceData[]) => {
    setAllocations(newAllocations);
  };

  const handleTotalAmountChange = (value: string) => {
    const amount = parseInt(value) || 0;
    setTotalAmount(amount);

    // Recalculate allocated amounts
    if (allocations.length > 0) {
      const percentages = allocations.map((s) => s.percentage);
      const amounts = allocateAmounts(amount, percentages);

      const updated = allocations.map((site, i) => ({
        ...site,
        allocatedAmount: amounts[i],
      }));
      setAllocations(updated);
    }
  };

  const handleSave = async () => {
    // Validate
    if (totalAmount <= 0) {
      setError("Please enter a total amount");
      return;
    }

    if (allocations.length === 0) {
      setError("No site allocations available");
      return;
    }

    const totalPercentage = allocations.reduce((sum, s) => sum + s.percentage, 0);
    if (totalPercentage !== 100) {
      setError(`Percentages must sum to 100% (currently ${totalPercentage}%)`);
      return;
    }

    // Validate percentage split
    const percentSum =
      percentageSplit.daily + percentageSplit.contract + percentageSplit.market;
    if (percentSum !== 100) {
      setError(
        `Labor group percentages must sum to 100% (currently ${percentSum}%)`
      );
      return;
    }

    setError(null);

    const allocationData = allocations.map((alloc) => ({
      siteId: alloc.siteId,
      namedLaborerCount: alloc.namedLaborerCount,
      marketLaborerCount: alloc.marketLaborerCount,
      percentage: alloc.percentage,
      amount: alloc.allocatedAmount,
    }));

    try {
      if (entry) {
        // Update existing entry
        await updateEntry.mutateAsync({
          id: entry.id,
          teaShopId: shop.id,
          siteGroupId: siteGroup.id,
          date,
          totalAmount,
          allocations: allocationData,
          isPercentageOverride: isOverride,
          percentageSplit,
          notes: notes || undefined,
          updatedBy: userProfile?.display_name || undefined,
          updatedByUserId: userProfile?.id,
        });
      } else {
        // Create new entry
        await createEntry.mutateAsync({
          teaShopId: shop.id,
          siteGroupId: siteGroup.id,
          date,
          totalAmount,
          allocations: allocationData,
          isPercentageOverride: isOverride,
          percentageSplit,
          notes: notes || undefined,
          enteredBy: userProfile?.display_name || undefined,
          enteredByUserId: userProfile?.id,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save entry");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <GroupsIcon color="primary" />
            <Typography variant="h6" component="span">
              {entry ? "Edit Group Entry" : "New Group Entry"}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {shop.shop_name} - {siteGroup.name}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Date Input */}
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            slotProps={{
              inputLabel: { shrink: true },
            }}
          />

          {/* Total Amount Input */}
          <TextField
            label="Total T&S Amount"
            type="number"
            value={totalAmount || ""}
            onChange={(e) => handleTotalAmountChange(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">Rs</InputAdornment>
                ),
              },
            }}
            placeholder="Enter total for all sites"
            helperText="This amount will be split across all sites in the group"
          />

          <Divider />

          {/* Site Allocation Preview */}
          <GroupSiteAllocationPreview
            sites={allocations}
            totalAmount={totalAmount}
            onAllocationsChange={handleAllocationsChange}
            loading={loadingAttendance}
            onAutoCalculate={handleAutoCalculate}
            isOverride={isOverride}
            onOverrideChange={setIsOverride}
          />

          <Divider />

          {/* Labor Group Percentage Split */}
          <PercentageSplitInput
            daily={percentageSplit.daily}
            contract={percentageSplit.contract}
            market={percentageSplit.market}
            onChange={setPercentageSplit}
            totalCost={totalAmount}
          />

          {/* Notes */}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Optional notes..."
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isLoading || totalAmount <= 0}
        >
          {isLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : entry ? (
            "Update"
          ) : (
            "Save"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
