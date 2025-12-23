"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  Card,
  CardContent,
  Grid,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Autocomplete,
} from "@mui/material";
import {
  Add as AddIcon,
  AccountBalanceWallet as WalletIcon,
  ArrowDownward as ReceivedIcon,
  ArrowUpward as SpentIcon,
  SwapHoriz as SettlementIcon,
  Person as PersonIcon,
  CheckCircle as CheckIcon,
  Receipt as ReceiptIcon,
  Undo as ReturnIcon,
  MoneyOff as ExpenseIcon,
  Payments as ReimburseIcon,
  ToggleOn as ToggleIcon,
  ToggleOff as ToggleOffIcon,
  Lock as LockIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { hasEditPermission } from "@/lib/permissions";
import type {
  SiteEngineerTransaction,
  SiteEngineerSettlement,
  SiteEngineerTransactionType,
  PaymentMode,
  RecipientType,
} from "@/types/database.types";
import dayjs from "dayjs";
import { createPaymentSettlementNotification, createSalaryExpense, clearPendingSalaryExpense } from "@/lib/services/notificationService";
import PayerSourceSelector, { getPayerSourceLabel, getPayerSourceColor } from "@/components/settlement/PayerSourceSelector";
import BatchSelector from "@/components/wallet/BatchSelector";
import {
  recordDeposit,
  recordWalletSpending,
  recordOwnMoneySpending,
  recordReturn,
  getPendingReimbursements,
  settleReimbursement,
  getAvailableBatches,
} from "@/lib/services/walletService";
import type { PayerSource } from "@/types/settlement.types";
import type {
  BatchOption,
  BatchAllocation,
  ExpenseMoneySource,
  PendingReimbursement,
} from "@/types/wallet.types";

interface User {
  id: string;
  name: string;
  role: string;
}

interface Site {
  id: string;
  name: string;
}

interface TransactionWithDetails extends SiteEngineerTransaction {
  user_name?: string;
  site_name?: string;
}

interface SettlementWithDetails extends SiteEngineerSettlement {
  engineer_name?: string;
}

interface PendingAttendanceSettlement {
  transaction_id: string;
  engineer_id: string;
  engineer_name: string;
  site_id: string;
  site_name: string;
  amount: number;
  record_count: number;
  created_at: string;
  proof_url: string | null;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function EngineerWalletPage() {
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [settlements, setSettlements] = useState<SettlementWithDetails[]>([]);
  const [pendingAttendance, setPendingAttendance] = useState<PendingAttendanceSettlement[]>([]);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tabValue, setTabValue] = useState(0);
  const [settlingTransactionId, setSettlingTransactionId] = useState<string | null>(null);
  const [openTransactionDialog, setOpenTransactionDialog] = useState(false);
  const [openSettlementDialog, setOpenSettlementDialog] = useState(false);
  const [selectedEngineer, setSelectedEngineer] = useState<User | null>(null);

  // New dialog states for three-button UI
  const [openAddMoneyDialog, setOpenAddMoneyDialog] = useState(false);
  const [openExpenseDialog, setOpenExpenseDialog] = useState(false);
  const [openReturnDialog, setOpenReturnDialog] = useState(false);
  const [openReimbursementDialog, setOpenReimbursementDialog] = useState(false);
  const [pendingReimbursements, setPendingReimbursements] = useState<PendingReimbursement[]>([]);
  const [availableBatches, setAvailableBatches] = useState<BatchOption[]>([]);

  const { userProfile } = useAuth();
  const supabase = createClient();

  const canEdit = hasEditPermission(userProfile?.role);

  // Transaction Form State
  const [transactionForm, setTransactionForm] = useState({
    user_id: "",
    transaction_type: "received_from_company" as SiteEngineerTransactionType,
    amount: 0,
    transaction_date: dayjs().format("YYYY-MM-DD"),
    site_id: "",
    description: "",
    recipient_type: "" as RecipientType | "",
    payment_mode: "cash" as PaymentMode,
    notes: "",
  });

  // Settlement Form State
  const [settlementForm, setSettlementForm] = useState({
    site_engineer_id: "",
    amount: 0,
    settlement_date: dayjs().format("YYYY-MM-DD"),
    settlement_type: "company_to_engineer" as "company_to_engineer" | "engineer_to_company",
    payment_mode: "cash" as PaymentMode,
    notes: "",
  });

  // Add Money Form State
  const [addMoneyForm, setAddMoneyForm] = useState({
    user_id: "",
    payer_source: "trust_account" as PayerSource,
    payer_name: "",
    amount: 0,
    transaction_date: dayjs().format("YYYY-MM-DD"),
    payment_mode: "cash" as PaymentMode,
    site_id: "",
    site_restricted: false,
    notes: "",
  });

  // Record Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    user_id: "",
    money_source: "wallet" as ExpenseMoneySource,
    amount: 0,
    transaction_date: dayjs().format("YYYY-MM-DD"),
    site_id: "",
    recipient_type: "" as RecipientType | "",
    payment_mode: "cash" as PaymentMode,
    description: "",
    notes: "",
    selected_batches: [] as BatchAllocation[],
  });

  // Return Money Form State
  const [returnForm, setReturnForm] = useState({
    user_id: "",
    amount: 0,
    transaction_date: dayjs().format("YYYY-MM-DD"),
    payment_mode: "cash" as PaymentMode,
    notes: "",
    selected_batches: [] as BatchAllocation[],
  });

  // Settle Reimbursement Form State
  const [reimbursementForm, setReimbursementForm] = useState({
    selected_expenses: [] as string[],
    total_amount: 0,
    payer_source: "trust_account" as PayerSource,
    payer_name: "",
    payment_mode: "cash" as PaymentMode,
    settled_date: dayjs().format("YYYY-MM-DD"),
    notes: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch site engineers
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, role")
        .in("role", ["site_engineer", "admin", "office"]);

      if (usersError) throw usersError;
      setEngineers((usersData || []) as User[]);

      // Fetch sites
      const { data: sitesData, error: sitesError } = await supabase
        .from("sites")
        .select("id, name")
        .eq("status", "active");

      if (sitesError) throw sitesError;
      setSites((sitesData || []) as Site[]);

      // Fetch transactions - use explicit FK hint for user_id relationship
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("site_engineer_transactions")
        .select("*, user:users!site_engineer_transactions_user_id_fkey(name), site:sites(name)")
        .order("transaction_date", { ascending: false })
        .limit(200);

      if (transactionsError) throw transactionsError;

      const formattedTransactions: TransactionWithDetails[] = ((transactionsData || []) as any[]).map(
        (t) => ({
          ...t,
          user_name: t.user?.name || "Unknown",
          site_name: t.site?.name || "-",
        })
      );
      setTransactions(formattedTransactions);

      // Fetch settlements - use explicit FK hint for site_engineer_id relationship
      const { data: settlementsData, error: settlementsError } = await supabase
        .from("site_engineer_settlements")
        .select("*, engineer:users!site_engineer_settlements_site_engineer_id_fkey(name)")
        .order("settlement_date", { ascending: false })
        .limit(100);

      if (settlementsError) throw settlementsError;

      const formattedSettlements: SettlementWithDetails[] = ((settlementsData || []) as any[]).map(
        (s) => ({
          ...s,
          engineer_name: s.engineer?.name || "Unknown",
        })
      );
      setSettlements(formattedSettlements);

      // Fetch pending attendance settlements - find attendance with engineer_transaction_id but not paid
      // First get unique transaction IDs from unpaid attendance
      const { data: unpaidDailyAttendance } = await (supabase.from("daily_attendance") as any)
        .select("engineer_transaction_id, amount")
        .not("engineer_transaction_id", "is", null)
        .eq("is_paid", false);

      const { data: unpaidMarketAttendance } = await (supabase.from("market_laborer_attendance") as any)
        .select("engineer_transaction_id, total_wages")
        .not("engineer_transaction_id", "is", null)
        .eq("is_paid", false);

      // Aggregate by transaction ID
      const txAggregates: Record<string, { count: number; amount: number }> = {};
      ((unpaidDailyAttendance || []) as any[]).forEach((a: any) => {
        if (!txAggregates[a.engineer_transaction_id]) {
          txAggregates[a.engineer_transaction_id] = { count: 0, amount: 0 };
        }
        txAggregates[a.engineer_transaction_id].count += 1;
        txAggregates[a.engineer_transaction_id].amount += a.amount || 0;
      });
      ((unpaidMarketAttendance || []) as any[]).forEach((a: any) => {
        if (!txAggregates[a.engineer_transaction_id]) {
          txAggregates[a.engineer_transaction_id] = { count: 0, amount: 0 };
        }
        txAggregates[a.engineer_transaction_id].count += 1;
        txAggregates[a.engineer_transaction_id].amount += a.total_wages || 0;
      });

      const txIds = Object.keys(txAggregates);
      if (txIds.length > 0) {
        const { data: pendingTxData } = await (supabase.from("site_engineer_transactions") as any)
          .select(`
            id,
            user_id,
            site_id,
            amount,
            created_at,
            proof_url,
            is_settled,
            user:users!site_engineer_transactions_user_id_fkey(name),
            site:sites(name)
          `)
          .in("id", txIds)
          .order("created_at", { ascending: false });

        const pendingAttendanceData: PendingAttendanceSettlement[] = ((pendingTxData || []) as any[])
          .map((t: any) => ({
            transaction_id: t.id,
            engineer_id: t.user_id,
            engineer_name: t.user?.name || "Unknown",
            site_id: t.site_id,
            site_name: t.site?.name || "Unknown Site",
            amount: txAggregates[t.id]?.amount || t.amount,
            record_count: txAggregates[t.id]?.count || 0,
            created_at: t.created_at,
            proof_url: t.proof_url,
          }));
        setPendingAttendance(pendingAttendanceData);
      } else {
        setPendingAttendance([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userProfile) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [userProfile]);

  // Calculate wallet summary per engineer
  const walletSummary = useMemo(() => {
    const summary: Record<
      string,
      {
        engineer_name: string;
        received: number;
        spent: number;
        own_money: number;
        returned: number;
        settled: number;
        balance: number;
        owed_to_engineer: number;
        by_site: Record<string, { spent: number; own_money: number }>;
      }
    > = {};

    // Initialize from transactions
    transactions.forEach((t) => {
      if (!summary[t.user_id]) {
        const engineer = engineers.find((e) => e.id === t.user_id);
        summary[t.user_id] = {
          engineer_name: engineer?.name || t.user_name || "Unknown",
          received: 0,
          spent: 0,
          own_money: 0,
          returned: 0,
          settled: 0,
          balance: 0,
          owed_to_engineer: 0,
          by_site: {},
        };
      }

      const s = summary[t.user_id];

      switch (t.transaction_type) {
        case "received_from_company":
          s.received += t.amount;
          break;
        case "spent_on_behalf":
          s.spent += t.amount;
          if (t.site_id && t.site_name) {
            if (!s.by_site[t.site_id]) {
              s.by_site[t.site_id] = { spent: 0, own_money: 0 };
            }
            s.by_site[t.site_id].spent += t.amount;
          }
          break;
        case "used_own_money":
          s.own_money += t.amount;
          if (!t.is_settled) {
            s.owed_to_engineer += t.amount;
          }
          if (t.site_id && t.site_name) {
            if (!s.by_site[t.site_id]) {
              s.by_site[t.site_id] = { spent: 0, own_money: 0 };
            }
            s.by_site[t.site_id].own_money += t.amount;
          }
          break;
        case "returned_to_company":
          s.returned += t.amount;
          break;
      }
    });

    // Add settlement totals
    settlements.forEach((st) => {
      if (summary[st.site_engineer_id]) {
        if (st.settlement_type === "company_to_engineer") {
          summary[st.site_engineer_id].settled += st.amount;
        }
      }
    });

    // Calculate balances
    Object.values(summary).forEach((s) => {
      s.balance = s.received - s.spent - s.returned;
      s.owed_to_engineer = s.own_money - s.settled;
    });

    return summary;
  }, [transactions, settlements, engineers]);

  // Overall company totals
  const companyTotals = useMemo(() => {
    let totalGiven = 0;
    let totalSpent = 0;
    let totalOwnMoney = 0;
    let totalReturned = 0;
    let totalOwedToEngineers = 0;
    let totalWithEngineers = 0;

    Object.values(walletSummary).forEach((s) => {
      totalGiven += s.received;
      totalSpent += s.spent;
      totalOwnMoney += s.own_money;
      totalReturned += s.returned;
      totalOwedToEngineers += Math.max(0, s.owed_to_engineer);
      totalWithEngineers += Math.max(0, s.balance);
    });

    return {
      totalGiven,
      totalSpent,
      totalOwnMoney,
      totalReturned,
      totalOwedToEngineers,
      totalWithEngineers,
    };
  }, [walletSummary]);

  const handleOpenTransactionDialog = () => {
    setTransactionForm({
      user_id: selectedEngineer?.id || "",
      transaction_type: "received_from_company",
      amount: 0,
      transaction_date: dayjs().format("YYYY-MM-DD"),
      site_id: "",
      description: "",
      recipient_type: "",
      payment_mode: "cash",
      notes: "",
    });
    setOpenTransactionDialog(true);
  };

  // ===== NEW DIALOG HANDLERS =====

  // Add Money to Wallet dialog
  const handleOpenAddMoneyDialog = () => {
    setAddMoneyForm({
      user_id: selectedEngineer?.id || "",
      payer_source: "trust_account",
      payer_name: "",
      amount: 0,
      transaction_date: dayjs().format("YYYY-MM-DD"),
      payment_mode: "cash",
      site_id: "",
      site_restricted: false,
      notes: "",
    });
    setOpenAddMoneyDialog(true);
  };

  const handleSaveAddMoney = async () => {
    try {
      setError("");
      setSuccess("");

      if (!addMoneyForm.user_id) {
        setError("Please select a site engineer");
        return;
      }

      if (addMoneyForm.amount <= 0) {
        setError("Amount must be greater than 0");
        return;
      }

      const result = await recordDeposit(supabase, {
        engineerId: addMoneyForm.user_id,
        amount: addMoneyForm.amount,
        payerSource: addMoneyForm.payer_source,
        payerName: addMoneyForm.payer_name || undefined,
        paymentMode: addMoneyForm.payment_mode,
        siteId: addMoneyForm.site_id || undefined,
        siteRestricted: addMoneyForm.site_restricted,
        notes: addMoneyForm.notes || undefined,
        transactionDate: addMoneyForm.transaction_date,
        userName: userProfile?.name || "Unknown",
        userId: userProfile?.id || "",
      });

      if (!result.success) {
        setError(result.error || "Failed to add money");
        return;
      }

      setSuccess(`Money added successfully! Batch Code: ${result.batchCode}`);
      await fetchData();
      setOpenAddMoneyDialog(false);
    } catch (err: any) {
      setError(err.message || "Failed to add money");
    }
  };

  // Record Expense dialog
  const handleOpenExpenseDialog = async () => {
    setExpenseForm({
      user_id: selectedEngineer?.id || "",
      money_source: "wallet",
      amount: 0,
      transaction_date: dayjs().format("YYYY-MM-DD"),
      site_id: "",
      recipient_type: "",
      payment_mode: "cash",
      description: "",
      notes: "",
      selected_batches: [],
    });

    // Load available batches if engineer is selected
    if (selectedEngineer?.id) {
      const batches = await getAvailableBatches(supabase, selectedEngineer.id);
      setAvailableBatches(batches);
    }

    setOpenExpenseDialog(true);
  };

  const handleSaveExpense = async () => {
    try {
      setError("");
      setSuccess("");

      if (!expenseForm.user_id) {
        setError("Please select a site engineer");
        return;
      }

      if (expenseForm.amount <= 0) {
        setError("Amount must be greater than 0");
        return;
      }

      if (!expenseForm.site_id) {
        setError("Please select a site");
        return;
      }

      let result;
      if (expenseForm.money_source === "wallet") {
        // Validate batch selection
        const totalSelected = expenseForm.selected_batches.reduce((sum, b) => sum + b.amount, 0);
        if (Math.abs(totalSelected - expenseForm.amount) > 0.01) {
          setError(`Selected batch amount (Rs.${totalSelected.toLocaleString()}) must match expense amount (Rs.${expenseForm.amount.toLocaleString()})`);
          return;
        }

        result = await recordWalletSpending(supabase, {
          engineerId: expenseForm.user_id,
          amount: expenseForm.amount,
          siteId: expenseForm.site_id,
          description: expenseForm.description,
          recipientType: expenseForm.recipient_type,
          paymentMode: expenseForm.payment_mode,
          moneySource: "wallet",
          batchAllocations: expenseForm.selected_batches,
          notes: expenseForm.notes || undefined,
          transactionDate: expenseForm.transaction_date,
          userName: userProfile?.name || "Unknown",
          userId: userProfile?.id || "",
        });
      } else {
        result = await recordOwnMoneySpending(supabase, {
          engineerId: expenseForm.user_id,
          amount: expenseForm.amount,
          siteId: expenseForm.site_id,
          description: expenseForm.description,
          recipientType: expenseForm.recipient_type,
          paymentMode: expenseForm.payment_mode,
          moneySource: "own_money",
          notes: expenseForm.notes || undefined,
          transactionDate: expenseForm.transaction_date,
          userName: userProfile?.name || "Unknown",
          userId: userProfile?.id || "",
        });
      }

      if (!result.success) {
        setError(result.error || "Failed to record expense");
        return;
      }

      const message = expenseForm.money_source === "wallet"
        ? "Expense recorded from wallet successfully!"
        : "Expense recorded using own money. Pending reimbursement created.";
      setSuccess(message);
      await fetchData();
      setOpenExpenseDialog(false);
    } catch (err: any) {
      setError(err.message || "Failed to record expense");
    }
  };

  // Return Money dialog
  const handleOpenReturnDialog = async () => {
    setReturnForm({
      user_id: selectedEngineer?.id || "",
      amount: 0,
      transaction_date: dayjs().format("YYYY-MM-DD"),
      payment_mode: "cash",
      notes: "",
      selected_batches: [],
    });

    // Load available batches if engineer is selected
    if (selectedEngineer?.id) {
      const batches = await getAvailableBatches(supabase, selectedEngineer.id);
      setAvailableBatches(batches);
    }

    setOpenReturnDialog(true);
  };

  const handleSaveReturn = async () => {
    try {
      setError("");
      setSuccess("");

      if (!returnForm.user_id) {
        setError("Please select a site engineer");
        return;
      }

      if (returnForm.amount <= 0) {
        setError("Amount must be greater than 0");
        return;
      }

      // Validate batch selection
      const totalSelected = returnForm.selected_batches.reduce((sum, b) => sum + b.amount, 0);
      if (Math.abs(totalSelected - returnForm.amount) > 0.01) {
        setError(`Selected batch amount (Rs.${totalSelected.toLocaleString()}) must match return amount (Rs.${returnForm.amount.toLocaleString()})`);
        return;
      }

      const result = await recordReturn(supabase, {
        engineerId: returnForm.user_id,
        amount: returnForm.amount,
        paymentMode: returnForm.payment_mode,
        batchAllocations: returnForm.selected_batches,
        notes: returnForm.notes || undefined,
        transactionDate: returnForm.transaction_date,
        userName: userProfile?.name || "Unknown",
        userId: userProfile?.id || "",
      });

      if (!result.success) {
        setError(result.error || "Failed to record return");
        return;
      }

      setSuccess("Money return recorded successfully!");
      await fetchData();
      setOpenReturnDialog(false);
    } catch (err: any) {
      setError(err.message || "Failed to record return");
    }
  };

  // Settle Reimbursement dialog
  const handleOpenReimbursementDialog = async () => {
    // Load pending reimbursements
    const pending = await getPendingReimbursements(supabase, selectedEngineer?.id);
    setPendingReimbursements(pending);

    setReimbursementForm({
      selected_expenses: [],
      total_amount: 0,
      payer_source: "trust_account",
      payer_name: "",
      payment_mode: "cash",
      settled_date: dayjs().format("YYYY-MM-DD"),
      notes: "",
    });

    setOpenReimbursementDialog(true);
  };

  const handleSaveReimbursement = async () => {
    try {
      setError("");
      setSuccess("");

      if (reimbursementForm.selected_expenses.length === 0) {
        setError("Please select at least one pending expense to reimburse");
        return;
      }

      if (reimbursementForm.total_amount <= 0) {
        setError("Amount must be greater than 0");
        return;
      }

      // Get engineer ID from first selected expense
      const firstExpense = pendingReimbursements.find(
        (p) => reimbursementForm.selected_expenses.includes(p.transaction_id)
      );
      if (!firstExpense) {
        setError("Could not find selected expense");
        return;
      }

      const result = await settleReimbursement(supabase, {
        expenseTransactionIds: reimbursementForm.selected_expenses,
        engineerId: firstExpense.engineer_id,
        totalAmount: reimbursementForm.total_amount,
        payerSource: reimbursementForm.payer_source,
        payerName: reimbursementForm.payer_name || undefined,
        paymentMode: reimbursementForm.payment_mode,
        notes: reimbursementForm.notes || undefined,
        settledDate: reimbursementForm.settled_date,
        userName: userProfile?.name || "Unknown",
        userId: userProfile?.id || "",
      });

      if (!result.success) {
        setError(result.error || "Failed to settle reimbursement");
        return;
      }

      setSuccess("Reimbursement settled successfully!");
      await fetchData();
      setOpenReimbursementDialog(false);
    } catch (err: any) {
      setError(err.message || "Failed to settle reimbursement");
    }
  };

  // ===== END NEW DIALOG HANDLERS =====

  const handleSaveTransaction = async () => {
    try {
      setError("");
      setSuccess("");

      if (!transactionForm.user_id) {
        setError("Please select a site engineer");
        return;
      }

      if (transactionForm.amount <= 0) {
        setError("Amount must be greater than 0");
        return;
      }

      // Validate site_id for spent/own_money types
      if (
        (transactionForm.transaction_type === "spent_on_behalf" ||
          transactionForm.transaction_type === "used_own_money") &&
        !transactionForm.site_id
      ) {
        setError("Site is required for spending transactions");
        return;
      }

      const insertData: any = {
        user_id: transactionForm.user_id,
        transaction_type: transactionForm.transaction_type,
        amount: transactionForm.amount,
        transaction_date: transactionForm.transaction_date,
        site_id: transactionForm.site_id || null,
        description: transactionForm.description || null,
        recipient_type: transactionForm.recipient_type || null,
        payment_mode: transactionForm.payment_mode,
        notes: transactionForm.notes || null,
        recorded_by: userProfile?.name || "Unknown",
        recorded_by_user_id: userProfile?.id,
        is_settled: false,
        // Set settlement_status for received_from_company transactions
        settlement_status:
          transactionForm.transaction_type === "received_from_company"
            ? "pending_settlement"
            : null,
      };

      const { data: insertedData, error: insertError } = await (
        supabase.from("site_engineer_transactions") as any
      )
        .insert(insertData)
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Create notification for site engineer if this is a payment to them
      if (
        transactionForm.transaction_type === "received_from_company" &&
        insertedData?.id
      ) {
        // Get site name for the notification message
        const siteName = sites.find((s) => s.id === transactionForm.site_id)?.name;

        // Create notification (fire and forget - don't block on error)
        createPaymentSettlementNotification(
          supabase,
          insertedData.id,
          transactionForm.user_id,
          transactionForm.amount,
          { dailyCount: 0, marketCount: 0, totalAmount: transactionForm.amount },
          siteName
        ).catch((err) => console.error("Failed to create notification:", err));
      }

      // Create expense for "used_own_money" transactions (Pending from Company)
      if (
        transactionForm.transaction_type === "used_own_money" &&
        transactionForm.site_id &&
        insertedData?.id
      ) {
        // Get engineer name
        const engineerName = engineers.find((e) => e.id === transactionForm.user_id)?.name || "Engineer";

        // Create expense with "Pending from Company" indicator
        await createSalaryExpense(supabase, {
          siteId: transactionForm.site_id,
          amount: transactionForm.amount,
          date: transactionForm.transaction_date,
          description: transactionForm.description || `Payment by ${engineerName}`,
          paymentMode: transactionForm.payment_mode,
          paidBy: engineerName,
          paidByUserId: transactionForm.user_id,
          proofUrl: null,
          subcontractId: null,
          isCleared: false, // Pending from company
          engineerTransactionId: insertedData.id,
          paymentSource: "engineer_own_money",
        });
      }

      setSuccess("Transaction recorded successfully");
      await fetchData();
      setOpenTransactionDialog(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Settle attendance payments - marks linked attendance as paid
  const handleSettleAttendance = async (transactionId: string, settlementMode: string = "cash") => {
    setSettlingTransactionId(transactionId);
    try {
      setError("");

      const paymentDate = dayjs().format("YYYY-MM-DD");
      const isAdmin = userProfile?.role === "admin" || userProfile?.role === "office";

      // For cash payments without proof, require admin confirmation
      // For UPI/bank payments, auto-confirm
      const newStatus = settlementMode === "cash" ? "pending_confirmation" : "confirmed";

      // Mark the transaction as settled/pending confirmation
      await (supabase.from("site_engineer_transactions") as any)
        .update({
          is_settled: newStatus === "confirmed",
          settlement_status: newStatus,
          settlement_mode: settlementMode,
          settled_date: paymentDate,
          settled_by: userProfile?.name,
          // If admin is settling directly, also add confirmation
          ...(isAdmin && newStatus === "confirmed" ? {
            confirmed_by: userProfile?.name,
            confirmed_by_user_id: userProfile?.id,
            confirmed_at: new Date().toISOString(),
          } : {}),
        })
        .eq("id", transactionId);

      // Mark all linked daily attendance as paid
      await (supabase.from("daily_attendance") as any)
        .update({
          is_paid: true,
          payment_date: paymentDate,
        })
        .eq("engineer_transaction_id", transactionId);

      // Mark all linked market attendance as paid
      await (supabase.from("market_laborer_attendance") as any)
        .update({
          is_paid: true,
          payment_date: paymentDate,
        })
        .eq("engineer_transaction_id", transactionId);

      if (newStatus === "pending_confirmation") {
        setSuccess("Settlement recorded. Pending admin confirmation.");
      } else {
        setSuccess("Attendance settled and confirmed successfully");
      }
      await fetchData();
    } catch (err: any) {
      setError("Failed to settle: " + err.message);
    } finally {
      setSettlingTransactionId(null);
    }
  };

  // Confirm a cash settlement (admin only)
  const handleConfirmSettlement = async (transactionId: string) => {
    try {
      setError("");

      await (supabase.from("site_engineer_transactions") as any)
        .update({
          is_settled: true,
          settlement_status: "confirmed",
          confirmed_by: userProfile?.name,
          confirmed_by_user_id: userProfile?.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", transactionId);

      setSuccess("Settlement confirmed");
      await fetchData();
    } catch (err: any) {
      setError("Failed to confirm: " + err.message);
    }
  };

  // Dispute a settlement (admin only)
  const handleDisputeSettlement = async (transactionId: string, notes: string) => {
    try {
      setError("");

      await (supabase.from("site_engineer_transactions") as any)
        .update({
          settlement_status: "disputed",
          dispute_notes: notes,
          confirmed_by: userProfile?.name,
          confirmed_by_user_id: userProfile?.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", transactionId);

      setSuccess("Settlement marked as disputed");
      await fetchData();
    } catch (err: any) {
      setError("Failed to dispute: " + err.message);
    }
  };

  const handleOpenSettlementDialog = () => {
    setSettlementForm({
      site_engineer_id: selectedEngineer?.id || "",
      amount: 0,
      settlement_date: dayjs().format("YYYY-MM-DD"),
      settlement_type: "company_to_engineer",
      payment_mode: "cash",
      notes: "",
    });
    setOpenSettlementDialog(true);
  };

  const handleSaveSettlement = async () => {
    try {
      setError("");
      setSuccess("");

      if (!settlementForm.site_engineer_id) {
        setError("Please select a site engineer");
        return;
      }

      if (settlementForm.amount <= 0) {
        setError("Amount must be greater than 0");
        return;
      }

      const insertData: any = {
        site_engineer_id: settlementForm.site_engineer_id,
        amount: settlementForm.amount,
        settlement_date: settlementForm.settlement_date,
        settlement_type: settlementForm.settlement_type,
        payment_mode: settlementForm.payment_mode,
        notes: settlementForm.notes || null,
        recorded_by: userProfile?.name || "Unknown",
        recorded_by_user_id: userProfile?.id,
      };

      const { error: insertError } = await (supabase.from("site_engineer_settlements") as any).insert(insertData);

      if (insertError) throw insertError;

      // If this is a reimbursement (company_to_engineer), mark related "own_money" transactions as settled
      if (settlementForm.settlement_type === "company_to_engineer") {
        // Get unsettled own_money transactions for this engineer
        const { data: unsettledTx } = await supabase
          .from("site_engineer_transactions")
          .select("id, amount")
          .eq("user_id", settlementForm.site_engineer_id)
          .eq("transaction_type", "used_own_money")
          .eq("is_settled", false)
          .order("transaction_date", { ascending: true });

        if (unsettledTx && unsettledTx.length > 0) {
          let remainingAmount = settlementForm.amount;
          const idsToSettle: string[] = [];

          for (const tx of unsettledTx as any[]) {
            if (remainingAmount >= tx.amount) {
              idsToSettle.push(tx.id);
              remainingAmount -= tx.amount;
            }
            if (remainingAmount <= 0) break;
          }

          if (idsToSettle.length > 0) {
            await (supabase.from("site_engineer_transactions") as any)
              .update({
                is_settled: true,
                settled_date: settlementForm.settlement_date,
                settled_by: userProfile?.id,
              })
              .in("id", idsToSettle);

            // Clear pending expenses for settled transactions
            for (const txId of idsToSettle) {
              await clearPendingSalaryExpense(supabase, txId);
            }
          }
        }
      }

      setSuccess("Settlement recorded successfully");
      await fetchData();
      setOpenSettlementDialog(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getTransactionTypeLabel = (type: SiteEngineerTransactionType) => {
    const labels: Record<SiteEngineerTransactionType, string> = {
      received_from_company: "Received",
      spent_on_behalf: "Spent",
      used_own_money: "Own Money",
      returned_to_company: "Returned",
    };
    return labels[type];
  };

  const getTransactionTypeColor = (type: SiteEngineerTransactionType) => {
    const colors: Record<SiteEngineerTransactionType, "success" | "error" | "warning" | "info"> = {
      received_from_company: "success",
      spent_on_behalf: "error",
      used_own_money: "warning",
      returned_to_company: "info",
    };
    return colors[type];
  };

  // Filter transactions by selected engineer
  const filteredTransactions = useMemo(() => {
    if (!selectedEngineer) return transactions;
    return transactions.filter((t) => t.user_id === selectedEngineer.id);
  }, [transactions, selectedEngineer]);

  const filteredSettlements = useMemo(() => {
    if (!selectedEngineer) return settlements;
    return settlements.filter((s) => s.site_engineer_id === selectedEngineer.id);
  }, [settlements, selectedEngineer]);

  return (
    <Box>
      <PageHeader
        title="Site Engineer Wallet"
        subtitle="Track money flow between company and site engineers"
        actions={
          canEdit && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                color="success"
                startIcon={<AddIcon />}
                onClick={handleOpenAddMoneyDialog}
              >
                Add Money
              </Button>
              <Button
                variant="contained"
                color="warning"
                startIcon={<ExpenseIcon />}
                onClick={handleOpenExpenseDialog}
              >
                Record Expense
              </Button>
              <Button
                variant="outlined"
                color="info"
                startIcon={<ReturnIcon />}
                onClick={handleOpenReturnDialog}
              >
                Return Money
              </Button>
            </Box>
          )
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Company Overview Stats */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Company Overview
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Given
                </Typography>
                <Typography variant="h5" fontWeight={600} color="success.main">
                  ₹{companyTotals.totalGiven.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Spent
                </Typography>
                <Typography variant="h5" fontWeight={600} color="error.main">
                  ₹{companyTotals.totalSpent.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Own Money Used
                </Typography>
                <Typography variant="h5" fontWeight={600} color="warning.main">
                  ₹{companyTotals.totalOwnMoney.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Returned
                </Typography>
                <Typography variant="h5" fontWeight={600} color="info.main">
                  ₹{companyTotals.totalReturned.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  With Engineers
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  ₹{companyTotals.totalWithEngineers.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Owed to Engineers
                </Typography>
                <Typography variant="h5" fontWeight={600} color="error.main">
                  ₹{companyTotals.totalOwedToEngineers.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Engineer Filter */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Autocomplete
            options={engineers}
            getOptionLabel={(option) => option.name}
            value={selectedEngineer}
            onChange={(_, newValue) => setSelectedEngineer(newValue)}
            renderInput={(params) => (
              <TextField {...params} label="Filter by Site Engineer" placeholder="All engineers" />
            )}
            sx={{ maxWidth: 400 }}
          />
        </CardContent>
      </Card>

      {/* Per-Engineer Summary (when one is selected) */}
      {selectedEngineer && walletSummary[selectedEngineer.id] && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {selectedEngineer.name}&apos;s Wallet Summary
            </Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 6, md: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Received
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="success.main">
                    ₹{walletSummary[selectedEngineer.id].received.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Spent
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="error.main">
                    ₹{walletSummary[selectedEngineer.id].spent.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Own Money
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="warning.main">
                    ₹{walletSummary[selectedEngineer.id].own_money.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Returned
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="info.main">
                    ₹{walletSummary[selectedEngineer.id].returned.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Balance
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    ₹{walletSummary[selectedEngineer.id].balance.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Owed to Engineer
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    color={walletSummary[selectedEngineer.id].owed_to_engineer > 0 ? "error.main" : "success.main"}
                  >
                    ₹{Math.max(0, walletSummary[selectedEngineer.id].owed_to_engineer).toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Spending by Site */}
            {Object.keys(walletSummary[selectedEngineer.id].by_site).length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Spending by Site
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Site</TableCell>
                        <TableCell align="right">Spent</TableCell>
                        <TableCell align="right">Own Money</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(walletSummary[selectedEngineer.id].by_site).map(([siteId, data]) => {
                        const site = sites.find((s) => s.id === siteId);
                        return (
                          <TableRow key={siteId}>
                            <TableCell>{site?.name || "Unknown Site"}</TableCell>
                            <TableCell align="right">₹{data.spent.toLocaleString()}</TableCell>
                            <TableCell align="right">₹{data.own_money.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs for Transactions and Settlements */}
      <Card>
        <CardContent>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Transactions" />
            <Tab label="Settlements" />
            <Tab
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  Pending Attendance
                  {pendingAttendance.length > 0 && (
                    <Chip label={pendingAttendance.length} size="small" color="warning" />
                  )}
                </Box>
              }
            />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Engineer</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Site</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Settled?</TableCell>
                    <TableCell>Recorded By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{dayjs(t.transaction_date).format("DD MMM YYYY")}</TableCell>
                        <TableCell>{t.user_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={getTransactionTypeLabel(t.transaction_type as SiteEngineerTransactionType)}
                            size="small"
                            color={getTransactionTypeColor(t.transaction_type as SiteEngineerTransactionType)}
                          />
                        </TableCell>
                        <TableCell>{t.site_name}</TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={600}
                            color={
                              t.transaction_type === "received_from_company"
                                ? "success.main"
                                : t.transaction_type === "returned_to_company"
                                ? "info.main"
                                : "error.main"
                            }
                          >
                            {t.transaction_type === "received_from_company" ? "+" : "-"}₹
                            {t.amount.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={t.payment_mode.toUpperCase()} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{t.description || t.notes || "-"}</TableCell>
                        <TableCell>
                          {t.transaction_type === "used_own_money" ? (
                            t.is_settled ? (
                              <Chip label="Settled" size="small" color="success" icon={<CheckIcon />} />
                            ) : (
                              <Chip label="Pending" size="small" color="warning" />
                            )
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{t.recorded_by}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Engineer</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Recorded By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSettlements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No settlements found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSettlements.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{dayjs(s.settlement_date).format("DD MMM YYYY")}</TableCell>
                        <TableCell>{s.engineer_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={
                              s.settlement_type === "company_to_engineer"
                                ? "Company → Engineer"
                                : "Engineer → Company"
                            }
                            size="small"
                            color={s.settlement_type === "company_to_engineer" ? "success" : "info"}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={600}>₹{s.amount.toLocaleString()}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={s.payment_mode.toUpperCase()} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{s.notes || "-"}</TableCell>
                        <TableCell>{s.recorded_by}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Pending Attendance Settlements Tab */}
          <TabPanel value={tabValue} index={2}>
            {pendingAttendance.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                No pending attendance settlements. All attendance payments have been settled.
              </Alert>
            ) : (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  These are attendance payments sent to engineers that haven&apos;t been settled yet.
                  When the engineer pays the laborers, click &quot;Settle&quot; to mark as paid.
                </Alert>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date Sent</TableCell>
                        <TableCell>Engineer</TableCell>
                        <TableCell>Site</TableCell>
                        <TableCell align="center">Records</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Proof</TableCell>
                        <TableCell align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingAttendance.map((p) => (
                        <TableRow key={p.transaction_id}>
                          <TableCell>{dayjs(p.created_at).format("DD MMM YYYY")}</TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <PersonIcon fontSize="small" color="action" />
                              {p.engineer_name}
                            </Box>
                          </TableCell>
                          <TableCell>{p.site_name}</TableCell>
                          <TableCell align="center">
                            <Chip label={`${p.record_count} laborers`} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight={600} color="warning.main">
                              ₹{p.amount.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {p.proof_url ? (
                              <Tooltip title="View payment proof">
                                <IconButton
                                  size="small"
                                  onClick={() => window.open(p.proof_url!, "_blank")}
                                >
                                  <ReceiptIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={<CheckIcon />}
                              onClick={() => handleSettleAttendance(p.transaction_id)}
                              disabled={settlingTransactionId === p.transaction_id || !canEdit}
                            >
                              {settlingTransactionId === p.transaction_id ? "Settling..." : "Settle"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Summary */}
                <Box sx={{ mt: 2, p: 2, bgcolor: "background.default", borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Pending: {pendingAttendance.length} transactions |{" "}
                    <Typography component="span" fontWeight={600} color="warning.main">
                      ₹{pendingAttendance.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                    </Typography>
                  </Typography>
                </Box>
              </>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Record Transaction Dialog */}
      <Dialog
        open={openTransactionDialog}
        onClose={() => setOpenTransactionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Transaction</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Site Engineer</InputLabel>
                  <Select
                    value={transactionForm.user_id}
                    label="Site Engineer"
                    onChange={(e) =>
                      setTransactionForm({ ...transactionForm, user_id: e.target.value })
                    }
                  >
                    {engineers.map((eng) => (
                      <MenuItem key={eng.id} value={eng.id}>
                        {eng.name} ({eng.role})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Transaction Type</InputLabel>
                  <Select
                    value={transactionForm.transaction_type}
                    label="Transaction Type"
                    onChange={(e) =>
                      setTransactionForm({
                        ...transactionForm,
                        transaction_type: e.target.value as SiteEngineerTransactionType,
                      })
                    }
                  >
                    <MenuItem value="received_from_company">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <ReceivedIcon color="success" fontSize="small" />
                        Received from Company
                      </Box>
                    </MenuItem>
                    <MenuItem value="spent_on_behalf">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <SpentIcon color="error" fontSize="small" />
                        Spent on Behalf
                      </Box>
                    </MenuItem>
                    <MenuItem value="used_own_money">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <WalletIcon color="warning" fontSize="small" />
                        Used Own Money
                      </Box>
                    </MenuItem>
                    <MenuItem value="returned_to_company">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <SettlementIcon color="info" fontSize="small" />
                        Returned to Company
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {(transactionForm.transaction_type === "spent_on_behalf" ||
                transactionForm.transaction_type === "used_own_money") && (
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth required>
                    <InputLabel>Site</InputLabel>
                    <Select
                      value={transactionForm.site_id}
                      label="Site"
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, site_id: e.target.value })
                      }
                    >
                      {sites.map((site) => (
                        <MenuItem key={site.id} value={site.id}>
                          {site.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={transactionForm.amount}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, amount: Number(e.target.value) })
                  }
                  slotProps={{ input: { startAdornment: "₹" } }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={transactionForm.transaction_date}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, transaction_date: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={transactionForm.payment_mode}
                    label="Payment Mode"
                    onChange={(e) =>
                      setTransactionForm({
                        ...transactionForm,
                        payment_mode: e.target.value as PaymentMode,
                      })
                    }
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="upi">UPI</MenuItem>
                    <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {(transactionForm.transaction_type === "spent_on_behalf" ||
                transactionForm.transaction_type === "used_own_money") && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Recipient Type</InputLabel>
                    <Select
                      value={transactionForm.recipient_type}
                      label="Recipient Type"
                      onChange={(e) =>
                        setTransactionForm({
                          ...transactionForm,
                          recipient_type: e.target.value as RecipientType,
                        })
                      }
                    >
                      <MenuItem value="">Not specified</MenuItem>
                      <MenuItem value="laborer">Laborer</MenuItem>
                      <MenuItem value="mesthri">Mesthri</MenuItem>
                      <MenuItem value="vendor">Vendor</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Description"
                  value={transactionForm.description}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, description: e.target.value })
                  }
                  placeholder="What is this payment for?"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={transactionForm.notes}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, notes: e.target.value })
                  }
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTransactionDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveTransaction} variant="contained">
            Save Transaction
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Settlement Dialog */}
      <Dialog
        open={openSettlementDialog}
        onClose={() => setOpenSettlementDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Settlement</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Use this to record reimbursements to engineers for their own money used, or when
              engineers return unused company funds.
            </Alert>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Site Engineer</InputLabel>
                  <Select
                    value={settlementForm.site_engineer_id}
                    label="Site Engineer"
                    onChange={(e) =>
                      setSettlementForm({ ...settlementForm, site_engineer_id: e.target.value })
                    }
                  >
                    {engineers.map((eng) => (
                      <MenuItem key={eng.id} value={eng.id}>
                        {eng.name} ({eng.role})
                        {walletSummary[eng.id] && walletSummary[eng.id].owed_to_engineer > 0 && (
                          <Chip
                            label={`Owed: ₹${walletSummary[eng.id].owed_to_engineer.toLocaleString()}`}
                            size="small"
                            color="warning"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Settlement Type</InputLabel>
                  <Select
                    value={settlementForm.settlement_type}
                    label="Settlement Type"
                    onChange={(e) =>
                      setSettlementForm({
                        ...settlementForm,
                        settlement_type: e.target.value as "company_to_engineer" | "engineer_to_company",
                      })
                    }
                  >
                    <MenuItem value="company_to_engineer">
                      Company → Engineer (Reimbursement for own money used)
                    </MenuItem>
                    <MenuItem value="engineer_to_company">
                      Engineer → Company (Returning unused funds)
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={settlementForm.amount}
                  onChange={(e) =>
                    setSettlementForm({ ...settlementForm, amount: Number(e.target.value) })
                  }
                  slotProps={{ input: { startAdornment: "₹" } }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={settlementForm.settlement_date}
                  onChange={(e) =>
                    setSettlementForm({ ...settlementForm, settlement_date: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={settlementForm.payment_mode}
                    label="Payment Mode"
                    onChange={(e) =>
                      setSettlementForm({
                        ...settlementForm,
                        payment_mode: e.target.value as PaymentMode,
                      })
                    }
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="upi">UPI</MenuItem>
                    <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={settlementForm.notes}
                  onChange={(e) =>
                    setSettlementForm({ ...settlementForm, notes: e.target.value })
                  }
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSettlementDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveSettlement} variant="contained">
            Save Settlement
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== NEW DIALOGS ===== */}

      {/* Add Money to Wallet Dialog */}
      <Dialog
        open={openAddMoneyDialog}
        onClose={() => setOpenAddMoneyDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AddIcon color="success" />
          Add Money to Wallet
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Site Engineer</InputLabel>
                  <Select
                    value={addMoneyForm.user_id}
                    label="Site Engineer"
                    onChange={(e) =>
                      setAddMoneyForm({ ...addMoneyForm, user_id: e.target.value })
                    }
                  >
                    {engineers.map((eng) => (
                      <MenuItem key={eng.id} value={eng.id}>
                        {eng.name} ({eng.role})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <PayerSourceSelector
                  value={addMoneyForm.payer_source}
                  customName={addMoneyForm.payer_name}
                  onChange={(source) => setAddMoneyForm({ ...addMoneyForm, payer_source: source })}
                  onCustomNameChange={(name) => setAddMoneyForm({ ...addMoneyForm, payer_name: name })}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={addMoneyForm.amount || ""}
                  onChange={(e) =>
                    setAddMoneyForm({ ...addMoneyForm, amount: Number(e.target.value) })
                  }
                  slotProps={{ input: { startAdornment: "Rs." } }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={addMoneyForm.transaction_date}
                  onChange={(e) =>
                    setAddMoneyForm({ ...addMoneyForm, transaction_date: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={addMoneyForm.payment_mode}
                    label="Payment Mode"
                    onChange={(e) =>
                      setAddMoneyForm({ ...addMoneyForm, payment_mode: e.target.value as PaymentMode })
                    }
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="upi">UPI</MenuItem>
                    <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Site Restriction (Optional)
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 8 }}>
                <FormControl fullWidth>
                  <InputLabel>Restrict to Site</InputLabel>
                  <Select
                    value={addMoneyForm.site_id}
                    label="Restrict to Site"
                    onChange={(e) =>
                      setAddMoneyForm({ ...addMoneyForm, site_id: e.target.value })
                    }
                  >
                    <MenuItem value="">No restriction</MenuItem>
                    {sites.map((site) => (
                      <MenuItem key={site.id} value={site.id}>
                        {site.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                {addMoneyForm.site_id && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={addMoneyForm.site_restricted}
                        onChange={(e) =>
                          setAddMoneyForm({ ...addMoneyForm, site_restricted: e.target.checked })
                        }
                      />
                    }
                    label={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <LockIcon fontSize="small" />
                        <Typography variant="body2">Lock to site</Typography>
                      </Box>
                    }
                  />
                )}
              </Grid>

              {addMoneyForm.site_restricted && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="warning" icon={<LockIcon />}>
                    This money can ONLY be used for the selected site. It will be blocked from use on other sites.
                  </Alert>
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={addMoneyForm.notes}
                  onChange={(e) =>
                    setAddMoneyForm({ ...addMoneyForm, notes: e.target.value })
                  }
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddMoneyDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveAddMoney} variant="contained" color="success">
            Add Money
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Expense Dialog */}
      <Dialog
        open={openExpenseDialog}
        onClose={() => setOpenExpenseDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ExpenseIcon color="warning" />
          Record Expense
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Site Engineer</InputLabel>
                  <Select
                    value={expenseForm.user_id}
                    label="Site Engineer"
                    onChange={async (e) => {
                      const userId = e.target.value;
                      setExpenseForm({ ...expenseForm, user_id: userId, selected_batches: [] });
                      if (userId) {
                        const batches = await getAvailableBatches(supabase, userId, expenseForm.site_id || null);
                        setAvailableBatches(batches);
                      }
                    }}
                  >
                    {engineers.map((eng) => (
                      <MenuItem key={eng.id} value={eng.id}>
                        {eng.name} ({eng.role})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Money Source
                </Typography>
                <ToggleButtonGroup
                  value={expenseForm.money_source}
                  exclusive
                  onChange={(_, value) => {
                    if (value) {
                      setExpenseForm({ ...expenseForm, money_source: value, selected_batches: [] });
                    }
                  }}
                  fullWidth
                >
                  <ToggleButton value="wallet" color="primary">
                    <WalletIcon sx={{ mr: 1 }} />
                    From Wallet
                  </ToggleButton>
                  <ToggleButton value="own_money" color="warning">
                    <PersonIcon sx={{ mr: 1 }} />
                    Used Own Money
                  </ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Site</InputLabel>
                  <Select
                    value={expenseForm.site_id}
                    label="Site"
                    onChange={async (e) => {
                      const siteId = e.target.value;
                      setExpenseForm({ ...expenseForm, site_id: siteId, selected_batches: [] });
                      if (expenseForm.user_id) {
                        const batches = await getAvailableBatches(supabase, expenseForm.user_id, siteId || null);
                        setAvailableBatches(batches);
                      }
                    }}
                  >
                    {sites.map((site) => (
                      <MenuItem key={site.id} value={site.id}>
                        {site.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={expenseForm.amount || ""}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })
                  }
                  slotProps={{ input: { startAdornment: "Rs." } }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={expenseForm.transaction_date}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, transaction_date: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
              </Grid>

              {expenseForm.money_source === "wallet" && expenseForm.user_id && expenseForm.amount > 0 && (
                <Grid size={{ xs: 12 }}>
                  <BatchSelector
                    engineerId={expenseForm.user_id}
                    siteId={expenseForm.site_id || null}
                    requiredAmount={expenseForm.amount}
                    selectedBatches={expenseForm.selected_batches}
                    onSelectionChange={(batches) =>
                      setExpenseForm({ ...expenseForm, selected_batches: batches })
                    }
                  />
                </Grid>
              )}

              {expenseForm.money_source === "own_money" && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="info" icon={<InfoIcon />}>
                    A pending reimbursement will be created. You can settle it later by specifying who paid the engineer back.
                  </Alert>
                </Grid>
              )}

              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={expenseForm.payment_mode}
                    label="Payment Mode"
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, payment_mode: e.target.value as PaymentMode })
                    }
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="upi">UPI</MenuItem>
                    <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Recipient Type</InputLabel>
                  <Select
                    value={expenseForm.recipient_type}
                    label="Recipient Type"
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, recipient_type: e.target.value as RecipientType })
                    }
                  >
                    <MenuItem value="">Not specified</MenuItem>
                    <MenuItem value="laborer">Laborer</MenuItem>
                    <MenuItem value="mesthri">Mesthri</MenuItem>
                    <MenuItem value="vendor">Vendor</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Description"
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, description: e.target.value })
                  }
                  placeholder="What is this expense for?"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={expenseForm.notes}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, notes: e.target.value })
                  }
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenExpenseDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveExpense} variant="contained" color="warning">
            Record Expense
          </Button>
        </DialogActions>
      </Dialog>

      {/* Return Money Dialog */}
      <Dialog
        open={openReturnDialog}
        onClose={() => setOpenReturnDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ReturnIcon color="info" />
          Return Money to Company
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Site Engineer</InputLabel>
                  <Select
                    value={returnForm.user_id}
                    label="Site Engineer"
                    onChange={async (e) => {
                      const userId = e.target.value;
                      setReturnForm({ ...returnForm, user_id: userId, selected_batches: [] });
                      if (userId) {
                        const batches = await getAvailableBatches(supabase, userId);
                        setAvailableBatches(batches);
                      }
                    }}
                  >
                    {engineers.map((eng) => (
                      <MenuItem key={eng.id} value={eng.id}>
                        {eng.name} ({eng.role})
                        {walletSummary[eng.id] && walletSummary[eng.id].balance > 0 && (
                          <Chip
                            label={`Balance: Rs.${walletSummary[eng.id].balance.toLocaleString()}`}
                            size="small"
                            color="success"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Amount to Return"
                  type="number"
                  value={returnForm.amount || ""}
                  onChange={(e) =>
                    setReturnForm({ ...returnForm, amount: Number(e.target.value) })
                  }
                  slotProps={{ input: { startAdornment: "Rs." } }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={returnForm.transaction_date}
                  onChange={(e) =>
                    setReturnForm({ ...returnForm, transaction_date: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
              </Grid>

              {returnForm.user_id && returnForm.amount > 0 && (
                <Grid size={{ xs: 12 }}>
                  <BatchSelector
                    engineerId={returnForm.user_id}
                    requiredAmount={returnForm.amount}
                    selectedBatches={returnForm.selected_batches}
                    onSelectionChange={(batches) =>
                      setReturnForm({ ...returnForm, selected_batches: batches })
                    }
                  />
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={returnForm.payment_mode}
                    label="Payment Mode"
                    onChange={(e) =>
                      setReturnForm({ ...returnForm, payment_mode: e.target.value as PaymentMode })
                    }
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="upi">UPI</MenuItem>
                    <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={returnForm.notes}
                  onChange={(e) =>
                    setReturnForm({ ...returnForm, notes: e.target.value })
                  }
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReturnDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveReturn} variant="contained" color="info">
            Record Return
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settle Reimbursement Dialog */}
      <Dialog
        open={openReimbursementDialog}
        onClose={() => setOpenReimbursementDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ReimburseIcon color="secondary" />
          Settle Reimbursement
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {pendingReimbursements.length === 0 ? (
              <Alert severity="info">
                No pending reimbursements found. Engineers need to record expenses using their own money first.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Select Pending Expenses to Reimburse
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox" />
                          <TableCell>Engineer</TableCell>
                          <TableCell>Site</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pendingReimbursements.map((pr) => (
                          <TableRow
                            key={pr.transaction_id}
                            hover
                            selected={reimbursementForm.selected_expenses.includes(pr.transaction_id)}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={reimbursementForm.selected_expenses.includes(pr.transaction_id)}
                                onChange={(e) => {
                                  const selected = e.target.checked
                                    ? [...reimbursementForm.selected_expenses, pr.transaction_id]
                                    : reimbursementForm.selected_expenses.filter((id) => id !== pr.transaction_id);

                                  const totalAmount = pendingReimbursements
                                    .filter((p) => selected.includes(p.transaction_id))
                                    .reduce((sum, p) => sum + p.amount, 0);

                                  setReimbursementForm({
                                    ...reimbursementForm,
                                    selected_expenses: selected,
                                    total_amount: totalAmount,
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell>{pr.engineer_name}</TableCell>
                            <TableCell>{pr.site_name || "-"}</TableCell>
                            <TableCell>{pr.description || "-"}</TableCell>
                            <TableCell align="right">Rs.{pr.amount.toLocaleString()}</TableCell>
                            <TableCell>{dayjs(pr.transaction_date).format("DD MMM")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {reimbursementForm.selected_expenses.length > 0 && (
                  <>
                    <Grid size={{ xs: 12 }}>
                      <Alert severity="success">
                        Selected {reimbursementForm.selected_expenses.length} expense(s) totaling{" "}
                        <strong>Rs.{reimbursementForm.total_amount.toLocaleString()}</strong>
                      </Alert>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <PayerSourceSelector
                        value={reimbursementForm.payer_source}
                        customName={reimbursementForm.payer_name}
                        onChange={(source) =>
                          setReimbursementForm({ ...reimbursementForm, payer_source: source })
                        }
                        onCustomNameChange={(name) =>
                          setReimbursementForm({ ...reimbursementForm, payer_name: name })
                        }
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl fullWidth required>
                        <InputLabel>Payment Mode</InputLabel>
                        <Select
                          value={reimbursementForm.payment_mode}
                          label="Payment Mode"
                          onChange={(e) =>
                            setReimbursementForm({
                              ...reimbursementForm,
                              payment_mode: e.target.value as PaymentMode,
                            })
                          }
                        >
                          <MenuItem value="cash">Cash</MenuItem>
                          <MenuItem value="upi">UPI</MenuItem>
                          <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Settlement Date"
                        type="date"
                        value={reimbursementForm.settled_date}
                        onChange={(e) =>
                          setReimbursementForm({ ...reimbursementForm, settled_date: e.target.value })
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                        required
                      />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        label="Notes"
                        value={reimbursementForm.notes}
                        onChange={(e) =>
                          setReimbursementForm({ ...reimbursementForm, notes: e.target.value })
                        }
                        multiline
                        rows={2}
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReimbursementDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSaveReimbursement}
            variant="contained"
            color="secondary"
            disabled={reimbursementForm.selected_expenses.length === 0}
          >
            Settle Reimbursement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
