"use client";

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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tabs,
  Tab,
  LinearProgress,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Fab,
} from "@mui/material";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  Add,
  Delete,
  Edit,
  Visibility,
  Payment as PaymentIcon,
  Calculate as CalculateIcon,
  AttachMoney as MoneyIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import SubcontractPaymentBreakdown from "@/components/subcontracts/SubcontractPaymentBreakdown";
import type {
  Subcontract,
  ContractType,
  ContractStatus,
  MeasurementUnit,
  PaymentMode,
  PaymentType,
  PaymentChannel,
} from "@/types/database.types";
import dayjs from "dayjs";

interface SubcontractWithDetails extends Subcontract {
  team_name?: string;
  laborer_name?: string;
  total_paid?: number;
  balance_due?: number;
  completion_percentage?: number;
}

export default function SiteSubcontractsPage() {
  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const [subcontracts, setSubcontracts] = useState<SubcontractWithDetails[]>(
    []
  );
  const [teams, setTeams] = useState<any[]>([]);
  const [laborers, setLaborers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingSubcontract, setEditingSubcontract] = useState<Subcontract | null>(
    null
  );
  const [selectedSubcontract, setSelectedSubcontract] =
    useState<SubcontractWithDetails | null>(null);
  const [error, setError] = useState("");

  // Filters
  const [activeTab, setActiveTab] = useState<ContractStatus | "all">("all");

  // Form state (no site_id - will use selectedSite.id)
  const [form, setForm] = useState({
    contract_type: "mesthri" as ContractType,
    team_id: "",
    laborer_id: "",
    title: "",
    description: "",
    scope_of_work: "",
    total_value: 0,
    measurement_unit: "sqft" as MeasurementUnit,
    rate_per_unit: 0,
    total_units: 0,
    weekly_advance_rate: 0,
    start_date: dayjs().format("YYYY-MM-DD"),
    expected_end_date: "",
    status: "draft" as ContractStatus,
    is_rate_based: true,
  });

  // Payment form - Enhanced with payment channel and period tracking
  const [paymentForm, setPaymentForm] = useState({
    payment_type: "part_payment" as PaymentType,
    amount: 0,
    payment_date: dayjs().format("YYYY-MM-DD"),
    payment_mode: "cash" as PaymentMode,
    payment_channel: "via_site_engineer" as PaymentChannel,
    period_from_date: dayjs().subtract(6, "day").format("YYYY-MM-DD"),
    period_to_date: dayjs().format("YYYY-MM-DD"),
    notes: "",
  });

  // Site engineers list for payment channel
  const [siteEngineers, setSiteEngineers] = useState<any[]>([]);
  const [selectedSiteEngineer, setSelectedSiteEngineer] = useState<string>("");

  const canEdit = hasEditPermission(userProfile?.role);

  // Fetch teams, laborers, and site engineers
  useEffect(() => {
    const fetchOptions = async () => {
      const [teamsRes, laborersRes, engineersRes] = await Promise.all([
        supabase
          .from("teams")
          .select("id, name")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("laborers")
          .select("id, name")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("users")
          .select("id, name, role")
          .in("role", ["site_engineer", "admin", "office"])
          .order("name"),
      ]);

      setTeams(teamsRes.data || []);
      setLaborers(laborersRes.data || []);
      setSiteEngineers(engineersRes.data || []);
    };

    fetchOptions();
  }, []);

  // Fetch subcontracts for selected site
  const fetchSubcontracts = async () => {
    if (!selectedSite) return;

    setLoading(true);
    try {
      // Note: We avoid nested joins like teams(name), laborers(name) to prevent FK ambiguity issues
      // Teams and laborers are already fetched separately in fetchOptions
      let query = supabase
        .from("subcontracts")
        .select("*")
        .eq("site_id", selectedSite.id)
        .order("created_at", { ascending: false });

      if (activeTab !== "all") {
        query = query.eq("status", activeTab);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch payments for each subcontract (including labor payments and cleared expenses)
      const subcontractsWithDetails: SubcontractWithDetails[] =
        await Promise.all(
          (data || []).map(async (subcontract: any) => {
            // 1. Get direct subcontract_payments
            const { data: payments } = await supabase
              .from("subcontract_payments")
              .select("amount")
              .eq("subcontract_id", subcontract.id);

            const directPaid =
              (payments as { amount: number }[] | null)?.reduce(
                (sum, p) => sum + p.amount,
                0
              ) || 0;

            // 2. Get labor_payments linked to this subcontract
            const { data: laborPaymentsData } = await supabase
              .from("labor_payments")
              .select("amount")
              .eq("subcontract_id", subcontract.id);

            const laborPaid =
              (laborPaymentsData as { amount: number }[] | null)?.reduce(
                (sum, p) => sum + p.amount,
                0
              ) || 0;

            // 3. Get cleared expenses linked to this subcontract
            const { data: expensesData } = await supabase
              .from("expenses")
              .select("amount")
              .eq("contract_id", subcontract.id)
              .eq("is_deleted", false)
              .eq("is_cleared", true);

            const expensesPaid =
              (expensesData as { amount: number }[] | null)?.reduce(
                (sum, e) => sum + e.amount,
                0
              ) || 0;

            // Total = all three sources
            const totalPaid = directPaid + laborPaid + expensesPaid;
            const balanceDue = subcontract.total_value - totalPaid;
            const completionPercentage =
              subcontract.total_value > 0
                ? (totalPaid / subcontract.total_value) * 100
                : 0;

            // Lookup team and laborer names from already-fetched data
            const teamName = subcontract.team_id
              ? teams.find((t) => t.id === subcontract.team_id)?.name
              : undefined;
            const laborerName = subcontract.laborer_id
              ? laborers.find((l) => l.id === subcontract.laborer_id)?.name
              : undefined;

            return {
              ...subcontract,
              team_name: teamName,
              laborer_name: laborerName,
              total_paid: totalPaid,
              balance_due: balanceDue,
              completion_percentage: completionPercentage,
            };
          })
        );

      setSubcontracts(subcontractsWithDetails);
    } catch (err: any) {
      console.error("Error fetching subcontracts:", err);
      setError("Failed to load subcontracts: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSite && teams.length > 0) {
      fetchSubcontracts();
    }
  }, [activeTab, selectedSite, teams, laborers]);

  // Auto-calculate total value for rate-based contracts
  useEffect(() => {
    if (form.is_rate_based && form.rate_per_unit > 0 && form.total_units > 0) {
      const calculatedValue = form.rate_per_unit * form.total_units;
      setForm((prev) => ({
        ...prev,
        total_value: Math.round(calculatedValue * 100) / 100,
      }));
    }
  }, [form.is_rate_based, form.rate_per_unit, form.total_units]);

  const handleOpenDialog = (subcontract?: Subcontract) => {
    if (subcontract) {
      setEditingSubcontract(subcontract);
      const isRateBased =
        (subcontract.rate_per_unit ?? 0) > 0 && (subcontract.total_units ?? 0) > 0;
      setForm({
        contract_type: subcontract.contract_type,
        team_id: subcontract.team_id || "",
        laborer_id: subcontract.laborer_id || "",
        title: subcontract.title,
        description: subcontract.description || "",
        scope_of_work: subcontract.scope_of_work || "",
        total_value: subcontract.total_value,
        measurement_unit: subcontract.measurement_unit || "sqft",
        rate_per_unit: subcontract.rate_per_unit || 0,
        total_units: subcontract.total_units || 0,
        weekly_advance_rate: subcontract.weekly_advance_rate || 0,
        start_date: subcontract.start_date || "",
        expected_end_date: subcontract.expected_end_date || "",
        status: subcontract.status,
        is_rate_based: isRateBased,
      });
    } else {
      setEditingSubcontract(null);
      setForm({
        contract_type: "mesthri",
        team_id: "",
        laborer_id: "",
        title: "",
        description: "",
        scope_of_work: "",
        total_value: 0,
        measurement_unit: "sqft",
        rate_per_unit: 0,
        total_units: 0,
        weekly_advance_rate: 0,
        start_date: dayjs().format("YYYY-MM-DD"),
        expected_end_date: "",
        status: "draft",
        is_rate_based: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSubcontract(null);
  };

  const handleSubmit = async () => {
    if (!userProfile || !selectedSite) return;

    if (!form.title || form.total_value <= 0) {
      setError("Please fill in all required fields with valid values");
      return;
    }

    if (form.contract_type === "mesthri" && !form.team_id) {
      setError("Please select a team for Mesthri subcontract");
      return;
    }

    if (form.contract_type === "specialist" && !form.laborer_id) {
      setError("Please select a laborer for Specialist subcontract");
      return;
    }

    setLoading(true);
    try {
      const subcontractData = {
        site_id: selectedSite.id, // Auto-set from selected site
        contract_type: form.contract_type,
        team_id: form.contract_type === "mesthri" ? form.team_id : null,
        laborer_id:
          form.contract_type === "specialist" ? form.laborer_id : null,
        title: form.title,
        description: form.description || null,
        scope_of_work: form.scope_of_work || null,
        total_value: form.total_value,
        is_rate_based: form.is_rate_based,
        measurement_unit: form.measurement_unit,
        rate_per_unit: form.rate_per_unit || null,
        total_units: form.total_units || null,
        weekly_advance_rate: form.weekly_advance_rate || null,
        start_date: form.start_date,
        expected_end_date: form.expected_end_date || null,
        status: form.status,
      };

      if (editingSubcontract) {
        const { error } = await (supabase.from("subcontracts") as any)
          .update(subcontractData)
          .eq("id", editingSubcontract.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase.from("subcontracts") as any).insert(
          subcontractData
        );

        if (error) throw error;
      }

      await fetchSubcontracts();
      handleCloseDialog();
    } catch (err: any) {
      console.error("Error saving subcontract:", err);
      setError("Failed to save subcontract: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subcontract?")) return;

    setLoading(true);
    try {
      const { error } = await (supabase.from("subcontracts") as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchSubcontracts();
    } catch (err: any) {
      console.error("Error deleting subcontract:", err);
      setError("Failed to delete subcontract: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSubcontract = (subcontract: SubcontractWithDetails) => {
    setSelectedSubcontract(subcontract);
    setViewDialogOpen(true);
  };

  const handleOpenPaymentDialog = (subcontract: SubcontractWithDetails) => {
    setSelectedSubcontract(subcontract);
    setPaymentForm({
      payment_type: "part_payment",
      amount: 0,
      payment_date: dayjs().format("YYYY-MM-DD"),
      payment_mode: "cash",
      payment_channel: "via_site_engineer",
      period_from_date: dayjs().subtract(6, "day").format("YYYY-MM-DD"),
      period_to_date: dayjs().format("YYYY-MM-DD"),
      notes: "",
    });
    setSelectedSiteEngineer("");
    setPaymentDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedSubcontract || !userProfile || !selectedSite) return;

    if (paymentForm.amount <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    if (paymentForm.amount > (selectedSubcontract.balance_due || 0)) {
      setError("Payment amount cannot exceed balance due");
      return;
    }

    // Validate site engineer selection when channel is via_site_engineer
    if (paymentForm.payment_channel === "via_site_engineer" && !selectedSiteEngineer) {
      setError("Please select which site engineer made this payment");
      return;
    }

    setLoading(true);
    try {
      let siteEngineerTransactionId: string | null = null;

      // If payment is via site engineer, create a wallet transaction first
      if (paymentForm.payment_channel === "via_site_engineer" && selectedSiteEngineer) {
        const { data: txData, error: txError } = await (
          supabase.from("site_engineer_transactions") as any
        ).insert({
          user_id: selectedSiteEngineer,
          transaction_type: "spent_on_behalf",
          amount: paymentForm.amount,
          transaction_date: paymentForm.payment_date,
          site_id: selectedSite.id,
          description: `Payment to Mesthri - ${selectedSubcontract.title}`,
          recipient_type: "mesthri",
          recipient_id: selectedSubcontract.team_id,
          payment_mode: paymentForm.payment_mode,
          related_subcontract_id: selectedSubcontract.id,
          is_settled: false,
          notes: paymentForm.notes || null,
          recorded_by: userProfile.name || userProfile.email,
          recorded_by_user_id: userProfile.id,
        }).select("id").single();

        if (txError) throw txError;
        siteEngineerTransactionId = txData?.id || null;
      }

      // Get the payer name based on channel
      let paidByName = userProfile.name || "Unknown";
      if (paymentForm.payment_channel === "via_site_engineer" && selectedSiteEngineer) {
        const engineer = siteEngineers.find(e => e.id === selectedSiteEngineer);
        paidByName = engineer?.name || "Site Engineer";
      } else if (paymentForm.payment_channel === "mesthri_at_office") {
        paidByName = "Office Staff";
      } else if (paymentForm.payment_channel === "company_direct_online") {
        paidByName = "Company (Online Transfer)";
      }

      // Calculate balance after this payment
      const balanceAfterPayment = (selectedSubcontract.balance_due || 0) - paymentForm.amount;

      // Record the payment with enhanced fields
      const { error } = await (
        supabase.from("subcontract_payments") as any
      ).insert({
        subcontract_id: selectedSubcontract.id,
        payment_type: paymentForm.payment_type,
        amount: paymentForm.amount,
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        payment_channel: paymentForm.payment_channel,
        paid_by: paidByName,
        paid_by_user_id: paymentForm.payment_channel === "via_site_engineer" ? selectedSiteEngineer : userProfile.id,
        period_from_date: paymentForm.period_from_date,
        period_to_date: paymentForm.period_to_date,
        balance_after_payment: balanceAfterPayment,
        site_engineer_transaction_id: siteEngineerTransactionId,
        recorded_by: userProfile.name || userProfile.email,
        recorded_by_user_id: userProfile.id,
        notes: paymentForm.notes || null,
      });

      if (error) throw error;

      // Update subcontract status if fully paid
      const newTotalPaid =
        (selectedSubcontract.total_paid || 0) + paymentForm.amount;
      if (newTotalPaid >= selectedSubcontract.total_value) {
        await (supabase.from("subcontracts") as any)
          .update({ status: "completed" })
          .eq("id", selectedSubcontract.id);
      }

      await fetchSubcontracts();
      setPaymentDialogOpen(false);
      setSelectedSubcontract(null);
    } catch (err: any) {
      console.error("Error recording payment:", err);
      setError("Failed to record payment: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ContractStatus): any => {
    const colorMap: Record<ContractStatus, any> = {
      draft: "default",
      active: "primary",
      on_hold: "warning",
      completed: "success",
      cancelled: "error",
    };
    return colorMap[status];
  };

  // Table columns (no site column since we're already in site context)
  const columns = useMemo<MRT_ColumnDef<SubcontractWithDetails>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        size: isMobile ? 120 : 220,
        Cell: ({ cell, row }) => (
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ fontSize: isMobile ? '0.7rem' : 'inherit' }}>
              {cell.getValue<string>()}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.6rem' : 'inherit' }}>
              {row.original.contract_type === "mesthri"
                ? row.original.team_name
                : row.original.laborer_name}
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: "contract_type",
        header: isMobile ? "Type" : "Type",
        size: isMobile ? 55 : 110,
        Cell: ({ cell }) => (
          <Chip
            label={isMobile ? (cell.getValue<string>() === "mesthri" ? "M" : "S") : cell.getValue<string>().toUpperCase()}
            size="small"
            color={
              cell.getValue<string>() === "mesthri" ? "primary" : "secondary"
            }
          />
        ),
      },
      {
        accessorKey: "total_value",
        header: isMobile ? "Value" : "Subcontract Value",
        size: isMobile ? 80 : 150,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: isMobile ? '0.7rem' : 'inherit' }}>
            ₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "total_paid",
        header: "Paid",
        size: isMobile ? 70 : 120,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="success.main" sx={{ fontSize: isMobile ? '0.7rem' : 'inherit' }}>
            ₹{(cell.getValue<number>() || 0).toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "balance_due",
        header: isMobile ? "Due" : "Balance",
        size: isMobile ? 70 : 120,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="error.main" sx={{ fontSize: isMobile ? '0.7rem' : 'inherit' }}>
            ₹{(cell.getValue<number>() || 0).toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "completion_percentage",
        header: isMobile ? "%" : "Progress",
        size: isMobile ? 50 : 130,
        Cell: ({ cell }) => {
          const percentage = cell.getValue<number>() || 0;
          return isMobile ? (
            <Typography variant="caption" fontWeight={600}>
              {percentage.toFixed(0)}%
            </Typography>
          ) : (
            <Box sx={{ width: "100%" }}>
              <Typography variant="caption">{percentage.toFixed(0)}%</Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(percentage, 100)}
                color={
                  percentage >= 100
                    ? "success"
                    : percentage >= 50
                    ? "primary"
                    : "warning"
                }
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
          );
        },
      },
      {
        accessorKey: "status",
        header: isMobile ? "St" : "Status",
        size: isMobile ? 50 : 110,
        Cell: ({ cell }) => (
          <Chip
            label={isMobile
              ? cell.getValue<string>().charAt(0).toUpperCase()
              : cell.getValue<string>().toUpperCase()}
            size="small"
            color={getStatusColor(cell.getValue<ContractStatus>())}
          />
        ),
      },
      {
        accessorKey: "is_rate_based",
        header: "Type",
        size: 100,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<boolean>() ? "Rate" : "Lump"}
            size="small"
            color={cell.getValue<boolean>() ? "primary" : "secondary"}
            variant="outlined"
          />
        ),
      },
      {
        id: "mrt-row-actions",
        header: "",
        size: isMobile ? 100 : 180,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.25 }}>
            <IconButton
              size="small"
              onClick={() => handleViewSubcontract(row.original)}
            >
              <Visibility fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(row.original)}
              disabled={!canEdit || loading}
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleOpenPaymentDialog(row.original)}
              disabled={
                !canEdit || loading || row.original.status === "completed"
              }
            >
              <PaymentIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDelete(row.original.id)}
              disabled={!canEdit || loading}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ],
    [canEdit, loading, isMobile]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = subcontracts.reduce((sum, c) => sum + c.total_value, 0);
    const paid = subcontracts.reduce((sum, c) => sum + (c.total_paid || 0), 0);
    const due = subcontracts.reduce((sum, c) => sum + (c.balance_due || 0), 0);
    const active = subcontracts.filter((c) => c.status === "active").length;
    const completed = subcontracts.filter(
      (c) => c.status === "completed"
    ).length;

    return { total, paid, due, active, completed, count: subcontracts.length };
  }, [subcontracts]);

  // Show message if no site selected
  if (!selectedSite) {
    return (
      <Box>
        <PageHeader
          title="Sub Contract Management"
          subtitle="Manage subcontracts for this site"
        />
        <Alert severity="info" sx={{ mt: 2 }}>
          Please select a site from the site selector to view and manage
          subcontracts.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Sub Contract Management"
        subtitle={`Manage subcontracts for ${selectedSite.name}`}
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={!canEdit}
            size="small"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            New Subcontract
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Subcontracts
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {stats.count}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Subcontract Value
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                ₹{stats.total.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card sx={{ bgcolor: "success.light" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Paid
              </Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">
                ₹{stats.paid.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card sx={{ bgcolor: "error.light" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Balance Due
              </Typography>
              <Typography variant="h5" fontWeight={700} color="error.main">
                ₹{stats.due.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Active / Completed
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {stats.active} / {stats.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: "16px !important" }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="All" value="all" />
            <Tab label="Draft" value="draft" />
            <Tab label="Active" value="active" />
            <Tab label="Completed" value="completed" />
            <Tab label="Cancelled" value="cancelled" />
          </Tabs>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={subcontracts}
        isLoading={loading}
        enableExpanding={!isMobile}
        pinnedColumns={{
          left: ["title"],
          right: ["mrt-row-actions"],
        }}
        mobileHiddenColumns={["is_rate_based"]}
        renderDetailPanel={({ row }) => (
          <SubcontractPaymentBreakdown
            subcontractId={row.original.id}
            totalValue={row.original.total_value}
          />
        )}
      />

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingSubcontract ? "Edit Subcontract" : "New Subcontract"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Subcontract Type</InputLabel>
                  <Select
                    value={form.contract_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        contract_type: e.target.value as ContractType,
                      })
                    }
                    label="Subcontract Type"
                  >
                    <MenuItem value="mesthri">Mesthri (Team Based)</MenuItem>
                    <MenuItem value="specialist">
                      Specialist (Individual)
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                {form.contract_type === "mesthri" ? (
                  <FormControl fullWidth required>
                    <InputLabel>Team</InputLabel>
                    <Select
                      value={form.team_id}
                      onChange={(e) =>
                        setForm({ ...form, team_id: e.target.value })
                      }
                      label="Team"
                    >
                      {teams.map((team) => (
                        <MenuItem key={team.id} value={team.id}>
                          {team.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <FormControl fullWidth required>
                    <InputLabel>Laborer</InputLabel>
                    <Select
                      value={form.laborer_id}
                      onChange={(e) =>
                        setForm({ ...form, laborer_id: e.target.value })
                      }
                      label="Laborer"
                    >
                      {laborers.map((laborer) => (
                        <MenuItem key={laborer.id} value={laborer.id}>
                          {laborer.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Grid>
            </Grid>

            <TextField
              fullWidth
              label="Subcontract Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="e.g., Plastering Work - Ground Floor"
            />

            <TextField
              fullWidth
              label="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              multiline
              rows={2}
            />

            <TextField
              fullWidth
              label="Scope of Work"
              value={form.scope_of_work}
              onChange={(e) =>
                setForm({ ...form, scope_of_work: e.target.value })
              }
              multiline
              rows={3}
            />

            <Divider sx={{ my: 2 }} />

            {/* Contract Value Type Toggle */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
                sx={{ mb: 1.5 }}
              >
                Subcontract Value Type
              </Typography>
              <ToggleButtonGroup
                value={form.is_rate_based ? "rate" : "lumpsum"}
                exclusive
                onChange={(e, value) => {
                  if (value !== null) {
                    setForm({
                      ...form,
                      is_rate_based: value === "rate",
                      total_value: value === "rate" ? 0 : form.total_value,
                      rate_per_unit: value === "rate" ? form.rate_per_unit : 0,
                      total_units: value === "rate" ? form.total_units : 0,
                    });
                  }
                }}
                fullWidth
                sx={{
                  "& .MuiToggleButton-root": {
                    py: 1.5,
                    textTransform: "none",
                    fontWeight: 500,
                  },
                  "& .Mui-selected": {
                    backgroundColor: "primary.main",
                    color: "white",
                    "&:hover": {
                      backgroundColor: "primary.dark",
                    },
                  },
                }}
              >
                <ToggleButton value="rate">
                  <CalculateIcon sx={{ mr: 1, fontSize: 20 }} />
                  Rate-Based (Per Unit)
                </ToggleButton>
                <ToggleButton value="lumpsum">
                  <MoneyIcon sx={{ mr: 1, fontSize: 20 }} />
                  Lump Sum Subcontract
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Rate-Based Contract Fields */}
            {form.is_rate_based ? (
              <>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Measurement Unit</InputLabel>
                      <Select
                        value={form.measurement_unit}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            measurement_unit: e.target.value as MeasurementUnit,
                          })
                        }
                        label="Measurement Unit"
                      >
                        <MenuItem value="sqft">Square Feet (sqft)</MenuItem>
                        <MenuItem value="rft">Running Feet (rft)</MenuItem>
                        <MenuItem value="nos">Numbers (nos)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Rate per Unit"
                      type="number"
                      value={form.rate_per_unit || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          rate_per_unit: Number(e.target.value),
                        })
                      }
                      required
                      slotProps={{
                        input: {
                          startAdornment: "₹",
                        },
                      }}
                    />
                  </Grid>
                </Grid>

                <TextField
                  fullWidth
                  label={`Total Units (${form.measurement_unit})`}
                  type="number"
                  value={form.total_units || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      total_units: Number(e.target.value),
                    })
                  }
                  required
                  slotProps={{
                    input: {
                      endAdornment: form.measurement_unit,
                    },
                  }}
                />

                {/* Calculated Total Value Display */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: "primary.50",
                    border: "2px solid",
                    borderColor: "primary.main",
                    borderRadius: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Subcontract Value
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                      >
                        {form.rate_per_unit > 0 && form.total_units > 0 ? (
                          <>
                            ₹{form.rate_per_unit.toLocaleString()} ×{" "}
                            {form.total_units.toLocaleString()}{" "}
                            {form.measurement_unit}
                          </>
                        ) : (
                          "Enter rate and units to calculate"
                        )}
                      </Typography>
                    </Box>
                    <Typography
                      variant="h5"
                      fontWeight={700}
                      color="primary.main"
                    >
                      ₹{form.total_value.toLocaleString()}
                    </Typography>
                  </Box>
                </Paper>
              </>
            ) : (
              /* Lump Sum Contract Fields */
              <TextField
                fullWidth
                label="Total Subcontract Value"
                type="number"
                value={form.total_value || ""}
                onChange={(e) =>
                  setForm({ ...form, total_value: Number(e.target.value) })
                }
                required
                slotProps={{
                  input: {
                    startAdornment: "₹",
                  },
                }}
                helperText="Enter the fixed subcontract amount"
              />
            )}

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Expected End Date"
                  type="date"
                  value={form.expected_end_date}
                  onChange={(e) =>
                    setForm({ ...form, expected_end_date: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>

            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ContractStatus })
                }
                label="Status"
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {editingSubcontract ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Subcontract Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Subcontract Details</DialogTitle>
        <DialogContent>
          {selectedSubcontract && (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
            >
              <Box>
                <Typography variant="h6" gutterBottom>
                  {selectedSubcontract.title}
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Chip
                    label={selectedSubcontract.status.toUpperCase()}
                    color={getStatusColor(selectedSubcontract.status)}
                    size="small"
                  />
                </Box>
              </Box>

              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Subcontract Type
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedSubcontract.contract_type.toUpperCase()}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {selectedSubcontract.contract_type === "mesthri"
                      ? "Team"
                      : "Laborer"}
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedSubcontract.contract_type === "mesthri"
                      ? selectedSubcontract.team_name
                      : selectedSubcontract.laborer_name}
                  </Typography>
                </Grid>
              </Grid>

              {selectedSubcontract.description && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body2">
                    {selectedSubcontract.description}
                  </Typography>
                </Box>
              )}

              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Subcontract Value
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ₹{selectedSubcontract.total_value.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Paid
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    ₹{(selectedSubcontract.total_paid || 0).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Balance
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    ₹{(selectedSubcontract.balance_due || 0).toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>

              <LinearProgress
                variant="determinate"
                value={Math.min(
                  selectedSubcontract.completion_percentage || 0,
                  100
                )}
                color={
                  (selectedSubcontract.completion_percentage || 0) >= 100
                    ? "success"
                    : "primary"
                }
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          {canEdit &&
            selectedSubcontract &&
            selectedSubcontract.status !== "completed" && (
              <Button
                variant="contained"
                startIcon={<PaymentIcon />}
                onClick={() => {
                  setViewDialogOpen(false);
                  handleOpenPaymentDialog(selectedSubcontract);
                }}
              >
                Record Payment
              </Button>
            )}
        </DialogActions>
      </Dialog>

      {/* Payment Dialog - Enhanced with payment channel and period tracking */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Record Payment to Mesthri</DialogTitle>
        <DialogContent>
          {selectedSubcontract && (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
            >
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>{selectedSubcontract.title}</strong>
                  {selectedSubcontract.team_name && (
                    <> - {selectedSubcontract.team_name}</>
                  )}
                </Typography>
                <Typography variant="caption">
                  Contract Value: ₹{selectedSubcontract.total_value.toLocaleString()} |
                  Paid: ₹{(selectedSubcontract.total_paid || 0).toLocaleString()} |
                  Balance Due: ₹{(selectedSubcontract.balance_due || 0).toLocaleString()}
                </Typography>
              </Alert>

              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                Payment Channel (How was the payment made?)
              </Typography>

              <FormControl fullWidth required>
                <InputLabel>Payment Channel</InputLabel>
                <Select
                  value={paymentForm.payment_channel}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      payment_channel: e.target.value as PaymentChannel,
                    })
                  }
                  label="Payment Channel"
                >
                  <MenuItem value="via_site_engineer">
                    Via Site Engineer (Engineer pays on company&apos;s behalf)
                  </MenuItem>
                  <MenuItem value="mesthri_at_office">
                    Mesthri at Office (Mesthri came to office to collect)
                  </MenuItem>
                  <MenuItem value="company_direct_online">
                    Company Direct Online (UPI/Bank Transfer from company)
                  </MenuItem>
                </Select>
              </FormControl>

              {/* Site Engineer Selection - Only shown when via_site_engineer */}
              {paymentForm.payment_channel === "via_site_engineer" && (
                <FormControl fullWidth required>
                  <InputLabel>Site Engineer</InputLabel>
                  <Select
                    value={selectedSiteEngineer}
                    onChange={(e) => setSelectedSiteEngineer(e.target.value)}
                    label="Site Engineer"
                  >
                    {siteEngineers.map((eng) => (
                      <MenuItem key={eng.id} value={eng.id}>
                        {eng.name} ({eng.role})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {paymentForm.payment_channel === "via_site_engineer" && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  <Typography variant="caption">
                    This will automatically deduct ₹{paymentForm.amount.toLocaleString() || 0} from the selected engineer&apos;s wallet balance.
                  </Typography>
                </Alert>
              )}

              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Type</InputLabel>
                    <Select
                      value={paymentForm.payment_type}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          payment_type: e.target.value as PaymentType,
                        })
                      }
                      label="Payment Type"
                    >
                      <MenuItem value="weekly_advance">Weekly Advance</MenuItem>
                      <MenuItem value="part_payment">Part Payment</MenuItem>
                      <MenuItem value="milestone">Milestone Payment</MenuItem>
                      <MenuItem value="final_settlement">Final Settlement</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Amount"
                    type="number"
                    value={paymentForm.amount || ""}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        amount: Number(e.target.value),
                      })
                    }
                    required
                    slotProps={{ input: { startAdornment: "₹" } }}
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                Period Covered by this Payment
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Period From"
                    type="date"
                    value={paymentForm.period_from_date}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        period_from_date: e.target.value,
                      })
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Period To"
                    type="date"
                    value={paymentForm.period_to_date}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        period_to_date: e.target.value,
                      })
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Payment Date"
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_date: e.target.value,
                      })
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Mode</InputLabel>
                    <Select
                      value={paymentForm.payment_mode}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          payment_mode: e.target.value as PaymentMode,
                        })
                      }
                      label="Payment Mode"
                    >
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="upi">UPI</MenuItem>
                      <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <TextField
                fullWidth
                label="Notes"
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, notes: e.target.value })
                }
                multiline
                rows={2}
                placeholder="Any additional notes about this payment..."
              />

              {/* Balance after payment preview */}
              {paymentForm.amount > 0 && (
                <Paper elevation={0} sx={{ p: 2, bgcolor: "action.selected", borderRadius: 2 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Current Balance
                      </Typography>
                      <Typography variant="body1" fontWeight={600} color="error.main">
                        ₹{(selectedSubcontract.balance_due || 0).toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        After This Payment
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={600}
                        color={(selectedSubcontract.balance_due || 0) - paymentForm.amount <= 0 ? "success.main" : "warning.main"}
                      >
                        ₹{Math.max(0, (selectedSubcontract.balance_due || 0) - paymentForm.amount).toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRecordPayment}
            variant="contained"
            disabled={loading}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mobile FAB - always rendered, visibility controlled by CSS */}
      <Fab
        color="primary"
        onClick={() => handleOpenDialog()}
        disabled={!canEdit}
        sx={{
          display: canEdit ? { xs: 'flex', sm: 'none' } : 'none',
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
}
