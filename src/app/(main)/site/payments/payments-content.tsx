"use client";

import React, { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Paper,
  Alert,
} from "@mui/material";
import {
  Person as PersonIcon,
  Groups as GroupsIcon,
} from "@mui/icons-material";
import { useSite } from "@/contexts/SiteContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import PageHeader from "@/components/layout/PageHeader";
import PaymentSummaryCards from "@/components/payments/PaymentSummaryCards";
import DailyMarketPaymentsTab from "@/components/payments/DailyMarketPaymentsTab";
import ContractWeeklyPaymentsTab from "@/components/payments/ContractWeeklyPaymentsTab";
import dayjs from "dayjs";
import type { PaymentPageData } from "@/lib/data/payments";
import type { PaymentSummaryData } from "@/types/payment.types";

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

interface PaymentsContentProps {
  initialData: PaymentPageData | null;
}

export default function PaymentsContent({ initialData }: PaymentsContentProps) {
  const { selectedSite } = useSite();
  const { formatForApi, isAllTime } = useDateRange();

  const { dateFrom, dateTo } = formatForApi();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Summary data state - use initialData or empty
  const [summaryData, setSummaryData] = useState<PaymentSummaryData>(() =>
    initialData?.summaryData || {
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
    }
  );
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Handle data changes - refresh summary
  const handleDataChange = useCallback(() => {
    // The child components handle their own data fetching
    // We could trigger a full refresh here if needed
    // For now, just mark that data changed
  }, []);

  // Calculate effective date range for tab components
  const effectiveDateFrom = isAllTime
    ? "2000-01-01"
    : dateFrom || dayjs().format("YYYY-MM-DD");
  const effectiveDateTo = dateTo || dayjs().format("YYYY-MM-DD");

  // If no site selected, show message
  if (!selectedSite) {
    return (
      <Box>
        <PageHeader
          title="Salary Settlements"
          subtitle="Manage daily, market, and contract laborer salary settlements"
        />
        <Alert severity="info">
          Please select a site from the dropdown to view salary settlements.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Salary Settlements"
        subtitle="Manage daily, market, and contract laborer salary settlements"
      />

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
              dateFrom={effectiveDateFrom}
              dateTo={effectiveDateTo}
              onFilterChange={() => {}}
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
