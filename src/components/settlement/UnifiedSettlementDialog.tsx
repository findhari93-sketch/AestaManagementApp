"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  CircularProgress,
  Divider,
  Avatar,
  Chip,
  Collapse,
  Paper,
  alpha,
  useTheme,
  useMediaQuery,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Slide,
} from "@mui/material";
import { TransitionProps } from "@mui/material/transitions";
import {
  Payment as PaymentIcon,
  AccountBalanceWallet as WalletIcon,
  Close as CloseIcon,
  CalendarMonth,
  CalendarToday,
  Person,
  Groups,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import {
  createSalaryExpense,
  createPaymentSettlementNotification,
} from "@/lib/services/notificationService";
import {
  generateWhatsAppUrl,
  generateSettlementNotificationMessage,
} from "@/lib/formatters";
import FileUploader, { UploadedFile } from "@/components/common/FileUploader";
import SubcontractLinkSelector from "@/components/payments/SubcontractLinkSelector";
import PayerSourceSelector from "./PayerSourceSelector";
import dayjs from "dayjs";
import type {
  UnifiedSettlementConfig,
  SettlementRecord,
  PayerSource,
  SettlementTypeSelection,
} from "@/types/settlement.types";
import type { PaymentMode, PaymentChannel } from "@/types/payment.types";

// Slide up transition for mobile fullscreen
const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface Engineer {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  wallet_balance?: number;
}

interface UnifiedSettlementDialogProps {
  open: boolean;
  onClose: () => void;
  config: UnifiedSettlementConfig | null;
  onSuccess?: () => void;
}

export default function UnifiedSettlementDialog({
  open,
  onClose,
  config,
  onSuccess,
}: UnifiedSettlementDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const supabase = createClient();

  // Selection state (for daily context)
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

  // Settlement type selection (for weekly context)
  const [settlementType, setSettlementType] = useState<SettlementTypeSelection>("all");

  // Payment details
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>("direct");
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>("");
  const [engineerReference, setEngineerReference] = useState<string>("");

  // Payer source
  const [payerSource, setPayerSource] = useState<PayerSource>("own_money");
  const [customPayerName, setCustomPayerName] = useState<string>("");

  // Additional details
  const [subcontractId, setSubcontractId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<UploadedFile | null>(null);
  const [notes, setNotes] = useState<string>("");

  // Data state
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch site engineers when dialog opens
  useEffect(() => {
    const fetchEngineers = async () => {
      if (!selectedSite?.id || !open) return;

      setLoading(true);
      try {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name, email, avatar_url")
          .eq("role", "site_engineer")
          .eq("status", "active");

        const engineerList: Engineer[] = (usersData || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatar_url: u.avatar_url,
        }));

        // Get wallet balances
        for (const eng of engineerList) {
          const { data: transactions } = await supabase
            .from("site_engineer_transactions")
            .select("amount, transaction_type")
            .eq("user_id", eng.id)
            .eq("site_id", selectedSite.id);

          const balance =
            transactions?.reduce((sum, t) => {
              if (t.transaction_type === "credit") return sum + t.amount;
              if (t.transaction_type === "debit" || t.transaction_type === "spent_on_behalf")
                return sum - t.amount;
              return sum;
            }, 0) || 0;

          eng.wallet_balance = balance;
        }

        setEngineers(engineerList);
      } catch (err) {
        console.error("Error fetching engineers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEngineers();
  }, [selectedSite?.id, open, supabase]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && config) {
      // Pre-select all pending records for daily context
      if (config.context === "daily_single") {
        const pendingIds = config.records
          .filter((r) => !r.isPaid)
          .map((r) => r.id);
        setSelectedRecords(new Set(pendingIds));
      } else {
        setSelectedRecords(new Set());
      }

      setSettlementType("all");
      setPaymentMode("cash");
      setPaymentChannel("direct");
      setSelectedEngineerId("");
      setEngineerReference("");
      setPayerSource("own_money");
      setCustomPayerName("");
      setSubcontractId(config.defaultSubcontractId || null);
      setProofFile(null);
      setNotes("");
      setError(null);
    }
  }, [open, config]);

  // Generate default reference for engineer
  useEffect(() => {
    if (paymentChannel === "engineer_wallet" && !engineerReference && config) {
      if (config.context === "weekly") {
        setEngineerReference(`Weekly salary settlement ${config.weekLabel || ""}`);
      } else if (config.date) {
        setEngineerReference(`Daily salary for ${dayjs(config.date).format("MMM D, YYYY")}`);
      }
    }
  }, [paymentChannel, config, engineerReference]);

  // Calculate amounts based on selection
  const calculatedAmounts = useMemo(() => {
    if (!config) return { total: 0, selected: 0, count: 0 };

    if (config.context === "weekly") {
      // Weekly context - based on type selection
      let amount = 0;
      switch (settlementType) {
        case "daily":
          amount = config.dailyLaborPending;
          break;
        case "contract":
          amount = config.contractLaborPending;
          break;
        case "market":
          amount = config.marketLaborPending;
          break;
        case "all":
        default:
          amount = config.pendingAmount;
      }
      return { total: config.pendingAmount, selected: amount, count: 0 };
    } else {
      // Daily context - based on record selection
      const selectedAmount = config.records
        .filter((r) => selectedRecords.has(r.id))
        .reduce((sum, r) => sum + r.amount, 0);
      return {
        total: config.pendingAmount,
        selected: selectedAmount,
        count: selectedRecords.size,
      };
    }
  }, [config, settlementType, selectedRecords]);

  // Toggle record selection
  const handleToggleRecord = (id: string) => {
    setSelectedRecords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all/none
  const handleSelectAll = () => {
    if (!config) return;
    const pendingRecords = config.records.filter((r) => !r.isPaid);
    if (selectedRecords.size === pendingRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(pendingRecords.map((r) => r.id)));
    }
  };

  // Handle file upload
  const handleFileUpload = (file: UploadedFile) => {
    setProofFile(file);
  };

  const handleFileRemove = () => {
    setProofFile(null);
  };

  // Submit settlement
  const handleSubmit = async () => {
    if (!config || !selectedSite?.id || !userProfile) return;

    // Validation
    if (config.context === "daily_single" && selectedRecords.size === 0) {
      setError("Please select at least one laborer to settle");
      return;
    }

    if (calculatedAmounts.selected === 0) {
      setError("No pending amount to settle");
      return;
    }

    if (paymentChannel === "engineer_wallet" && !selectedEngineerId) {
      setError("Please select a site engineer");
      return;
    }

    if ((paymentMode === "upi" || paymentMode === "net_banking") && !proofFile) {
      setError("Please upload payment proof for UPI/Bank transfer");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const paymentDate = dayjs().format("YYYY-MM-DD");
      let engineerTransactionId: string | null = null;

      // 1. If via engineer wallet, create transaction first
      if (paymentChannel === "engineer_wallet") {
        const { data: txData, error: txError } = await (supabase
          .from("site_engineer_transactions") as any)
          .insert({
            user_id: selectedEngineerId,
            site_id: selectedSite.id,
            transaction_type: "received_from_company",
            settlement_status: "pending_settlement",
            amount: calculatedAmounts.selected,
            description: engineerReference,
            payment_mode: paymentMode,
            proof_url: proofFile?.url || null,
            is_settled: false,
            recorded_by: userProfile.name,
            recorded_by_user_id: userProfile.id,
            related_subcontract_id: subcontractId,
          })
          .select()
          .single();

        if (txError) throw txError;
        engineerTransactionId = txData.id;

        // Get engineer details for notification
        const selectedEngineer = engineers.find((e) => e.id === selectedEngineerId);

        // Send in-app notification to engineer
        const dailyCount = config.context === "daily_single"
          ? selectedRecords.size
          : config.records.filter((r) => r.sourceType === "daily" && !r.isPaid).length;
        const marketCount = config.context === "daily_single"
          ? 0
          : config.records.filter((r) => r.sourceType === "market" && !r.isPaid).length;

        if (engineerTransactionId) {
          await createPaymentSettlementNotification(
            supabase,
            engineerTransactionId,
            selectedEngineerId,
            calculatedAmounts.selected,
            { dailyCount, marketCount, totalAmount: calculatedAmounts.selected },
            selectedSite.name
          );

          // Send WhatsApp notification with deep link
          if (selectedEngineer) {
            // Fetch engineer's phone number
            const { data: userData } = await supabase
              .from("users")
              .select("phone")
              .eq("id", selectedEngineerId)
              .single();

            if (userData?.phone) {
              const whatsappMessage = generateSettlementNotificationMessage({
                engineerName: selectedEngineer.name,
                amount: calculatedAmounts.selected,
                dailyCount,
                marketCount,
                siteName: selectedSite.name || "Site",
                transactionId: engineerTransactionId,
              });
              const whatsappUrl = generateWhatsAppUrl(userData.phone, whatsappMessage);
              if (whatsappUrl) {
                window.open(whatsappUrl, "_blank");
              }
            }
          }
        }
      }

      // 2. Process records based on context
      if (config.context === "daily_single") {
        await processDailyRecords(paymentDate, engineerTransactionId);
      } else {
        await processWeeklyRecords(paymentDate, engineerTransactionId);
      }

      // 3. Create salary expense for direct payments
      if (paymentChannel === "direct") {
        const recordDate = config.date || config.dateRange?.from || paymentDate;
        const laborerCount = config.context === "daily_single"
          ? selectedRecords.size
          : config.records.filter((r) => !r.isPaid).length;

        const expenseResult = await createSalaryExpense(supabase, {
          siteId: selectedSite.id,
          amount: calculatedAmounts.selected,
          date: recordDate,
          description: `Laborer salary (${laborerCount} laborers)${notes ? ` - ${notes}` : ""}`,
          paymentMode,
          paidBy: userProfile.name || "Unknown",
          paidByUserId: userProfile.id,
          proofUrl: proofFile?.url || null,
          subcontractId,
          isCleared: true,
          paymentSource: "direct",
        });

        if (expenseResult.error) {
          console.warn("Failed to create salary expense:", expenseResult.error.message);
        }

        // Link expense to attendance records
        if (expenseResult.expenseId) {
          await linkExpenseToRecords(expenseResult.expenseId);
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Settlement error:", err);
      setError(err.message || "Failed to process settlement");
    } finally {
      setProcessing(false);
    }
  };

  // Process daily records
  const processDailyRecords = async (
    paymentDate: string,
    engineerTransactionId: string | null
  ) => {
    if (!config) return;

    const selectedIds = Array.from(selectedRecords);
    const dailyIds = config.records
      .filter((r) => selectedIds.includes(r.id) && r.sourceType === "daily")
      .map((r) => r.sourceId);
    const marketIds = config.records
      .filter((r) => selectedIds.includes(r.id) && r.sourceType === "market")
      .map((r) => r.sourceId);

    const updateData = {
      is_paid: paymentChannel === "direct",
      payment_date: paymentDate,
      payment_mode: paymentMode,
      paid_via: paymentChannel === "direct" ? "direct" : "engineer_wallet",
      engineer_transaction_id: engineerTransactionId,
      payment_proof_url: proofFile?.url || null,
      payment_notes: notes || null,
      payer_source: payerSource,
      payer_name: payerSource === "custom" ? customPayerName : null,
      subcontract_id: subcontractId,
    };

    if (dailyIds.length > 0) {
      const { error } = await supabase
        .from("daily_attendance")
        .update(updateData)
        .in("id", dailyIds);
      if (error) throw error;
    }

    if (marketIds.length > 0) {
      const { error } = await supabase
        .from("market_laborer_attendance")
        .update(updateData)
        .in("id", marketIds);
      if (error) throw error;
    }
  };

  // Process weekly records
  const processWeeklyRecords = async (
    paymentDate: string,
    engineerTransactionId: string | null
  ) => {
    if (!config || !config.dateRange) return;

    const updateData = {
      is_paid: paymentChannel === "direct",
      payment_date: paymentDate,
      payment_mode: paymentMode,
      paid_via: paymentChannel === "direct" ? "direct" : "engineer_wallet",
      engineer_transaction_id: engineerTransactionId,
      payment_proof_url: proofFile?.url || null,
      payment_notes: notes || null,
      payer_source: payerSource,
      payer_name: payerSource === "custom" ? customPayerName : null,
      subcontract_id: subcontractId,
    };

    // Update daily laborers
    if (settlementType === "daily" || settlementType === "all") {
      const { error: dailyError } = await supabase
        .from("daily_attendance")
        .update(updateData)
        .eq("site_id", selectedSite!.id)
        .gte("date", config.dateRange.from)
        .lte("date", config.dateRange.to)
        .eq("is_paid", false)
        .neq("laborer_type", "contract");

      if (dailyError) throw dailyError;
    }

    // Update contract laborers
    if (settlementType === "contract" || settlementType === "all") {
      const { error: contractError } = await supabase
        .from("daily_attendance")
        .update(updateData)
        .eq("site_id", selectedSite!.id)
        .gte("date", config.dateRange.from)
        .lte("date", config.dateRange.to)
        .eq("is_paid", false)
        .eq("laborer_type", "contract");

      if (contractError) throw contractError;
    }

    // Update market laborers
    if (settlementType === "market" || settlementType === "all") {
      const { error: marketError } = await supabase
        .from("market_laborer_attendance")
        .update({
          ...updateData,
        })
        .eq("site_id", selectedSite!.id)
        .gte("date", config.dateRange.from)
        .lte("date", config.dateRange.to)
        .eq("is_paid", false);

      if (marketError) throw marketError;
    }
  };

  // Link expense to attendance records
  const linkExpenseToRecords = async (expenseId: string) => {
    if (!config) return;

    if (config.context === "daily_single") {
      const selectedIds = Array.from(selectedRecords);
      const dailyIds = config.records
        .filter((r) => selectedIds.includes(r.id) && r.sourceType === "daily")
        .map((r) => r.sourceId);
      const marketIds = config.records
        .filter((r) => selectedIds.includes(r.id) && r.sourceType === "market")
        .map((r) => r.sourceId);

      if (dailyIds.length > 0) {
        await supabase
          .from("daily_attendance")
          .update({ expense_id: expenseId })
          .in("id", dailyIds);
      }
      if (marketIds.length > 0) {
        await supabase
          .from("market_laborer_attendance")
          .update({ expense_id: expenseId })
          .in("id", marketIds);
      }
    }
    // For weekly, we don't link individual records
  };

  if (!config) return null;

  const pendingRecords = config.records.filter((r) => !r.isPaid);
  const isWeekly = config.context === "weekly";

  // Dialog title
  const dialogTitle = isWeekly
    ? "Weekly Settlement"
    : `Daily Settlement - ${dayjs(config.date).format("MMM D, YYYY")}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      TransitionComponent={isMobile ? SlideTransition : undefined}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
          maxHeight: isMobile ? "100%" : "90vh",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
          bgcolor: isWeekly ? "primary.main" : "success.main",
          color: "white",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isWeekly ? <CalendarMonth /> : <CalendarToday />}
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {dialogTitle}
            </Typography>
            {isWeekly && config.weekLabel && (
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {config.weekLabel}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Summary Card */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            bgcolor: alpha(isWeekly ? theme.palette.primary.main : theme.palette.success.main, 0.08),
            borderRadius: 2,
            border: `1px solid ${alpha(isWeekly ? theme.palette.primary.main : theme.palette.success.main, 0.2)}`,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                Settlement Amount
              </Typography>
              <Typography
                variant="h5"
                fontWeight={700}
                color={isWeekly ? "primary.main" : "success.main"}
              >
                Rs.{calculatedAmounts.selected.toLocaleString("en-IN")}
              </Typography>
            </Box>
            {!isWeekly && (
              <Chip
                icon={<Person sx={{ fontSize: 16 }} />}
                label={`${calculatedAmounts.count} laborers`}
                color="success"
                variant="outlined"
              />
            )}
          </Box>
        </Paper>

        {/* Weekly Type Selection */}
        {isWeekly && config.allowTypeSelection && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Settlement Type
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Pending Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow
                    selected={settlementType === "daily"}
                    onClick={() => setSettlementType("daily")}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Person fontSize="small" />
                        Daily Laborers
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={`Rs.${config.dailyLaborPending.toLocaleString()}`}
                        color={config.dailyLaborPending > 0 ? "info" : "default"}
                        variant={settlementType === "daily" ? "filled" : "outlined"}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow
                    selected={settlementType === "market"}
                    onClick={() => setSettlementType("market")}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Groups fontSize="small" />
                        Market Laborers
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={`Rs.${config.marketLaborPending.toLocaleString()}`}
                        color={config.marketLaborPending > 0 ? "warning" : "default"}
                        variant={settlementType === "market" ? "filled" : "outlined"}
                      />
                    </TableCell>
                  </TableRow>
                  {config.contractLaborPending > 0 && (
                    <TableRow
                      selected={settlementType === "contract"}
                      onClick={() => setSettlementType("contract")}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>Contract Laborers</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={`Rs.${config.contractLaborPending.toLocaleString()}`}
                          color="secondary"
                          variant={settlementType === "contract" ? "filled" : "outlined"}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow
                    selected={settlementType === "all"}
                    onClick={() => setSettlementType("all")}
                    sx={{ cursor: "pointer", bgcolor: "action.hover" }}
                  >
                    <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={`Rs.${config.pendingAmount.toLocaleString()}`}
                        color="success"
                        variant={settlementType === "all" ? "filled" : "outlined"}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Click a row to settle only that type
            </Typography>
          </Box>
        )}

        {/* Daily Laborer Selection */}
        {!isWeekly && (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="subtitle2" fontWeight={600}>
                Select Laborers to Pay
              </Typography>
              <Button size="small" onClick={handleSelectAll}>
                {selectedRecords.size === pendingRecords.length ? "Deselect All" : "Select All"}
              </Button>
            </Box>
            <Paper variant="outlined" sx={{ maxHeight: 200, overflow: "auto" }}>
              <List dense disablePadding>
                {pendingRecords.map((record) => (
                  <ListItem
                    key={record.id}
                    sx={{ borderBottom: "1px solid", borderColor: "divider" }}
                    secondaryAction={
                      <Chip
                        size="small"
                        label={`Rs.${record.amount.toLocaleString("en-IN")}`}
                        variant="outlined"
                        color={selectedRecords.has(record.id) ? "success" : "default"}
                      />
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox
                        checked={selectedRecords.has(record.id)}
                        onChange={() => handleToggleRecord(record.id)}
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={record.laborerName}
                      secondary={record.role || record.laborerType}
                    />
                  </ListItem>
                ))}
                {pendingRecords.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No pending laborers"
                      secondary="All laborers have been paid"
                    />
                  </ListItem>
                )}
              </List>
            </Paper>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Payer Source */}
        <PayerSourceSelector
          value={payerSource}
          customName={customPayerName}
          onChange={setPayerSource}
          onCustomNameChange={setCustomPayerName}
          disabled={processing}
        />

        {/* Payment Mode */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Payment Mode
          </Typography>
          <RadioGroup
            row
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          >
            <FormControlLabel value="cash" control={<Radio size="small" />} label="Cash" />
            <FormControlLabel value="upi" control={<Radio size="small" />} label="UPI" />
            <FormControlLabel value="net_banking" control={<Radio size="small" />} label="Bank Transfer" />
          </RadioGroup>
        </Box>

        {/* Payment Channel */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Payment Channel
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={paymentChannel}
            onChange={(_, v) => v && setPaymentChannel(v)}
            fullWidth
            size="small"
          >
            <ToggleButton value="direct">
              <PaymentIcon sx={{ mr: 1 }} fontSize="small" />
              Direct Payment
            </ToggleButton>
            <ToggleButton value="engineer_wallet">
              <WalletIcon sx={{ mr: 1 }} fontSize="small" />
              Via Site Engineer
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Engineer Selection */}
        <Collapse in={paymentChannel === "engineer_wallet"}>
          <Box sx={{ mb: 2 }}>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Select Site Engineer</InputLabel>
              <Select
                value={selectedEngineerId}
                onChange={(e) => setSelectedEngineerId(e.target.value)}
                label="Select Site Engineer"
                disabled={loading}
              >
                {loading ? (
                  <MenuItem disabled>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2">Loading engineers...</Typography>
                    </Box>
                  </MenuItem>
                ) : engineers.length === 0 ? (
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">
                      No site engineers found
                    </Typography>
                  </MenuItem>
                ) : (
                  engineers.map((eng) => (
                    <MenuItem key={eng.id} value={eng.id}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar src={eng.avatar_url || undefined} sx={{ width: 28, height: 28 }}>
                          {eng.name?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">{eng.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Balance: Rs.{(eng.wallet_balance || 0).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              label="Reference/Purpose"
              placeholder="What is this payment for?"
              value={engineerReference}
              onChange={(e) => setEngineerReference(e.target.value)}
              helperText="This helps the engineer know which payment to settle"
            />
          </Box>
        </Collapse>

        {/* Subcontract Linking */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Link to Subcontract (Optional)
          </Typography>
          <SubcontractLinkSelector
            selectedSubcontractId={subcontractId}
            onSelect={setSubcontractId}
            paymentAmount={calculatedAmounts.selected}
            disabled={processing}
          />
        </Box>

        {/* Proof Upload */}
        {(paymentMode === "upi" || paymentMode === "net_banking") && (
          <Box sx={{ mb: 2 }}>
            <FileUploader
              supabase={supabase}
              bucketName="settlement-proofs"
              folderPath={`${selectedSite?.id}/${dayjs().format("YYYY-MM")}`}
              fileNamePrefix="settlement"
              accept="image"
              maxSizeMB={10}
              label="Payment Proof *"
              helperText={`Upload screenshot of ${paymentMode === "upi" ? "UPI" : "bank"} transfer`}
              value={proofFile}
              onUpload={handleFileUpload}
              onRemove={handleFileRemove}
              compact
            />
          </Box>
        )}

        {/* Notes */}
        <TextField
          fullWidth
          multiline
          rows={2}
          label="Settlement Notes (Optional)"
          placeholder="Any additional notes about this settlement..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          size="small"
        />
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={isWeekly ? "primary" : "success"}
          onClick={handleSubmit}
          disabled={
            processing ||
            calculatedAmounts.selected === 0 ||
            (paymentChannel === "engineer_wallet" && !selectedEngineerId) ||
            ((paymentMode === "upi" || paymentMode === "net_banking") && !proofFile)
          }
          startIcon={processing ? <CircularProgress size={20} /> : <PaymentIcon />}
        >
          {processing
            ? "Processing..."
            : `Settle Rs.${calculatedAmounts.selected.toLocaleString("en-IN")}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
