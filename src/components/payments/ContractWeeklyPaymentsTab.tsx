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
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import dayjs from "dayjs";
import WeekGroupRow from "./WeekGroupRow";
import PaymentDialog from "./PaymentDialog";
import type {
  WeekGroup,
  WeeklyContractLaborer,
  WeeklyFilterState,
  PaymentStatus,
  DailySalaryEntry,
  LaborerPaymentEntry,
} from "@/types/payment.types";
import { hasEditPermission } from "@/lib/permissions";

interface ContractWeeklyPaymentsTabProps {
  weeksToShow?: number;
  dateFrom?: string;
  dateTo?: string;
  onDataChange?: () => void;
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
}: ContractWeeklyPaymentsTabProps) {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();

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

      // Fetch contract laborers' attendance
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
            labor_roles(name),
            teams!laborers_team_id_fkey(id, name)
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
      if (attendanceError) throw attendanceError;

      // Fetch labor payments for contract laborers
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("labor_payments")
        .select("*")
        .eq("site_id", selectedSite.id)
        .eq("is_under_contract", true)
        .gte("payment_for_date", fromDate)
        .lte("payment_for_date", toDate);

      if (paymentsError) throw paymentsError;

      // Group attendance by laborer and week
      const laborerWeekMap = new Map<string, Map<string, {
        attendance: any[];
        payments: any[];
      }>>();

      // Process attendance
      (attendanceData || []).forEach((att: any) => {
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

          // Payment history
          const payments: LaborerPaymentEntry[] = weekData.payments.map(
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
            })
          );

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
        .eq("is_active", true);

      setSubcontracts(subcontractsData || []);
      setTeams(teamsData || []);
    } catch (err: any) {
      console.error("Error fetching weekly payment data:", err);
      setError(err.message || "Failed to load weekly payment data");
    } finally {
      setLoading(false);
    }
  // Note: expandedWeeks removed from deps to prevent refetch on expand/collapse
  }, [selectedSite?.id, dateRange, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          startIcon={<RefreshIcon />}
          onClick={fetchData}
          variant="outlined"
          size="small"
        >
          Refresh
        </Button>
      </Box>

      {/* Week Groups */}
      {filteredWeekGroups.length === 0 ? (
        <Alert severity="info">
          No contract laborer attendance found for the selected period. This tab shows only laborers with type &quot;contract&quot;. Daily and market laborers are shown in the first tab.
        </Alert>
      ) : (
        filteredWeekGroups.map((group) => (
          <WeekGroupRow
            key={group.weekStart}
            weekGroup={group}
            onToggleExpand={() => handleToggleExpand(group.weekStart)}
            onPayWeeklyDue={(laborers) => {
              // Open dialog for first laborer, could also batch
              if (laborers.length > 0) {
                openPaymentDialog(
                  laborers[0],
                  group.weekStart,
                  group.weekEnd
                );
              }
            }}
            onPaySelected={(laborers) => {
              if (laborers.length > 0) {
                openPaymentDialog(
                  laborers[0],
                  group.weekStart,
                  group.weekEnd
                );
              }
            }}
            onPayLaborer={(laborer) =>
              openPaymentDialog(laborer, group.weekStart, group.weekEnd)
            }
            selectedLaborers={selectedLaborers}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            disabled={!canEdit}
          />
        ))
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
    </Box>
  );
}
