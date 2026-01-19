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
  Drawer,
  Divider,
  Tooltip,
} from "@mui/material";
import {
  Add,
  Delete,
  Edit,
  AttachMoney,
  OpenInNew,
  Close,
  ChevronRight,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import RedirectConfirmDialog from "@/components/common/RedirectConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import { supabaseQueryWithTimeout } from "@/lib/utils/supabaseQuery";
import type {
  Expense,
  ExpenseModule,
  PaymentMode,
} from "@/types/database.types";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import {
  Description as ContractIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import {
  getSiteSubcontractTotals,
  type SubcontractTotals,
} from "@/lib/services/subcontractService";
// Material expenses hook removed - will be handled by Material Settlements page after settlement

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
  const [subcontractDrawerOpen, setSubcontractDrawerOpen] = useState(false);

  // Material Purchases state removed - now handled by Material Settlements page

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

      // Use timeout protection to prevent infinite loading
      const { data, error } = await supabaseQueryWithTimeout<any[]>(query, 30000);
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
      console.error("Error loading expenses:", error);
      setExpenses([]);
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

    // Calculate contract settlement breakdown for tooltip
    // Includes: Contract Salary, Advance, and Contract Salary Excess (overpayments)
    const contractSettlementBreakdown = {
      salary: { amount: 0, count: 0 },
      advance: { amount: 0, count: 0 },
      excess: { amount: 0, count: 0 },
      total: { amount: 0, count: 0 },
    };

    // Category breakdown by expense_type - consolidate contract types
    const categoryBreakdown = expenses.reduce((acc, e) => {
      const type = e.expense_type || 'Other';

      // Consolidate Contract Salary, Advance, and Excess into contractSettlementBreakdown
      if (type === "Contract Salary") {
        contractSettlementBreakdown.salary.amount += e.amount;
        contractSettlementBreakdown.salary.count += 1;
        contractSettlementBreakdown.total.amount += e.amount;
        contractSettlementBreakdown.total.count += 1;
        return acc; // Don't add to regular breakdown
      }

      if (type === "Advance") {
        contractSettlementBreakdown.advance.amount += e.amount;
        contractSettlementBreakdown.advance.count += 1;
        contractSettlementBreakdown.total.amount += e.amount;
        contractSettlementBreakdown.total.count += 1;
        return acc; // Don't add to regular breakdown
      }

      if (type === "Contract Salary Excess") {
        contractSettlementBreakdown.excess.amount += e.amount;
        contractSettlementBreakdown.excess.count += 1;
        contractSettlementBreakdown.total.amount += e.amount;
        contractSettlementBreakdown.total.count += 1;
        return acc; // Don't add to regular breakdown
      }

      // Regular categories
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
      contractSettlementBreakdown,
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

      {/* Unified Expense Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: { xs: 2.5, md: 3 },
              alignItems: { xs: "stretch", md: "stretch" },
            }}
          >
            {/* Left: Total */}
            <Box
              sx={{
                minWidth: { xs: "auto", md: 180 },
                borderRight: { xs: 0, md: 1 },
                borderBottom: { xs: 1, md: 0 },
                borderColor: "divider",
                pr: { xs: 0, md: 3 },
                pb: { xs: 2, md: 0 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <AttachMoney sx={{ fontSize: 18, color: "error.main" }} />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}
                >
                  Total Expenses
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} color="error.main">
                ₹{stats.total.toLocaleString("en-IN")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.totalCount} records
              </Typography>
            </Box>

            {/* Middle: Breakdown */}
            {(Object.keys(stats.categoryBreakdown).length > 0 || stats.contractSettlementBreakdown.total.count > 0) && (
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mb: 1.5,
                    display: "block",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    fontWeight: 500,
                  }}
                >
                  Breakdown by Type
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                  {/* Contract Weekly Settlement - consolidated card with tooltip */}
                  {stats.contractSettlementBreakdown.total.count > 0 && (
                    <Tooltip
                      title={
                        <Box sx={{ p: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                            Breakdown
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                            <Typography variant="caption">
                              Salary: ₹{stats.contractSettlementBreakdown.salary.amount.toLocaleString("en-IN")} ({stats.contractSettlementBreakdown.salary.count} rec)
                            </Typography>
                            <Typography variant="caption">
                              Advance: ₹{stats.contractSettlementBreakdown.advance.amount.toLocaleString("en-IN")} ({stats.contractSettlementBreakdown.advance.count} rec)
                            </Typography>
                            {stats.contractSettlementBreakdown.excess.count > 0 && (
                              <Typography variant="caption" sx={{ color: "info.light" }}>
                                Excess: ₹{stats.contractSettlementBreakdown.excess.amount.toLocaleString("en-IN")} ({stats.contractSettlementBreakdown.excess.count} rec)
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                      arrow
                      placement="top"
                    >
                      <Box
                        sx={{
                          px: 2,
                          py: 1.25,
                          bgcolor: "secondary.50",
                          borderRadius: 1.5,
                          minWidth: 110,
                          flex: "1 1 auto",
                          maxWidth: { xs: "100%", sm: 180 },
                          cursor: "help",
                          transition: "background-color 0.2s",
                          "&:hover": {
                            bgcolor: "secondary.100",
                          },
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: "block", mb: 0.25 }}
                        >
                          Contract Weekly Settlement
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          ₹{stats.contractSettlementBreakdown.total.amount.toLocaleString("en-IN")}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {stats.contractSettlementBreakdown.total.count} rec
                        </Typography>
                      </Box>
                    </Tooltip>
                  )}
                  {/* Other expense types */}
                  {Object.entries(stats.categoryBreakdown)
                    .sort(([, a], [, b]) => b.amount - a.amount)
                    .map(([type, data]) => (
                      <Box
                        key={type}
                        sx={{
                          px: 2,
                          py: 1.25,
                          bgcolor: "action.hover",
                          borderRadius: 1.5,
                          minWidth: 110,
                          flex: "1 1 auto",
                          maxWidth: { xs: "100%", sm: 160 },
                          transition: "background-color 0.2s",
                          "&:hover": {
                            bgcolor: "action.selected",
                          },
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: "block", mb: 0.25 }}
                        >
                          {type}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          ₹{data.amount.toLocaleString("en-IN")}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {data.count} rec
                        </Typography>
                      </Box>
                    ))}
                </Box>
              </Box>
            )}

            {/* Right: Subcontract Summary (Compact) */}
            {subcontracts.length > 0 && (
              <Box
                sx={{
                  minWidth: { xs: "auto", md: 200 },
                  borderLeft: { xs: 0, md: 1 },
                  borderTop: { xs: 1, md: 0 },
                  borderColor: "divider",
                  pl: { xs: 0, md: 3 },
                  pt: { xs: 2, md: 0 },
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <Box
                  onClick={() => setSubcontractDrawerOpen(true)}
                  sx={{
                    cursor: "pointer",
                    borderRadius: 1.5,
                    p: 1.5,
                    mx: -1.5,
                    transition: "background-color 0.2s",
                    "&:hover": {
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <ContractIcon sx={{ fontSize: 16, color: "primary.main" }} />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}
                      >
                        Subcontracts
                      </Typography>
                    </Box>
                    <ChevronRight sx={{ fontSize: 18, color: "text.secondary" }} />
                  </Box>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Value
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        ₹{subcontracts.reduce((sum, sc) => sum + sc.totalValue, 0).toLocaleString("en-IN")}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Paid
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        ₹{subcontracts.reduce((sum, sc) => sum + sc.totalPaid, 0).toLocaleString("en-IN")}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Balance
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="warning.main">
                        ₹{subcontracts.reduce((sum, sc) => sum + sc.balance, 0).toLocaleString("en-IN")}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Material Purchases section removed - material expenses show in All Site Expenses only AFTER settlement */}
      {/* See /site/material-settlements for pending material purchases */}

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

      {/* Subcontracts Summary Drawer */}
      <Drawer
        anchor="right"
        open={subcontractDrawerOpen}
        onClose={() => setSubcontractDrawerOpen(false)}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 480, md: 560 } },
        }}
      >
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <ContractIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Subcontracts Summary
              </Typography>
            </Box>
            <IconButton onClick={() => setSubcontractDrawerOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Summary Totals */}
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: 1, minWidth: 100, p: 2, bgcolor: "action.hover", borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Total Value
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                ₹{subcontracts.reduce((sum, sc) => sum + sc.totalValue, 0).toLocaleString("en-IN")}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100, p: 2, bgcolor: "success.50", borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Total Paid
              </Typography>
              <Typography variant="h6" fontWeight={700} color="success.main">
                ₹{subcontracts.reduce((sum, sc) => sum + sc.totalPaid, 0).toLocaleString("en-IN")}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 100, p: 2, bgcolor: "warning.50", borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Balance
              </Typography>
              <Typography variant="h6" fontWeight={700} color="warning.main">
                ₹{subcontracts.reduce((sum, sc) => sum + sc.balance, 0).toLocaleString("en-IN")}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Subcontract List */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Individual Subcontracts
          </Typography>

          {subcontractsLoading ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {subcontracts.map((sc) => (
                <Box
                  key={sc.subcontractId}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1.5,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {sc.title}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip
                        label={sc.status.toUpperCase()}
                        size="small"
                        color={sc.status === "active" ? "success" : "warning"}
                        variant="outlined"
                      />
                      <IconButton
                        size="small"
                        onClick={() => router.push("/site/subcontracts")}
                        title="View subcontract details"
                      >
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Value
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        ₹{sc.totalValue.toLocaleString("en-IN")}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Paid
                      </Typography>
                      <Typography variant="body2" fontWeight={500} color="success.main">
                        ₹{sc.totalPaid.toLocaleString("en-IN")}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Balance
                      </Typography>
                      <Typography variant="body2" fontWeight={500} color={sc.balance > 0 ? "warning.main" : "success.main"}>
                        ₹{sc.balance.toLocaleString("en-IN")}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Records
                      </Typography>
                      <Typography variant="body2" fontWeight={500} color="text.secondary">
                        {sc.totalRecordCount}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* View All Button */}
          <Box sx={{ mt: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              endIcon={<OpenInNew />}
              onClick={() => router.push("/site/subcontracts")}
            >
              View All Subcontracts
            </Button>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
