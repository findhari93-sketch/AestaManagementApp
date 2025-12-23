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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  alpha,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Payment as PaymentIcon,
  History as HistoryIcon,
  CalendarMonth as CalendarMonthIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import dayjs from "dayjs";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PaymentRefDialog from "./PaymentRefDialog";
import ContractPaymentHistoryDialog from "./ContractPaymentHistoryDialog";
import ContractLaborerSummaryDashboard from "./ContractLaborerSummaryDashboard";
import ContractPaymentRecordDialog from "./ContractPaymentRecordDialog";
import type {
  PaymentStatus,
  PaymentSummaryData,
  ContractLaborerPaymentView,
  WeekBreakdownEntry,
} from "@/types/payment.types";
import {
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from "@/types/payment.types";
import { hasEditPermission } from "@/lib/permissions";

interface ContractWeeklyPaymentsTabProps {
  weeksToShow?: number;
  dateFrom?: string;
  dateTo?: string;
  onDataChange?: () => void;
  onSummaryChange?: (summary: PaymentSummaryData) => void;
  highlightRef?: string | null;
}

// View mode type
type ViewMode = "weekly" | "laborer";

// Week row data for week-wise view
interface WeekLaborerData {
  laborerId: string;
  laborerName: string;
  laborerRole: string | null;
  teamId: string | null;
  teamName: string | null;
  subcontractId: string | null;
  subcontractTitle: string | null;
  daysWorked: number;
  earned: number;
  paid: number;
  balance: number;
  progress: number;
}

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
  laborers: WeekLaborerData[];
  settlementReferences: string[];
}

// Get week boundaries (Sunday to Saturday)
function getWeekBoundaries(date: string): { weekStart: string; weekEnd: string } {
  const d = dayjs(date);
  const dayOfWeek = d.day();
  const weekStart = d.subtract(dayOfWeek, "day").format("YYYY-MM-DD");
  const weekEnd = d.add(6 - dayOfWeek, "day").format("YYYY-MM-DD");
  return { weekStart, weekEnd };
}

