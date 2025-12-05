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
  Tooltip,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  Visibility,
  Payment as PaymentIcon,
  Calculate as CalculateIcon,
  AttachMoney as MoneyIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import type {
  Contract,
  ContractType,
  ContractStatus,
  MeasurementUnit,
  PaymentMode,
  PaymentType,
} from "@/types/database.types";
import dayjs from "dayjs";

interface ContractWithDetails extends Contract {
  team_name?: string;
  laborer_name?: string;
  site_name?: string;
  total_paid?: number;
  balance_due?: number;
  completion_percentage?: number;
}

export default function CompanyContractsPage() {
  const { userProfile } = useAuth();
  const supabase = createClient();

  const [contracts, setContracts] = useState<ContractWithDetails[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [laborers, setLaborers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [selectedContract, setSelectedContract] =
    useState<ContractWithDetails | null>(null);
  const [error, setError] = useState("");

  // Filters
  const [activeTab, setActiveTab] = useState<ContractStatus | "all">("all");

  // Form state
  const [form, setForm] = useState({
    site_id: "",
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
    is_rate_based: true, // New field to toggle between rate-based and lump sum
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    payment_type: "part_payment" as PaymentType,
    amount: 0,
    payment_date: dayjs().format("YYYY-MM-DD"),
    payment_mode: "cash" as PaymentMode,
    notes: "",
  });

  const canEdit =
    userProfile?.role === "admin" || userProfile?.role === "office";

  // Fetch options
  useEffect(() => {
    const fetchOptions = async () => {
      const [teamsRes, laborersRes, sitesRes] = await Promise.all([
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
          .from("sites")
          .select("id, name")
          .eq("status", "active")
          .order("name"),
      ]);

      setTeams(teamsRes.data || []);
      setLaborers(laborersRes.data || []);
      setSites(sitesRes.data || []);
    };

    fetchOptions();
  }, []);

  // Fetch contracts
  const fetchContracts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("contracts")
        .select(
          `
          *,
          teams(name),
          laborers(name),
          sites(name)
        `
        )
        .order("created_at", { ascending: false });

      if (activeTab !== "all") {
        query = query.eq("status", activeTab);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch payments for each contract
      const contractsWithDetails: ContractWithDetails[] = await Promise.all(
        (data || []).map(async (contract: any) => {
          const { data: payments } = await supabase
            .from("contract_payments")
            .select("amount")
            .eq("contract_id", contract.id);

          const totalPaid =
            payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
          const balanceDue = contract.total_value - totalPaid;
          const completionPercentage =
            contract.total_value > 0
              ? (totalPaid / contract.total_value) * 100
              : 0;

          return {
            ...contract,
            team_name: contract.teams?.name,
            laborer_name: contract.laborers?.name,
            site_name: contract.sites?.name,
            total_paid: totalPaid,
            balance_due: balanceDue,
            completion_percentage: completionPercentage,
          };
        })
      );

      setContracts(contractsWithDetails);
    } catch (err: any) {
      console.error("Error fetching contracts:", err);
      setError("Failed to load contracts: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [activeTab]);

  // Auto-calculate total value for rate-based contracts
  useEffect(() => {
    if (form.is_rate_based && form.rate_per_unit > 0 && form.total_units > 0) {
      const calculatedValue = form.rate_per_unit * form.total_units;
      setForm((prev) => ({
        ...prev,
        total_value: Math.round(calculatedValue * 100) / 100, // Round to 2 decimals
      }));
    }
  }, [form.is_rate_based, form.rate_per_unit, form.total_units]);

  const handleOpenDialog = (contract?: Contract) => {
    if (contract) {
      setEditingContract(contract);
      const isRateBased =
        contract.rate_per_unit > 0 && contract.total_units > 0;
      setForm({
        site_id: contract.site_id || "",
        contract_type: contract.contract_type,
        team_id: contract.team_id || "",
        laborer_id: contract.laborer_id || "",
        title: contract.title,
        description: contract.description || "",
        scope_of_work: contract.scope_of_work || "",
        total_value: contract.total_value,
        measurement_unit: contract.measurement_unit || "sqft",
        rate_per_unit: contract.rate_per_unit || 0,
        total_units: contract.total_units || 0,
        weekly_advance_rate: contract.weekly_advance_rate || 0,
        start_date: contract.start_date,
        expected_end_date: contract.expected_end_date || "",
        status: contract.status,
        is_rate_based: isRateBased,
      });
    } else {
      setEditingContract(null);
      setForm({
        site_id: "",
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
    setEditingContract(null);
  };

  const handleSubmit = async () => {
    if (!userProfile) return;

    if (!form.title || form.total_value <= 0 || !form.site_id) {
      setError("Please fill in all required fields with valid values");
      return;
    }

    if (form.contract_type === "mesthri" && !form.team_id) {
      setError("Please select a team for Mesthri contract");
      return;
    }

    if (form.contract_type === "specialist" && !form.laborer_id) {
      setError("Please select a laborer for Specialist contract");
      return;
    }

    setLoading(true);
    try {
      const contractData = {
        site_id: form.site_id,
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

      if (editingContract) {
        const { error } = await supabase
          .from("contracts")
          .update(contractData)
          .eq("id", editingContract.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("contracts").insert(contractData);

        if (error) throw error;
      }

      await fetchContracts();
      handleCloseDialog();
    } catch (err: any) {
      console.error("Error saving contract:", err);
      setError("Failed to save contract: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contract?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("contracts").delete().eq("id", id);

      if (error) throw error;
      await fetchContracts();
    } catch (err: any) {
      console.error("Error deleting contract:", err);
      setError("Failed to delete contract: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContract = (contract: ContractWithDetails) => {
    setSelectedContract(contract);
    setViewDialogOpen(true);
  };

  const handleOpenPaymentDialog = (contract: ContractWithDetails) => {
    setSelectedContract(contract);
    setPaymentForm({
      payment_type: "part_payment",
      amount: 0,
      payment_date: dayjs().format("YYYY-MM-DD"),
      payment_mode: "cash",
      notes: "",
    });
    setPaymentDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedContract || !userProfile) return;

    if (paymentForm.amount <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    if (paymentForm.amount > (selectedContract.balance_due || 0)) {
      setError("Payment amount cannot exceed balance due");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("contract_payments").insert({
        contract_id: selectedContract.id,
        payment_type: paymentForm.payment_type,
        amount: paymentForm.amount,
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        paid_by: userProfile.id,
        notes: paymentForm.notes || null,
      });

      if (error) throw error;

      // Update contract status if fully paid
      const newTotalPaid =
        (selectedContract.total_paid || 0) + paymentForm.amount;
      if (newTotalPaid >= selectedContract.total_value) {
        await supabase
          .from("contracts")
          .update({ status: "completed" })
          .eq("id", selectedContract.id);
      }

      await fetchContracts();
      setPaymentDialogOpen(false);
      setSelectedContract(null);
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
      completed: "success",
      cancelled: "error",
    };
    return colorMap[status];
  };

  const columns = useMemo<MRT_ColumnDef<ContractWithDetails>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Contract Title",
        size: 200,
        Cell: ({ cell, row }) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {cell.getValue<string>()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.contract_type === "mesthri"
                ? row.original.team_name
                : row.original.laborer_name}
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: "site_name",
        header: "Site",
        size: 150,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "contract_type",
        header: "Type",
        size: 110,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>().toUpperCase()}
            size="small"
            color={
              cell.getValue<string>() === "mesthri" ? "primary" : "secondary"
            }
          />
        ),
      },
      {
        accessorKey: "total_value",
        header: "Contract Value",
        size: 140,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={700}>
            ₹{cell.getValue<number>().toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "total_paid",
        header: "Paid",
        size: 120,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="success.main">
            ₹{(cell.getValue<number>() || 0).toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "balance_due",
        header: "Balance",
        size: 120,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600} color="error.main">
            ₹{(cell.getValue<number>() || 0).toLocaleString()}
          </Typography>
        ),
      },
      {
        accessorKey: "completion_percentage",
        header: "Progress",
        size: 130,
        Cell: ({ cell }) => {
          const percentage = cell.getValue<number>() || 0;
          return (
            <Box sx={{ width: "100%" }}>
              <Typography variant="caption">
                {percentage.toFixed(0)}%
              </Typography>
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
        header: "Status",
        size: 110,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>().toUpperCase()}
            size="small"
            color={getStatusColor(cell.getValue<ContractStatus>())}
          />
        ),
      },
      {
        accessorKey: "is_rate_based",
        header: "Value Type",
        size: 130,
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<boolean>() ? "Rate-Based" : "Lump Sum"}
            size="small"
            color={cell.getValue<boolean>() ? "primary" : "secondary"}
            variant="outlined"
          />
        ),
      },
      {
        id: "mrt-row-actions",
        header: "Actions",
        size: 180,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => handleViewContract(row.original)}
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
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ],
    [canEdit, loading]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = contracts.reduce((sum, c) => sum + c.total_value, 0);
    const paid = contracts.reduce((sum, c) => sum + (c.total_paid || 0), 0);
    const due = contracts.reduce((sum, c) => sum + (c.balance_due || 0), 0);
    const active = contracts.filter((c) => c.status === "active").length;
    const completed = contracts.filter((c) => c.status === "completed").length;

    return { total, paid, due, active, completed, count: contracts.length };
  }, [contracts]);

  return (
    <Box>
      <PageHeader
        title="Contracts Management"
        subtitle="Manage construction contracts across all sites"
        onRefresh={fetchContracts}
        isLoading={loading}
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={!canEdit}
          >
            New Contract
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
                Total Contracts
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
                Contract Value
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

      <DataTable columns={columns} data={contracts} isLoading={loading} />

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingContract ? "Edit Contract" : "New Contract"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Site</InputLabel>
              <Select
                value={form.site_id}
                onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                label="Site"
              >
                {sites.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Contract Type</InputLabel>
                  <Select
                    value={form.contract_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        contract_type: e.target.value as ContractType,
                      })
                    }
                    label="Contract Type"
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
              label="Contract Title"
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
                Contract Value Type
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
                  Lump Sum Contract
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
                        Total Contract Value
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
                label="Total Contract Value"
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
                helperText="Enter the fixed contract amount"
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
            {editingContract ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Contract Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Contract Details</DialogTitle>
        <DialogContent>
          {selectedContract && (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
            >
              <Box>
                <Typography variant="h6" gutterBottom>
                  {selectedContract.title}
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Chip
                    label={selectedContract.status.toUpperCase()}
                    color={getStatusColor(selectedContract.status)}
                    size="small"
                  />
                  <Chip
                    label={selectedContract.site_name}
                    variant="outlined"
                    size="small"
                  />
                </Box>
              </Box>

              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Contract Type
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedContract.contract_type.toUpperCase()}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    {selectedContract.contract_type === "mesthri"
                      ? "Team"
                      : "Laborer"}
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedContract.contract_type === "mesthri"
                      ? selectedContract.team_name
                      : selectedContract.laborer_name}
                  </Typography>
                </Grid>
              </Grid>

              {selectedContract.description && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body2">
                    {selectedContract.description}
                  </Typography>
                </Box>
              )}

              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Contract Value
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ₹{selectedContract.total_value.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Paid
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    ₹{(selectedContract.total_paid || 0).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Balance
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    ₹{(selectedContract.balance_due || 0).toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>

              <LinearProgress
                variant="determinate"
                value={Math.min(
                  selectedContract.completion_percentage || 0,
                  100
                )}
                color={
                  (selectedContract.completion_percentage || 0) >= 100
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
            selectedContract &&
            selectedContract.status !== "completed" && (
              <Button
                variant="contained"
                startIcon={<PaymentIcon />}
                onClick={() => {
                  setViewDialogOpen(false);
                  handleOpenPaymentDialog(selectedContract);
                }}
              >
                Record Payment
              </Button>
            )}
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          {selectedContract && (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
            >
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>{selectedContract.title}</strong>
                </Typography>
                <Typography variant="caption">
                  Balance Due: ₹
                  {(selectedContract.balance_due || 0).toLocaleString()}
                </Typography>
              </Alert>

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
                  <MenuItem value="cheque">Cheque</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Notes"
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, notes: e.target.value })
                }
                multiline
                rows={2}
              />
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
    </Box>
  );
}
