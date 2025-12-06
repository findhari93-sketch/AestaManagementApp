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
} from "@mui/material";
import { Add, Delete, Edit } from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import type { SiteHoliday } from "@/types/database.types";
import dayjs from "dayjs";

export default function HolidaysPage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();

  const [holidays, setHolidays] = useState<SiteHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<SiteHoliday | null>(
    null
  );

  const [form, setForm] = useState({
    date: dayjs().format("YYYY-MM-DD"),
    reason: "",
  });

  const canEdit =
    userProfile?.role === "admin" || userProfile?.role === "office";

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
      alert("Failed to load holidays: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [selectedSite]);

  const handleOpenDialog = (holiday?: SiteHoliday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setForm({ date: holiday.date, reason: holiday.reason });
    } else {
      setEditingHoliday(null);
      setForm({ date: dayjs().format("YYYY-MM-DD"), reason: "" });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingHoliday(null);
  };

  const handleSubmit = async () => {
    if (!selectedSite || !userProfile) return;
    if (!form.reason || !form.date) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      if (editingHoliday) {
        const { error } = await (supabase.from("site_holidays") as any)
          .update({ date: form.date, reason: form.reason })
          .eq("id", editingHoliday.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("site_holidays") as any).insert({
          site_id: selectedSite.id,
          date: form.date,
          reason: form.reason,
        });
        if (error) throw error;
      }

      await fetchHolidays();
      handleCloseDialog();
    } catch (error: any) {
      alert("Failed to save holiday: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("site_holidays")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await fetchHolidays();
    } catch (error: any) {
      alert("Failed to delete holiday: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<SiteHoliday>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        size: 180,
        Cell: ({ cell }) => {
          const date = dayjs(cell.getValue<string>());
          const isPast = date.isBefore(dayjs(), "day");
          const isToday = date.isSame(dayjs(), "day");
          const isUpcoming = date.isAfter(dayjs(), "day");

          return (
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {date.format("DD MMM YYYY")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {date.format("dddd")}
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
          );
        },
      },
      {
        accessorKey: "reason",
        header: "Reason / Holiday Name",
        size: 300,
      },
      {
        id: "mrt-row-actions",
        header: "Actions",
        size: 150,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => handleOpenDialog(row.original)}
              disabled={!canEdit}
            >
              Edit
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={() => handleDelete(row.original.id)}
              disabled={!canEdit}
            >
              Delete
            </Button>
          </Box>
        ),
      },
    ],
    [canEdit]
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
        onRefresh={fetchHolidays}
        isLoading={loading}
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
              Total Holidays
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Box sx={{ p: 2, bgcolor: "success.light", borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="success.main">
              {upcomingHolidays.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upcoming
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <DataTable columns={columns} data={holidays} isLoading={loading} />

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingHoliday ? "Edit Holiday" : "Add New Holiday"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
            <TextField
              fullWidth
              label="Reason / Holiday Name"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {editingHoliday ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
