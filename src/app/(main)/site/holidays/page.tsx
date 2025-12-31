"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  Grid,
  Switch,
  FormControlLabel,
  Snackbar,
  IconButton,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  ExpandMore,
  ExpandLess,
  Close,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import type { SiteHoliday } from "@/types/database.types";
import dayjs from "dayjs";

// Interface for grouped holidays
interface HolidayGroup {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  holidays: SiteHoliday[];
  dayCount: number;
}

// Interface for table rows (can be group header or individual day)
interface TableRow {
  id: string;
  type: "group" | "child";
  group: HolidayGroup;
  holiday?: SiteHoliday; // Only for child rows
}

// Group consecutive holidays with the same reason
function groupHolidays(holidays: SiteHoliday[]): HolidayGroup[] {
  if (holidays.length === 0) return [];

  // Sort by date ascending for grouping
  const sorted = [...holidays].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const groups: HolidayGroup[] = [];
  let currentGroup: SiteHoliday[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];

    // Check if consecutive (1 day apart) and same reason
    const prevDate = dayjs(previous.date);
    const currDate = dayjs(current.date);
    const isConsecutive = currDate.diff(prevDate, "day") === 1;
    const sameReason =
      (current.reason || "").trim().toLowerCase() ===
      (previous.reason || "").trim().toLowerCase();

    if (isConsecutive && sameReason) {
      currentGroup.push(current);
    } else {
      // Save current group and start new one
      groups.push({
        id: currentGroup[0].id,
        startDate: currentGroup[0].date,
        endDate: currentGroup[currentGroup.length - 1].date,
        reason: currentGroup[0].reason || "",
        holidays: currentGroup,
        dayCount: currentGroup.length,
      });
      currentGroup = [current];
    }
  }

  // Don't forget the last group
  groups.push({
    id: currentGroup[0].id,
    startDate: currentGroup[0].date,
    endDate: currentGroup[currentGroup.length - 1].date,
    reason: currentGroup[0].reason || "",
    holidays: currentGroup,
    dayCount: currentGroup.length,
  });

  // Sort groups by date descending (most recent first)
  return groups.sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
}

// Parse error messages to user-friendly format
function parseErrorMessage(error: any): string {
  const message = error?.message || error?.toString() || "Unknown error";

  if (
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    message.includes("site_holidays_site_id_date_key")
  ) {
    return "A holiday already exists for this date. Please choose a different date.";
  }

  if (message.includes("permission") || message.includes("policy")) {
    return "You don't have permission to modify holidays.";
  }

  return message;
}