// Format currency
function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `Rs.${(amount / 100000).toFixed(1)}L`;
  }
  return `Rs.${amount.toLocaleString()}`;
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

  const canEdit = hasEditPermission(userProfile?.role);

  // State
  const [laborers, setLaborers] = useState<ContractLaborerPaymentView[]>([]);
  const [weekGroups, setWeekGroups] = useState<WeekRowData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-scroll refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToHighlight, setHasScrolledToHighlight] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [filterSubcontract, setFilterSubcontract] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [subcontracts, setSubcontracts] = useState<{ id: string; title: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);

  // Dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);

  // Date range
  const dateRange = useMemo(() => {
    if (propDateFrom && propDateTo) {
      return { fromDate: propDateFrom, toDate: propDateTo };
    }
    const today = dayjs();
    const toDate = today.format("YYYY-MM-DD");
    const fromDate = today.subtract(weeksToShow, "week").startOf("week").format("YYYY-MM-DD");
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

      // Fetch teams first
      const { data: teamsLookup } = await supabase
        .from("teams")
        .select("id, name")
        .eq("site_id", selectedSite.id);

      const teamsMap = new Map<string, string>();
      (teamsLookup || []).forEach((t: any) => teamsMap.set(t.id, t.name));

      // Fetch contract laborers' attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("daily_attendance")
        .select(`
          id,
          date,
          laborer_id,
          daily_earnings,
          work_days,
          is_paid,
          payment_id,
          subcontract_id,
          laborers!inner(
            id,
            name,
            laborer_type,
            team_id,
            labor_roles(name)
          ),
          subcontracts(id, title)
        `)
        .eq("site_id", selectedSite.id)
        .eq("laborers.laborer_type", "contract")
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: true });

      if (attendanceError) {
        throw new Error(attendanceError.message);
      }

      // Fetch labor payments
      const { data: paymentsData } = await supabase
        .from("labor_payments")
        .select("*")
        .eq("site_id", selectedSite.id)
        .eq("is_under_contract", true);

      // Fetch payment week allocations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allocationsData } = await (supabase as any)
        .from("payment_week_allocations")
        .select("*")
        .eq("site_id", selectedSite.id);

      // Group by laborer
      const laborerMap = new Map<string, {
        info: any;
        attendance: any[];
        payments: any[];
        allocations: any[];
      }>();

      // Process attendance
      (attendanceData || []).forEach((att: any) => {
        const laborerId = att.laborer_id;
        if (!laborerMap.has(laborerId)) {
          laborerMap.set(laborerId, {
            info: {
              ...att.laborers,
              teamName: att.laborers?.team_id ? teamsMap.get(att.laborers.team_id) : null,
              subcontractId: att.subcontract_id,
              subcontractTitle: att.subcontracts?.title,
            },
            attendance: [],
            payments: [],
            allocations: [],
          });
        }
        laborerMap.get(laborerId)!.attendance.push(att);
      });

      // Process payments
      (paymentsData || []).forEach((p: any) => {
        if (laborerMap.has(p.laborer_id)) {
          laborerMap.get(p.laborer_id)!.payments.push(p);
        }
      });

      // Process allocations
      (allocationsData || []).forEach((a: any) => {
        if (laborerMap.has(a.laborer_id)) {
          laborerMap.get(a.laborer_id)!.allocations.push(a);
        }
      });

      // Build laborer views
      const laborerViews: ContractLaborerPaymentView[] = [];

      laborerMap.forEach((data, laborerId) => {
        const totalEarned = data.attendance.reduce(
          (sum: number, a: any) => sum + (a.daily_earnings || 0),
          0
        );
        const totalPaid = data.payments.reduce(
          (sum: number, p: any) => sum + (p.amount || 0),
          0
        );
        const outstanding = totalEarned - totalPaid;
        const paymentProgress = totalEarned > 0 ? (totalPaid / totalEarned) * 100 : 0;

        // Calculate status
        let status: PaymentStatus = "pending";
        if (outstanding <= 0) {
          status = outstanding < 0 ? "advance" : "completed";
        } else if (totalPaid > 0) {
          status = "partial";
        }

        // Build weekly breakdown
        const weeklyBreakdown: WeekBreakdownEntry[] = [];
        const weekMap = new Map<string, {
          attendance: any[];
          allocations: any[];
        }>();

        // Group attendance by week
        data.attendance.forEach((att: any) => {
          const { weekStart, weekEnd } = getWeekBoundaries(att.date);
          if (!weekMap.has(weekStart)) {
            weekMap.set(weekStart, { attendance: [], allocations: [] });
          }
          weekMap.get(weekStart)!.attendance.push(att);
        });

        // Group allocations by week
        data.allocations.forEach((alloc: any) => {
          if (weekMap.has(alloc.week_start)) {
            weekMap.get(alloc.week_start)!.allocations.push(alloc);
          }
        });

        // Build week entries
        weekMap.forEach((weekData, weekStart) => {
          const weekEnd = dayjs(weekStart).add(6, "day").format("YYYY-MM-DD");
          const earned = weekData.attendance.reduce(
            (sum: number, a: any) => sum + (a.daily_earnings || 0),
            0
          );
          const paid = weekData.allocations.reduce(
            (sum: number, a: any) => sum + (a.allocated_amount || 0),
            0
          );

          weeklyBreakdown.push({
            weekStart,
            weekEnd,
            weekLabel: `${dayjs(weekStart).format("MMM D")} - ${dayjs(weekEnd).format("MMM D, YYYY")}`,
            earned,
            paid,
            balance: earned - paid,
            daysWorked: weekData.attendance.length,
            isPaid: paid >= earned,
            allocations: weekData.allocations.map((a: any) => ({
              paymentId: a.labor_payment_id,
              paymentReference: null,
              amount: a.allocated_amount,
              paymentDate: a.created_at,
            })),
          });
        });

        // Sort weeks by date
        weeklyBreakdown.sort(
          (a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
        );

        // Get last payment date
        const lastPayment = data.payments
          .sort((a: any, b: any) => new Date(b.actual_payment_date).getTime() - new Date(a.actual_payment_date).getTime())[0];

        // Collect all settlement references from payments for highlighting
        const settlementReferences = data.payments
          .map((p: any) => p.settlement_reference)
          .filter((ref: string | null): ref is string => ref != null && ref !== "");

        laborerViews.push({
          laborerId,
          laborerName: data.info.name,
          laborerRole: data.info.labor_roles?.name || null,
          teamId: data.info.team_id,
          teamName: data.info.teamName,
          subcontractId: data.info.subcontractId,
          subcontractTitle: data.info.subcontractTitle,
          totalEarned,
          totalPaid,
          outstanding,
          paymentProgress,
          status,
          lastPaymentDate: lastPayment?.actual_payment_date || null,
          weeklyBreakdown,
          settlementReferences,
        });
      });

      setLaborers(laborerViews);

      // Build week-wise data from laborer views
      const weekDataMap = new Map<string, {
        laborers: WeekLaborerData[];
        totalSalary: number;
        totalPaid: number;
        settlementRefs: Set<string>;
      }>();

      laborerViews.forEach((laborer) => {
        laborer.weeklyBreakdown.forEach((week) => {
          if (!weekDataMap.has(week.weekStart)) {
            weekDataMap.set(week.weekStart, {
              laborers: [],
              totalSalary: 0,
              totalPaid: 0,
              settlementRefs: new Set(),
            });
          }
          const weekData = weekDataMap.get(week.weekStart)!;

          weekData.laborers.push({
            laborerId: laborer.laborerId,
            laborerName: laborer.laborerName,
            laborerRole: laborer.laborerRole,
            teamId: laborer.teamId ?? null,
            teamName: laborer.teamName,
            subcontractId: laborer.subcontractId ?? null,
            subcontractTitle: laborer.subcontractTitle,
            daysWorked: week.daysWorked,
            earned: week.earned,
            paid: week.paid,
            balance: week.balance,
            progress: week.earned > 0 ? (week.paid / week.earned) * 100 : 0,
          });

          weekData.totalSalary += week.earned;
          weekData.totalPaid += week.paid;

          // Add settlement references
          laborer.settlementReferences.forEach((ref) => weekData.settlementRefs.add(ref));
        });
      });

      // Convert map to array
      const weekRows: WeekRowData[] = [];
      weekDataMap.forEach((data, weekStart) => {
        const weekEnd = dayjs(weekStart).add(6, "day").format("YYYY-MM-DD");
        const totalDue = data.totalSalary - data.totalPaid;
        const paymentProgress = data.totalSalary > 0 ? (data.totalPaid / data.totalSalary) * 100 : 0;

        let status: PaymentStatus = "pending";
        if (totalDue <= 0) {
          status = totalDue < 0 ? "advance" : "completed";
        } else if (data.totalPaid > 0) {
          status = "partial";
        }

        weekRows.push({
          id: weekStart,
          weekStart,
          weekEnd,
          weekLabel: `${dayjs(weekStart).format("MMM D")} - ${dayjs(weekEnd).format("MMM D, YYYY")}`,
          laborerCount: data.laborers.length,
          totalSalary: data.totalSalary,
          totalPaid: data.totalPaid,
          totalDue: Math.max(0, totalDue),
          paymentProgress,
          status,
          laborers: data.laborers,
          settlementReferences: Array.from(data.settlementRefs),
        });
      });

      // Sort by week start date descending (most recent first)
      weekRows.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
      setWeekGroups(weekRows);

      // Fetch filter options
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
      console.error("Error fetching data:", err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedSite?.id, dateRange, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Emit summary when laborers change
  useEffect(() => {
    if (!onSummaryChange) return;

    const totalDue = laborers.reduce((sum, l) => sum + Math.max(0, l.outstanding), 0);
    const totalPaid = laborers.reduce((sum, l) => sum + l.totalPaid, 0);
    const laborersWithDue = laborers.filter((l) => l.outstanding > 0).length;

    onSummaryChange({
      dailyMarketPending: 0,
      dailyMarketPendingCount: 0,
      dailyMarketSentToEngineer: 0,
      dailyMarketSentToEngineerCount: 0,
      dailyMarketPaid: 0,
      dailyMarketPaidCount: 0,
      contractWeeklyDue: totalDue,
      contractWeeklyDueLaborerCount: laborersWithDue,
      contractWeeklyPaid: totalPaid,
      bySubcontract: [],
      unlinkedTotal: 0,
      unlinkedCount: 0,
    });
  }, [laborers, onSummaryChange]);

  // Filter laborers
  const filteredLaborers = useMemo(() => {
    return laborers.filter((l) => {
      // Status filter
      if (filterStatus === "pending" && l.status === "completed") return false;
      if (filterStatus === "completed" && l.status !== "completed" && l.status !== "advance") return false;

      // Subcontract filter
      if (filterSubcontract !== "all" && l.subcontractId !== filterSubcontract) return false;

      // Team filter
      if (filterTeam !== "all" && l.teamId !== filterTeam) return false;

      return true;
    });
  }, [laborers, filterStatus, filterSubcontract, filterTeam]);

  // Filter week groups
  const filteredWeekGroups = useMemo(() => {
    return weekGroups.map((week) => {
      // Filter laborers within each week
      const filteredWeekLaborers = week.laborers.filter((l) => {
        if (filterSubcontract !== "all" && l.subcontractId !== filterSubcontract) return false;
        if (filterTeam !== "all" && l.teamId !== filterTeam) return false;
        return true;
      });

      // Recalculate totals for filtered laborers
      const totalSalary = filteredWeekLaborers.reduce((sum, l) => sum + l.earned, 0);
      const totalPaid = filteredWeekLaborers.reduce((sum, l) => sum + l.paid, 0);
      const totalDue = totalSalary - totalPaid;
      const paymentProgress = totalSalary > 0 ? (totalPaid / totalSalary) * 100 : 0;

      let status: PaymentStatus = "pending";
      if (totalDue <= 0) {
        status = totalDue < 0 ? "advance" : "completed";
      } else if (totalPaid > 0) {
        status = "partial";
      }

      return {
        ...week,
        laborers: filteredWeekLaborers,
        laborerCount: filteredWeekLaborers.length,
        totalSalary,
        totalPaid,
        totalDue: Math.max(0, totalDue),
        paymentProgress,
        status,
      };
    }).filter((week) => {
      // Status filter
      if (filterStatus === "pending" && week.status === "completed") return false;
      if (filterStatus === "completed" && week.status !== "completed" && week.status !== "advance") return false;

      // Only include weeks with laborers after filtering
      return week.laborerCount > 0;
    });
  }, [weekGroups, filterStatus, filterSubcontract, filterTeam]);

  // Auto-scroll to highlighted row when data loads
  useEffect(() => {
    if (!highlightRef || hasScrolledToHighlight || loading) {
      return;
    }

    const dataToSearch = viewMode === "weekly" ? filteredWeekGroups : filteredLaborers;
    if (dataToSearch.length === 0) return;

    // Find the row index that contains the highlighted reference
    const highlightedRowIndex = dataToSearch.findIndex((item) =>
      item.settlementReferences.includes(highlightRef)
    );

    if (highlightedRowIndex === -1) {
      return;
    }

    // Small delay to ensure DOM is rendered
    const timeout = setTimeout(() => {
      const tableContainer = tableContainerRef.current;
      if (!tableContainer) return;

      // Find the row element by data attribute
      const highlightedRow = tableContainer.querySelector(
        `[data-row-index="${highlightedRowIndex}"]`
      );

      if (highlightedRow) {
        highlightedRow.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        setHasScrolledToHighlight(true);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [highlightRef, filteredLaborers, filteredWeekGroups, viewMode, hasScrolledToHighlight, loading]);

  // Table columns
  const columns: MRT_ColumnDef<ContractLaborerPaymentView>[] = useMemo(
    () => [
      {
        accessorKey: "laborerName",
        header: "Laborer",
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {row.original.laborerName}
            </Typography>
            {row.original.laborerRole && (
              <Typography variant="caption" color="text.secondary">
                {row.original.laborerRole}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "teamName",
        header: "Team",
        Cell: ({ row }) => row.original.teamName || "-",
      },
      {
        accessorKey: "totalEarned",
        header: "Earned",
        Cell: ({ row }) => formatCurrency(row.original.totalEarned),
      },
      {
        accessorKey: "totalPaid",
        header: "Paid",
        Cell: ({ row }) => (
          <Typography variant="body2" color="success.main">
            {formatCurrency(row.original.totalPaid)}
          </Typography>
        ),
      },
      {
        accessorKey: "outstanding",
        header: "Outstanding",
        Cell: ({ row }) => (
          <Typography
            variant="body2"
            fontWeight={600}
            color={row.original.outstanding > 0 ? "error.main" : "success.main"}
          >
            {formatCurrency(Math.max(0, row.original.outstanding))}
          </Typography>
        ),
      },
      {
        accessorKey: "paymentProgress",
        header: "Progress",
        Cell: ({ row }) => (
          <Box sx={{ width: 100 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="caption">{row.original.paymentProgress.toFixed(0)}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(row.original.paymentProgress, 100)}
              color={
                row.original.paymentProgress >= 100
                  ? "success"
                  : row.original.paymentProgress > 50
                    ? "warning"
                    : "error"
              }
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Box>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        Cell: ({ row }) => (
          <Chip
            label={getPaymentStatusLabel(row.original.status)}
            size="small"
            color={getPaymentStatusColor(row.original.status)}
            variant="outlined"
          />
        ),
      },
    ],
    []
  );

  // Week columns for week-wise view
  const weekColumns: MRT_ColumnDef<WeekRowData>[] = useMemo(
    () => [
      {
        accessorKey: "weekLabel",
        header: "Week",
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {row.original.weekLabel}
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: "laborerCount",
        header: "Laborers",
        Cell: ({ row }) => (
          <Chip
            label={row.original.laborerCount}
            size="small"
            color="primary"
            variant="outlined"
          />
        ),
      },
      {
        accessorKey: "totalSalary",
        header: "Salary",
        Cell: ({ row }) => formatCurrency(row.original.totalSalary),
      },
      {
        accessorKey: "totalPaid",
        header: "Paid",
        Cell: ({ row }) => (
          <Typography variant="body2" color="success.main">
            {formatCurrency(row.original.totalPaid)}
          </Typography>
        ),
      },
      {
        accessorKey: "totalDue",
        header: "Due",
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
        Cell: ({ row }) => (
          <Box sx={{ width: 100 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="caption">{row.original.paymentProgress.toFixed(0)}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(row.original.paymentProgress, 100)}
              color={
                row.original.paymentProgress >= 100
                  ? "success"
                  : row.original.paymentProgress > 50
                    ? "warning"
                    : "error"
              }
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Box>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        Cell: ({ row }) => (
          <Chip
            label={getPaymentStatusLabel(row.original.status)}
            size="small"
            color={getPaymentStatusColor(row.original.status)}
            variant="outlined"
          />
        ),
      },
    ],
    []
  );

  // Render laborers detail panel for week-wise view
  const renderWeekDetailPanel = ({ row }: { row: { original: WeekRowData } }) => {
    const week = row.original;

    if (week.laborers.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No laborers for this week
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Laborers ({week.laborerCount})
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Laborer</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Days</TableCell>
                <TableCell align="right">Earned</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Due</TableCell>
                <TableCell>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {week.laborers.map((laborer) => (
                <TableRow
                  key={laborer.laborerId}
                  sx={{
                    bgcolor: laborer.balance <= 0 ? alpha(theme.palette.success.main, 0.05) : undefined,
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {laborer.laborerName}
                      </Typography>
                      {laborer.laborerRole && (
                        <Typography variant="caption" color="text.secondary">
                          {laborer.laborerRole}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{laborer.teamName || "-"}</TableCell>
                  <TableCell>{laborer.daysWorked}</TableCell>
                  <TableCell align="right">{formatCurrency(laborer.earned)}</TableCell>
                  <TableCell align="right" sx={{ color: "success.main" }}>
                    {formatCurrency(laborer.paid)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: laborer.balance > 0 ? "error.main" : "success.main" }}
                  >
                    {formatCurrency(Math.max(0, laborer.balance))}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(laborer.progress, 100)}
                        color={
                          laborer.progress >= 100
                            ? "success"
                            : laborer.progress > 50
                              ? "warning"
                              : "error"
                        }
                        sx={{ width: 60, height: 6, borderRadius: 1 }}
                      />
                      <Typography variant="caption">
                        {laborer.progress.toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // Render week breakdown detail panel (for laborer-wise view)
  const renderDetailPanel = ({ row }: { row: { original: ContractLaborerPaymentView } }) => {
    const laborer = row.original;

    if (laborer.weeklyBreakdown.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No weekly data available
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Weekly Breakdown
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Week</TableCell>
                <TableCell>Days</TableCell>
                <TableCell align="right">Earned</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {laborer.weeklyBreakdown.map((week) => (
                <TableRow
                  key={week.weekStart}
                  sx={{
                    bgcolor: week.isPaid ? alpha(theme.palette.success.main, 0.05) : undefined,
                  }}
                >
                  <TableCell>{week.weekLabel}</TableCell>
                  <TableCell>{week.daysWorked}</TableCell>
                  <TableCell align="right">{formatCurrency(week.earned)}</TableCell>
                  <TableCell align="right" sx={{ color: "success.main" }}>
                    {formatCurrency(week.paid)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: week.balance > 0 ? "error.main" : "success.main" }}
                  >
                    {formatCurrency(Math.max(0, week.balance))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={week.isPaid ? "Paid" : "Pending"}
                      size="small"
                      color={week.isPaid ? "success" : "warning"}
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const handlePaymentSuccess = () => {
    fetchData();
    onDataChange?.();
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
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
      {/* Summary Dashboard */}
      <ContractLaborerSummaryDashboard laborers={laborers} loading={loading} />

      {/* Action Bar */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 3,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Record Payment Button */}
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<PaymentIcon />}
            onClick={() => setPaymentDialogOpen(true)}
            disabled={laborers.filter((l) => l.outstanding > 0).length === 0}
          >
            Record Payment
          </Button>
        )}

        {/* View Mode Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value) => value && setViewMode(value)}
          size="small"
        >
          <ToggleButton value="weekly">
            <Tooltip title="Week View">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CalendarMonthIcon fontSize="small" />
                <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" } }}>
                  Weeks
                </Typography>
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="laborer">
            <Tooltip title="Laborer View">
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PersonIcon fontSize="small" />
                <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" } }}>
                  Laborers
                </Typography>
              </Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flexGrow: 1 }} />

        {/* Filters */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "all" | "pending" | "completed")}
            label="Status"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Subcontract</InputLabel>
          <Select
            value={filterSubcontract}
            onChange={(e) => setFilterSubcontract(e.target.value)}
            label="Subcontract"
          >
            <MenuItem value="all">All</MenuItem>
            {subcontracts.map((sc) => (
              <MenuItem key={sc.id} value={sc.id}>
                {sc.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Team</InputLabel>
          <Select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            label="Team"
          >
            <MenuItem value="all">All</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          startIcon={<HistoryIcon />}
          onClick={() => setHistoryDialogOpen(true)}
          variant="outlined"
          size="small"
        >
          History
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

      {/* Data Table - Conditional based on view mode */}
      {viewMode === "weekly" ? (
        // Week-wise view
        filteredWeekGroups.length === 0 ? (
          <Alert severity="info">
            No weeks found for the selected period and filters.
          </Alert>
        ) : (
          <Box ref={tableContainerRef}>
            <DataTable<WeekRowData>
              columns={weekColumns}
              data={filteredWeekGroups}
              isLoading={loading}
              enableExpanding
              renderDetailPanel={renderWeekDetailPanel}
              initialState={{
                sorting: [{ id: "weekStart", desc: true }],
              }}
              muiTableBodyRowProps={({ row }) => ({
                "data-row-index": row.index,
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
          </Box>
        )
      ) : (
        // Laborer-wise view
        filteredLaborers.length === 0 ? (
          <Alert severity="info">
            No contract laborers found for the selected period and filters.
          </Alert>
        ) : (
          <Box ref={tableContainerRef}>
            <DataTable<ContractLaborerPaymentView>
              columns={columns}
              data={filteredLaborers}
              isLoading={loading}
              enableExpanding
              renderDetailPanel={renderDetailPanel}
              initialState={{
                sorting: [{ id: "outstanding", desc: true }],
              }}
              muiTableBodyRowProps={({ row }) => ({
                "data-row-index": row.index,
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
          </Box>
        )
      )}

      {/* Payment Dialog */}
      <ContractPaymentRecordDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        laborers={laborers}
        onSuccess={handlePaymentSuccess}
      />

      {/* Payment History Dialog */}
      <ContractPaymentHistoryDialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        onViewPayment={(ref: string) => {
          setSelectedRef(ref);
          setRefDialogOpen(true);
        }}
      />

      {/* Payment Ref Dialog */}
      <PaymentRefDialog
        open={refDialogOpen}
        onClose={() => {
          setRefDialogOpen(false);
          setSelectedRef(null);
        }}
        paymentReference={selectedRef}
      />
    </Box>
  );
}
