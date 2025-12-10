"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Tab,
  Tabs,
  TextField,
  Paper,
  CircularProgress,
} from "@mui/material";
import {
  Payments as PaymentsIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  CalendarMonth as CalendarIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import PageHeader from "@/components/layout/PageHeader";
import PaymentSummaryCards from "@/components/payments/PaymentSummaryCards";
import DailyMarketPaymentsTab from "@/components/payments/DailyMarketPaymentsTab";
import ContractWeeklyPaymentsTab from "@/components/payments/ContractWeeklyPaymentsTab";
import dayjs from "dayjs";
import type { PaymentSummaryData, PaymentFilterState } from "@/types/payment.types";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`payment-tabpanel-${index}`}
      aria-labelledby={`payment-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function PaymentsPage() {
  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Date filter state
  const [dateFrom, setDateFrom] = useState(
    dayjs().subtract(7, "day").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(dayjs().format("YYYY-MM-DD"));

  // Summary data state
  const [summaryData, setSummaryData] = useState<PaymentSummaryData>({
    dailyMarketPending: 0,
    dailyMarketPendingCount: 0,
    dailyMarketSentToEngineer: 0,
    dailyMarketSentToEngineerCount: 0,
    dailyMarketPaid: 0,
    dailyMarketPaidCount: 0,
    contractWeeklyDue: 0,
    contractWeeklyDueLaborerCount: 0,
    contractWeeklyPaid: 0,
    bySubcontract: [],
    unlinkedTotal: 0,
    unlinkedCount: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Fetch summary data
  const fetchSummaryData = useCallback(async () => {
    if (!selectedSite?.id) return;

    setSummaryLoading(true);

    try {
      // Fetch daily attendance summary (non-contract)
      const { data: dailyData } = await supabase
        .from("daily_attendance")
        .select(
          `
          id,
          daily_earnings,
          is_paid,
          paid_via,
          subcontract_id,
          laborers!inner(laborer_type)
        `
        )
        .eq("site_id", selectedSite.id)
        .neq("laborers.laborer_type", "contract")
        .gte("date", dateFrom)
        .lte("date", dateTo);

      // Fetch market attendance summary
      const { data: marketData } = await supabase
        .from("market_laborer_attendance")
        .select("id, total_cost, is_paid, paid_via")
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      // Fetch contract laborers attendance for weekly due
      const weeksBack = 4;
      const contractFromDate = dayjs()
        .subtract(weeksBack, "week")
        .day(0)
        .format("YYYY-MM-DD");

      const { data: contractAttendance } = await supabase
        .from("daily_attendance")
        .select(
          `
          id,
          laborer_id,
          daily_earnings,
          is_paid,
          subcontract_id,
          laborers!inner(laborer_type)
        `
        )
        .eq("site_id", selectedSite.id)
        .eq("laborers.laborer_type", "contract")
        .gte("date", contractFromDate)
        .lte("date", dateTo);

      const { data: contractPayments } = await supabase
        .from("labor_payments")
        .select("laborer_id, amount")
        .eq("site_id", selectedSite.id)
        .eq("is_under_contract", true)
        .gte("payment_for_date", contractFromDate)
        .lte("payment_for_date", dateTo);

      // Calculate daily/market summary
      const dailyRecords = dailyData || [];
      const marketRecords = marketData || [];

      const dailyMarketPending =
        dailyRecords
          .filter((r: any) => !r.is_paid && r.paid_via !== "engineer_wallet")
          .reduce((sum: number, r: any) => sum + (r.daily_earnings || 0), 0) +
        marketRecords
          .filter((r: any) => !r.is_paid && r.paid_via !== "engineer_wallet")
          .reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0);

      const dailyMarketPendingCount =
        dailyRecords.filter(
          (r: any) => !r.is_paid && r.paid_via !== "engineer_wallet"
        ).length +
        marketRecords.filter(
          (r: any) => !r.is_paid && r.paid_via !== "engineer_wallet"
        ).length;

      const dailyMarketSentToEngineer =
        dailyRecords
          .filter((r: any) => !r.is_paid && r.paid_via === "engineer_wallet")
          .reduce((sum: number, r: any) => sum + (r.daily_earnings || 0), 0) +
        marketRecords
          .filter((r: any) => !r.is_paid && r.paid_via === "engineer_wallet")
          .reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0);

      const dailyMarketSentToEngineerCount =
        dailyRecords.filter(
          (r: any) => !r.is_paid && r.paid_via === "engineer_wallet"
        ).length +
        marketRecords.filter(
          (r: any) => !r.is_paid && r.paid_via === "engineer_wallet"
        ).length;

      const dailyMarketPaid =
        dailyRecords
          .filter((r: any) => r.is_paid)
          .reduce((sum: number, r: any) => sum + (r.daily_earnings || 0), 0) +
        marketRecords
          .filter((r: any) => r.is_paid)
          .reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0);

      const dailyMarketPaidCount =
        dailyRecords.filter((r: any) => r.is_paid).length +
        marketRecords.filter((r: any) => r.is_paid).length;

      // Calculate contract weekly due
      const contractLaborerEarnings = new Map<string, number>();
      const contractLaborerPaid = new Map<string, number>();

      (contractAttendance || []).forEach((r: any) => {
        const current = contractLaborerEarnings.get(r.laborer_id) || 0;
        contractLaborerEarnings.set(
          r.laborer_id,
          current + (r.daily_earnings || 0)
        );
      });

      (contractPayments || []).forEach((p: any) => {
        const current = contractLaborerPaid.get(p.laborer_id) || 0;
        contractLaborerPaid.set(p.laborer_id, current + (p.amount || 0));
      });

      let contractWeeklyDue = 0;
      let contractWeeklyDueLaborerCount = 0;
      let contractWeeklyPaid = 0;

      contractLaborerEarnings.forEach((earnings, laborerId) => {
        const paid = contractLaborerPaid.get(laborerId) || 0;
        const due = earnings - paid;
        if (due > 0) {
          contractWeeklyDue += due;
          contractWeeklyDueLaborerCount++;
        }
        contractWeeklyPaid += paid;
      });

      // Calculate by subcontract
      const subcontractTotals = new Map<
        string,
        { title: string; paid: number; due: number }
      >();

      // Get subcontract titles
      const subcontractIds = new Set<string>();
      dailyRecords.forEach((r: any) => {
        if (r.subcontract_id) subcontractIds.add(r.subcontract_id);
      });

      if (subcontractIds.size > 0) {
        const { data: subcontracts } = await supabase
          .from("subcontracts")
          .select("id, title")
          .in("id", Array.from(subcontractIds));

        (subcontracts || []).forEach((sc: any) => {
          subcontractTotals.set(sc.id, { title: sc.title, paid: 0, due: 0 });
        });
      }

      // Aggregate by subcontract
      dailyRecords.forEach((r: any) => {
        if (r.subcontract_id && subcontractTotals.has(r.subcontract_id)) {
          const sc = subcontractTotals.get(r.subcontract_id)!;
          if (r.is_paid) {
            sc.paid += r.daily_earnings || 0;
          } else {
            sc.due += r.daily_earnings || 0;
          }
        }
      });

      const bySubcontract = Array.from(subcontractTotals.entries()).map(
        ([id, data]) => ({
          subcontractId: id,
          subcontractTitle: data.title,
          totalPaid: data.paid,
          totalDue: data.due,
        })
      );

      // Calculate unlinked (no subcontract)
      const unlinkedTotal =
        dailyRecords
          .filter((r: any) => !r.subcontract_id && r.is_paid)
          .reduce((sum: number, r: any) => sum + (r.daily_earnings || 0), 0) +
        marketRecords
          .filter((r: any) => r.is_paid)
          .reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0);

      const unlinkedCount =
        dailyRecords.filter((r: any) => !r.subcontract_id && r.is_paid).length +
        marketRecords.filter((r: any) => r.is_paid).length;

      setSummaryData({
        dailyMarketPending,
        dailyMarketPendingCount,
        dailyMarketSentToEngineer,
        dailyMarketSentToEngineerCount,
        dailyMarketPaid,
        dailyMarketPaidCount,
        contractWeeklyDue,
        contractWeeklyDueLaborerCount,
        contractWeeklyPaid,
        bySubcontract,
        unlinkedTotal,
        unlinkedCount,
      });
    } catch (error) {
      console.error("Error fetching summary:", error);
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedSite?.id, dateFrom, dateTo, supabase]);

  useEffect(() => {
    fetchSummaryData();
  }, [fetchSummaryData]);

  const handleFilterChange = (filters: Partial<PaymentFilterState>) => {
    if (filters.dateFrom) setDateFrom(filters.dateFrom);
    if (filters.dateTo) setDateTo(filters.dateTo);
  };

  const handleDataChange = () => {
    fetchSummaryData();
  };

  return (
    <Box>
      <PageHeader
        title="Salary Settlements"
        subtitle="Manage daily, market, and contract laborer salary settlements"
      />

      {/* Date Range Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <CalendarIcon color="action" />
          <Typography variant="subtitle2">Date Range:</Typography>
          <TextField
            type="date"
            size="small"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <Typography variant="body2">to</Typography>
          <TextField
            type="date"
            size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
        </Box>
      </Paper>

      {/* Summary Cards */}
      <PaymentSummaryCards data={summaryData} loading={summaryLoading} />

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab
            icon={<PersonIcon />}
            iconPosition="start"
            label="Daily & Market Settlements"
            id="payment-tab-0"
            aria-controls="payment-tabpanel-0"
          />
          <Tab
            icon={<GroupsIcon />}
            iconPosition="start"
            label="Contract Weekly Settlements"
            id="payment-tab-1"
            aria-controls="payment-tabpanel-1"
          />
        </Tabs>

        <Box sx={{ p: 2 }}>
          <TabPanel value={activeTab} index={0}>
            <DailyMarketPaymentsTab
              dateFrom={dateFrom}
              dateTo={dateTo}
              onFilterChange={handleFilterChange}
              onDataChange={handleDataChange}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <ContractWeeklyPaymentsTab
              weeksToShow={4}
              onDataChange={handleDataChange}
            />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}
