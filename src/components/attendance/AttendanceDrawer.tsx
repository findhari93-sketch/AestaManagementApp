"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  InputAdornment,
  Grid,
} from "@mui/material";
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  Store as StoreIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import dayjs from "dayjs";
import LaborerSelectionDialog from "./LaborerSelectionDialog";

interface AttendanceDrawerProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  date?: string;
  onSuccess?: () => void;
}

interface LaborerWithCategory {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  daily_rate: number;
  team_id: string | null;
  team_name: string | null;
  laborer_type: string;
}

interface SelectedLaborer {
  laborerId: string;
  workDays: number;
  dailyRate: number;
}

interface MarketLaborerEntry {
  id: string;
  roleId: string;           // Changed from categoryId
  roleName: string;         // Changed from categoryName
  count: number;
  workDays: number;         // NEW: 0.5, 1, 1.5, 2
  ratePerPerson: number;
}

interface LaborRole {
  id: string;
  name: string;
  default_daily_rate: number;
}

export default function AttendanceDrawer({
  open,
  onClose,
  siteId,
  date: initialDate,
  onSuccess,
}: AttendanceDrawerProps) {
  const { userProfile } = useAuth();
  const supabase = createClient();

  // Form state
  const [selectedDate, setSelectedDate] = useState(
    initialDate || dayjs().format("YYYY-MM-DD")
  );
  const [sectionId, setSectionId] = useState<string>("");
  const [selectedLaborers, setSelectedLaborers] = useState<
    Map<string, SelectedLaborer>
  >(new Map());
  const [marketLaborers, setMarketLaborers] = useState<MarketLaborerEntry[]>(
    []
  );

  // Data state
  const [laborers, setLaborers] = useState<LaborerWithCategory[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [laborRoles, setLaborRoles] = useState<LaborRole[]>([]);
  const [laborerDialogOpen, setLaborerDialogOpen] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync selectedDate with initialDate when it changes
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // Fetch data on open
  useEffect(() => {
    if (open && siteId) {
      fetchData();
    }
  }, [open, siteId]);

  // Load existing attendance when drawer opens with a specific date
  useEffect(() => {
    if (open && siteId && initialDate) {
      // Small delay to ensure selectedDate state is synced
      const dateToLoad = initialDate;
      loadExistingAttendanceForDate(dateToLoad);
    }
  }, [open, siteId, initialDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch laborers with category info
      const { data: laborersData, error: laborersError } = await supabase
        .from("laborers")
        .select(
          `
          id,
          name,
          category_id,
          daily_rate,
          team_id,
          laborer_type,
          labor_categories(name),
          team:teams!laborers_team_id_fkey(name)
        `
        )
        .eq("status", "active")
        .order("name");

      if (laborersError) throw laborersError;

      const mappedLaborers: LaborerWithCategory[] = (laborersData || []).map(
        (l: any) => ({
          id: l.id,
          name: l.name,
          category_id: l.category_id,
          category_name: l.labor_categories?.name || "Unknown",
          daily_rate: l.daily_rate,
          team_id: l.team_id,
          team_name: l.team?.name || null,
          laborer_type: l.laborer_type || "daily_market",
        })
      );
      setLaborers(mappedLaborers);

      // Fetch sections for the site
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("building_sections")
        .select("id, name")
        .eq("site_id", siteId)
        .order("name");

      if (sectionsError) throw sectionsError;
      const sectionsArray = (sectionsData || []) as { id: string; name: string }[];
      setSections(sectionsArray);

      // Auto-select first section only when adding new attendance (not editing)
      // When editing (initialDate provided), loadExistingAttendanceForDate will set the correct section
      if (sectionsArray.length > 0 && !sectionId && !initialDate) {
        setSectionId(sectionsArray[0].id);
      }

      // Fetch labor roles for market laborers
      const { data: rolesData, error: rolesError } = await supabase
        .from("labor_roles")
        .select("id, name, default_daily_rate")
        .order("name");

      if (rolesError) throw rolesError;
      setLaborRoles((rolesData || []) as LaborRole[]);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAttendanceForDate = async (dateToLoad: string) => {
    try {
      setLoading(true);

      // Load existing daily attendance for this date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("daily_attendance")
        .select("laborer_id, work_days, daily_rate_applied, section_id")
        .eq("site_id", siteId)
        .eq("date", dateToLoad);

      if (attendanceError) throw attendanceError;

      // Populate selected laborers from existing attendance
      const existingSelected = new Map<string, SelectedLaborer>();
      let loadedSectionId: string | null = null;

      (attendanceData || []).forEach((record: any) => {
        existingSelected.set(record.laborer_id, {
          laborerId: record.laborer_id,
          workDays: record.work_days,
          dailyRate: record.daily_rate_applied,
        });
        // Get section_id from the first record (all should have same section)
        if (!loadedSectionId && record.section_id) {
          loadedSectionId = record.section_id;
        }
      });
      setSelectedLaborers(existingSelected);

      // Set the section from loaded attendance data
      if (loadedSectionId) {
        setSectionId(loadedSectionId);
      }

      // Load existing market laborers for this date
      const { data: marketData, error: marketError } = await (
        supabase.from("market_laborer_attendance") as any
      )
        .select("id, role_id, count, work_days, rate_per_person, labor_roles(name)")
        .eq("site_id", siteId)
        .eq("date", dateToLoad);

      let marketCount = 0;
      if (!marketError && marketData) {
        const existingMarket: MarketLaborerEntry[] = marketData.map(
          (m: any) => ({
            id: m.id,
            roleId: m.role_id,
            roleName: m.labor_roles?.name || "Unknown",
            count: m.count,
            workDays: m.work_days || 1,
            ratePerPerson: m.rate_per_person,
          })
        );
        setMarketLaborers(existingMarket);
        marketCount = existingMarket.reduce((acc, m) => acc + m.count, 0);
      } else {
        setMarketLaborers([]);
      }

      // Show success message with loaded counts
      const namedCount = existingSelected.size;
      if (namedCount > 0 || marketCount > 0) {
        setSuccess(
          `Loaded ${namedCount} named laborer${namedCount !== 1 ? "s" : ""} and ${marketCount} market laborer${marketCount !== 1 ? "s" : ""} for this date`
        );
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("Error loading existing attendance:", err);
      setError("Failed to load existing attendance");
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary
  const summary = useMemo(() => {
    let namedCount = 0;
    let namedAmount = 0;
    let marketCount = 0;
    let marketAmount = 0;

    selectedLaborers.forEach((s) => {
      namedCount++;
      namedAmount += s.workDays * s.dailyRate;
    });

    marketLaborers.forEach((m) => {
      marketCount += m.count;
      marketAmount += m.count * m.ratePerPerson * m.workDays;
    });

    return {
      namedCount,
      namedAmount,
      marketCount,
      marketAmount,
      totalCount: namedCount + marketCount,
      totalAmount: namedAmount + marketAmount,
    };
  }, [selectedLaborers, marketLaborers]);

  const handleLaborerToggle = (laborer: LaborerWithCategory) => {
    setSelectedLaborers((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(laborer.id)) {
        newMap.delete(laborer.id);
      } else {
        newMap.set(laborer.id, {
          laborerId: laborer.id,
          workDays: 1,
          dailyRate: laborer.daily_rate,
        });
      }
      return newMap;
    });
  };

  const handleAddMarketLaborer = () => {
    if (laborRoles.length === 0) return;

    const unusedRole = laborRoles.find(
      (role) => !marketLaborers.some((m) => m.roleId === role.id)
    );
    const role = unusedRole || laborRoles[0];

    setMarketLaborers((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        roleId: role.id,
        roleName: role.name,
        count: 1,
        workDays: 1, // Default to full day
        ratePerPerson: role.default_daily_rate,
      },
    ]);
  };

  const handleRemoveMarketLaborer = (id: string) => {
    setMarketLaborers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleMarketLaborerChange = (
    id: string,
    field: "roleId" | "count" | "workDays" | "ratePerPerson",
    value: string | number
  ) => {
    setMarketLaborers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;

        if (field === "roleId") {
          // Auto-fill rate when role changes
          const role = laborRoles.find((r) => r.id === value);
          return {
            ...m,
            roleId: value as string,
            roleName: role?.name || "Unknown",
            ratePerPerson: role?.default_daily_rate || 500,
          };
        }

        // Validate count and rate
        if (field === "count" || field === "ratePerPerson") {
          if ((value as number) < 0) return m;
        }

        return { ...m, [field]: value };
      })
    );
  };

  const handleSave = async () => {
    if (selectedLaborers.size === 0 && marketLaborers.length === 0) {
      setError("Please select at least one laborer or add market laborers");
      return;
    }

    if (!sectionId) {
      setError("Please select a section");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Save named laborers to daily_attendance
      const namedRecords = Array.from(selectedLaborers.values()).map((s) => ({
        date: selectedDate,
        laborer_id: s.laborerId,
        site_id: siteId,
        section_id: sectionId,
        work_days: s.workDays,
        hours_worked: s.workDays * 8,
        daily_rate_applied: s.dailyRate,
        daily_earnings: s.workDays * s.dailyRate,
        entered_by: userProfile?.id || null,
        recorded_by: userProfile?.name || "Unknown",
        recorded_by_user_id: userProfile?.id || null,
        is_paid: false,
        synced_to_expense: true,
      }));

      if (namedRecords.length > 0) {
        // Delete existing records for this date/site first
        await (supabase.from("daily_attendance") as any)
          .delete()
          .eq("site_id", siteId)
          .eq("date", selectedDate);

        // Insert new records
        const { error: attendanceError } = await (supabase.from("daily_attendance") as any)
          .insert(namedRecords);

        if (attendanceError) throw attendanceError;
      }

      // 2. Save market laborers
      if (marketLaborers.length > 0) {
        // Delete existing market laborer records for this date/site
        await (supabase.from("market_laborer_attendance") as any)
          .delete()
          .eq("site_id", siteId)
          .eq("date", selectedDate);

        const marketRecords = marketLaborers.map((m) => ({
          site_id: siteId,
          section_id: sectionId,
          date: selectedDate,
          role_id: m.roleId,
          count: m.count,
          work_days: m.workDays,
          rate_per_person: m.ratePerPerson,
          total_cost: m.count * m.ratePerPerson * m.workDays,
          entered_by: userProfile?.name || "Unknown",
          entered_by_user_id: userProfile?.id || null,
        }));

        const { error: marketError } = await (
          supabase.from("market_laborer_attendance") as any
        ).insert(marketRecords);

        if (marketError) throw marketError;
      }

      // 3. AUTO-SYNC: Create expense record for labor
      const totalAmount = summary.totalAmount;
      if (totalAmount > 0) {
        // Get labor expense category
        const { data: laborCategory } = await (supabase.from("expense_categories") as any)
          .select("id")
          .eq("module", "labor")
          .single();

        const categoryId = (laborCategory as { id: string } | null)?.id;

        // Delete existing expense for this date/site (auto-synced)
        await (supabase.from("expenses") as any)
          .delete()
          .eq("site_id", siteId)
          .eq("date", selectedDate)
          .eq("module", "labor")
          .like("description", "Daily labor%");

        // Create new expense
        const { data: expenseData, error: expenseError } = await (supabase.from("expenses") as any)
          .insert({
            module: "labor",
            category_id: categoryId,
            date: selectedDate,
            amount: totalAmount,
            site_id: siteId,
            section_id: sectionId,
            description: `Daily labor - ${summary.totalCount} laborers`,
            payment_mode: "cash",
            is_recurring: false,
            is_cleared: false,
            entered_by: userProfile?.name || "Unknown",
            entered_by_user_id: userProfile?.id || null,
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        // 4. Track sync in attendance_expense_sync
        await (supabase.from("attendance_expense_sync") as any).upsert(
          {
            attendance_date: selectedDate,
            site_id: siteId,
            expense_id: expenseData?.id || null,
            total_laborers: summary.totalCount,
            total_work_days: summary.namedCount + summary.marketCount,
            total_amount: totalAmount,
            synced_by: userProfile?.name || "Unknown",
            synced_by_user_id: userProfile?.id || null,
          },
          { onConflict: "attendance_date,site_id" }
        );
      }

      setSuccess("Attendance saved and synced to expenses!");
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error("Error saving attendance:", err);
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedLaborers(new Map());
    setMarketLaborers([]);
    setError(null);
    setSuccess(null);
    onClose();
  };

  const workDaysOptions = [
    { value: 0.5, label: "Half Day" },
    { value: 1, label: "Full Day" },
    { value: 1.5, label: "1.5 Days" },
    { value: 2, label: "2 Days" },
  ];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      disableScrollLock={false}
      hideBackdrop={false}
      ModalProps={{
        keepMounted: false,
      }}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 600, md: 800 },
          maxWidth: "90vw",
          overflowY: "auto",
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {initialDate
                ? `Edit Attendance for ${dayjs(initialDate).format("DD MMM YYYY")}`
                : "Add Attendance"}
            </Typography>
            {initialDate && (
              <Typography variant="caption" color="text.secondary">
                You can add new laborers or edit existing ones for this date
              </Typography>
            )}
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
          {/* Alerts */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Date and Section */}
              <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
                <TextField
                  label="Date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  size="small"
                  disabled={!!initialDate}
                  sx={{
                    flex: 1,
                    ...(initialDate && {
                      '& .MuiInputBase-root': {
                        bgcolor: 'action.disabledBackground',
                      },
                    }),
                  }}
                />
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Section</InputLabel>
                  <Select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    label="Section"
                  >
                    {sections.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Named Laborers Section */}
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PeopleIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Selected Laborers
                    </Typography>
                    {selectedLaborers.size > 0 && (
                      <Chip
                        label={`${selectedLaborers.size} selected`}
                        size="small"
                        color="primary"
                      />
                    )}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setLaborerDialogOpen(true)}
                  >
                    Select Laborers
                  </Button>
                </Box>

                {/* Show selected laborers in compact list */}
                {selectedLaborers.size > 0 ? (
                  <Box
                    sx={{
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      overflow: "hidden",
                    }}
                  >
                    {Array.from(selectedLaborers.values()).map((selection) => {
                      const laborer = laborers.find(
                        (l) => l.id === selection.laborerId
                      );
                      if (!laborer) return null;

                      return (
                        <Box
                          key={selection.laborerId}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            p: 1.5,
                            borderBottom: 1,
                            borderColor: "divider",
                            "&:last-child": { borderBottom: 0 },
                          }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {laborer.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {laborer.category_name} • {laborer.team_name || "No Team"}
                            </Typography>
                          </Box>
                          <Chip
                            label={`${selection.workDays} day${
                              selection.workDays !== 1 ? "s" : ""
                            }`}
                            size="small"
                            sx={{ mr: 2 }}
                          />
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ minWidth: 80, textAlign: "right", mr: 1 }}
                          >
                            ₹
                            {(
                              selection.workDays * selection.dailyRate
                            ).toLocaleString()}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleLaborerToggle(laborer)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Alert severity="info">
                    Click &quot;Select Laborers&quot; to add workers for this day
                  </Alert>
                )}
              </Box>

              {/* Laborer Selection Dialog */}
              <LaborerSelectionDialog
                open={laborerDialogOpen}
                onClose={() => setLaborerDialogOpen(false)}
                siteId={siteId}
                selectedLaborers={selectedLaborers}
                onConfirm={(selected) => {
                  setSelectedLaborers(selected);
                  setLaborerDialogOpen(false);
                }}
              />

              <Divider sx={{ mb: 2 }} />

              {/* Market Laborers Section */}
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <StoreIcon color="warning" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Market Laborers (Anonymous)
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddMarketLaborer}
                  >
                    Add
                  </Button>
                </Box>

                {marketLaborers.map((entry) => (
                  <Box
                    key={entry.id}
                    sx={{
                      mb: 2,
                      p: 2,
                      bgcolor: "grey.50",
                      borderRadius: 1,
                      border: 1,
                      borderColor: "divider",
                    }}
                  >
                    <Grid container spacing={2} alignItems="flex-start">
                      <Grid size={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Labor Role</InputLabel>
                          <Select
                            value={entry.roleId}
                            onChange={(e) =>
                              handleMarketLaborerChange(
                                entry.id,
                                "roleId",
                                e.target.value
                              )
                            }
                            label="Labor Role"
                          >
                            {laborRoles.map((role) => (
                              <MenuItem key={role.id} value={role.id}>
                                {role.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid size={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="No. of Workers"
                          type="number"
                          value={entry.count}
                          onChange={(e) =>
                            handleMarketLaborerChange(
                              entry.id,
                              "count",
                              Number(e.target.value)
                            )
                          }
                          slotProps={{
                            htmlInput: { min: 1 },
                          }}
                        />
                      </Grid>

                      <Grid size={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Work Days</InputLabel>
                          <Select
                            value={entry.workDays}
                            onChange={(e) =>
                              handleMarketLaborerChange(
                                entry.id,
                                "workDays",
                                e.target.value as number
                              )
                            }
                            label="Work Days"
                          >
                            <MenuItem value={0.5}>Half Day (0.5)</MenuItem>
                            <MenuItem value={1}>Full Day (1)</MenuItem>
                            <MenuItem value={1.5}>1.5 Days</MenuItem>
                            <MenuItem value={2}>2 Days</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid size={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Rate per Person"
                          type="number"
                          value={entry.ratePerPerson}
                          onChange={(e) =>
                            handleMarketLaborerChange(
                              entry.id,
                              "ratePerPerson",
                              Number(e.target.value)
                            )
                          }
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">₹</InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Grid>

                      <Grid size={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Total Cost"
                          value={`₹${(
                            entry.count *
                            entry.ratePerPerson *
                            entry.workDays
                          ).toLocaleString()}`}
                          disabled
                          sx={{
                            "& .MuiInputBase-input": {
                              fontWeight: 600,
                              color: "success.main",
                            },
                          }}
                        />
                      </Grid>

                      <Grid size={1} sx={{ display: "flex", alignItems: "flex-start", pt: 0.5 }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveMarketLaborer(entry.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Box>
                ))}

                {marketLaborers.length === 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: "center", py: 2 }}
                  >
                    No market laborers added
                  </Typography>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* Summary & Save */}
        <Box
          sx={{
            borderTop: 1,
            borderColor: "divider",
            p: 2,
            bgcolor: "grey.50",
          }}
        >
          {/* Summary */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              SUMMARY
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2">Named Laborers:</Typography>
              <Typography variant="body2">
                {summary.namedCount} → ₹{summary.namedAmount.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2">Market Laborers:</Typography>
              <Typography variant="body2">
                {summary.marketCount} → ₹{summary.marketAmount.toLocaleString()}
              </Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="subtitle1" fontWeight={700}>
                TOTAL:
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                {summary.totalCount} laborers → ₹
                {summary.totalAmount.toLocaleString()}
              </Typography>
            </Box>
          </Box>

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleSave}
            disabled={
              saving || (selectedLaborers.size === 0 && marketLaborers.length === 0)
            }
          >
            {saving ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Save Attendance"
            )}
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", textAlign: "center", mt: 1 }}
          >
            Attendance will be auto-synced to Daily Expenses
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}
