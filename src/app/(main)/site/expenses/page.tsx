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
  FormControlLabel,
  Switch,
  IconButton,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  AttachMoney,
  TrendingUp,
  Category as CategoryIcon,
  OpenInNew,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import RedirectConfirmDialog from "@/components/common/RedirectConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import type {
  Expense,
  ExpenseModule,
  PaymentMode,
} from "@/types/database.types";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import {
  Description as ContractIcon,
  AccountBalance as BalanceIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import {
  getSiteSubcontractTotals,
  type SubcontractTotals,
} from "@/lib/services/subcontractService";

interface SitePayer {
  id: string;
  name: string;
  is_active: boolean;
}

interface ExpenseWithCategory extends Expense {
  category_name?: string;
  payer_name?: string;
  subcontract_title?: string;
  settlement_reference?: string | null;
  source_type?: "expense" | "settlement" | "misc_expense" | "tea_shop_settlement" | "subcontract_payment";
  source_id?: string;
  expense_type?: string;
  recorded_date?: string;
}

export default function ExpensesPage() {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const { formatForApi, isAllTime } = useDateRange();
  const supabase = createClient();
  const router = useRouter();

  const { dateFrom, dateTo } = formatForApi();

  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<ExpenseModule | "all" | "miscellaneous">("all");

  // Multi-payer state
  const [hasMultiplePayers, setHasMultiplePayers] = useState(false);
  const [sitePayers, setSitePayers] = useState<SitePayer[]>([]);

  // Subcontract summary state
  const [subcontracts, setSubcontracts] = useState<SubcontractTotals[]>([]);
  const [subcontractsLoading, setSubcontractsLoading] = useState(false);

  // Redirect dialog state for salary expenses that can't be deleted directly
  const [redirectDialog, setRedirectDialog] = useState<{
    open: boolean;
    expense: ExpenseWithCategory | null;
  }>({ open: false, expense: null });

  const [form, setForm] = useState({
    module: "general" as ExpenseModule,
    category_id: "",
    date: dayjs().format("YYYY-MM-DD"),
    amount: 0,
    vendor_name: "",
    description: "",
    payment_mode: "cash" as PaymentMode,
    is_cleared: false,
    site_payer_id: "",
  });

  const canEdit = hasEditPermission(userProfile?.role);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from("expense_categories")
        .select("*")
        .order("module")
        .order("name");
      setCategories(data || []);
    };
    fetchCategories();
  }, []);

  // Fetch subcontracts with payment totals using shared service
  const fetchSubcontracts = async () => {
    if (!selectedSite?.id) {
      setSubcontracts([]);
      return;
    }

    setSubcontractsLoading(true);
    try {
      // Use shared service for consistent calculation across all pages
      // totalPaid = subcontract_payments + settlement_groups + cleared expenses
      // Include ALL subcontract statuses to match payments page totals
      const summaries = await getSiteSubcontractTotals(
        supabase,
        selectedSite.id,
        ["active", "on_hold", "completed", "draft", "cancelled"]
      );
      setSubcontracts(summaries);
    } catch (err) {
      console.error("Error fetching subcontracts:", err);
    } finally {
      setSubcontractsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubcontracts();
  }, [selectedSite?.id]);

  // Fetch multi-payer settings when site changes
  useEffect(() => {
    const fetchPayerSettings = async () => {
      if (!selectedSite) {
        setHasMultiplePayers(false);
        setSitePayers([]);
        return;
      }

      try {
        // Fetch site's multi-payer setting
        // Note: Using type assertion until migration is run and types regenerated
        const { data: siteData } = await supabase
          .from("sites")
          .select("*")
          .eq("id", selectedSite.id)
          .single();

        const isMultiPayer = (siteData as any)?.has_multiple_payers || false;
        setHasMultiplePayers(isMultiPayer);

        // Fetch payers if multi-payer is enabled
        if (isMultiPayer) {
          // Note: Using type assertion until migration is run and types regenerated
          const { data: payersData } = await (supabase as any)
            .from("site_payers")
            .select("id, name, is_active")
            .eq("site_id", selectedSite.id)
            .eq("is_active", true)
            .order("name");
          setSitePayers(payersData || []);
        } else {
          setSitePayers([]);
        }
      } catch (err) {
        console.error("Error fetching payer settings:", err);
      }
    };

    fetchPayerSettings();
  }, [selectedSite]);

  const fetchExpenses = async () => {
    if (!selectedSite) return;
    setLoading(true);
    try {
      // Use v_all_expenses view for unified data (regular expenses + derived salary expenses)
      // Note: Cast to any until Supabase types are regenerated after migrations
      let query = (supabase as any)
        .from("v_all_expenses")
        .select("*")
        .eq("site_id", selectedSite.id)
        .eq("is_deleted", false)
        .order("date", { ascending: false });

      // Only apply date filters if not "All Time"
      if (!isAllTime && dateFrom && dateTo) {
        query = query.gte("date", dateFrom).lte("date", dateTo);
      }

      if (activeTab !== "all") query = query.eq("module", activeTab);
      const { data, error } = await query;
      if (error) throw error;

      setExpenses(
        (data || []).map((e: any) => ({
          ...e,
          // View already has category_name, payer_name, subcontract_title
        }))
      );
      // Also refresh subcontracts summary since expenses affect paid totals
      fetchSubcontracts();
    } catch (error: any) {
      alert("Failed to load expenses: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedSite, dateFrom, dateTo, activeTab, isAllTime]);

  const handleOpenDialog = (expense?: ExpenseWithCategory) => {
    // Prevent editing of settlement-derived expenses
    if (expense?.source_type === "settlement") {
      alert("Salary settlement expenses cannot be edited here. Please use the Salary Settlement page to modify.");
      return;
    }
    // Prevent editing of miscellaneous expenses from this page
    if (expense?.source_type === "misc_expense") {
      router.push(`/site/expenses/miscellaneous?highlight=${encodeURIComponent(expense.settlement_reference || "")}`);
      return;
    }
    // Prevent editing of tea shop settlements from this page
    if (expense?.source_type === "tea_shop_settlement") {
      router.push(`/site/tea-shop?highlight=${encodeURIComponent(expense.settlement_reference || "")}`);
      return;
    }
    // Prevent editing of subcontract direct payments from this page
    if (expense?.source_type === "subcontract_payment") {
      router.push(`/site/subcontracts`);
      return;
    }

    if (expense) {
      setEditingExpense(expense);
      setForm({
        module: expense.module,
        category_id: expense.category_id,
        date: expense.date,
        amount: expense.amount,
        vendor_name: expense.vendor_name || "",
        description: expense.description || "",
        payment_mode: expense.payment_mode || "cash",
        is_cleared: expense.is_cleared,
        site_payer_id: (expense as any).site_payer_id || "",
      });
    } else {
      setEditingExpense(null);
      setForm({
        module: (activeTab === "all" || activeTab === "miscellaneous") ? "general" : activeTab,
        category_id: "",
        date: dayjs().format("YYYY-MM-DD"),
        amount: 0,
        vendor_name: "",
        description: "",
        payment_mode: "cash",
        is_cleared: false,
        site_payer_id: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedSite || !form.category_id || form.amount <= 0) {
      alert("Please fill required fields");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        site_id: selectedSite.id,
        module: form.module,
        category_id: form.category_id,
        date: form.date,
        amount: form.amount,
        vendor_name: form.vendor_name || null,
        description: form.description || null,
        payment_mode: form.payment_mode,
        is_cleared: form.is_cleared,
        site_payer_id: form.site_payer_id || null,
      };

      if (editingExpense) {
        await (supabase.from("expenses") as any)
          .update(payload)
          .eq("id", editingExpense.id);
      } else {
        await (supabase.from("expenses") as any).insert(payload);
      }
      await fetchExpenses();
      setDialogOpen(false);
    } catch (error: any) {
      alert("Failed to save: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (expense: ExpenseWithCategory) => {
    // Check if expense is derived from settlement_groups (source_type='settlement')
    // These can't be deleted directly - must be cancelled from salary settlement page
    if (expense.source_type === "settlement") {
      setRedirectDialog({ open: true, expense });
      return;
    }

    // Subcontract direct payments can't be deleted from here
    if (expense.source_type === "subcontract_payment") {
      alert("Direct subcontract payments cannot be deleted here. Please use the Subcontracts page to modify.");
      router.push(`/site/subcontracts`);
      return;
    }

    // Legacy: Check if expense came from salary settlement via engineer_transaction_id
    if (expense.engineer_transaction_id) {
      // Show redirect dialog instead of allowing delete
      setRedirectDialog({ open: true, expense });
      return;
    }

    // Regular delete for non-salary expenses
    if (!confirm("Delete this expense?")) return;
    setLoading(true);
    try {
      await supabase.from("expenses").delete().eq("id", expense.id);
      await fetchExpenses();
    } catch (error: any) {
      alert("Failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const clearedExpenses = expenses.filter((e) => e.is_cleared);
    const cleared = clearedExpenses.reduce((s, e) => s + e.amount, 0);
    const pendingExpenses = expenses.filter((e) => !e.is_cleared);

    // Category breakdown by expense_type
    const categoryBreakdown = expenses.reduce((acc, e) => {
      const type = e.expense_type || 'Other';
      if (!acc[type]) {
        acc[type] = { amount: 0, count: 0 };
      }
      acc[type].amount += e.amount;
      acc[type].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; count: number }>);

    return {
      total,
      cleared,
      pending: total - cleared,
      totalCount: expenses.length,
      clearedCount: clearedExpenses.length,
      pendingCount: pendingExpenses.length,
      categoryBreakdown,
    };
  }, [expenses]);

  const columns = useMemo<MRT_ColumnDef<ExpenseWithCategory>[]>(() => {
    const cols: MRT_ColumnDef<ExpenseWithCategory>[] = [
      // 1st column - Ref Code (pinned)
      {
        accessorKey: "settlement_reference",
        header: "Ref Code",
        size: 140,
        filterVariant: "text",
        enablePinning: true,
        Cell: ({ cell, row }) => {
          const ref = cell.getValue<string>();
          if (!ref) {
            return <Typography variant="body2" color="text.disabled">-</Typography>;
          }

          // Determine chip color based on reference type or source type
          const sourceType = row.original.source_type;
          const chipColor = ref.startsWith("MISC-") ? "error" as const
            : ref.startsWith("TSS-") ? "warning" as const
            : ref.startsWith("SCP-") || sourceType === "subcontract_payment" ? "info" as const
            : "primary" as const;

          return (
            <Chip
              label={ref}
              size="small"
              color={chipColor}
              variant="outlined"
              clickable
              onClick={() => {
                // Route based on reference type or source type
                if (ref.startsWith("MISC-")) {
                  // Navigate to miscellaneous expenses page
                  router.push(`/site/expenses/miscellaneous?highlight=${encodeURIComponent(ref)}`);
                } else if (ref.startsWith("TSS-")) {
                  // Navigate to tea shop page
                  router.push(`/site/tea-shop?highlight=${encodeURIComponent(ref)}`);
                } else if (ref.startsWith("SCP-") || sourceType === "subcontract_payment") {
                  // Navigate to subcontracts page for direct payments
                  router.push(`/site/subcontracts`);
                } else {
                  // Use expense_type to determine which tab to navigate to
                  // "Contract Salary" goes to contract tab, all others (Daily Salary, etc) go to salary tab
                  const isContractSettlement = row.original.expense_type === "Contract Salary";
                  const tab = isContractSettlement ? "contract" : "salary";
                  router.push(`/site/payments?tab=${tab}&highlight=${encodeURIComponent(ref)}`);
                }
              }}
              sx={{ fontFamily: "monospace", fontWeight: 600, cursor: "pointer" }}
            />
          );
        },
      },
      // 2nd column - Settlement Date (pinned)
      {
        accessorKey: "date",
        header: "Settlement Date",
        size: 130,
        enablePinning: true,
        Cell: ({ cell }) =>
          dayjs(cell.getValue<string>()).format("DD MMM YYYY"),
      },
      // 3rd column - Recorded Date
      {
        accessorKey: "recorded_date",
        header: "Recorded Date",
        size: 130,
        Cell: ({ cell, row }) => {
          const recordedDate = cell.getValue<string>();
          const settlementDate = row.original.date;
          const isDifferent = recordedDate && settlementDate && recordedDate !== settlementDate;
          return (
            <Typography
              variant="body2"
              color={isDifferent ? "warning.main" : "text.primary"}
              fontWeight={isDifferent ? 500 : 400}
            >
              {recordedDate ? dayjs(recordedDate).format("DD MMM YYYY") : "-"}
            </Typography>
          );
        },
      },
      {
        accessorKey: "module",
        header: "Module",
        size: 100,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "salary", label: "SALARY" },
          { value: "material", label: "MATERIAL" },
          { value: "general", label: "GENERAL" },
        ],
        Cell: ({ cell }) => (
          <Chip label={cell.getValue<string>().toUpperCase()} size="small" />
        ),
      },
      {
        accessorKey: "expense_type",
        header: "Type",
        size: 130,
        filterVariant: "select",
        filterSelectOptions: ["Daily Salary", "Contract Salary", "Advance", "Direct Payment", "Material", "Machinery", "General", "Miscellaneous", "Tea & Snacks"],
        Cell: ({ cell }) => {
          const type = cell.getValue<string>();
          const colorMap: Record<string, "primary" | "secondary" | "warning" | "info" | "success" | "default" | "error"> = {
            "Daily Salary": "primary",
            "Contract Salary": "secondary",
            "Advance": "warning",
            "Direct Payment": "secondary",
            "Material": "info",
            "Machinery": "success",
            "General": "default",
            "Miscellaneous": "error",
            "Tea & Snacks": "warning",
          };
          return (
            <Chip
              label={type || "Other"}
              size="small"
              color={colorMap[type] || "default"}
              variant="outlined"
            />
          );
        },
      },
      { accessorKey: "category_name", header: "Category", size: 150 },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 120,
        Cell: ({ cell }) => (
          <Typography fontWeight={600} color="error.main">
            ₹{cell.getValue<number>().toLocaleString('en-IN')}
          </Typography>
        ),
      },
      {
        accessorKey: "vendor_name",
        header: "Vendor",
        size: 150,
        Cell: ({ cell }) => cell.getValue<string>() || "-",
      },
      {
        accessorKey: "payer_name",
        header: "Paid By",
        size: 130,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value ? (
            <Chip label={value} size="small" variant="outlined" color="secondary" />
          ) : (
            <Typography variant="body2" color="text.disabled">—</Typography>
          );
        },
      },
      {
        accessorKey: "subcontract_title",
        header: "Subcontract",
        size: 160,
        filterVariant: "text",
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value ? (
            <Chip
              label={value}
              size="small"
              color="info"
              variant="outlined"
              icon={<LinkIcon fontSize="small" />}
            />
          ) : (
            <Chip
              label="Unlinked"
              size="small"
              variant="outlined"
              sx={{ color: 'text.disabled', borderColor: 'divider' }}
            />
          );
        },
      },
    ];

    cols.push(
      {
        accessorKey: "is_cleared",
        header: "Status",
        size: 150,
        filterVariant: "select",
        filterSelectOptions: [
          { value: "true", label: "Cleared" },
          { value: "false", label: "Pending" },
        ],
        Cell: ({ cell, row }) => {
          const isCleared = cell.getValue<boolean>();
          const description = row.original.description || "";
          const isPendingFromCompany = !isCleared && description.includes("Pending from Company");

          return (
            <Chip
              label={isCleared ? "CLEARED" : isPendingFromCompany ? "PENDING (COMPANY)" : "PENDING"}
              size="small"
              color={isCleared ? "success" : isPendingFromCompany ? "error" : "warning"}
              sx={isPendingFromCompany ? { fontWeight: 600 } : undefined}
            />
          );
        },
      },
      {
        id: "mrt-row-actions",
        header: "Actions",
        size: 100,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(row.original)}
              disabled={!canEdit}
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDelete(row.original)}
              disabled={!canEdit}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        ),
      }
    );

    return cols;
  }, [canEdit]);

  if (!selectedSite)
    return (
      <Box>
        <PageHeader title="All Site Expenses" />
        <Alert severity="warning">Please select a site</Alert>
      </Box>
    );

  return (
    <Box>
      <PageHeader
        title="All Site Expenses"
        subtitle={`Track expenses for ${selectedSite.name}`}
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={!canEdit}
          >
            Add Expense
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <AttachMoney color="error" />
                <Typography variant="body2" color="text.secondary">
                  Total
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700}>
                ₹{stats.total.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({stats.totalCount} records)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Cleared
              </Typography>
              <Typography variant="h4" fontWeight={700} color="success.main">
                ₹{stats.cleared.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({stats.clearedCount} records)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Pending
              </Typography>
              <Typography variant="h4" fontWeight={700} color="warning.main">
                ₹{stats.pending.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({stats.pendingCount} records)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Category Breakdown */}
        {Object.keys(stats.categoryBreakdown).length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <CategoryIcon color="primary" />
                  <Typography variant="h6">Expense Breakdown by Type</Typography>
                </Box>
                <Grid container spacing={2}>
                  {Object.entries(stats.categoryBreakdown)
                    .sort(([, a], [, b]) => b.amount - a.amount)
                    .map(([type, data]) => (
                      <Grid size={{ xs: 6, sm: 4, md: 3 }} key={type}>
                        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            {type}
                          </Typography>
                          <Typography variant="h6" fontWeight={600}>
                            ₹{data.amount.toLocaleString('en-IN')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({data.count} records)
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Subcontract Summary Section */}
      {subcontracts.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <ContractIcon color="primary" />
              <Typography variant="h6">Subcontracts Summary</Typography>
            </Box>

            {subcontractsLoading ? (
              <Typography color="text.secondary">Loading...</Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "collapse",
                    "& th, & td": {
                      px: 2,
                      py: 1.5,
                      textAlign: "left",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    },
                    "& th": {
                      bgcolor: "action.hover",
                      fontWeight: 600,
                    },
                    "& tr:hover td": {
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  <thead>
                    <tr>
                      <th>Subcontract</th>
                      <th style={{ textAlign: "right" }}>Total Value</th>
                      <th style={{ textAlign: "right" }}>Paid</th>
                      <th style={{ textAlign: "right" }}>Records</th>
                      <th style={{ textAlign: "right" }}>Balance</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center", width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subcontracts.map((sc) => (
                      <tr key={sc.subcontractId}>
                        <td>
                          <Typography variant="body2" fontWeight={500}>
                            {sc.title}
                          </Typography>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Typography variant="body2">
                            Rs.{sc.totalValue.toLocaleString('en-IN')}
                          </Typography>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Typography variant="body2" color="success.main" fontWeight={500}>
                            Rs.{sc.totalPaid.toLocaleString('en-IN')}
                          </Typography>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Typography variant="body2" color="text.secondary">
                            {sc.totalRecordCount}
                          </Typography>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Typography
                            variant="body2"
                            color={sc.balance > 0 ? "warning.main" : "success.main"}
                            fontWeight={600}
                          >
                            Rs.{sc.balance.toLocaleString('en-IN')}
                          </Typography>
                        </td>
                        <td>
                          <Chip
                            label={sc.status.toUpperCase()}
                            size="small"
                            color={sc.status === "active" ? "success" : "warning"}
                            variant="outlined"
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <IconButton
                            size="small"
                            onClick={() => router.push("/site/subcontracts")}
                            title="View subcontract details"
                          >
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr>
                      <td>
                        <Typography variant="body2" fontWeight={700}>
                          TOTAL
                        </Typography>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Typography variant="body2" fontWeight={700}>
                          Rs.{subcontracts.reduce((sum, sc) => sum + sc.totalValue, 0).toLocaleString('en-IN')}
                        </Typography>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Typography variant="body2" fontWeight={700} color="success.main">
                          Rs.{subcontracts.reduce((sum, sc) => sum + sc.totalPaid, 0).toLocaleString('en-IN')}
                        </Typography>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Typography variant="body2" fontWeight={700} color="text.secondary">
                          {subcontracts.reduce((sum, sc) => sum + sc.totalRecordCount, 0)}
                        </Typography>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Typography variant="body2" fontWeight={700} color="warning.main">
                          Rs.{subcontracts.reduce((sum, sc) => sum + sc.balance, 0).toLocaleString('en-IN')}
                        </Typography>
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tbody>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
          >
            <Tab label="All" value="all" />
            <Tab label="Labor" value="labor" />
            <Tab label="Material" value="material" />
            <Tab label="Machinery" value="machinery" />
            <Tab label="General" value="general" />
            <Tab label="Miscellaneous" value="miscellaneous" />
          </Tabs>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={expenses}
        isLoading={loading}
        enableColumnPinning
        showRecordCount
        initialState={{
          columnPinning: { left: ["settlement_reference", "date"] },
        }}
      />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingExpense ? "Edit" : "Add"} Expense</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Module</InputLabel>
                  <Select
                    value={form.module}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        module: e.target.value as ExpenseModule,
                        category_id: "",
                      })
                    }
                    label="Module"
                  >
                    <MenuItem value="labor">Labor</MenuItem>
                    <MenuItem value="material">Material</MenuItem>
                    <MenuItem value="machinery">Machinery</MenuItem>
                    <MenuItem value="general">General</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={form.category_id}
                    onChange={(e) =>
                      setForm({ ...form, category_id: e.target.value })
                    }
                    label="Category"
                  >
                    {categories
                      .filter((c) => c.module === form.module)
                      .map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={form.amount || ""}
                  onChange={(e) =>
                    setForm({ ...form, amount: Number(e.target.value) })
                  }
                  slotProps={{ input: { startAdornment: "₹" } }}
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth
              label="Vendor"
              value={form.vendor_name}
              onChange={(e) =>
                setForm({ ...form, vendor_name: e.target.value })
              }
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
            <FormControl fullWidth>
              <InputLabel>Payment Mode</InputLabel>
              <Select
                value={form.payment_mode}
                onChange={(e) =>
                  setForm({
                    ...form,
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
            {hasMultiplePayers && sitePayers.length > 0 && (
              <FormControl fullWidth>
                <InputLabel>Paid By</InputLabel>
                <Select
                  value={form.site_payer_id}
                  onChange={(e) =>
                    setForm({ ...form, site_payer_id: e.target.value })
                  }
                  label="Paid By"
                >
                  <MenuItem value="">
                    <em>Not specified</em>
                  </MenuItem>
                  {sitePayers.map((payer) => (
                    <MenuItem key={payer.id} value={payer.id}>
                      {payer.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={form.is_cleared}
                  onChange={(e) =>
                    setForm({ ...form, is_cleared: e.target.checked })
                  }
                />
              }
              label="Payment Cleared"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {editingExpense ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Redirect dialog for salary expenses */}
      <RedirectConfirmDialog
        open={redirectDialog.open}
        onClose={() => setRedirectDialog({ open: false, expense: null })}
        title="Cannot Delete Salary Expense"
        message="This expense was created from a salary settlement. To modify or delete it, please cancel the payment in the Salary Settlement page first."
        targetPage="payments"
        targetParams={{
          date: redirectDialog.expense?.date,
          highlightType: "salary",
          transactionId: redirectDialog.expense?.engineer_transaction_id || undefined,
        }}
      />
    </Box>
  );
}
