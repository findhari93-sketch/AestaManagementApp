"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
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
import DateGroupRow from "./DateGroupRow";
import PaymentDialog from "./PaymentDialog";
import type {
  DateGroup,
  DailyPaymentRecord,
  PaymentFilterState,
} from "@/types/payment.types";
import { hasEditPermission } from "@/lib/permissions";

interface DailyMarketPaymentsTabProps {
  dateFrom: string;
  dateTo: string;
  onFilterChange: (filters: Partial<PaymentFilterState>) => void;
  onDataChange?: () => void;
}

export default function DailyMarketPaymentsTab({
  dateFrom,
  dateTo,
  onFilterChange,
  onDataChange,
}: DailyMarketPaymentsTabProps) {
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();

  // Data state
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "sent_to_engineer" | "paid"
  >("all");
  const [filterSubcontract, setFilterSubcontract] = useState<string>("all");
  const [subcontracts, setSubcontracts] = useState<
    { id: string; title: string }[]
  >([]);

  // Selection state
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(
    new Set()
  );

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedForPayment, setSelectedForPayment] = useState<
    DailyPaymentRecord[]
  >([]);

  // Expanded state
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const canEdit = hasEditPermission(userProfile?.role);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!selectedSite?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch daily attendance (non-contract laborers)
      const { data: dailyData, error: dailyError } = await supabase
        .from("daily_attendance")
        .select(
          `
          id,
          date,
          laborer_id,
          daily_earnings,
          is_paid,
          payment_date,
          payment_mode,
          paid_via,
          engineer_transaction_id,
          payment_proof_url,
          subcontract_id,
          laborers!inner(name, laborer_type, labor_categories(name), labor_roles(name)),
          subcontracts(title)
        `
        )
        .eq("site_id", selectedSite.id)
        .neq("laborers.laborer_type", "contract")
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      if (dailyError) throw dailyError;

      // Fetch market attendance
      const { data: marketData, error: marketError } = await supabase
        .from("market_laborer_attendance")
        .select(
          `
          id,
          date,
          count,
          total_cost,
          is_paid,
          payment_date,
          payment_mode,
          paid_via,
          engineer_transaction_id,
          payment_proof_url,
          labor_roles(name)
        `
        )
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      if (marketError) throw marketError;

      // Map to DailyPaymentRecord
      const dailyRecords: DailyPaymentRecord[] = (dailyData || []).map(
        (r: any) => ({
          id: `daily-${r.id}`,
          sourceType: "daily" as const,
          sourceId: r.id,
          date: r.date,
          laborerId: r.laborer_id,
          laborerName: r.laborers?.name || "Unknown",
          laborerType: "daily" as const,
          category: r.laborers?.labor_categories?.name,
          role: r.laborers?.labor_roles?.name,
          amount: r.daily_earnings || 0,
          isPaid: r.is_paid || false,
          paidVia: r.paid_via,
          paymentDate: r.payment_date,
          paymentMode: r.payment_mode,
          engineerTransactionId: r.engineer_transaction_id,
          proofUrl: r.payment_proof_url,
          subcontractId: r.subcontract_id,
          subcontractTitle: r.subcontracts?.title,
        })
      );

      const marketRecords: DailyPaymentRecord[] = (marketData || []).map(
        (r: any) => ({
          id: `market-${r.id}`,
          sourceType: "market" as const,
          sourceId: r.id,
          date: r.date,
          laborerId: null,
          laborerName: r.labor_roles?.name || "Market Labor",
          laborerType: "market" as const,
          role: r.labor_roles?.name,
          count: r.count,
          amount: r.total_cost || 0,
          isPaid: r.is_paid || false,
          paidVia: r.paid_via,
          paymentDate: r.payment_date,
          paymentMode: r.payment_mode,
          engineerTransactionId: r.engineer_transaction_id,
          proofUrl: r.payment_proof_url,
          subcontractId: null,
          subcontractTitle: null,
        })
      );

      // Group by date
      const dateMap = new Map<string, DateGroup>();

      // Process daily records
      dailyRecords.forEach((record) => {
        if (!dateMap.has(record.date)) {
          dateMap.set(record.date, createEmptyDateGroup(record.date));
        }
        const group = dateMap.get(record.date)!;
        group.dailyRecords.push(record);
        updateGroupSummary(group);
      });

      // Process market records
      marketRecords.forEach((record) => {
        if (!dateMap.has(record.date)) {
          dateMap.set(record.date, createEmptyDateGroup(record.date));
        }
        const group = dateMap.get(record.date)!;
        group.marketRecords.push(record);
        updateGroupSummary(group);
      });

      // Convert to array and sort by date descending
      const groups = Array.from(dateMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Restore expanded state
      groups.forEach((g) => {
        g.isExpanded = expandedDates.has(g.date);
      });

      setDateGroups(groups);

      // Fetch subcontracts for filter
      const { data: subcontractsData } = await supabase
        .from("subcontracts")
        .select("id, title")
        .eq("site_id", selectedSite.id)
        .in("status", ["active", "on_hold"]);

      setSubcontracts(subcontractsData || []);
    } catch (err: any) {
      console.error("Error fetching payment data:", err);
      setError(err.message || "Failed to load payment data");
    } finally {
      setLoading(false);
    }
  }, [selectedSite?.id, dateFrom, dateTo, expandedDates, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter records
  const filteredDateGroups = useMemo(() => {
    return dateGroups
      .map((group) => {
        let dailyRecords = group.dailyRecords;
        let marketRecords = group.marketRecords;

        // Filter by status
        if (filterStatus !== "all") {
          const filterFn = (r: DailyPaymentRecord) => {
            if (filterStatus === "pending")
              return !r.isPaid && r.paidVia !== "engineer_wallet";
            if (filterStatus === "sent_to_engineer")
              return !r.isPaid && r.paidVia === "engineer_wallet";
            if (filterStatus === "paid") return r.isPaid;
            return true;
          };
          dailyRecords = dailyRecords.filter(filterFn);
          marketRecords = marketRecords.filter(filterFn);
        }

        // Filter by subcontract
        if (filterSubcontract !== "all") {
          dailyRecords = dailyRecords.filter(
            (r) => r.subcontractId === filterSubcontract
          );
          // Market records don't have subcontract, so exclude them if filtering by subcontract
          marketRecords = [];
        }

        const filteredGroup = {
          ...group,
          dailyRecords,
          marketRecords,
          summary: calculateSummary(dailyRecords, marketRecords),
        };

        return filteredGroup;
      })
      .filter(
        (group) =>
          group.dailyRecords.length > 0 || group.marketRecords.length > 0
      );
  }, [dateGroups, filterStatus, filterSubcontract]);

  // Helper functions
  function createEmptyDateGroup(date: string): DateGroup {
    return {
      date,
      dateLabel: dayjs(date).format("MMM DD, YYYY"),
      dayName: dayjs(date).format("dddd"),
      dailyRecords: [],
      marketRecords: [],
      summary: {
        dailyCount: 0,
        dailyTotal: 0,
        dailyPending: 0,
        dailyPaid: 0,
        dailySentToEngineer: 0,
        marketCount: 0,
        marketTotal: 0,
        marketPending: 0,
        marketPaid: 0,
        marketSentToEngineer: 0,
      },
      isExpanded: false,
    };
  }

  function updateGroupSummary(group: DateGroup) {
    group.summary = calculateSummary(group.dailyRecords, group.marketRecords);
  }

  function calculateSummary(
    dailyRecords: DailyPaymentRecord[],
    marketRecords: DailyPaymentRecord[]
  ) {
    return {
      dailyCount: dailyRecords.length,
      dailyTotal: dailyRecords.reduce((sum, r) => sum + r.amount, 0),
      dailyPending: dailyRecords
        .filter((r) => !r.isPaid && r.paidVia !== "engineer_wallet")
        .reduce((sum, r) => sum + r.amount, 0),
      dailyPaid: dailyRecords
        .filter((r) => r.isPaid)
        .reduce((sum, r) => sum + r.amount, 0),
      dailySentToEngineer: dailyRecords
        .filter((r) => !r.isPaid && r.paidVia === "engineer_wallet")
        .reduce((sum, r) => sum + r.amount, 0),
      marketCount: marketRecords.length,
      marketTotal: marketRecords.reduce((sum, r) => sum + r.amount, 0),
      marketPending: marketRecords
        .filter((r) => !r.isPaid && r.paidVia !== "engineer_wallet")
        .reduce((sum, r) => sum + r.amount, 0),
      marketPaid: marketRecords
        .filter((r) => r.isPaid)
        .reduce((sum, r) => sum + r.amount, 0),
      marketSentToEngineer: marketRecords
        .filter((r) => !r.isPaid && r.paidVia === "engineer_wallet")
        .reduce((sum, r) => sum + r.amount, 0),
    };
  }

  // Handlers
  const handleToggleExpand = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });

    setDateGroups((prev) =>
      prev.map((g) =>
        g.date === date ? { ...g, isExpanded: !g.isExpanded } : g
      )
    );
  };

  const handleToggleSelect = (recordId: string) => {
    setSelectedRecords((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const handleSelectAllDaily = (date: string, select: boolean) => {
    const group = dateGroups.find((g) => g.date === date);
    if (!group) return;

    setSelectedRecords((prev) => {
      const next = new Set(prev);
      group.dailyRecords.forEach((r) => {
        if (!r.isPaid) {
          if (select) {
            next.add(r.id);
          } else {
            next.delete(r.id);
          }
        }
      });
      return next;
    });
  };

  const handleSelectAllMarket = (date: string, select: boolean) => {
    const group = dateGroups.find((g) => g.date === date);
    if (!group) return;

    setSelectedRecords((prev) => {
      const next = new Set(prev);
      group.marketRecords.forEach((r) => {
        if (!r.isPaid) {
          if (select) {
            next.add(r.id);
          } else {
            next.delete(r.id);
          }
        }
      });
      return next;
    });
  };

  const openPaymentDialog = (records: DailyPaymentRecord[]) => {
    setSelectedForPayment(records);
    setPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    setSelectedRecords(new Set());
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
              setFilterStatus(
                e.target.value as "all" | "pending" | "sent_to_engineer" | "paid"
              )
            }
            label="Status"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="sent_to_engineer">Sent to Engineer</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
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

      {/* Date Groups */}
      {filteredDateGroups.length === 0 ? (
        <Alert severity="info">
          No payment records found for the selected date range and filters.
        </Alert>
      ) : (
        filteredDateGroups.map((group) => (
          <DateGroupRow
            key={group.date}
            dateGroup={group}
            onToggleExpand={() => handleToggleExpand(group.date)}
            onPayAllDaily={(records) => openPaymentDialog(records)}
            onPayAllMarket={(records) => openPaymentDialog(records)}
            onPayAll={(records) => openPaymentDialog(records)}
            onPaySelected={(records) => openPaymentDialog(records)}
            onPaySingle={(record) => openPaymentDialog([record])}
            selectedRecords={selectedRecords}
            onToggleSelect={handleToggleSelect}
            onSelectAllDaily={handleSelectAllDaily}
            onSelectAllMarket={handleSelectAllMarket}
            disabled={!canEdit}
          />
        ))
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        dailyRecords={selectedForPayment}
        allowSubcontractLink
        onSuccess={handlePaymentSuccess}
      />
    </Box>
  );
}
