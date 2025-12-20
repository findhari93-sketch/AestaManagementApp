"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useFullscreen } from "@/hooks/useFullscreen";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import dayjs from "dayjs";
import SalarySettlementTable from "./SalarySettlementTable";
import PaymentDialog from "./PaymentDialog";
import CancelPaymentDialog from "./CancelPaymentDialog";
import DateEditDialog from "./DateEditDialog";
import DateCancelDialog from "./DateCancelDialog";
import type {
  DateGroup,
  DailyPaymentRecord,
  PaymentFilterState,
  MoneySourceSummary,
} from "@/types/payment.types";
import { hasEditPermission, canPerformMassUpload } from "@/lib/permissions";
import MoneySourceSummaryCard from "./MoneySourceSummaryCard";
import { getPayerSourceLabel } from "@/components/settlement/PayerSourceSelector";
import type { PayerSource } from "@/types/settlement.types";
import { notifyEngineerPaymentReminder } from "@/lib/services/notificationService";
import { generateWhatsAppUrl, generatePaymentReminderMessage } from "@/lib/formatters";
import SettlementDetailsDialog from "@/components/settlement/SettlementDetailsDialog";
import DateViewDetailsDialog from "./DateViewDetailsDialog";

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { selectedSite } = useSite();
  const { userProfile } = useAuth();
  const supabase = createClient();

  // Fullscreen support
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen(
    tableContainerRef,
    { orientation: "landscape" }
  );

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

  // Cancel payment dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [recordToCancel, setRecordToCancel] = useState<DailyPaymentRecord | null>(null);
  const [engineerNameToCancel, setEngineerNameToCancel] = useState<string>("");

  // Bulk cancel state
  const [bulkCancelRecords, setBulkCancelRecords] = useState<DailyPaymentRecord[]>([]);
  const [bulkCancelProcessing, setBulkCancelProcessing] = useState(false);

  // Date edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogDate, setEditDialogDate] = useState<string>("");
  const [editDialogGroup, setEditDialogGroup] = useState<DateGroup | null>(null);

  // Date cancel dialog state (bulk cancel by date)
  const [dateCancelDialogOpen, setDateCancelDialogOpen] = useState(false);
  const [dateCancelDate, setDateCancelDate] = useState<string>("");
  const [dateCancelRecords, setDateCancelRecords] = useState<DailyPaymentRecord[]>([]);

  // Expanded state
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const expandedDatesRef = useRef<Set<string>>(new Set());

  // Keep ref in sync with state
  useEffect(() => {
    expandedDatesRef.current = expandedDates;
  }, [expandedDates]);

  const canEdit = hasEditPermission(userProfile?.role);
  const isAdmin = canPerformMassUpload(userProfile?.role); // admin or office

  // Settlement details dialog state (for admin confirmation)
  const [settlementDetailsOpen, setSettlementDetailsOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  // View details dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewDialogDate, setViewDialogDate] = useState<string>("");
  const [viewDialogGroup, setViewDialogGroup] = useState<DateGroup | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!selectedSite?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch daily attendance (non-contract laborers) with settlement status
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
          payment_notes,
          subcontract_id,
          expense_id,
          laborers!inner(name, laborer_type, labor_categories(name), labor_roles(name)),
          subcontracts(title),
          site_engineer_transactions!engineer_transaction_id(
            settlement_status,
            settlement_mode,
            notes,
            proof_url,
            settlement_proof_url,
            transaction_date,
            settled_date,
            confirmed_at,
            money_source,
            money_source_name
          )
        `
        )
        .eq("site_id", selectedSite.id)
        .neq("laborers.laborer_type", "contract")
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      if (dailyError) throw dailyError;

      // Fetch market attendance with settlement status
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
          payment_notes,
          expense_id,
          labor_roles(name),
          site_engineer_transactions!engineer_transaction_id(
            settlement_status,
            settlement_mode,
            notes,
            proof_url,
            settlement_proof_url,
            transaction_date,
            settled_date,
            confirmed_at,
            money_source,
            money_source_name
          )
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
          paymentNotes: r.payment_notes || null,
          subcontractId: r.subcontract_id,
          subcontractTitle: r.subcontracts?.title,
          expenseId: r.expense_id || null,
          settlementStatus: r.site_engineer_transactions?.settlement_status || null,
          // Settlement tracking fields from engineer transaction
          companyProofUrl: r.site_engineer_transactions?.proof_url || null,
          engineerProofUrl: r.site_engineer_transactions?.settlement_proof_url || null,
          transactionDate: r.site_engineer_transactions?.transaction_date || null,
          settledDate: r.site_engineer_transactions?.settled_date || null,
          confirmedAt: r.site_engineer_transactions?.confirmed_at || null,
          settlementMode: r.site_engineer_transactions?.settlement_mode || null,
          cashReason: r.site_engineer_transactions?.notes || null,
          // Money source tracking
          moneySource: r.site_engineer_transactions?.money_source || null,
          moneySourceName: r.site_engineer_transactions?.money_source_name || null,
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
          paymentNotes: r.payment_notes || null,
          subcontractId: null,
          subcontractTitle: null,
          expenseId: r.expense_id || null,
          settlementStatus: r.site_engineer_transactions?.settlement_status || null,
          // Settlement tracking fields from engineer transaction
          companyProofUrl: r.site_engineer_transactions?.proof_url || null,
          engineerProofUrl: r.site_engineer_transactions?.settlement_proof_url || null,
          transactionDate: r.site_engineer_transactions?.transaction_date || null,
          settledDate: r.site_engineer_transactions?.settled_date || null,
          confirmedAt: r.site_engineer_transactions?.confirmed_at || null,
          settlementMode: r.site_engineer_transactions?.settlement_mode || null,
          cashReason: r.site_engineer_transactions?.notes || null,
          // Money source tracking
          moneySource: r.site_engineer_transactions?.money_source || null,
          moneySourceName: r.site_engineer_transactions?.money_source_name || null,
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

      // Restore expanded state using ref (to avoid stale closure)
      groups.forEach((g) => {
        g.isExpanded = expandedDatesRef.current.has(g.date);
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
  // Note: expandedDates removed from deps to prevent refetch on expand/collapse
  }, [selectedSite?.id, dateFrom, dateTo, supabase]);

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

  // Calculate money source summary from all records with engineer transactions
  const moneySourceSummaries = useMemo(() => {
    const summaryMap = new Map<string, MoneySourceSummary>();

    // Collect all records
    const allRecords = filteredDateGroups.flatMap(g => [...g.dailyRecords, ...g.marketRecords]);

    // Only include records that went via engineer wallet (have money source)
    allRecords.forEach(record => {
      if (record.moneySource && record.paidVia === "engineer_wallet") {
        const key = record.moneySource === "other_site_money" || record.moneySource === "custom"
          ? `${record.moneySource}:${record.moneySourceName || ""}`
          : record.moneySource;

        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            source: record.moneySource as PayerSource,
            displayName: getPayerSourceLabel(record.moneySource as PayerSource, record.moneySourceName || undefined),
            totalAmount: 0,
            transactionCount: 0,
            laborerCount: 0,
          });
        }

        const summary = summaryMap.get(key)!;
        summary.totalAmount += record.amount;
        summary.transactionCount += 1;
        summary.laborerCount += record.count || 1;
      }
    });

    // Sort by amount descending
    return Array.from(summaryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredDateGroups]);

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

  // Handle "Notify Engineer" button click for single record
  const handleNotifyEngineer = async (record: DailyPaymentRecord) => {
    if (!record.engineerTransactionId) {
      console.error("No engineer transaction ID found");
      return;
    }

    try {
      // Fetch engineer details from the transaction
      const { data: txData, error: txError } = await supabase
        .from("site_engineer_transactions")
        .select(`
          id,
          user_id,
          amount,
          transaction_date,
          users!site_engineer_transactions_user_id_fkey (name, phone)
        `)
        .eq("id", record.engineerTransactionId)
        .single();

      if (txError || !txData) {
        console.error("Error fetching engineer transaction:", txError);
        return;
      }

      const engineerName = (txData.users as unknown as { name: string; phone: string } | null)?.name || "Engineer";
      const engineerPhone = (txData.users as unknown as { name: string; phone: string } | null)?.phone;

      // Send in-app notification
      await notifyEngineerPaymentReminder(
        supabase,
        txData.user_id,
        record.engineerTransactionId,
        record.amount,
        1, // laborerCount for single record
        selectedSite?.name,
        record.date
      );

      // Open WhatsApp with pre-filled message
      if (engineerPhone) {
        const message = generatePaymentReminderMessage({
          engineerName,
          paymentDate: dayjs(record.date).format("MMM D, YYYY"),
          amount: record.amount,
          laborerCount: 1,
          siteName: selectedSite?.name || "the site",
        });
        const whatsappUrl = generateWhatsAppUrl(engineerPhone, message);
        if (whatsappUrl) {
          window.open(whatsappUrl, "_blank");
        }
      }
    } catch (err) {
      console.error("Error notifying engineer:", err);
    }
  };

  // Handle "Notify Engineer" button click for all records on a date (bulk notification)
  const handleNotifyDate = async (date: string, records: DailyPaymentRecord[]) => {
    if (records.length === 0) return;

    try {
      // Group records by engineer transaction ID to avoid duplicate notifications
      const byEngineerTx = new Map<string, { records: DailyPaymentRecord[]; totalAmount: number }>();

      records.forEach((record) => {
        if (!record.engineerTransactionId) return;

        const existing = byEngineerTx.get(record.engineerTransactionId);
        if (existing) {
          existing.records.push(record);
          existing.totalAmount += record.amount;
        } else {
          byEngineerTx.set(record.engineerTransactionId, {
            records: [record],
            totalAmount: record.amount,
          });
        }
      });

      // For each unique engineer transaction, send notification
      for (const [txId, { records: txRecords, totalAmount }] of byEngineerTx) {
        // Fetch engineer details
        const { data: txData, error: txError } = await supabase
          .from("site_engineer_transactions")
          .select(`
            id,
            user_id,
            amount,
            transaction_date,
            users!site_engineer_transactions_user_id_fkey (name, phone)
          `)
          .eq("id", txId)
          .single();

        if (txError || !txData) {
          console.error("Error fetching engineer transaction:", txError);
          continue;
        }

        const engineerName = (txData.users as unknown as { name: string; phone: string } | null)?.name || "Engineer";
        const engineerPhone = (txData.users as unknown as { name: string; phone: string } | null)?.phone;
        const laborerCount = txRecords.length;

        // Send in-app notification
        await notifyEngineerPaymentReminder(
          supabase,
          txData.user_id,
          txId,
          totalAmount,
          laborerCount,
          selectedSite?.name,
          date
        );

        // Open WhatsApp with pre-filled message (only for first/primary engineer)
        if (engineerPhone) {
          const message = generatePaymentReminderMessage({
            engineerName,
            paymentDate: dayjs(date).format("MMM D, YYYY"),
            amount: totalAmount,
            laborerCount,
            siteName: selectedSite?.name || "the site",
          });
          const whatsappUrl = generateWhatsAppUrl(engineerPhone, message);
          if (whatsappUrl) {
            window.open(whatsappUrl, "_blank");
          }
        }
      }
    } catch (err) {
      console.error("Error notifying engineer for date:", err);
    }
  };

  // Handle opening cancel payment dialog
  const handleOpenCancelDialog = async (record: DailyPaymentRecord) => {
    try {
      let engineerName = "";

      // For engineer wallet payments, fetch engineer name
      if (record.engineerTransactionId) {
        const { data: txData, error: txError } = await supabase
          .from("site_engineer_transactions")
          .select(`
            id,
            users!site_engineer_transactions_user_id_fkey (name)
          `)
          .eq("id", record.engineerTransactionId)
          .single();

        if (txError) {
          console.error("Error fetching engineer transaction:", txError);
        }

        engineerName = (txData?.users as unknown as { name: string } | null)?.name || "Engineer";
      }
      // For direct payments, no engineer involved
      // engineerName stays empty

      setRecordToCancel(record);
      setEngineerNameToCancel(engineerName);
      setCancelDialogOpen(true);
    } catch (err) {
      console.error("Error opening cancel dialog:", err);
    }
  };

  // Handle cancel payment confirmation
  const handleCancelPayment = async (reason?: string) => {
    if (!recordToCancel || !userProfile) {
      throw new Error("Missing required data for cancellation");
    }

    // 1. Reset attendance record(s) to unpaid state
    if (recordToCancel.sourceType === "daily") {
      const { error: dailyError } = await supabase
        .from("daily_attendance")
        .update({
          is_paid: false,
          payment_date: null,
          payment_mode: null,
          paid_via: null,
          engineer_transaction_id: null,
          payment_proof_url: null,
          subcontract_id: null,
        })
        .eq("id", recordToCancel.sourceId);

      if (dailyError) throw dailyError;
    } else if (recordToCancel.sourceType === "market") {
      const { error: marketError } = await supabase
        .from("market_laborer_attendance")
        .update({
          is_paid: false,
          payment_date: null,
          payment_mode: null,
          paid_via: null,
          engineer_transaction_id: null,
          payment_proof_url: null,
        })
        .eq("id", recordToCancel.sourceId);

      if (marketError) throw marketError;
    }

    // 2. For engineer wallet payments, handle the transaction
    if (recordToCancel.engineerTransactionId) {
      const transactionId = recordToCancel.engineerTransactionId;

      // Check if there are other records linked to this transaction
      const { count: dailyCount } = await supabase
        .from("daily_attendance")
        .select("*", { count: "exact", head: true })
        .eq("engineer_transaction_id", transactionId);

      const { count: marketCount } = await supabase
        .from("market_laborer_attendance")
        .select("*", { count: "exact", head: true })
        .eq("engineer_transaction_id", transactionId);

      const remainingLinkedRecords = (dailyCount || 0) + (marketCount || 0);

      // If no more linked records, mark transaction as cancelled
      if (remainingLinkedRecords === 0) {
        const { error: txError } = await supabase
          .from("site_engineer_transactions")
          .update({
            settlement_status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: userProfile.name,
            cancelled_by_user_id: userProfile.id,
            cancellation_reason: reason || null,
          })
          .eq("id", transactionId);

        if (txError) throw txError;
      }
    }
    // For direct payments (no engineerTransactionId), no transaction to update

    // 3. Delete the expense record
    if (recordToCancel.expenseId) {
      // Delete by expense_id (most reliable - direct link)
      await supabase
        .from("expenses")
        .delete()
        .eq("id", recordToCancel.expenseId);
    } else if (recordToCancel.engineerTransactionId) {
      // Fallback: For engineer payments - delete by transaction ID
      await supabase
        .from("expenses")
        .delete()
        .eq("engineer_transaction_id", recordToCancel.engineerTransactionId);
    } else if (selectedSite && recordToCancel.subcontractId) {
      // Fallback for old direct payments: match by subcontract, date, amount
      await supabase
        .from("expenses")
        .delete()
        .eq("site_id", selectedSite.id)
        .eq("contract_id", recordToCancel.subcontractId)
        .eq("date", recordToCancel.date)
        .eq("amount", recordToCancel.amount)
        .eq("module", "labor");
    }

    // Note: Subcontract paid totals are calculated by summing linked expenses,
    // so deleting the expense above automatically updates the subcontract's paid amount.

    // 4. Refresh data
    fetchData();
    onDataChange?.();
  };

  // Handle opening bulk cancel confirmation
  const handleOpenBulkCancelDialog = (records: DailyPaymentRecord[]) => {
    setBulkCancelRecords(records);
    // Use the first record to show in dialog (for display purposes)
    if (records.length > 0) {
      setRecordToCancel({
        ...records[0],
        // Override laborer name to show count
        laborerName: `${records.length} payments`,
        // Sum up total amount
        amount: records.reduce((sum, r) => sum + r.amount, 0),
      });
      setEngineerNameToCancel(""); // Direct payments don't have engineer
      setCancelDialogOpen(true);
    }
  };

  // Handle bulk cancel confirmation
  const handleBulkCancelPayment = async (reason?: string) => {
    if (bulkCancelRecords.length === 0 || !userProfile) {
      throw new Error("Missing required data for bulk cancellation");
    }

    setBulkCancelProcessing(true);

    try {
      // Process each record
      for (const record of bulkCancelRecords) {
        if (record.sourceType === "daily") {
          const { error: dailyError } = await supabase
            .from("daily_attendance")
            .update({
              is_paid: false,
              payment_date: null,
              payment_mode: null,
              paid_via: null,
              engineer_transaction_id: null,
              payment_proof_url: null,
              subcontract_id: null,
            })
            .eq("id", record.sourceId);

          if (dailyError) throw dailyError;
        } else if (record.sourceType === "market") {
          const { error: marketError } = await supabase
            .from("market_laborer_attendance")
            .update({
              is_paid: false,
              payment_date: null,
              payment_mode: null,
              paid_via: null,
              engineer_transaction_id: null,
              payment_proof_url: null,
            })
            .eq("id", record.sourceId);

          if (marketError) throw marketError;
        }

        // Delete the expense record for this payment
        if (record.expenseId) {
          // Delete by expense_id (most reliable - direct link)
          await supabase
            .from("expenses")
            .delete()
            .eq("id", record.expenseId);
        } else if (record.engineerTransactionId) {
          // Fallback: For engineer payments - delete by transaction ID
          await supabase
            .from("expenses")
            .delete()
            .eq("engineer_transaction_id", record.engineerTransactionId);
        } else if (selectedSite && record.subcontractId) {
          // Fallback for old direct payments: match by subcontract, date, amount
          await supabase
            .from("expenses")
            .delete()
            .eq("site_id", selectedSite.id)
            .eq("contract_id", record.subcontractId)
            .eq("date", record.date)
            .eq("amount", record.amount)
            .eq("module", "labor");
        }

        // Note: Subcontract paid totals are calculated by summing linked expenses,
        // so deleting the expense above automatically updates the subcontract's paid amount.
      }

      // Refresh data
      fetchData();
      onDataChange?.();
    } finally {
      setBulkCancelProcessing(false);
      setBulkCancelRecords([]);
    }
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
    <Box
      ref={tableContainerRef}
      sx={{
        bgcolor: isFullscreen ? "background.paper" : "transparent",
        p: isFullscreen ? 2 : 0,
        height: isFullscreen ? "100vh" : "auto",
        overflow: isFullscreen ? "auto" : "visible",
        position: "relative",
      }}
    >
      {/* Fullscreen Header */}
      {isFullscreen && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
            pb: 1,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            Daily & Market Settlements
          </Typography>
          <IconButton onClick={exitFullscreen} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      )}

      {/* Fullscreen Toggle (Mobile only, when not fullscreen) */}
      {!isFullscreen && isMobile && (
        <Tooltip title="View fullscreen (rotate)">
          <IconButton
            onClick={enterFullscreen}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 10,
              bgcolor: "rgba(255,255,255,0.95)",
              boxShadow: 2,
              "&:hover": { bgcolor: "rgba(255,255,255,1)" },
            }}
          >
            <FullscreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Filters */}
      <Box
        sx={{
          display: "flex",
          gap: { xs: 1, sm: 2 },
          mb: 2,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <FormControl size="small" sx={{ minWidth: { xs: 100, sm: 150 } }}>
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
            <MenuItem value="sent_to_engineer">With Engineer</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 200 } }}>
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

        <Box sx={{ flexGrow: 1 }} />

        {/* Fullscreen toggle button (desktop) */}
        {!isFullscreen && !isMobile && (
          <Tooltip title="View fullscreen">
            <IconButton onClick={enterFullscreen} size="small">
              <FullscreenIcon />
            </IconButton>
          </Tooltip>
        )}

        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchData}
          variant="outlined"
          size="small"
        >
          Refresh
        </Button>
      </Box>

      {/* Money Source Summary Card */}
      {moneySourceSummaries.length > 0 && (
        <MoneySourceSummaryCard summaries={moneySourceSummaries} />
      )}

      {/* Salary Settlement Table */}
      {filteredDateGroups.length === 0 ? (
        <Alert severity="info">
          No payment records found for the selected date range and filters.
        </Alert>
      ) : (
        <SalarySettlementTable
          dateGroups={filteredDateGroups}
          loading={loading}
          disabled={!canEdit}
          isAdmin={isAdmin}
          onPayDate={(date, records) => openPaymentDialog(records)}
          onViewDate={(date, group) => {
            setViewDialogDate(date);
            setViewDialogGroup(group);
            setViewDialogOpen(true);
          }}
          onEditDate={(date, group) => {
            setEditDialogDate(date);
            setEditDialogGroup(group);
            setEditDialogOpen(true);
          }}
          onCancelDate={(date, records) => {
            setDateCancelDate(date);
            setDateCancelRecords(records);
            setDateCancelDialogOpen(true);
          }}
          onDeleteDate={(date, records) => {
            // Delete uses same dialog as cancel
            setDateCancelDate(date);
            setDateCancelRecords(records);
            setDateCancelDialogOpen(true);
          }}
          onNotifyDate={(date, records) => handleNotifyDate(date, records)}
          onConfirmSettlement={(transactionId) => {
            setSelectedTransactionId(transactionId);
            setSettlementDetailsOpen(true);
          }}
        />
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        dailyRecords={selectedForPayment}
        allowSubcontractLink
        onSuccess={handlePaymentSuccess}
      />

      {/* Cancel Payment Dialog (single record) */}
      <CancelPaymentDialog
        open={cancelDialogOpen}
        onClose={() => {
          setCancelDialogOpen(false);
          setRecordToCancel(null);
          setEngineerNameToCancel("");
          setBulkCancelRecords([]);
        }}
        record={recordToCancel}
        engineerName={engineerNameToCancel}
        onConfirm={bulkCancelRecords.length > 0 ? handleBulkCancelPayment : handleCancelPayment}
      />

      {/* Date Edit Dialog */}
      <DateEditDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditDialogDate("");
          setEditDialogGroup(null);
        }}
        date={editDialogDate}
        group={editDialogGroup}
        onSuccess={() => {
          fetchData();
          onDataChange?.();
        }}
      />

      {/* Date Cancel Dialog (bulk cancel) */}
      <DateCancelDialog
        open={dateCancelDialogOpen}
        onClose={() => {
          setDateCancelDialogOpen(false);
          setDateCancelDate("");
          setDateCancelRecords([]);
        }}
        date={dateCancelDate}
        records={dateCancelRecords}
        onSuccess={() => {
          fetchData();
          onDataChange?.();
        }}
      />

      {/* Settlement Details Dialog (for admin to view and confirm engineer settlements) */}
      {selectedTransactionId && (
        <SettlementDetailsDialog
          open={settlementDetailsOpen}
          onClose={() => {
            setSettlementDetailsOpen(false);
            setSelectedTransactionId(null);
          }}
          transactionId={selectedTransactionId}
          onSuccess={() => {
            fetchData();
            onDataChange?.();
          }}
        />
      )}

      {/* View Details Dialog (shows settlement summary with proofs) */}
      <DateViewDetailsDialog
        open={viewDialogOpen}
        onClose={() => {
          setViewDialogOpen(false);
          setViewDialogGroup(null);
        }}
        date={viewDialogDate}
        group={viewDialogGroup}
      />
    </Box>
  );
}