export default function HolidaysPage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();

  const [holidays, setHolidays] = useState<SiteHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<HolidayGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning" | "info";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  // Bulk mode state
  const [bulkMode, setBulkMode] = useState(false);

  const [form, setForm] = useState({
    date: dayjs().format("YYYY-MM-DD"),
    startDate: dayjs().format("YYYY-MM-DD"),
    endDate: dayjs().format("YYYY-MM-DD"),
    reason: "",
  });

  const canEdit = hasEditPermission(userProfile?.role);

  // Group holidays for display
  const groupedHolidays = useMemo(
    () => groupHolidays(holidays),
    [holidays]
  );

  // Flatten groups into table rows (includes expanded children)
  const tableRows = useMemo((): TableRow[] => {
    const rows: TableRow[] = [];
    for (const group of groupedHolidays) {
      // Add group header row
      rows.push({
        id: group.id,
        type: "group",
        group,
      });
      // If expanded and has multiple days, add child rows
      if (expandedGroups.has(group.id) && group.dayCount > 1) {
        for (const holiday of group.holidays) {
          rows.push({
            id: `child-${holiday.id}`,
            type: "child",
            group,
            holiday,
          });
        }
      }
    }
    return rows;
  }, [groupedHolidays, expandedGroups]);

  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "warning" | "info" = "info"
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const fetchHolidays = async () => {
    if (!selectedSite) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("site_holidays")
        .select("*")
        .eq("site_id", selectedSite.id)
        .order("date", { ascending: false });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error: any) {
      console.error("Error fetching holidays:", error);
      showSnackbar("Failed to load holidays: " + parseErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [selectedSite]);

  const handleOpenDialog = (group?: HolidayGroup) => {
    if (group) {
      setEditingGroup(group);
      setForm({
        date: group.startDate,
        startDate: group.startDate,
        endDate: group.endDate,
        reason: group.reason,
      });
      setBulkMode(false); // Edit mode doesn't use bulk
    } else {
      setEditingGroup(null);
      setForm({
        date: dayjs().format("YYYY-MM-DD"),
        startDate: dayjs().format("YYYY-MM-DD"),
        endDate: dayjs().format("YYYY-MM-DD"),
        reason: "",
      });
      setBulkMode(false);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGroup(null);
    setBulkMode(false);
  };

  // Calculate days count for bulk mode preview
  const bulkDaysCount = useMemo(() => {
    if (!bulkMode) return 0;
    const start = dayjs(form.startDate);
    const end = dayjs(form.endDate);
    if (end.isBefore(start)) return 0;
    return end.diff(start, "day") + 1;
  }, [bulkMode, form.startDate, form.endDate]);

  const handleSubmit = async () => {
    if (!selectedSite || !userProfile) return;

    // Validation
    if (!form.reason.trim()) {
      showSnackbar("Please enter a reason for the holiday", "warning");
      return;
    }

    if (bulkMode) {
      if (!form.startDate || !form.endDate) {
        showSnackbar("Please select both start and end dates", "warning");
        return;
      }
      if (dayjs(form.endDate).isBefore(dayjs(form.startDate))) {
        showSnackbar("End date must be on or after start date", "warning");
        return;
      }
    } else if (!editingGroup && !form.date) {
      showSnackbar("Please select a date", "warning");
      return;
    }

    setLoading(true);
    try {
      if (editingGroup) {
        // Update all holidays in the group with the new reason
        const ids = editingGroup.holidays.map((h) => h.id);
        const { error } = await supabase
          .from("site_holidays")
          .update({ reason: form.reason })
          .in("id", ids);
        if (error) throw error;
        showSnackbar(
          `Updated ${editingGroup.dayCount} holiday${editingGroup.dayCount > 1 ? "s" : ""}`,
          "success"
        );
      } else if (bulkMode) {
        // Generate array of dates and bulk insert
        const dates: string[] = [];
        let current = dayjs(form.startDate);
        const end = dayjs(form.endDate);
        while (current.isBefore(end) || current.isSame(end, "day")) {
          dates.push(current.format("YYYY-MM-DD"));
          current = current.add(1, "day");
        }

        // Check for existing holidays
        const existingDates = holidays.map((h) => h.date);
        const newDates = dates.filter((d) => !existingDates.includes(d));

        if (newDates.length === 0) {
          showSnackbar(
            "All selected dates already have holidays. No new holidays created.",
            "warning"
          );
          setLoading(false);
          return;
        }

        const records = newDates.map((date) => ({
          site_id: selectedSite.id,
          date,
          reason: form.reason.trim(),
        }));

        const { error } = await (supabase.from("site_holidays") as any).insert(
          records
        );
        if (error) throw error;

        const skipped = dates.length - newDates.length;
        const msg =
          skipped > 0
            ? `Created ${newDates.length} holidays (${skipped} dates already had holidays)`
            : `Created ${newDates.length} holidays`;
        showSnackbar(msg, "success");
      } else {
        // Single insert
        const { error } = await (supabase.from("site_holidays") as any).insert({
          site_id: selectedSite.id,
          date: form.date,
          reason: form.reason.trim(),
        });
        if (error) throw error;
        showSnackbar("Holiday added successfully", "success");
      }

      await fetchHolidays();
      handleCloseDialog();
    } catch (error: any) {
      console.error("Error saving holiday:", error);
      showSnackbar(parseErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (group: HolidayGroup) => {
    const confirmMsg =
      group.dayCount > 1
        ? `Are you sure you want to delete ${group.dayCount} holidays (${dayjs(group.startDate).format("DD MMM")} - ${dayjs(group.endDate).format("DD MMM YYYY")})?`
        : `Are you sure you want to delete this holiday (${dayjs(group.startDate).format("DD MMM YYYY")})?`;

    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const ids = group.holidays.map((h) => h.id);
      const { error } = await supabase
        .from("site_holidays")
        .delete()
        .in("id", ids);
      if (error) throw error;
      showSnackbar(
        `Deleted ${group.dayCount} holiday${group.dayCount > 1 ? "s" : ""}`,
        "success"
      );
      await fetchHolidays();
    } catch (error: any) {
      showSnackbar("Failed to delete: " + parseErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingle = async (holiday: SiteHoliday) => {
    if (
      !confirm(
        `Delete holiday on ${dayjs(holiday.date).format("DD MMM YYYY")}?`
      )
    )
      return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("site_holidays")
        .delete()
        .eq("id", holiday.id);
      if (error) throw error;
      showSnackbar("Holiday deleted", "success");
      await fetchHolidays();
    } catch (error: any) {
      showSnackbar("Failed to delete: " + parseErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const columns = useMemo<MRT_ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: "group.startDate",
        header: "Date",
        size: 250,
        enableSorting: false, // Sorting handled by data order
        Cell: ({ row }) => {
          const { type, group, holiday } = row.original;

          if (type === "child" && holiday) {
            // Child row - show individual date with indent
            const date = dayjs(holiday.date);
            return (
              <Box sx={{ pl: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  └─
                </Typography>
                <Typography variant="body2">
                  {date.format("DD MMM YYYY")} ({date.format("ddd")})
                </Typography>
              </Box>
            );
          }

          // Group row
          const startDate = dayjs(group.startDate);
          const endDate = dayjs(group.endDate);
          const isRange = group.dayCount > 1;
          const isExpanded = expandedGroups.has(group.id);

          const today = dayjs();
          const isPast = endDate.isBefore(today, "day");
          const isToday =
            startDate.isSame(today, "day") ||
            (startDate.isBefore(today, "day") && endDate.isAfter(today, "day"));
          const isUpcoming = startDate.isAfter(today, "day");

          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {isRange && (
                <IconButton
                  size="small"
                  onClick={() => toggleExpand(group.id)}
                  sx={{ p: 0.25 }}
                >
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              )}
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {isRange
                    ? `${startDate.format("DD")} - ${endDate.format("DD MMM YYYY")}`
                    : startDate.format("DD MMM YYYY")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isRange
                    ? `${startDate.format("ddd")} - ${endDate.format("ddd")}`
                    : startDate.format("dddd")}
                </Typography>
                {isToday && (
                  <Chip
                    label="Today"
                    size="small"
                    color="primary"
                    sx={{ ml: 1, height: 18 }}
                  />
                )}
                {isUpcoming && (
                  <Chip
                    label="Upcoming"
                    size="small"
                    color="success"
                    sx={{ ml: 1, height: 18 }}
                  />
                )}
                {isPast && (
                  <Chip
                    label="Past"
                    size="small"
                    color="default"
                    sx={{ ml: 1, height: 18 }}
                  />
                )}
              </Box>
            </Box>
          );
        },
      },
      {
        accessorKey: "group.dayCount",
        header: "Days",
        size: 80,
        enableSorting: false,
        Cell: ({ row }) => {
          if (row.original.type === "child") return null;
          return (
            <Chip
              label={row.original.group.dayCount}
              size="small"
              color={row.original.group.dayCount > 1 ? "primary" : "default"}
              variant={row.original.group.dayCount > 1 ? "filled" : "outlined"}
            />
          );
        },
      },
      {
        accessorKey: "group.reason",
        header: "Reason / Holiday Name",
        size: 300,
        enableSorting: false,
        Cell: ({ row }) => {
          if (row.original.type === "child") return null;
          return row.original.group.reason;
        },
      },
      {
        id: "mrt-row-actions",
        header: "Actions",
        size: 150,
        Cell: ({ row }) => {
          const { type, group, holiday } = row.original;

          if (type === "child" && holiday) {
            // Child row - only delete button
            return (
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteSingle(holiday)}
                disabled={!canEdit}
              >
                <Delete fontSize="small" />
              </IconButton>
            );
          }

          // Group row
          return (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => handleOpenDialog(group)}
                disabled={!canEdit}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => handleDeleteGroup(group)}
                disabled={!canEdit}
              >
                Delete
              </Button>
            </Box>
          );
        },
      },
    ],
    [canEdit, expandedGroups]
  );

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Site Holidays" />
        <Alert severity="warning">
          Please select a site to manage holidays
        </Alert>
      </Box>
    );
  }

  const upcomingHolidays = holidays.filter((h) =>
    dayjs(h.date).isAfter(dayjs(), "day")
  );

  return (
    <Box>
      <PageHeader
        title="Site Holidays"
        subtitle={`Manage holidays for ${selectedSite.name}`}
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={!canEdit}
          >
            Add Holiday
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Box sx={{ p: 2, bgcolor: "primary.light", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="primary.main">
              {holidays.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Holiday Days
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Box sx={{ p: 2, bgcolor: "success.light", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="success.main">
              {upcomingHolidays.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upcoming Days
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Box sx={{ p: 2, bgcolor: "info.light", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="info.main">
              {groupedHolidays.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Holiday Groups
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <DataTable
        columns={columns}
        data={tableRows}
        isLoading={loading}
        getRowId={(row) => row.id}
        enableSorting={false}
        muiTableBodyRowProps={({ row }) => ({
          sx: {
            backgroundColor:
              row.original.type === "child" ? "action.hover" : "inherit",
            "&:hover": {
              backgroundColor:
                row.original.type === "child" ? "action.selected" : "action.hover",
            },
          },
        })}
      />

      {/* Add/Edit Holiday Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingGroup
            ? `Edit Holiday${editingGroup.dayCount > 1 ? "s" : ""}`
            : "Add New Holiday"}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
          >
            {/* Bulk mode toggle - only for new holidays */}
            {!editingGroup && (
              <FormControlLabel
                control={
                  <Switch
                    checked={bulkMode}
                    onChange={(e) => setBulkMode(e.target.checked)}
                  />
                }
                label="Add multiple days (date range)"
              />
            )}

            {/* Date inputs */}
            {editingGroup ? (
              // Edit mode - show info about the group
              <Alert severity="info">
                Editing {editingGroup.dayCount} holiday
                {editingGroup.dayCount > 1 ? "s" : ""} from{" "}
                {dayjs(editingGroup.startDate).format("DD MMM")} to{" "}
                {dayjs(editingGroup.endDate).format("DD MMM YYYY")}
              </Alert>
            ) : bulkMode ? (
              // Bulk mode - show date range
              <>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
                {bulkDaysCount > 0 && (
                  <Alert severity="info">
                    This will create {bulkDaysCount} holiday
                    {bulkDaysCount > 1 ? "s" : ""} from{" "}
                    {dayjs(form.startDate).format("DD MMM")} to{" "}
                    {dayjs(form.endDate).format("DD MMM YYYY")}
                  </Alert>
                )}
                {bulkDaysCount === 0 && form.startDate && form.endDate && (
                  <Alert severity="error">
                    End date must be on or after start date
                  </Alert>
                )}
              </>
            ) : (
              // Single date mode
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                required
              />
            )}

            <TextField
              fullWidth
              label="Reason / Holiday Name"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
              multiline
              rows={2}
              placeholder="e.g., Diwali Festival, Republic Day, Site Inspection"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || (bulkMode && bulkDaysCount === 0)}
          >
            {editingGroup
              ? "Update"
              : bulkMode && bulkDaysCount > 0
                ? `Add ${bulkDaysCount} Holiday${bulkDaysCount > 1 ? "s" : ""}`
                : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={handleCloseSnackbar}
            >
              <Close fontSize="small" />
            </IconButton>
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
