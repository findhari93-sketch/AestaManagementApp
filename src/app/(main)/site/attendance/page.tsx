"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  Chip,
  FormControl,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Collapse,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Divider,
  Tooltip,
} from "@mui/material";
import {
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Sync as SyncIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Payment as PaymentIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import PageHeader from "@/components/layout/PageHeader";
import type {
  BuildingSection,
  PaymentMode,
  PaymentChannel,
  LaborerType,
} from "@/types/database.types";
import dayjs from "dayjs";
import { usePresence } from "@/hooks/usePresence";
import PresenceIndicator from "@/components/PresenceIndicator";

interface AttendanceEntry {
  laborer_id: string;
  laborer_name: string;
  category_name: string;
  role_name: string;
  team_name: string | null;
  team_id: string | null;
  daily_rate: number;
  work_days: number;
  section_id: string;
  section_name: string;
  hours_worked: number;
  advance_given: number;
  extra_given: number;
  notes: string;
  isExpanded: boolean;
  // Payment ecosystem fields
  laborer_type: LaborerType;
  subcontract_id: string | null;
  is_paid: boolean;
  payment_amount: number;
  payment_mode: PaymentMode;
  payment_channel: PaymentChannel;
}

interface DailySummary {
  category: string;
  count: number;
  workDays: number;
  totalAmount: number;
}

interface PaymentSummary {
  underContract: number;
  outsideContract: number;
  alreadyPaid: number;
  pendingPayment: number;
  total: number;
}

interface SubcontractOption {
  id: string;
  title: string;
  team_id: string | null;
  laborer_id: string | null;
  contract_type: string;
}

export default function AttendancePage() {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [laborers, setLaborers] = useState<any[]>([]);
  const [sections, setSections] = useState<BuildingSection[]>([]);
  const [subcontracts, setSubcontracts] = useState<SubcontractOption[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingAttendance, setExistingAttendance] = useState<Set<string>>(
    new Set()
  );
  const [showSummary, setShowSummary] = useState(false);

  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();

  const canEdit =
    userProfile?.role === "admin" ||
    userProfile?.role === "office" ||
    userProfile?.role === "site_engineer";

  // Track presence - show who else is editing attendance for this site/date
  const { activeUsers } = usePresence({
    channelName: `attendance:${selectedSite?.id}:${date}`,
    enabled: !!selectedSite,
  });

  const fetchData = async () => {
    if (!selectedSite) return;

    try {
      setLoading(true);
      setError("");

      // Fetch active laborers with category, role, and laborer_type
      const { data: laborersData, error: laborersError } = await supabase
        .from("laborers")
        .select(
          `
          *,
          teams:team_id (name),
          labor_categories:category_id (name),
          labor_roles:role_id (name)
        `
        )
        .eq("status", "active")
        .order("name");

      if (laborersError) throw laborersError;

      // Fetch sections for the site
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("building_sections")
        .select("*")
        .eq("site_id", selectedSite.id)
        .order("name");

      if (sectionsError) throw sectionsError;

      // Fetch active subcontracts for the site
      const { data: subcontractsData, error: subcontractsError } = await supabase
        .from("subcontracts")
        .select("id, title, team_id, laborer_id, contract_type")
        .eq("site_id", selectedSite.id)
        .eq("status", "active")
        .order("title");

      if (subcontractsError) throw subcontractsError;

      setLaborers(laborersData || []);
      setSections(sectionsData || []);
      const typedSubcontracts = (subcontractsData || []) as SubcontractOption[];
      setSubcontracts(typedSubcontracts);

      // Fetch existing attendance for the date
      const { data: existingData, error: existingError } = await supabase
        .from("daily_attendance")
        .select("laborer_id, subcontract_id, is_paid")
        .eq("site_id", selectedSite.id)
        .eq("date", date);

      if (existingError) throw existingError;

      const existingMap = new Map(
        (existingData || []).map((a: any) => [
          a.laborer_id,
          { subcontract_id: a.subcontract_id, is_paid: a.is_paid },
        ])
      );
      setExistingAttendance(new Set(existingMap.keys()));

      // Initialize attendance entries
      const typedLaborersData = laborersData as any[] | null;
      const typedSectionsData = sectionsData as BuildingSection[] | null;

      if (
        typedLaborersData &&
        typedSectionsData &&
        typedSectionsData.length > 0
      ) {
        const defaultSection = typedSectionsData[0];
        const entries: AttendanceEntry[] = typedLaborersData.map((laborer) => {
          const existingRecord = existingMap.get(laborer.id);

          // Try to find a matching subcontract for this laborer
          let defaultSubcontract: string | null = null;
          if (laborer.team_id && typedSubcontracts.length > 0) {
            const teamSubcontract = typedSubcontracts.find(
              (sc) => sc.team_id === laborer.team_id
            );
            if (teamSubcontract) {
              defaultSubcontract = teamSubcontract.id;
            }
          }

          return {
            laborer_id: laborer.id,
            laborer_name: laborer.name,
            category_name: laborer.labor_categories?.name || "Unknown",
            role_name: laborer.labor_roles?.name || "Unknown",
            team_name: laborer.teams?.name || null,
            team_id: laborer.team_id || null,
            daily_rate: laborer.daily_rate || 0,
            work_days: existingMap.has(laborer.id) ? 0 : 1,
            section_id: defaultSection.id,
            section_name: defaultSection.name,
            hours_worked: 8,
            advance_given: 0,
            extra_given: 0,
            notes: "",
            isExpanded: false,
            // Payment ecosystem fields
            laborer_type: laborer.laborer_type || "daily_market",
            subcontract_id: existingRecord?.subcontract_id || defaultSubcontract,
            is_paid: false,
            payment_amount: 0,
            payment_mode: "cash" as PaymentMode,
            payment_channel: "via_site_engineer" as PaymentChannel,
          };
        });
        setAttendanceEntries(entries);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSite, date]);

  const handleWorkDaysChange = (laborerId: string, value: number) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? {
              ...entry,
              work_days: value,
              hours_worked:
                value === 0.5 ? 4 : value === 1 ? 8 : value === 1.5 ? 12 : 16,
              payment_amount:
                value > 0 ? value * entry.daily_rate : 0,
            }
          : entry
      )
    );
  };

  const handleSectionChange = (laborerId: string, sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? {
              ...entry,
              section_id: sectionId,
              section_name: section?.name || "",
            }
          : entry
      )
    );
  };

  const handleSubcontractChange = (laborerId: string, subcontractId: string | null) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? { ...entry, subcontract_id: subcontractId }
          : entry
      )
    );
  };

  const handleIsPaidChange = (laborerId: string, isPaid: boolean) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? {
              ...entry,
              is_paid: isPaid,
              payment_amount: isPaid
                ? entry.work_days * entry.daily_rate
                : 0,
            }
          : entry
      )
    );
  };

  const handlePaymentModeChange = (laborerId: string, mode: PaymentMode) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? { ...entry, payment_mode: mode }
          : entry
      )
    );
  };

  const handlePaymentChannelChange = (laborerId: string, channel: PaymentChannel) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? { ...entry, payment_channel: channel }
          : entry
      )
    );
  };

  const handlePaymentAmountChange = (laborerId: string, amount: number) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? { ...entry, payment_amount: amount }
          : entry
      )
    );
  };

  const handleAdvanceChange = (laborerId: string, value: number) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? { ...entry, advance_given: value }
          : entry
      )
    );
  };

  const handleExtraChange = (laborerId: string, value: number) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? { ...entry, extra_given: value }
          : entry
      )
    );
  };

  const handleNotesChange = (laborerId: string, value: string) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId ? { ...entry, notes: value } : entry
      )
    );
  };

  const toggleExpanded = (laborerId: string) => {
    setAttendanceEntries((prev) =>
      prev.map((entry) =>
        entry.laborer_id === laborerId
          ? { ...entry, isExpanded: !entry.isExpanded }
          : entry
      )
    );
  };

  const calculateDailyEarnings = (workDays: number, dailyRate: number) => {
    return workDays * dailyRate;
  };

  const handleSubmit = async () => {
    if (!selectedSite) {
      setError("Please select a site");
      return;
    }

    if (!canEdit) {
      setError("You do not have permission to record attendance");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const activeEntries = attendanceEntries.filter(
        (entry) => entry.work_days > 0
      );

      if (activeEntries.length === 0) {
        setError("No attendance entries to save");
        return;
      }

      const attendanceRecords = activeEntries.map((entry) => ({
        site_id: selectedSite.id,
        laborer_id: entry.laborer_id,
        date: date,
        section_id: entry.section_id,
        work_days: entry.work_days,
        hours_worked: entry.hours_worked,
        daily_rate_applied: entry.daily_rate,
        daily_earnings: calculateDailyEarnings(
          entry.work_days,
          entry.daily_rate
        ),
        entered_by: userProfile?.id,
        // Payment ecosystem fields
        subcontract_id: entry.subcontract_id,
        is_paid: entry.is_paid,
        recorded_by: userProfile?.name || userProfile?.email,
        recorded_by_user_id: userProfile?.id,
      }));

      const laborerIds = activeEntries.map((e) => e.laborer_id);
      const { error: deleteError } = await supabase
        .from("daily_attendance")
        .delete()
        .eq("site_id", selectedSite.id)
        .eq("date", date)
        .in("laborer_id", laborerIds);

      if (deleteError) throw deleteError;

      const { error: insertError } = await (
        supabase.from("daily_attendance") as any
      ).insert(attendanceRecords);

      if (insertError) throw insertError;

      // Handle advances and extras
      const advanceRecords = activeEntries
        .filter((entry) => entry.advance_given > 0 || entry.extra_given > 0)
        .flatMap((entry) => {
          const records = [];
          if (entry.advance_given > 0) {
            records.push({
              laborer_id: entry.laborer_id,
              date: date,
              amount: entry.advance_given,
              transaction_type: "advance" as const,
              payment_mode: "cash" as const,
              reason: entry.notes || null,
              given_by: userProfile?.id,
              deduction_status: "pending" as const,
              deducted_amount: 0,
            });
          }
          if (entry.extra_given > 0) {
            records.push({
              laborer_id: entry.laborer_id,
              date: date,
              amount: entry.extra_given,
              transaction_type: "extra" as const,
              payment_mode: "cash" as const,
              reason: entry.notes || null,
              given_by: userProfile?.id,
              deduction_status: "deducted" as const,
              deducted_amount: entry.extra_given,
            });
          }
          return records;
        });

      if (advanceRecords.length > 0) {
        const { error: advanceError } = await (
          supabase.from("advances") as any
        ).insert(advanceRecords);

        if (advanceError) throw advanceError;
      }

      // Handle labor payments for daily market laborers marked as paid
      const paidDailyLaborers = activeEntries.filter(
        (entry) => entry.is_paid && entry.laborer_type === "daily_market"
      );

      if (paidDailyLaborers.length > 0) {
        const laborPayments = paidDailyLaborers.map((entry) => ({
          laborer_id: entry.laborer_id,
          site_id: selectedSite.id,
          subcontract_id: entry.subcontract_id,
          amount: entry.payment_amount,
          payment_date: date,
          payment_for_date: date,
          payment_mode: entry.payment_mode,
          payment_channel: entry.payment_channel,
          paid_by: userProfile?.name || userProfile?.email || "Unknown",
          paid_by_user_id: userProfile?.id,
          is_under_contract: !!entry.subcontract_id,
          recorded_by: userProfile?.name || userProfile?.email || "Unknown",
          recorded_by_user_id: userProfile?.id,
        }));

        const { error: paymentError } = await (
          supabase.from("labor_payments") as any
        ).insert(laborPayments);

        if (paymentError) {
          console.error("Error recording labor payments:", paymentError);
          // Don't throw - attendance is saved, payments are secondary
        }
      }

      setSuccess(
        `Attendance saved successfully for ${activeEntries.length} laborer(s)${
          paidDailyLaborers.length > 0
            ? ` (${paidDailyLaborers.length} payments recorded)`
            : ""
        }`
      );
      setShowSummary(true);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncToExpenses = async () => {
    if (!selectedSite || !userProfile) return;

    try {
      setSyncing(true);
      setError("");

      const activeEntries = attendanceEntries.filter((e) => e.work_days > 0);
      if (activeEntries.length === 0) {
        setError("No attendance entries to sync");
        return;
      }

      const totalAmount = activeEntries.reduce(
        (sum, e) => sum + calculateDailyEarnings(e.work_days, e.daily_rate),
        0
      );
      const totalWorkDays = activeEntries.reduce((sum, e) => sum + e.work_days, 0);

      // Check if already synced
      const { data: existingSync } = await supabase
        .from("attendance_expense_sync")
        .select("id")
        .eq("site_id", selectedSite.id)
        .eq("attendance_date", date)
        .single();

      if (existingSync) {
        setError("Attendance for this date has already been synced to expenses");
        return;
      }

      // Get or create "Daily Labor" expense category
      let categoryId: string;
      const { data: laborCategory } = await supabase
        .from("expense_categories")
        .select("id")
        .eq("module", "labor")
        .eq("name", "Daily Labor")
        .single();

      const typedCategory = laborCategory as { id: string } | null;
      if (typedCategory) {
        categoryId = typedCategory.id;
      } else {
        const { data: newCategory, error: catError } = await (
          supabase.from("expense_categories") as any
        ).insert({
          module: "labor",
          name: "Daily Labor",
          is_recurring: false,
        }).select("id").single();

        if (catError) throw catError;
        categoryId = newCategory.id;
      }

      // Create expense record
      const { data: expense, error: expenseError } = await (
        supabase.from("expenses") as any
      ).insert({
        module: "labor",
        category_id: categoryId,
        date: date,
        amount: totalAmount,
        site_id: selectedSite.id,
        description: `Daily labor for ${dayjs(date).format("DD MMM YYYY")} - ${activeEntries.length} laborers`,
        payment_mode: "cash",
        is_recurring: false,
        is_cleared: false,
      }).select("id").single();

      if (expenseError) throw expenseError;

      // Record sync
      const { error: syncError } = await (
        supabase.from("attendance_expense_sync") as any
      ).insert({
        attendance_date: date,
        site_id: selectedSite.id,
        expense_id: expense.id,
        total_laborers: activeEntries.length,
        total_work_days: totalWorkDays,
        total_amount: totalAmount,
        synced_by: userProfile.name || userProfile.email,
        synced_by_user_id: userProfile.id,
      });

      if (syncError) throw syncError;

      // Update attendance records as synced
      await (supabase.from("daily_attendance") as any)
        .update({ synced_to_expense: true })
        .eq("site_id", selectedSite.id)
        .eq("date", date);

      setSuccess(`Synced ₹${totalAmount.toLocaleString()} to daily expenses`);
    } catch (err: any) {
      setError("Failed to sync: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const stats = useMemo(() => {
    const present = attendanceEntries.filter((e) => e.work_days > 0).length;
    const totalEarnings = attendanceEntries.reduce(
      (sum, e) => sum + calculateDailyEarnings(e.work_days, e.daily_rate),
      0
    );
    const totalAdvance = attendanceEntries.reduce(
      (sum, e) => sum + (e.advance_given || 0),
      0
    );
    const totalExtra = attendanceEntries.reduce(
      (sum, e) => sum + (e.extra_given || 0),
      0
    );

    return { present, totalEarnings, totalAdvance, totalExtra };
  }, [attendanceEntries]);

  // Payment summary breakdown
  const paymentSummary = useMemo<PaymentSummary>(() => {
    const activeEntries = attendanceEntries.filter((e) => e.work_days > 0);

    const underContract = activeEntries
      .filter((e) => e.subcontract_id)
      .reduce((sum, e) => sum + calculateDailyEarnings(e.work_days, e.daily_rate), 0);

    const outsideContract = activeEntries
      .filter((e) => !e.subcontract_id)
      .reduce((sum, e) => sum + calculateDailyEarnings(e.work_days, e.daily_rate), 0);

    const alreadyPaid = activeEntries
      .filter((e) => e.is_paid)
      .reduce((sum, e) => sum + e.payment_amount, 0);

    const pendingPayment = activeEntries
      .filter((e) => !e.is_paid && e.laborer_type === "daily_market")
      .reduce((sum, e) => sum + calculateDailyEarnings(e.work_days, e.daily_rate), 0);

    return {
      underContract,
      outsideContract,
      alreadyPaid,
      pendingPayment,
      total: underContract + outsideContract,
    };
  }, [attendanceEntries]);

  // Calculate daily summary by category
  const dailySummary = useMemo<DailySummary[]>(() => {
    const summaryMap = new Map<string, DailySummary>();

    attendanceEntries
      .filter((e) => e.work_days > 0)
      .forEach((entry) => {
        const category = entry.category_name;
        const existing = summaryMap.get(category) || {
          category,
          count: 0,
          workDays: 0,
          totalAmount: 0,
        };
        existing.count += 1;
        existing.workDays += entry.work_days;
        existing.totalAmount += calculateDailyEarnings(
          entry.work_days,
          entry.daily_rate
        );
        summaryMap.set(category, existing);
      });

    return Array.from(summaryMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );
  }, [attendanceEntries]);

  const getLaborerTypeBadge = (type: LaborerType) => {
    if (type === "contract") {
      return (
        <Chip
          icon={<GroupIcon sx={{ fontSize: 14 }} />}
          label="CONTRACT"
          size="small"
          color="primary"
          variant="outlined"
          sx={{ ml: 1, height: 20, fontSize: 10 }}
        />
      );
    }
    return (
      <Chip
        icon={<PersonIcon sx={{ fontSize: 14 }} />}
        label="DAILY"
        size="small"
        color="secondary"
        variant="outlined"
        sx={{ ml: 1, height: 20, fontSize: 10 }}
      />
    );
  };

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Attendance Entry" showBack={true} />
        <Alert severity="warning">
          Please select a site to record attendance
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Attendance Entry"
        subtitle={`Record daily attendance for ${selectedSite.name}`}
        onRefresh={fetchData}
        isLoading={loading}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Presence Indicator - Show who else is viewing/editing */}
      <PresenceIndicator activeUsers={activeUsers} />

      {/* Date and Stats Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                fullWidth
                label="Attendance Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Present
                </Typography>
                <Typography variant="h5" fontWeight={600} color="primary">
                  {stats.present}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Earnings
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  ₹{stats.totalEarnings.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Advance
                </Typography>
                <Typography variant="h6" fontWeight={600} color="warning.main">
                  ₹{stats.totalAdvance.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Extra
                </Typography>
                <Typography variant="h6" fontWeight={600} color="success.main">
                  ₹{stats.totalExtra.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3.5 }}>
              <Button
                variant="outlined"
                startIcon={<SyncIcon />}
                onClick={handleSyncToExpenses}
                disabled={syncing || loading || stats.present === 0}
                fullWidth
              >
                {syncing ? "Syncing..." : "Sync to Daily Expenses"}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Payment Summary Card */}
      {stats.present > 0 && (
        <Card sx={{ mb: 3, bgcolor: "grey.50" }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Payment Breakdown
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ p: 1.5, bgcolor: "primary.50", borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Under Subcontract
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="primary.main">
                    ₹{paymentSummary.underContract.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ p: 1.5, bgcolor: "secondary.50", borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    General Work
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="secondary.main">
                    ₹{paymentSummary.outsideContract.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ p: 1.5, bgcolor: "success.50", borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Paid Today
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="success.main">
                    ₹{paymentSummary.alreadyPaid.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ p: 1.5, bgcolor: "warning.50", borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Pending (Daily)
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="warning.main">
                    ₹{paymentSummary.pendingPayment.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Attendance Table */}
      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell width={40}></TableCell>
                <TableCell>Laborer</TableCell>
                <TableCell>Category / Role</TableCell>
                <TableCell>Subcontract</TableCell>
                <TableCell>Rate</TableCell>
                <TableCell>Work Days</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Earnings</TableCell>
                <TableCell align="center">Paid</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : attendanceEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    No laborers found
                  </TableCell>
                </TableRow>
              ) : (
                attendanceEntries.map((entry) => (
                  <React.Fragment key={entry.laborer_id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => toggleExpanded(entry.laborer_id)}
                        >
                          {entry.isExpanded ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Typography variant="body2" fontWeight={500}>
                            {entry.laborer_name}
                          </Typography>
                          {getLaborerTypeBadge(entry.laborer_type)}
                        </Box>
                        {entry.team_name && (
                          <Typography variant="caption" color="text.disabled">
                            Team: {entry.team_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.category_name}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {entry.role_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <Select
                            value={entry.subcontract_id || ""}
                            onChange={(e) =>
                              handleSubcontractChange(
                                entry.laborer_id,
                                e.target.value || null
                              )
                            }
                            disabled={!canEdit || entry.work_days === 0}
                            displayEmpty
                          >
                            <MenuItem value="">
                              <em>General Work</em>
                            </MenuItem>
                            {subcontracts.map((sc) => (
                              <MenuItem key={sc.id} value={sc.id}>
                                {sc.title}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          ₹{entry.daily_rate}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={entry.work_days}
                            onChange={(e) =>
                              handleWorkDaysChange(
                                entry.laborer_id,
                                Number(e.target.value)
                              )
                            }
                            disabled={!canEdit}
                          >
                            <MenuItem value={0}>Absent</MenuItem>
                            <MenuItem value={0.5}>Half Day</MenuItem>
                            <MenuItem value={1}>Full Day</MenuItem>
                            <MenuItem value={1.5}>1.5 Days</MenuItem>
                            <MenuItem value={2}>2 Days</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                          <Select
                            value={entry.section_id}
                            onChange={(e) =>
                              handleSectionChange(
                                entry.laborer_id,
                                e.target.value
                              )
                            }
                            disabled={!canEdit || entry.work_days === 0}
                          >
                            {sections.map((section) => (
                              <MenuItem key={section.id} value={section.id}>
                                {section.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          ₹
                          {calculateDailyEarnings(
                            entry.work_days,
                            entry.daily_rate
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {entry.laborer_type === "daily_market" && entry.work_days > 0 && (
                          <Tooltip title="Mark as paid today">
                            <Checkbox
                              checked={entry.is_paid}
                              onChange={(e) =>
                                handleIsPaidChange(entry.laborer_id, e.target.checked)
                              }
                              disabled={!canEdit}
                              size="small"
                              color="success"
                            />
                          </Tooltip>
                        )}
                        {entry.laborer_type === "contract" && entry.work_days > 0 && (
                          <Tooltip title="Payment via Mesthri">
                            <Chip
                              label="Via Mesthri"
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: 10 }}
                            />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {existingAttendance.has(entry.laborer_id) && (
                          <Chip
                            label="Recorded"
                            size="small"
                            color="success"
                            icon={<CheckCircleIcon />}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={10} sx={{ py: 0, borderBottom: 0 }}>
                        <Collapse
                          in={entry.isExpanded}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box sx={{ p: 2, bgcolor: "action.hover" }}>
                            <Grid container spacing={2}>
                              {/* Payment Details for Daily Market Laborers */}
                              {entry.laborer_type === "daily_market" && entry.is_paid && (
                                <>
                                  <Grid size={12}>
                                    <Divider sx={{ mb: 1 }}>
                                      <Chip
                                        label="Payment Details"
                                        size="small"
                                        icon={<PaymentIcon />}
                                      />
                                    </Divider>
                                  </Grid>
                                  <Grid size={{ xs: 12, md: 2 }}>
                                    <TextField
                                      fullWidth
                                      label="Payment Amount"
                                      type="number"
                                      size="small"
                                      value={entry.payment_amount}
                                      onChange={(e) =>
                                        handlePaymentAmountChange(
                                          entry.laborer_id,
                                          Number(e.target.value)
                                        )
                                      }
                                      disabled={!canEdit}
                                      slotProps={{ input: { startAdornment: "₹" } }}
                                    />
                                  </Grid>
                                  <Grid size={{ xs: 12, md: 2.5 }}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>Payment Mode</InputLabel>
                                      <Select
                                        value={entry.payment_mode}
                                        onChange={(e) =>
                                          handlePaymentModeChange(
                                            entry.laborer_id,
                                            e.target.value as PaymentMode
                                          )
                                        }
                                        label="Payment Mode"
                                        disabled={!canEdit}
                                      >
                                        <MenuItem value="cash">Cash</MenuItem>
                                        <MenuItem value="upi">UPI</MenuItem>
                                        <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid size={{ xs: 12, md: 3.5 }}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel>Payment Channel</InputLabel>
                                      <Select
                                        value={entry.payment_channel}
                                        onChange={(e) =>
                                          handlePaymentChannelChange(
                                            entry.laborer_id,
                                            e.target.value as PaymentChannel
                                          )
                                        }
                                        label="Payment Channel"
                                        disabled={!canEdit}
                                      >
                                        <MenuItem value="via_site_engineer">
                                          Via Site Engineer
                                        </MenuItem>
                                        <MenuItem value="at_office">At Office</MenuItem>
                                        <MenuItem value="company_direct_online">
                                          Company Direct Online
                                        </MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid size={12}>
                                    <Divider sx={{ my: 1 }} />
                                  </Grid>
                                </>
                              )}
                              <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                  fullWidth
                                  label="Advance Given"
                                  type="number"
                                  size="small"
                                  value={entry.advance_given}
                                  onChange={(e) =>
                                    handleAdvanceChange(
                                      entry.laborer_id,
                                      Number(e.target.value)
                                    )
                                  }
                                  disabled={!canEdit || entry.work_days === 0}
                                  slotProps={{ input: { startAdornment: "₹" } }}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                  fullWidth
                                  label="Extra Payment"
                                  type="number"
                                  size="small"
                                  value={entry.extra_given}
                                  onChange={(e) =>
                                    handleExtraChange(
                                      entry.laborer_id,
                                      Number(e.target.value)
                                    )
                                  }
                                  disabled={!canEdit || entry.work_days === 0}
                                  slotProps={{ input: { startAdornment: "₹" } }}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  label="Notes"
                                  size="small"
                                  value={entry.notes}
                                  onChange={(e) =>
                                    handleNotesChange(
                                      entry.laborer_id,
                                      e.target.value
                                    )
                                  }
                                  disabled={!canEdit || entry.work_days === 0}
                                  placeholder="Optional notes"
                                />
                              </Grid>
                            </Grid>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {canEdit && attendanceEntries.length > 0 && (
          <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : "Save Attendance"}
            </Button>
          </Box>
        )}
      </Paper>

      {/* Daily Summary Table */}
      {(showSummary || dailySummary.length > 0) && stats.present > 0 && (
        <Paper sx={{ borderRadius: 3, p: 3 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Daily Summary - {dayjs(date).format("DD MMM YYYY")}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "primary.main" }}>
                  <TableCell sx={{ color: "white", fontWeight: 600 }}>
                    Category
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 600 }}
                    align="center"
                  >
                    Count
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 600 }}
                    align="center"
                  >
                    Work Days
                  </TableCell>
                  <TableCell
                    sx={{ color: "white", fontWeight: 600 }}
                    align="right"
                  >
                    Total Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailySummary.map((row) => (
                  <TableRow key={row.category} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {row.category}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{row.count}</TableCell>
                    <TableCell align="center">{row.workDays}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        ₹{row.totalAmount.toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      TOTAL
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700}>
                      {dailySummary.reduce((sum, r) => sum + r.count, 0)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700}>
                      {dailySummary.reduce((sum, r) => sum + r.workDays, 0)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      color="primary.main"
                    >
                      ₹
                      {dailySummary
                        .reduce((sum, r) => sum + r.totalAmount, 0)
                        .toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
