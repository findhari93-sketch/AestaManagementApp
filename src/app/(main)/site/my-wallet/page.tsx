"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Tabs,
  Tab,
  CircularProgress,
} from "@mui/material";
import {
  AccountBalanceWallet as WalletIcon,
  ArrowDownward as ReceivedIcon,
  ArrowUpward as SpentIcon,
  Schedule as PendingIcon,
  CheckCircle as CheckIcon,
  Receipt as ReceiptIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import PageHeader from "@/components/layout/PageHeader";
import EngineerWalletTable from "@/components/wallet/EngineerWalletTable";
import SettlementFormDialog from "@/components/settlement/SettlementFormDialog";
import SettlementStatusIndicator from "@/components/payments/SettlementStatusIndicator";
import dayjs from "dayjs";

interface LaborerDetail {
  id: string;
  name: string;
  type: "daily" | "market";
  role?: string;
  count?: number;
  amount: number;
  date: string;
}

interface PendingSettlement {
  id: string;
  amount: number;
  companySettlementDate: string; // When company sent the money
  laborSalaryDates: string[]; // Unique dates of labor work
  description: string | null;
  proofUrl: string | null;
  siteName: string | null;
  dailyCount: number;
  marketCount: number;
  settlementStatus: string | null;
  laborers: LaborerDetail[];
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  site_name: string | null;
  description: string | null;
  payment_mode: string;
  is_settled: boolean;
  settlement_status: string | null;
  settlement_mode: string | null;
  settlement_proof_url: string | null;
  settled_date: string | null;
  confirmed_at: string | null;
}

interface WalletSummary {
  received: number;
  spent: number;
  ownMoney: number;
  returned: number;
  pendingToSettle: number;
  pendingCount: number;
  pendingApproval: number;    // Amount awaiting admin approval (engineer submitted, not yet confirmed)
  pendingApprovalCount: number;
  balance: number;
  owedByCompany: number;
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

export default function MyWalletPage() {
  const [pendingSettlements, setPendingSettlements] = useState<PendingSettlement[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tabValue, setTabValue] = useState(0);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);

  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();
  const searchParams = useSearchParams();

  // Handle deep link - auto-open settlement dialog if settle param is provided
  useEffect(() => {
    const settleId = searchParams.get("settle");
    if (settleId && !loading && pendingSettlements.length > 0) {
      // Check if this settlement exists in pending list
      const settlement = pendingSettlements.find((s) => s.id === settleId);
      if (settlement) {
        setSelectedTransactionId(settleId);
        setSettlementDialogOpen(true);
      }
    }
  }, [searchParams, loading, pendingSettlements]);

  const fetchData = async () => {
    if (!userProfile?.id) return;

    try {
      setLoading(true);
      setError("");

      // Fetch all transactions for current user
      const { data: txData, error: txError } = await supabase
        .from("site_engineer_transactions")
        .select(`
          id,
          transaction_type,
          amount,
          transaction_date,
          description,
          payment_mode,
          is_settled,
          settlement_status,
          settlement_mode,
          settlement_proof_url,
          settled_date,
          confirmed_at,
          proof_url,
          sites(name)
        `)
        .eq("user_id", userProfile.id)
        .order("transaction_date", { ascending: false })
        .limit(100);

      if (txError) throw txError;

      // Show ALL transactions including cancelled ones (engineer should see cancelled status)
      const formattedTransactions: Transaction[] = ((txData || []) as any[])
        .map(t => ({
          id: t.id,
          transaction_type: t.transaction_type,
          amount: t.amount,
          transaction_date: t.transaction_date,
          site_name: t.sites?.name || null,
          description: t.description,
          payment_mode: t.payment_mode,
          is_settled: t.is_settled,
          settlement_status: t.settlement_status,
          settlement_mode: t.settlement_mode,
          settlement_proof_url: t.settlement_proof_url,
          settled_date: t.settled_date,
          confirmed_at: t.confirmed_at,
        }));

      setTransactions(formattedTransactions);

      // Get pending settlements (received_from_company with pending status)
      const pendingTxs = formattedTransactions.filter(
        t => t.transaction_type === "received_from_company" &&
             t.settlement_status === "pending_settlement"
      );

      // For each pending transaction, get linked attendance with details
      const pendingWithDetails: PendingSettlement[] = [];
      for (const tx of pendingTxs) {
        // Fetch daily attendance with laborer names and dates
        const { data: dailyData } = await supabase
          .from("daily_attendance")
          .select(`
            id,
            date,
            daily_earnings,
            laborers!inner(name, labor_roles(name))
          `)
          .eq("engineer_transaction_id", tx.id);

        // Fetch market attendance - using separate query to avoid FK cache issues
        const { data: marketData } = await supabase
          .from("market_laborer_attendance")
          .select(`
            id,
            date,
            count,
            total_cost,
            role_id
          `)
          .eq("engineer_transaction_id", tx.id);

        // Fetch role names separately to avoid FK schema cache issues
        const roleIds = (marketData || [])
          .map((m: any) => m.role_id)
          .filter((id: string | null): id is string => id != null);

        let rolesMap: Record<string, string> = {};
        if (roleIds.length > 0) {
          const { data: roles } = await supabase
            .from("labor_roles")
            .select("id, name")
            .in("id", roleIds);

          rolesMap = (roles || []).reduce((acc: Record<string, string>, role: any) => {
            acc[role.id] = role.name;
            return acc;
          }, {});
        }

        // Build laborers list
        const laborers: LaborerDetail[] = [];

        // Add daily laborers
        (dailyData || []).forEach((d: any) => {
          laborers.push({
            id: `daily-${d.id}`,
            name: d.laborers?.name || "Unknown",
            type: "daily",
            role: d.laborers?.labor_roles?.name,
            amount: d.daily_earnings || 0,
            date: d.date,
          });
        });

        // Add market laborers
        (marketData || []).forEach((m: any) => {
          const roleName = m.role_id ? rolesMap[m.role_id] || "Market Labor" : "Market Labor";
          laborers.push({
            id: `market-${m.id}`,
            name: roleName,
            type: "market",
            role: roleName,
            count: m.count,
            amount: m.total_cost || 0,
            date: m.date,
          });
        });

        // Get unique labor dates
        const laborDates = [...new Set(laborers.map(l => l.date))];

        pendingWithDetails.push({
          id: tx.id,
          amount: tx.amount,
          companySettlementDate: tx.transaction_date,
          laborSalaryDates: laborDates,
          description: tx.description,
          proofUrl: (txData as any[]).find(t => t.id === tx.id)?.proof_url || null,
          siteName: tx.site_name,
          dailyCount: (dailyData || []).length,
          marketCount: (marketData || []).length,
          settlementStatus: tx.settlement_status,
          laborers,
        });
      }

      setPendingSettlements(pendingWithDetails);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userProfile?.id]);

  // Calculate wallet summary
  const summary: WalletSummary = useMemo(() => {
    let received = 0;
    let spent = 0;
    let ownMoney = 0;
    let returned = 0;
    let pendingToSettle = 0;
    let pendingCount = 0;
    let pendingApproval = 0;       // Amount awaiting admin approval
    let pendingApprovalCount = 0;
    let owedByCompany = 0;

    transactions.forEach(t => {
      switch (t.transaction_type) {
        case "received_from_company":
          received += t.amount;
          if (t.settlement_status === "pending_settlement") {
            // Engineer hasn't submitted settlement yet
            pendingToSettle += t.amount;
            pendingCount++;
          } else if (t.settlement_status === "pending_confirmation") {
            // Engineer submitted, awaiting admin approval
            pendingApproval += t.amount;
            pendingApprovalCount++;
          }
          break;
        case "spent_on_behalf":
          spent += t.amount;
          break;
        case "used_own_money":
          ownMoney += t.amount;
          if (!t.is_settled) {
            owedByCompany += t.amount;
          }
          break;
        case "returned_to_company":
          returned += t.amount;
          break;
      }
    });

    // Balance available to engineer:
    // - received: total money received from company
    // - spent: money spent on behalf of company (direct payments)
    // - returned: money returned to company
    // - pendingApproval: money engineer has already paid to laborers (submitted for approval)
    // Note: pendingApproval is excluded because that money has been spent paying laborers
    const balance = received - spent - returned - pendingApproval;

    return {
      received,
      spent,
      ownMoney,
      returned,
      pendingToSettle,
      pendingCount,
      pendingApproval,
      pendingApprovalCount,
      balance,
      owedByCompany,
    };
  }, [transactions]);

  const handleOpenSettlementDialog = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setSettlementDialogOpen(true);
  };

  const handleSettlementSuccess = () => {
    setSettlementDialogOpen(false);
    setSelectedTransactionId(null);
    setSuccess("Settlement submitted successfully!");
    fetchData();
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      received_from_company: "Received",
      spent_on_behalf: "Spent",
      used_own_money: "Own Money",
      returned_to_company: "Returned",
    };
    return labels[type] || type;
  };

  const getTransactionTypeColor = (type: string): "success" | "error" | "warning" | "info" => {
    const colors: Record<string, "success" | "error" | "warning" | "info"> = {
      received_from_company: "success",
      spent_on_behalf: "error",
      used_own_money: "warning",
      returned_to_company: "info",
    };
    return colors[type] || "info";
  };

  const getSettlementStatusChip = (tx: Transaction) => {
    if (tx.transaction_type !== "received_from_company") {
      return null;
    }

    if (tx.settlement_status === "confirmed") {
      return <Chip label="Settled" size="small" color="success" icon={<CheckIcon />} />;
    }
    if (tx.settlement_status === "pending_confirmation") {
      return <Chip label="Awaiting Confirmation" size="small" color="info" />;
    }
    if (tx.settlement_status === "disputed") {
      return <Chip label="Disputed" size="small" color="error" />;
    }
    if (tx.settlement_status === "pending_settlement") {
      return <Chip label="Pending" size="small" color="warning" icon={<PendingIcon />} />;
    }
    return null;
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="My Wallet"
        subtitle="Track your payments and settlements"
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
          >
            Refresh
          </Button>
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

      {/* Wallet Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 2.4 }}>
          <Card sx={{ bgcolor: "success.light", color: "success.contrastText" }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <ReceivedIcon fontSize="small" />
                <Typography variant="caption" fontWeight={500}>
                  RECEIVED
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700}>
                Rs.{summary.received.toLocaleString()}
              </Typography>
              <Typography variant="caption">From Company</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 2.4 }}>
          <Card sx={{ bgcolor: "warning.light", color: "warning.contrastText" }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PendingIcon fontSize="small" />
                <Typography variant="caption" fontWeight={500}>
                  TO SETTLE
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700}>
                Rs.{summary.pendingToSettle.toLocaleString()}
              </Typography>
              <Typography variant="caption">
                {summary.pendingCount} pending
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 2.4 }}>
          <Card sx={{ bgcolor: summary.pendingApproval > 0 ? "info.light" : "grey.100" }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <CheckIcon fontSize="small" color={summary.pendingApproval > 0 ? "info" : "disabled"} />
                <Typography variant="caption" fontWeight={500}>
                  AWAITING APPROVAL
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700}>
                Rs.{summary.pendingApproval.toLocaleString()}
              </Typography>
              <Typography variant="caption">
                {summary.pendingApprovalCount} submitted
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 2.4 }}>
          <Card>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <WalletIcon fontSize="small" color="action" />
                <Typography variant="caption" fontWeight={500} color="text.secondary">
                  BALANCE
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700}>
                Rs.{summary.balance.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Available
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 6, sm: 2.4 }}>
          <Card sx={{ bgcolor: summary.owedByCompany > 0 ? "error.light" : "grey.100" }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <WarningIcon fontSize="small" />
                <Typography variant="caption" fontWeight={500}>
                  OWED BY COMPANY
                </Typography>
              </Box>
              <Typography variant="h5" fontWeight={700}>
                Rs.{summary.owedByCompany.toLocaleString()}
              </Typography>
              <Typography variant="caption">
                Own money used
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <CardContent>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  Pending Payments
                  {pendingSettlements.length > 0 && (
                    <Chip label={pendingSettlements.length} size="small" color="warning" />
                  )}
                </Box>
              }
            />
            <Tab label="All Transactions" />
          </Tabs>

          {/* Pending Payments Tab */}
          <TabPanel value={tabValue} index={0}>
            {pendingSettlements.length === 0 ? (
              <Alert severity="success" icon={<CheckIcon />}>
                All caught up! No pending payments.
              </Alert>
            ) : (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  These payments were sent to you for distribution. Please settle them by paying the laborers and uploading proof.
                </Alert>

                <EngineerWalletTable
                  settlements={pendingSettlements}
                  loading={loading}
                  onSettle={handleOpenSettlementDialog}
                />

                <Box sx={{ mt: 2, p: 2, bgcolor: "background.default", borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Pending: {pendingSettlements.length} payments |{" "}
                    <Typography component="span" fontWeight={600} color="warning.main">
                      Rs.{summary.pendingToSettle.toLocaleString()}
                    </Typography>
                  </Typography>
                </Box>
              </>
            )}
          </TabPanel>

          {/* All Transactions Tab */}
          <TabPanel value={tabValue} index={1}>
            {transactions.length === 0 ? (
              <Alert severity="info">No transactions found.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Site</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Mode</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map(tx => (
                      <TableRow key={tx.id} hover>
                        <TableCell>
                          {dayjs(tx.transaction_date).format("DD MMM YYYY")}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getTransactionTypeLabel(tx.transaction_type)}
                            size="small"
                            color={getTransactionTypeColor(tx.transaction_type)}
                          />
                        </TableCell>
                        <TableCell>{tx.site_name || "-"}</TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={600}
                            color={
                              tx.transaction_type === "received_from_company"
                                ? "success.main"
                                : tx.transaction_type === "returned_to_company"
                                ? "info.main"
                                : "error.main"
                            }
                          >
                            {tx.transaction_type === "received_from_company" ? "+" : "-"}
                            Rs.{tx.amount.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={tx.payment_mode?.toUpperCase() || "CASH"}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {getSettlementStatusChip(tx)}
                          {tx.transaction_type === "used_own_money" && (
                            tx.is_settled ? (
                              <Chip label="Reimbursed" size="small" color="success" />
                            ) : (
                              <Chip label="Pending" size="small" color="warning" />
                            )
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {tx.description || "-"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Settlement Form Dialog */}
      {selectedTransactionId && (
        <SettlementFormDialog
          open={settlementDialogOpen}
          onClose={() => {
            setSettlementDialogOpen(false);
            setSelectedTransactionId(null);
          }}
          transactionId={selectedTransactionId}
          onSuccess={handleSettlementSuccess}
        />
      )}
    </Box>
  );
}
