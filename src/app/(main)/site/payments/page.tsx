"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  Radio,
  FormControlLabel,
  InputAdornment,
} from "@mui/material";
import {
  Payments as PaymentsIcon,
  AccountBalanceWallet as WalletIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  FilterList as FilterIcon,
  CheckCircle as PaidIcon,
  Schedule as PendingIcon,
  Send as SendIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import dayjs from "dayjs";
import { hasEditPermission } from "@/lib/permissions";

interface DailyAttendanceRecord {
  id: string;
  date: string;
  laborer_id: string;
  laborer_name: string;
  laborer_type: string;
  daily_earnings: number;
  is_paid: boolean;
  payment_date: string | null;
  payment_mode: string | null;
  paid_via: string | null;
}

interface MarketAttendanceRecord {
  id: string;
  date: string;
  role_name: string;
  count: number;
  total_cost: number;
  is_paid: boolean;
  payment_date: string | null;
  payment_mode: string | null;
  paid_via: string | null;
}

interface Engineer {
  id: string;
  name: string;
  email: string;
}

type PaymentRecord = {
  id: string;
  type: "daily" | "market";
  date: string;
  name: string;
  count: number;
  amount: number;
  is_paid: boolean;
  payment_date: string | null;
  payment_mode: string | null;
  paid_via: string | null;
  laborer_type?: string;
};

export default function DailyPaymentsPage() {
  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();

  // Filter state
  const [dateFrom, setDateFrom] = useState(
    dayjs().subtract(7, "day").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [filterType, setFilterType] = useState<"all" | "daily" | "market">("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "sent_to_engineer" | "paid"
  >("pending");

  // Data state
  const [dailyRecords, setDailyRecords] = useState<DailyAttendanceRecord[]>([]);
  const [marketRecords, setMarketRecords] = useState<MarketAttendanceRecord[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

  // Dialog state
  const [payDirectDialogOpen, setPayDirectDialogOpen] = useState(false);
  const [sendToEngineerDialogOpen, setSendToEngineerDialogOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"upi" | "cash" | "bank">("upi");
  const [selectedEngineer, setSelectedEngineer] = useState<string>("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  const canEdit = hasEditPermission(userProfile?.role);

  // Fetch data
  const fetchData = async () => {
    if (!selectedSite?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch daily attendance records
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
          laborers(name, laborer_type)
        `
        )
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      if (dailyError) throw dailyError;

      const mappedDaily: DailyAttendanceRecord[] = (dailyData || []).map(
        (r: any) => ({
          id: r.id,
          date: r.date,
          laborer_id: r.laborer_id,
          laborer_name: r.laborers?.name || "Unknown",
          laborer_type: r.laborers?.laborer_type || "daily",
          daily_earnings: r.daily_earnings || 0,
          is_paid: r.is_paid || false,
          payment_date: r.payment_date,
          payment_mode: r.payment_mode,
          paid_via: r.paid_via,
        })
      );
      setDailyRecords(mappedDaily);

      // Fetch market attendance records
      const { data: marketData, error: marketError } = await (
        supabase.from("market_laborer_attendance") as any
      )
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
          labor_roles(name)
        `
        )
        .eq("site_id", selectedSite.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      if (marketError) throw marketError;

      const mappedMarket: MarketAttendanceRecord[] = (marketData || []).map(
        (r: any) => ({
          id: r.id,
          date: r.date,
          role_name: r.labor_roles?.name || "Unknown",
          count: r.count || 0,
          total_cost: r.total_cost || 0,
          is_paid: r.is_paid || false,
          payment_date: r.payment_date,
          payment_mode: r.payment_mode,
          paid_via: r.paid_via,
        })
      );
      setMarketRecords(mappedMarket);

      // Fetch engineers for this site
      const { data: engineerData } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("role", "site_engineer");

      setEngineers((engineerData || []) as Engineer[]);
    } catch (err: any) {
      console.error("Error fetching payment data:", err);
      setError("Failed to load payment data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSite?.id, dateFrom, dateTo]);

  // Combined and filtered records
  const paymentRecords = useMemo(() => {
    const records: PaymentRecord[] = [];

    // Add daily records
    if (filterType === "all" || filterType === "daily") {
      dailyRecords.forEach((r) => {
        records.push({
          id: `daily-${r.id}`,
          type: "daily",
          date: r.date,
          name: r.laborer_name,
          count: 1,
          amount: r.daily_earnings,
          is_paid: r.is_paid,
          payment_date: r.payment_date,
          payment_mode: r.payment_mode,
          paid_via: r.paid_via,
          laborer_type: r.laborer_type,
        });
      });
    }

    // Add market records
    if (filterType === "all" || filterType === "market") {
      marketRecords.forEach((r) => {
        records.push({
          id: `market-${r.id}`,
          type: "market",
          date: r.date,
          name: `${r.role_name} (${r.count} people)`,
          count: r.count,
          amount: r.total_cost,
          is_paid: r.is_paid,
          payment_date: r.payment_date,
          payment_mode: r.payment_mode,
          paid_via: r.paid_via,
        });
      });
    }

    // Apply status filter
    return records.filter((r) => {
      if (filterStatus === "all") return true;
      if (filterStatus === "pending") return !r.is_paid && !r.paid_via;
      if (filterStatus === "sent_to_engineer")
        return !r.is_paid && r.paid_via === "engineer_wallet";
      if (filterStatus === "paid") return r.is_paid;
      return true;
    });
  }, [dailyRecords, marketRecords, filterType, filterStatus]);

  // Summary calculations
  const summary = useMemo(() => {
    const pending = paymentRecords.filter(
      (r) => !r.is_paid && !r.paid_via
    );
    const sentToEngineer = paymentRecords.filter(
      (r) => !r.is_paid && r.paid_via === "engineer_wallet"
    );
    const paid = paymentRecords.filter((r) => r.is_paid);

    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, r) => sum + r.amount, 0),
      sentToEngineerCount: sentToEngineer.length,
      sentToEngineerAmount: sentToEngineer.reduce((sum, r) => sum + r.amount, 0),
      paidCount: paid.length,
      paidAmount: paid.reduce((sum, r) => sum + r.amount, 0),
    };
  }, [paymentRecords]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const unpaidIds = paymentRecords
        .filter((r) => !r.is_paid)
        .map((r) => r.id);
      setSelectedRecords(new Set(unpaidIds));
    } else {
      setSelectedRecords(new Set());
    }
  };

  const handleSelectRecord = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRecords);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRecords(newSelected);
  };

  // Get selected records data
  const getSelectedRecordsData = () => {
    return paymentRecords.filter((r) => selectedRecords.has(r.id));
  };

  const selectedTotal = getSelectedRecordsData().reduce(
    (sum, r) => sum + r.amount,
    0
  );

  // Handle pay direct
  const handlePayDirect = async () => {
    setProcessing(true);
    try {
      const selected = getSelectedRecordsData();

      // Upload proof if provided
      let proofUrl: string | null = null;
      if (proofFile && paymentMode === "upi") {
        const fileName = `${selectedSite?.id}/${dayjs().format("YYYY-MM-DD")}/${Date.now()}-${proofFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(fileName, proofFile);

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("payment-proofs").getPublicUrl(fileName);
          proofUrl = publicUrl;
        }
      }

      // Update daily records
      const dailyIds = selected
        .filter((r) => r.type === "daily")
        .map((r) => r.id.replace("daily-", ""));

      if (dailyIds.length > 0) {
        await (supabase.from("daily_attendance") as any)
          .update({
            is_paid: true,
            payment_date: dayjs().format("YYYY-MM-DD"),
            payment_mode: paymentMode,
            payment_proof_url: proofUrl,
            paid_via: "direct",
          })
          .in("id", dailyIds);
      }

      // Update market records
      const marketIds = selected
        .filter((r) => r.type === "market")
        .map((r) => r.id.replace("market-", ""));

      if (marketIds.length > 0) {
        await (supabase.from("market_laborer_attendance") as any)
          .update({
            is_paid: true,
            payment_date: dayjs().format("YYYY-MM-DD"),
            payment_mode: paymentMode,
            payment_proof_url: proofUrl,
            paid_via: "direct",
          })
          .in("id", marketIds);
      }

      setPayDirectDialogOpen(false);
      setSelectedRecords(new Set());
      setProofFile(null);
      fetchData();
    } catch (err: any) {
      console.error("Error marking as paid:", err);
      setError("Failed to mark as paid: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Handle send to engineer
  const handleSendToEngineer = async () => {
    if (!selectedEngineer) return;

    setProcessing(true);
    try {
      const selected = getSelectedRecordsData();
      const totalAmount = selected.reduce((sum, r) => sum + r.amount, 0);

      // Upload proof
      let proofUrl: string | null = null;
      if (proofFile) {
        const fileName = `${selectedSite?.id}/${dayjs().format("YYYY-MM-DD")}/${Date.now()}-${proofFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(fileName, proofFile);

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("payment-proofs").getPublicUrl(fileName);
          proofUrl = publicUrl;
        }
      }

      // Create engineer transaction
      const { data: transaction, error: txError } = await (
        supabase.from("site_engineer_transactions") as any
      )
        .insert({
          user_id: selectedEngineer,
          site_id: selectedSite?.id,
          transaction_type: "credit",
          amount: totalAmount,
          description: `Attendance payment for ${selected.length} records`,
          payment_mode: "upi",
          proof_url: proofUrl,
          is_settled: false,
          entered_by: userProfile?.name,
          entered_by_user_id: userProfile?.id,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Update daily records
      const dailyIds = selected
        .filter((r) => r.type === "daily")
        .map((r) => r.id.replace("daily-", ""));

      if (dailyIds.length > 0) {
        await (supabase.from("daily_attendance") as any)
          .update({
            paid_via: "engineer_wallet",
            engineer_transaction_id: transaction.id,
          })
          .in("id", dailyIds);
      }

      // Update market records
      const marketIds = selected
        .filter((r) => r.type === "market")
        .map((r) => r.id.replace("market-", ""));

      if (marketIds.length > 0) {
        await (supabase.from("market_laborer_attendance") as any)
          .update({
            paid_via: "engineer_wallet",
            engineer_transaction_id: transaction.id,
          })
          .in("id", marketIds);
      }

      setSendToEngineerDialogOpen(false);
      setSelectedRecords(new Set());
      setSelectedEngineer("");
      setProofFile(null);
      fetchData();
    } catch (err: any) {
      console.error("Error sending to engineer:", err);
      setError("Failed to send to engineer: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!selectedSite) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Please select a site to view payments</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Daily Payment Log
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track and manage payments for attendance records
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            sx={{
              bgcolor: "warning.50",
              borderLeft: 4,
              borderColor: "warning.main",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PendingIcon color="warning" />
                <Typography variant="subtitle2" color="warning.dark">
                  Pending Payment
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} color="warning.main">
                ₹{summary.pendingAmount.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary.pendingCount} records
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            sx={{
              bgcolor: "info.50",
              borderLeft: 4,
              borderColor: "info.main",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <WalletIcon color="info" />
                <Typography variant="subtitle2" color="info.dark">
                  Sent to Engineer
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} color="info.main">
                ₹{summary.sentToEngineerAmount.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary.sentToEngineerCount} records (pending settlement)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            sx={{
              bgcolor: "success.50",
              borderLeft: 4,
              borderColor: "success.main",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PaidIcon color="success" />
                <Typography variant="subtitle2" color="success.dark">
                  Paid
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} color="success.main">
                ₹{summary.paidAmount.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary.paidCount} records
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <FilterIcon color="action" />
          <TextField
            label="From Date"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 160 }}
          />
          <TextField
            label="To Date"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 160 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              label="Type"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="market">Market</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              label="Status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="sent_to_engineer">Sent to Engineer</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={fetchData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Action Buttons */}
      {canEdit && selectedRecords.size > 0 && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
            bgcolor: "primary.50",
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            {selectedRecords.size} selected | Total: ₹
            {selectedTotal.toLocaleString()}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            color="success"
            startIcon={<MoneyIcon />}
            onClick={() => setPayDirectDialogOpen(true)}
          >
            Pay Direct
          </Button>
          <Button
            variant="contained"
            color="info"
            startIcon={<SendIcon />}
            onClick={() => setSendToEngineerDialogOpen(true)}
          >
            Send to Engineer
          </Button>
        </Paper>
      )}

      {/* Records Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : paymentRecords.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">
              No records found for the selected filters
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={
                      selectedRecords.size > 0 &&
                      selectedRecords.size ===
                        paymentRecords.filter((r) => !r.is_paid).length
                    }
                    indeterminate={
                      selectedRecords.size > 0 &&
                      selectedRecords.size <
                        paymentRecords.filter((r) => !r.is_paid).length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Name / Role</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment Info</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentRecords.map((record) => (
                <TableRow
                  key={record.id}
                  selected={selectedRecords.has(record.id)}
                  sx={{
                    bgcolor: record.is_paid
                      ? "success.50"
                      : record.paid_via
                        ? "info.50"
                        : "inherit",
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedRecords.has(record.id)}
                      disabled={record.is_paid}
                      onChange={(e) =>
                        handleSelectRecord(record.id, e.target.checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {dayjs(record.date).format("DD MMM")}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {record.type === "daily" ? (
                        <PersonIcon fontSize="small" color="action" />
                      ) : (
                        <StoreIcon fontSize="small" color="action" />
                      )}
                      <Typography variant="body2">{record.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        record.type === "market"
                          ? "Market"
                          : record.laborer_type === "contract"
                            ? "Contract"
                            : "Daily"
                      }
                      size="small"
                      color={
                        record.type === "market"
                          ? "secondary"
                          : record.laborer_type === "contract"
                            ? "info"
                            : "warning"
                      }
                      sx={{ fontSize: "0.7rem" }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      ₹{record.amount.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {record.is_paid ? (
                      <Chip
                        label="Paid"
                        size="small"
                        color="success"
                        icon={<PaidIcon />}
                      />
                    ) : record.paid_via === "engineer_wallet" ? (
                      <Chip
                        label="With Engineer"
                        size="small"
                        color="info"
                        icon={<WalletIcon />}
                      />
                    ) : (
                      <Chip
                        label="Pending"
                        size="small"
                        color="warning"
                        icon={<PendingIcon />}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {record.payment_date && (
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(record.payment_date).format("DD MMM")} •{" "}
                        {record.payment_mode}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Pay Direct Dialog */}
      <Dialog
        open={payDirectDialogOpen}
        onClose={() => setPayDirectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Pay Direct</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Mark {selectedRecords.size} records as paid (₹
            {selectedTotal.toLocaleString()})
          </Typography>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Payment Mode
          </Typography>
          <RadioGroup
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as any)}
            row
            sx={{ mb: 2 }}
          >
            <FormControlLabel value="upi" control={<Radio />} label="UPI" />
            <FormControlLabel value="cash" control={<Radio />} label="Cash" />
            <FormControlLabel
              value="bank"
              control={<Radio />}
              label="Bank Transfer"
            />
          </RadioGroup>

          {paymentMode === "upi" && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Upload Payment Screenshot (Optional)
              </Typography>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
              >
                {proofFile ? proofFile.name : "Select File"}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) =>
                    setProofFile(e.target.files?.[0] || null)
                  }
                />
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDirectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handlePayDirect}
            disabled={processing}
          >
            {processing ? <CircularProgress size={20} /> : "Confirm Payment"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send to Engineer Dialog */}
      <Dialog
        open={sendToEngineerDialogOpen}
        onClose={() => setSendToEngineerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Send to Site Engineer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Transfer ₹{selectedTotal.toLocaleString()} for{" "}
            {selectedRecords.size} records to engineer for settlement
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select Engineer</InputLabel>
            <Select
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              label="Select Engineer"
            >
              {engineers.map((eng) => (
                <MenuItem key={eng.id} value={eng.id}>
                  {eng.name} ({eng.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Upload Transfer Proof (UPI Screenshot)
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadIcon />}
            >
              {proofFile ? proofFile.name : "Select File"}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              />
            </Button>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            The engineer will need to settle these payments after receiving
            cash from ATM or making direct payments to laborers.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendToEngineerDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="info"
            onClick={handleSendToEngineer}
            disabled={processing || !selectedEngineer}
          >
            {processing ? <CircularProgress size={20} /> : "Send to Engineer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
