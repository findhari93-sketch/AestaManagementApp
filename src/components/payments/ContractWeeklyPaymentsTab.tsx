"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Typography,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  alpha,
  Checkbox,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Payment as PaymentIcon,
  CheckCircle as CompletedIcon,
  Warning as WarningIcon,
  TrendingUp as AdvanceIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import dayjs from "dayjs";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PaymentDialog from "./PaymentDialog";
import PaymentRefDialog from "./PaymentRefDialog";
import ContractPaymentEditDialog from "./ContractPaymentEditDialog";
import ContractPaymentDeleteDialog from "./ContractPaymentDeleteDialog";
import ContractPaymentHistoryDialog from "./ContractPaymentHistoryDialog";
import SettlementsOverviewDialog from "./SettlementsOverviewDialog";
import type {
  WeekGroup,
  WeeklyContractLaborer,
  WeeklyFilterState,
  PaymentStatus,
  DailySalaryEntry,
  LaborerPaymentEntry,
  PaymentSummaryData,
  PaymentDetails,
} from "@/types/payment.types";
import {
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from "@/types/payment.types";
import { hasEditPermission } from "@/lib/permissions";

// Row data structure for the MRT table
interface WeekRowData {
  id: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  laborerCount: number;
  totalSalary: number;
  totalPaid: number;
  totalDue: number;
  paymentProgress: number;
  status: PaymentStatus;
  laborers: WeeklyContractLaborer[];
  settlementReferences: string[];
  // Original group for reference
  group: WeekGroup;
}

// Extended laborer type to include settlement reference
interface WeeklyContractLaborerWithRef extends WeeklyContractLaborer {
  settlementReference?: string | null;
}

interface ContractWeeklyPaymentsTabProps {
  weeksToShow?: number;
  dateFrom?: string;
  dateTo?: string;
  onDataChange?: () => void;
  onSummaryChange?: (summary: PaymentSummaryData) => void;
  highlightRef?: string | null;
}

// Get week boundaries (Sunday to Saturday)
function getWeekBoundaries(date: string): { weekStart: string; weekEnd: string } {
  const d = dayjs(date);
  const weekStart = d.day(0).format("YYYY-MM-DD"); // Sunday
  const weekEnd = d.day(6).format("YYYY-MM-DD"); // Saturday
  return { weekStart, weekEnd };
}

// Get all weeks in a range
function getWeeksInRange(fromDate: string, toDate: string): { weekStart: string; weekEnd: string; weekLabel: string }[] {
  const weeks: { weekStart: string; weekEnd: string; weekLabel: string }[] = [];
  let current = dayjs(fromDate).day(0); // Start from Sunday of first week
  const end = dayjs(toDate);

  while (current.isBefore(end) || current.isSame(end, "day")) {
    const weekStart = current.format("YYYY-MM-DD");
    const weekEnd = current.day(6).format("YYYY-MM-DD");
    const weekLabel = `${current.format("MMM D")} - ${current.day(6).format("MMM D, YYYY")}`;
    weeks.push({ weekStart, weekEnd, weekLabel });
    current = current.add(1, "week");
  }

  return weeks.reverse(); // Most recent first
}

export default function ContractWeeklyPaymentsTab({
  weeksToShow = 4,
  dateFrom: propDateFrom,
  dateTo: propDateTo,
  onDataChange,
  onSummaryChange,
  highlightRef,
}: ContractWeeklyPaymentsTabProps) {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();
  const theme = useTheme();

  // Data state
  const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterSubcontract, setFilterSubcontract] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [subcontracts, setSubcontracts] = useState<{ id: string; title: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);

  // Selection state
  const [selectedLaborers, setSelectedLaborers] = useState<Set<string>>(new Set());

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedLaborer, setSelectedLaborer] = useState<WeeklyContractLaborer | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<{ weekStart: string; weekEnd: string } | null>(null);

  // Payment ref dialog state (for viewing payment details)
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [selectedPaymentRef, setSelectedPaymentRef] = useState<string | null>(null);

  // Edit/Delete dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState<PaymentDetails | null>(null);

  // History dialog state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Settlements overview dialog state
  const [overviewDialogOpen, setOverviewDialogOpen] = useState(false);
  const [overviewRefs, setOverviewRefs] = useState<string[]>([]);
  const [overviewContext, setOverviewContext] = useState<{
    weekStart?: string;
    weekEnd?: string;
    laborerName?: string;
  }>({});

  // Expanded state
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const expandedWeeksRef = useRef<Set<string>>(new Set());

  // Keep ref in sync with state
  useEffect(() => {
    expandedWeeksRef.current = expandedWeeks;
  }, [expandedWeeks]);

  const canEdit = hasEditPermission(userProfile?.role);

  // Calculate date range based on props or weeksToShow fallback
  const dateRange = useMemo(() => {
    // If date props provided, use them
    if (propDateFrom && propDateTo) {
      return { fromDate: propDateFrom, toDate: propDateTo };
    }
    // Otherwise fall back to weeksToShow calculation
    const today = dayjs();
    const toDate = today.format("YYYY-MM-DD");
    const fromDate = today.subtract(weeksToShow, "week").day(0).format("YYYY-MM-DD");
    return { fromDate, toDate };
  }, [propDateFrom, propDateTo, weeksToShow]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!selectedSite?.id) {
      setLoading(false);
      setError("Please select a site to view contract payments");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { fromDate, toDate } = dateRange;

      // Fetch teams first (to avoid complex nested join issues)
      const { data: teamsLookup } = await supabase
        .from("teams")
        .select("id, name")
        .eq("site_id", selectedSite.id);

      const teamsMap = new Map<string, string>();
      (teamsLookup || []).forEach((t: any) => teamsMap.set(t.id, t.name));

      // Fetch contract laborers' attendance (simplified query without teams join)
      console.log("Fetching contract attendance for site:", selectedSite.id, "from:", fromDate, "to:", toDate);
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("daily_attendance")
        .select(
          `
          id,
          date,
          laborer_id,
          daily_earnings,
          work_days,
          is_paid,
          payment_id,
          subcontract_id,
          payment_notes,
          laborers!inner(
            id,
            name,
            laborer_type,
            team_id,
            labor_roles(name)
          ),
          subcontracts(id, title)
        `
        )
        .eq("site_id", selectedSite.id)
        .eq("laborers.laborer_type", "contract")
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: true });

      console.log("Contract attendance result:", attendanceData?.length || 0, "records", attendanceError ? `Error: ${attendanceError.message}` : "");
      if (attendanceError) {
        console.error("Attendance query error:", attendanceError);
        throw new Error(attendanceError.message || JSON.stringify(attendanceError));
      }

      // Enrich attendance data with team names
      const enrichedAttendanceData = (attendanceData || []).map((att: any) => ({
        ...att,
        laborers: {
          ...att.laborers,
          teams: att.laborers?.team_id ? { id: att.laborers.team_id, name: teamsMap.get(att.laborers.team_id) || null } : null,
        },
      }));

      // Fetch labor payments for contract laborers (without join to avoid PostgREST cache issues)
      let paymentsData: any[] = [];
      try {
        const { data, error } = await supabase
          .from("labor_payments")
          .select("*")
          .eq("site_id", selectedSite.id)
          .eq("is_under_contract", true)
          .gte("payment_for_date", fromDate)
          .lte("payment_for_date", toDate);

        if (error) {
          console.error("Error fetching labor payments:", error);
          paymentsData = [];
        } else {
          paymentsData = data || [];

          // Fetch settlement references for payments that have settlement_group_id
          const settlementGroupIds = paymentsData
            .map((p: any) => p.settlement_group_id)
            .filter((id: string | null) => id !== null);

          if (settlementGroupIds.length > 0) {
            const { data: settlementGroups } = await (supabase as any)
              .from("settlement_groups")
              .select("id, settlement_reference")
              .in("id", settlementGroupIds);

            // Create lookup map
            const settlementMap = new Map<string, string>();
            (settlementGroups || []).forEach((sg: any) => {
              settlementMap.set(sg.id, sg.settlement_reference);
            });

            // Enrich payments with settlement references
            paymentsData = paymentsData.map((p: any) => ({
              ...p,
              settlement_reference: p.settlement_group_id
                ? settlementMap.get(p.settlement_group_id) || null
                : null,
            }));
          }
        }
      } catch (err: any) {
        console.error("Error fetching labor payments:", err);
        // Continue with empty payments data
        paymentsData = [];
      }

      // Group attendance by laborer and week
      const laborerWeekMap = new Map<string, Map<string, {
        attendance: any[];
        payments: any[];
      }>>();

      // Process attendance (using enriched data with team names)
      enrichedAttendanceData.forEach((att: any) => {
        const laborerId = att.laborer_id;
        const { weekStart } = getWeekBoundaries(att.date);

        if (!laborerWeekMap.has(laborerId)) {
          laborerWeekMap.set(laborerId, new Map());
        }
        const laborerMap = laborerWeekMap.get(laborerId)!;

        if (!laborerMap.has(weekStart)) {
          laborerMap.set(weekStart, { attendance: [], payments: [] });
        }
        laborerMap.get(weekStart)!.attendance.push(att);
      });

      // Process payments
      (paymentsData || []).forEach((payment: any) => {
        const laborerId = payment.laborer_id;
        const { weekStart } = getWeekBoundaries(payment.payment_for_date);

        if (laborerWeekMap.has(laborerId)) {
          const laborerMap = laborerWeekMap.get(laborerId)!;
          if (laborerMap.has(weekStart)) {
            laborerMap.get(weekStart)!.payments.push(payment);
          }
        }
      });

      // Get all weeks
      const weeks = getWeeksInRange(fromDate, toDate);

      // Build week groups with running balance calculation
      const groups: WeekGroup[] = weeks.map(({ weekStart, weekEnd, weekLabel }) => {
        const laborers: WeeklyContractLaborer[] = [];

        // Calculate cumulative totals for each laborer up to this week
        laborerWeekMap.forEach((weekMap, laborerId) => {
          const weekData = weekMap.get(weekStart);
          if (!weekData || weekData.attendance.length === 0) return;

          const firstAtt = weekData.attendance[0];
          const laborerInfo = firstAtt.laborers;

          // Calculate cumulative salary and paid from start
          let cumulativeSalary = 0;
          let cumulativePaid = 0;

          // Sum up all previous weeks + current week
          const allWeeks = Array.from(weekMap.entries()).sort(
            ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
          );

          for (const [wk, wkData] of allWeeks) {
            const wkSalary = wkData.attendance.reduce(
              (sum: number, a: any) => sum + (a.daily_earnings || 0),
              0
            );
            const wkPaid = wkData.payments.reduce(
              (sum: number, p: any) => sum + (p.amount || 0),
              0
            );

            cumulativeSalary += wkSalary;
            cumulativePaid += wkPaid;

            // Stop at current week
            if (wk === weekStart) break;
          }

          // This week's values
          const weekSalary = weekData.attendance.reduce(
            (sum: number, a: any) => sum + (a.daily_earnings || 0),
            0
          );
          const weekPaid = weekData.payments.reduce(
            (sum: number, p: any) => sum + (p.amount || 0),
            0
          );

          // Calculate previous balance (before this week)
          const previousBalance = cumulativeSalary - weekSalary - (cumulativePaid - weekPaid);

          // Running balance
          const runningBalance = cumulativeSalary - cumulativePaid;

          // Payment progress
          const paymentProgress =
            cumulativeSalary > 0
              ? (cumulativePaid / cumulativeSalary) * 100
              : 0;

          // Status
          let status: PaymentStatus = "pending";
          if (runningBalance <= 0) {
            status = runningBalance < 0 ? "advance" : "completed";
          } else if (cumulativePaid > 0) {
            status = "partial";
          }

          // Daily breakdown
          const dailySalary: DailySalaryEntry[] = weekData.attendance.map(
            (a: any) => ({
              date: a.date,
              dayName: dayjs(a.date).format("ddd"),
              attendanceId: a.id,
              amount: a.daily_earnings || 0,
              workDays: a.work_days || 0,
            })
          );

          // Payment history with settlement references
          const payments: (LaborerPaymentEntry & { settlementReference?: string })[] = weekData.payments.map(
            (p: any) => ({
              paymentId: p.id,
              amount: p.amount,
              paymentDate: p.payment_date,
              paymentMode: p.payment_mode,
              weekStart: weekStart,
              paidBy: p.paid_by || "",
              paidByUserId: p.paid_by_user_id || "",
              paidByAvatar: null,
              proofUrl: p.proof_url,
              subcontractId: p.subcontract_id,
              settlementReference: p.settlement_reference || undefined,
            })
          );

          // Collect settlement references for this laborer
          const laborerSettlementRefs = payments
            .map(p => p.settlementReference)
            .filter((ref): ref is string => ref !== null && ref !== undefined);

          laborers.push({
            laborerId,
            laborerName: laborerInfo.name,
            laborerRole: laborerInfo.labor_roles?.name || null,
            teamId: laborerInfo.team_id,
            teamName: laborerInfo.teams?.name || null,
            subcontractId: firstAtt.subcontract_id,
            subcontractTitle: firstAtt.subcontracts?.title || null,
            dailySalary,
            daysWorked: weekData.attendance.length,
            weekSalary,
            weekPaid,
            previousBalance: Math.max(0, previousBalance),
            cumulativeSalary,
            cumulativePaid,
            runningBalance,
            paymentProgress,
            status,
            payments,
          });
        });

        // Calculate week summary
        const totalSalary = laborers.reduce((sum, l) => sum + l.weekSalary, 0);
        const totalPaid = laborers.reduce((sum, l) => sum + l.weekPaid, 0);
        const totalDue = laborers.reduce(
          (sum, l) => sum + Math.max(0, l.runningBalance),
          0
        );
        const paymentProgress =
          totalSalary > 0 ? (totalPaid / totalSalary) * 100 : 0;

        let summaryStatus: PaymentStatus = "pending";
        if (totalDue <= 0) {
          summaryStatus = totalPaid > totalSalary ? "advance" : "completed";
        } else if (totalPaid > 0) {
          summaryStatus = "partial";
        }

        return {
          weekStart,
          weekEnd,
          weekLabel,
          laborers,
          summary: {
            laborerCount: laborers.length,
            totalSalary,
            totalPaid,
            totalDue,
            paymentProgress,
            status: summaryStatus,
          },
          isExpanded: expandedWeeksRef.current.has(weekStart),
        };
      });

      // Filter out empty weeks
      const nonEmptyGroups = groups.filter((g) => g.laborers.length > 0);
      setWeekGroups(nonEmptyGroups);

      // Fetch subcontracts and teams for filters
      const { data: subcontractsData } = await supabase
        .from("subcontracts")
        .select("id, title")
        .eq("site_id", selectedSite.id)
        .in("status", ["active", "on_hold"]);

      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("site_id", selectedSite.id)
        .eq("status", "active");

      setSubcontracts(subcontractsData || []);
      setTeams(teamsData || []);
    } catch (err: any) {
      console.error("Error fetching weekly payment data:", err);
      const errorMessage = err?.message || err?.error_description || (typeof err === 'string' ? err : JSON.stringify(err));
      setError(`Failed to load weekly payment data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  // Note: expandedWeeks removed from deps to prevent refetch on expand/collapse
  }, [selectedSite?.id, dateRange, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate and emit summary when weekGroups changes
  useEffect(() => {
    if (!onSummaryChange) return;

    // Aggregate across all weeks and laborers
    const allLaborers = weekGroups.flatMap((g) => g.laborers);

    // Calculate totals for the SELECTED PERIOD only (not cumulative)
    // weekSalary = salary earned in this period
    // weekPaid = amount paid in this period
    const totalSalaryInPeriod = allLaborers.reduce((sum, l) => sum + l.weekSalary, 0);
    const totalPaidInPeriod = allLaborers.reduce((sum, l) => sum + l.weekPaid, 0);

    // Due = salary earned in period minus paid in period (for this period only)
    const totalDueInPeriod = Math.max(0, totalSalaryInPeriod - totalPaidInPeriod);

    // Count unique laborers
    const uniqueLaborerIds = new Set(allLaborers.map((l) => l.laborerId));

    // Group by subcontract (using period values, not cumulative)
    const subcontractMap = new Map<string, { title: string; paid: number; salary: number }>();
    allLaborers.forEach((l) => {
      if (l.subcontractId) {
        const existing = subcontractMap.get(l.subcontractId) || {
          title: l.subcontractTitle || "Unknown",
          paid: 0,
          salary: 0,
        };
        existing.paid += l.weekPaid;
        existing.salary += l.weekSalary;
        subcontractMap.set(l.subcontractId, existing);
      }
    });

    const bySubcontract = Array.from(subcontractMap.entries()).map(([id, data]) => ({
      subcontractId: id,
      subcontractTitle: data.title,
      totalPaid: data.paid,
      totalDue: Math.max(0, data.salary - data.paid),
    }));

    const summary: PaymentSummaryData = {
      dailyMarketPending: 0,
      dailyMarketPendingCount: 0,
      dailyMarketSentToEngineer: 0,
      dailyMarketSentToEngineerCount: 0,
      dailyMarketPaid: 0,
      dailyMarketPaidCount: 0,
      contractWeeklyDue: totalDueInPeriod,
      contractWeeklyDueLaborerCount: uniqueLaborerIds.size,
      contractWeeklyPaid: totalPaidInPeriod,
      bySubcontract,
      unlinkedTotal: 0,
      unlinkedCount: 0,
    };

    onSummaryChange(summary);
  }, [weekGroups, onSummaryChange]);

  // Filter week groups
  const filteredWeekGroups = useMemo(() => {
    return weekGroups
      .map((group) => {
        let laborers = group.laborers;

        if (filterSubcontract !== "all") {
          laborers = laborers.filter(
            (l) => l.subcontractId === filterSubcontract
          );
        }

        if (filterTeam !== "all") {
          laborers = laborers.filter((l) => l.teamId === filterTeam);
        }

        if (filterStatus !== "all") {
          laborers = laborers.filter((l) => {
            if (filterStatus === "pending")
              return l.status === "pending" || l.status === "partial";
            if (filterStatus === "completed")
              return l.status === "completed" || l.status === "advance";
            return true;
          });
        }

        // Recalculate summary
        const totalSalary = laborers.reduce((sum, l) => sum + l.weekSalary, 0);
        const totalPaid = laborers.reduce((sum, l) => sum + l.weekPaid, 0);
        const totalDue = laborers.reduce(
          (sum, l) => sum + Math.max(0, l.runningBalance),
          0
        );

        return {
          ...group,
          laborers,
          summary: {
            ...group.summary,
            laborerCount: laborers.length,
            totalSalary,
            totalPaid,
            totalDue,
          },
        };
      })
      .filter((g) => g.laborers.length > 0);
  }, [weekGroups, filterSubcontract, filterTeam, filterStatus]);

  // Transform to table data
  const tableData: WeekRowData[] = useMemo(() => {
    return filteredWeekGroups.map((group) => {
      // Collect unique settlement references from all laborers' payments
      const allRefs = group.laborers.flatMap((laborer) =>
        laborer.payments
          .map((p: any) => p.settlementReference)
          .filter((ref: string | null | undefined): ref is string => ref !== null && ref !== undefined)
      );
      const uniqueRefs = [...new Set(allRefs)];

      return {
        id: group.weekStart,
        weekStart: group.weekStart,
        weekEnd: group.weekEnd,
        weekLabel: group.weekLabel,
        laborerCount: group.summary.laborerCount,
        totalSalary: group.summary.totalSalary,
        totalPaid: group.summary.totalPaid,
        totalDue: group.summary.totalDue,
        paymentProgress: group.summary.paymentProgress,
        status: group.summary.status,
        laborers: group.laborers,
        settlementReferences: uniqueRefs,
        group,
      };
    });
  }, [filteredWeekGroups]);

  // Format currency
  const formatCurrency = (amount: number) => `Rs.${amount.toLocaleString("en-IN")}`;

  // Get progress bar color
  const getProgressColor = (progress: number): "error" | "warning" | "success" | "info" => {
    if (progress >= 100) return "success";
    if (progress > 100) return "info";
    if (progress >= 50) return "warning";
    return "error";
  };

  // Define columns
  const columns = useMemo<MRT_ColumnDef<WeekRowData>[]>(
    () => [
      {
        accessorKey: "weekStart",
        header: "Week",
        size: 200,
        sortingFn: "datetime",
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {row.original.weekLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.laborerCount} laborers
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: "totalSalary",
        header: "Salary",
        size: 110,
        Cell: ({ row }) => (
          <Typography variant="body2" fontWeight={500}>
            {formatCurrency(row.original.totalSalary)}
          </Typography>
        ),
      },
      {
        accessorKey: "totalPaid",
        header: "Paid",
        size: 110,
        Cell: ({ row }) => (
          <Typography variant="body2" fontWeight={500} color="success.main">
            {formatCurrency(row.original.totalPaid)}
          </Typography>
        ),
      },
      {
        accessorKey: "totalDue",
        header: "Due",
        size: 110,
        Cell: ({ row }) => (
          <Typography
            variant="body2"
            fontWeight={600}
            color={row.original.totalDue > 0 ? "error.main" : "success.main"}
          >
            {formatCurrency(row.original.totalDue)}
          </Typography>
        ),
      },
      {
        accessorKey: "paymentProgress",
        header: "Progress",
        size: 120,
        Cell: ({ row }) => (
          <Box sx={{ width: 100 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="caption" fontWeight={600}>
                {row.original.paymentProgress.toFixed(0)}%
                {row.original.paymentProgress > 100 && " (Adv)"}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(row.original.paymentProgress, 100)}
              color={getProgressColor(row.original.paymentProgress)}
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Box>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 100,
        Cell: ({ row }) => (
          <Chip
            label={getPaymentStatusLabel(row.original.status)}
            size="small"
            color={getPaymentStatusColor(row.original.status)}
            variant={row.original.status === "completed" ? "filled" : "outlined"}
            sx={{ fontWeight: 500 }}
          />
        ),
      },
      {
        accessorKey: "settlementReferences",
        header: "Ref Code",
        size: 140,
        filterVariant: "text",
        Cell: ({ row }) => {
          const refs = row.original.settlementReferences;
          if (refs.length === 0) {
            return (
              <Typography variant="body2" color="text.disabled">
                —
              </Typography>
            );
          }

          // Single ref - show directly
          if (refs.length === 1) {
            return (
              <Chip
                label={refs[0]}
                size="small"
                color="primary"
                variant="outlined"
                clickable
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPaymentRef(refs[0]);
                  setRefDialogOpen(true);
                }}
                sx={{
                  fontFamily: "monospace",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  height: 22,
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                  },
                }}
              />
            );
          }

          // Multiple refs - show count with tooltip containing clickable chips
          return (
            <Tooltip
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, display: "block" }}>
                    Click chip for details, or click below to view all:
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {refs.map((ref) => (
                      <Chip
                        key={ref}
                        label={ref}
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPaymentRef(ref);
                          setRefDialogOpen(true);
                        }}
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.65rem",
                          height: 20,
                          cursor: "pointer",
                          color: "white",
                          borderColor: "rgba(255,255,255,0.5)",
                          "&:hover": {
                            bgcolor: "rgba(255,255,255,0.2)",
                            borderColor: "white",
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              }
              arrow
              placement="top"
              componentsProps={{
                tooltip: {
                  sx: { pointerEvents: "auto", maxWidth: 300 },
                },
              }}
            >
              <Chip
                label={`${refs.length} settlements`}
                size="small"
                color="primary"
                variant="outlined"
                clickable
                onClick={(e) => {
                  e.stopPropagation();
                  setOverviewRefs(refs);
                  setOverviewContext({
                    weekStart: row.original.weekStart,
                    weekEnd: row.original.weekEnd,
                  });
                  setOverviewDialogOpen(true);
                }}
                sx={{
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  height: 22,
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                  },
                }}
              />
            </Tooltip>
          );
        },
      },
    ],
    []
  );

  // Render expanded detail panel with laborer breakdown
  const renderDetailPanel = ({ row }: { row: { original: WeekRowData } }) => {
    const { laborers, weekStart, weekEnd } = row.original;

    if (laborers.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No laborers for this week
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={laborers.filter(l => l.runningBalance > 0).every(l => selectedLaborers.has(l.laborerId))}
                    indeterminate={
                      laborers.filter(l => l.runningBalance > 0).some(l => selectedLaborers.has(l.laborerId)) &&
                      !laborers.filter(l => l.runningBalance > 0).every(l => selectedLaborers.has(l.laborerId))
                    }
                    onChange={(e) => handleSelectAll(weekStart, e.target.checked)}
                    disabled={laborers.filter(l => l.runningBalance > 0).length === 0}
                  />
                </TableCell>
                <TableCell>Laborer</TableCell>
                <TableCell>Team / Subcontract</TableCell>
                <TableCell align="center">Days</TableCell>
                <TableCell align="right">Salary</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Due</TableCell>
                <TableCell align="center">Progress</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {laborers.map((laborer) => (
                <React.Fragment key={laborer.laborerId}>
                  <TableRow hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selectedLaborers.has(laborer.laborerId)}
                        onChange={() => handleToggleSelect(laborer.laborerId)}
                        disabled={laborer.runningBalance <= 0}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {laborer.laborerName}
                      </Typography>
                      {laborer.laborerRole && (
                        <Typography variant="caption" color="text.secondary">
                          {laborer.laborerRole}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {laborer.teamName && (
                        <Typography variant="body2">{laborer.teamName}</Typography>
                      )}
                      {laborer.subcontractTitle && (
                        <Typography variant="caption" color="text.secondary">
                          {laborer.subcontractTitle}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={laborer.daysWorked} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500}>
                        {formatCurrency(laborer.weekSalary)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500} color="success.main">
                        {formatCurrency(laborer.weekPaid)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={
                          laborer.runningBalance > 0
                            ? "error.main"
                            : laborer.runningBalance < 0
                              ? "info.main"
                              : "success.main"
                        }
                      >
                        {laborer.runningBalance < 0
                          ? `+${formatCurrency(Math.abs(laborer.runningBalance))}`
                          : formatCurrency(laborer.runningBalance)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ width: 70 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(laborer.paymentProgress, 100)}
                          color={getProgressColor(laborer.paymentProgress)}
                          sx={{ height: 5, borderRadius: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                          {laborer.paymentProgress.toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {laborer.runningBalance > 0 ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openPaymentDialog(laborer, weekStart, weekEnd)}
                          disabled={!canEdit}
                        >
                          Settle
                        </Button>
                      ) : (
                        <Chip
                          label={laborer.status === "advance" ? "ADVANCE" : "SETTLED"}
                          size="small"
                          color={laborer.status === "advance" ? "info" : "success"}
                          sx={{ fontSize: "0.65rem" }}
                        />
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Daily Breakdown Row */}
                  <TableRow>
                    <TableCell colSpan={9} sx={{ py: 0.5, px: 2 }}>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center", pl: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                          Daily:
                        </Typography>
                        {laborer.dailySalary.map((day) => (
                          <Tooltip
                            key={day.date}
                            title={`${dayjs(day.date).format("ddd MMM D")} - ${day.workDays} day(s)`}
                          >
                            <Chip
                              label={`${day.dayName}:${day.amount}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: 10, height: 20 }}
                            />
                          </Tooltip>
                        ))}
                        {laborer.previousBalance > 0 && (
                          <Chip
                            icon={<WarningIcon sx={{ fontSize: 12 }} />}
                            label={`Prev: ${formatCurrency(laborer.previousBalance)}`}
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ fontSize: 10, height: 20, ml: 2 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Bulk action for selected laborers */}
        {laborers.filter(l => selectedLaborers.has(l.laborerId) && l.runningBalance > 0).length > 0 && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<PaymentIcon />}
              onClick={() => {
                const selected = laborers.filter(
                  l => selectedLaborers.has(l.laborerId) && l.runningBalance > 0
                );
                if (selected.length > 0) {
                  openPaymentDialog(selected[0], weekStart, weekEnd);
                }
              }}
              disabled={!canEdit}
            >
              Settle Selected ({laborers.filter(l => selectedLaborers.has(l.laborerId) && l.runningBalance > 0).length})
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  // Handlers
  const handleToggleExpand = (weekStart: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekStart)) {
        next.delete(weekStart);
      } else {
        next.add(weekStart);
      }
      return next;
    });

    setWeekGroups((prev) =>
      prev.map((g) =>
        g.weekStart === weekStart ? { ...g, isExpanded: !g.isExpanded } : g
      )
    );
  };

  const handleToggleSelect = (laborerId: string) => {
    setSelectedLaborers((prev) => {
      const next = new Set(prev);
      if (next.has(laborerId)) {
        next.delete(laborerId);
      } else {
        next.add(laborerId);
      }
      return next;
    });
  };

  const handleSelectAll = (weekStart: string, select: boolean) => {
    const group = weekGroups.find((g) => g.weekStart === weekStart);
    if (!group) return;

    setSelectedLaborers((prev) => {
      const next = new Set(prev);
      group.laborers.forEach((l) => {
        if (l.runningBalance > 0) {
          if (select) {
            next.add(l.laborerId);
          } else {
            next.delete(l.laborerId);
          }
        }
      });
      return next;
    });
  };

  const openPaymentDialog = (
    laborer: WeeklyContractLaborer,
    weekStart: string,
    weekEnd: string
  ) => {
    setSelectedLaborer(laborer);
    setSelectedWeek({ weekStart, weekEnd });
    setPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    setSelectedLaborers(new Set());
    fetchData();
    onDataChange?.();
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          py: 8,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 3,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as "all" | "pending" | "completed")
            }
            label="Status"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="pending">Pending / Partial</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Subcontract</InputLabel>
          <Select
            value={filterSubcontract}
            onChange={(e) => setFilterSubcontract(e.target.value)}
            label="Subcontract"
          >
            <MenuItem value="all">All Subcontracts</MenuItem>
            {subcontracts.map((sc) => (
              <MenuItem key={sc.id} value={sc.id}>
                {sc.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Team</InputLabel>
          <Select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            label="Team"
          >
            <MenuItem value="all">All Teams</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          startIcon={<HistoryIcon />}
          onClick={() => setHistoryDialogOpen(true)}
          variant="outlined"
          size="small"
          color="secondary"
        >
          Payment History
        </Button>

        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchData}
          variant="outlined"
          size="small"
        >
          Refresh
        </Button>
      </Box>

      {/* Week Groups Table */}
      {tableData.length === 0 ? (
        <Alert severity="info">
          No contract laborer attendance found for the selected period. This tab shows only laborers with type &quot;contract&quot;. Daily and market laborers are shown in the first tab.
        </Alert>
      ) : (
        <DataTable<WeekRowData>
          columns={columns}
          data={tableData}
          isLoading={loading}
          enableExpanding
          renderDetailPanel={renderDetailPanel}
          enableRowActions
          positionActionsColumn="last"
          renderRowActions={({ row }) => (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {row.original.totalDue > 0 && (
                <Tooltip title={`Settle Due ${formatCurrency(row.original.totalDue)}`}>
                  <IconButton
                    size="small"
                    color="success"
                    onClick={(e) => {
                      e.stopPropagation();
                      const pendingLaborers = row.original.laborers.filter(
                        (l) => l.runningBalance > 0 && l.status !== "completed"
                      );
                      if (pendingLaborers.length > 0) {
                        openPaymentDialog(
                          pendingLaborers[0],
                          row.original.weekStart,
                          row.original.weekEnd
                        );
                      }
                    }}
                    disabled={!canEdit}
                  >
                    <PaymentIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
          initialState={{
            sorting: [{ id: "weekStart", desc: true }],
          }}
          enablePagination={tableData.length > 10}
          pageSize={10}
          muiExpandButtonProps={({ row }) => ({
            sx: {
              color: row.original.laborerCount > 0 ? "primary.main" : "text.disabled",
            },
          })}
          muiTableBodyRowProps={({ row }) => ({
            sx: {
              // Highlight row if it contains the matching settlement reference
              backgroundColor:
                highlightRef &&
                row.original.settlementReferences.includes(highlightRef)
                  ? alpha(theme.palette.primary.main, 0.15)
                  : undefined,
              transition: "background-color 0.3s ease-in-out",
            },
          })}
        />
      )}

      {/* Payment Dialog */}
      {selectedLaborer && selectedWeek && (
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setSelectedLaborer(null);
            setSelectedWeek(null);
          }}
          weeklyPayment={{
            laborer: selectedLaborer,
            weekStart: selectedWeek.weekStart,
            weekEnd: selectedWeek.weekEnd,
          }}
          allowSubcontractLink
          defaultSubcontractId={selectedLaborer.subcontractId || undefined}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Payment Ref Dialog - shows when clicking on ref codes */}
      <PaymentRefDialog
        open={refDialogOpen}
        paymentReference={selectedPaymentRef}
        onClose={() => {
          setRefDialogOpen(false);
          setSelectedPaymentRef(null);
        }}
        onEdit={(details) => {
          setSelectedPaymentDetails(details);
          setRefDialogOpen(false);
          setEditDialogOpen(true);
        }}
        onDelete={(details) => {
          setSelectedPaymentDetails(details);
          setRefDialogOpen(false);
          setDeleteDialogOpen(true);
        }}
      />

      {/* Edit Payment Dialog */}
      <ContractPaymentEditDialog
        open={editDialogOpen}
        paymentDetails={selectedPaymentDetails}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedPaymentDetails(null);
        }}
        onSuccess={() => {
          fetchData();
          onDataChange?.();
        }}
      />

      {/* Delete Payment Dialog */}
      <ContractPaymentDeleteDialog
        open={deleteDialogOpen}
        paymentDetails={selectedPaymentDetails}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedPaymentDetails(null);
        }}
        onSuccess={() => {
          fetchData();
          onDataChange?.();
        }}
      />

      {/* Payment History Dialog */}
      <ContractPaymentHistoryDialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        onViewPayment={(reference) => {
          setHistoryDialogOpen(false);
          setSelectedPaymentRef(reference);
          setRefDialogOpen(true);
        }}
      />

      {/* Settlements Overview Dialog */}
      <SettlementsOverviewDialog
        open={overviewDialogOpen}
        onClose={() => {
          setOverviewDialogOpen(false);
          setOverviewRefs([]);
          setOverviewContext({});
        }}
        settlementRefs={overviewRefs}
        weekStart={overviewContext.weekStart}
        weekEnd={overviewContext.weekEnd}
        laborerName={overviewContext.laborerName}
        onViewDetails={(ref) => {
          setSelectedPaymentRef(ref);
          setRefDialogOpen(true);
        }}
      />
    </Box>
  );
}
