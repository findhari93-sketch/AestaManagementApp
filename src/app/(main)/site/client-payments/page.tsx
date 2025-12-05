"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Tooltip,
  alpha,
} from "@mui/material";
import {
  Add,
  CloudUpload,
  ReceiptLong,
  AccessTime,
  Timeline,
} from "@mui/icons-material";
import { createBrowserClient } from "@supabase/ssr";
import PageHeader from "@/components/layout/PageHeader";
import { useSite } from "@/contexts/SiteContext";
import type { Database } from "@/types/database.types";
import type {
  ClientPaymentPlan,
  PaymentPhase,
  ClientPayment,
} from "@/types/database.types";
import SitePaymentPlanDrawer, {
  type SitePlanUpdatePayload,
} from "@/components/payments/SitePaymentPlanDrawer";

export default function ClientPaymentTracking() {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { selectedSite } = useSite();
  const selectedSiteId = selectedSite?.id;
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<ClientPaymentPlan | null>(
    null
  );
  const [paymentPhases, setPaymentPhases] = useState<PaymentPhase[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning" | "info",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedReceiptFile, setSelectedReceiptFile] = useState<File | null>(
    null
  );
  const [receiptDragActive, setReceiptDragActive] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [planDrawerOpen, setPlanDrawerOpen] = useState(false);
  const [planSource, setPlanSource] = useState<"site" | "client" | null>(null);
  const [siteContractValue, setSiteContractValue] = useState(0);

  // Dialog states
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const [planForm, setPlanForm] = useState({
    plan_name: "",
    total_contract_amount: 0,
    description: "",
    notes: "",
  });

  const [phaseForm, setPhaseForm] = useState({
    phase_name: "",
    percentage: 0,
    expected_date: "",
    sequence_order: 0,
    description: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    payment_mode: "bank_transfer" as any,
    amount: 0,
    transaction_reference: "",
    notes: "",
    receipt_url: "",
  });

  const formatFileSize = (size: number) => {
    if (!size) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(
      Math.floor(Math.log(size) / Math.log(1024)),
      units.length - 1
    );
    const value = size / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
  };

  // Fetch shared payment plan (site milestones first, fallback to client plan)
  const fetchPlanAndPhases = useCallback(async () => {
    if (!selectedSiteId) {
      setSelectedPlan(null);
      setPaymentPhases([]);
      setPlanSource(null);
      return;
    }

    try {
      const [siteRes, milestoneRes, clientPlanRes] = await Promise.all([
        supabase
          .from("sites")
          .select("name, project_contract_value")
          .eq("id", selectedSiteId)
          .maybeSingle(),
        supabase
          .from("site_payment_milestones")
          .select("*")
          .eq("site_id", selectedSiteId)
          .order("sequence_order", { ascending: true }),
        supabase
          .from("client_payment_plans")
          .select("*")
          .eq("site_id", selectedSiteId)
          .maybeSingle(),
      ]);

      if (siteRes.error) throw siteRes.error;
      if (milestoneRes.error && milestoneRes.error.code !== "PGRST116")
        throw milestoneRes.error;

      const siteMeta = siteRes.data as any;

      const normalizedMilestones = (milestoneRes.data || []).map(
        (m: any, idx: number) => ({
          id: m.id,
          payment_plan_id: `site-${selectedSiteId}`,
          phase_name: m.milestone_name,
          description: m.milestone_description,
          percentage: m.percentage,
          amount: m.amount,
          expected_date: m.expected_date,
          sequence_order: m.sequence_order || idx + 1,
          is_milestone: true,
          construction_phase_id: null,
          notes: m.notes,
          created_at: m.created_at,
          updated_at: m.updated_at,
        })
      ) as PaymentPhase[];

      if (normalizedMilestones.length > 0) {
        const contractValue =
          siteMeta?.project_contract_value ||
          normalizedMilestones.reduce(
            (sum, phase) => sum + (phase.amount || 0),
            0
          );

        setSelectedPlan({
          id: `site-${selectedSiteId}`,
          site_id: selectedSiteId,
          plan_name: siteMeta?.name
            ? `${siteMeta.name} Payment Plan`
            : "Site Payment Plan",
          total_contract_amount: contractValue,
          description: "Shared site payment milestones plan",
          notes: null,
          is_active: true,
          created_by: null,
          created_at: "",
          updated_at: "",
        } as ClientPaymentPlan);
        setPaymentPhases(normalizedMilestones);
        setPlanSource("site");
        setSiteContractValue(contractValue);
        return;
      }

      if (clientPlanRes.data) {
        const clientPlan = clientPlanRes.data as ClientPaymentPlan;
        setSelectedPlan(clientPlan);
        setPlanSource("client");
        setSiteContractValue(clientPlan.total_contract_amount);

        const { data: phases, error: phaseError } = await supabase
          .from("payment_phases")
          .select("*")
          .eq("payment_plan_id", clientPlan.id)
          .order("sequence_order");
        if (phaseError) throw phaseError;
        setPaymentPhases((phases || []) as PaymentPhase[]);
        return;
      }

      setSelectedPlan(null);
      setPaymentPhases([]);
      setPlanSource(null);
      setSiteContractValue(siteMeta?.project_contract_value || 0);
    } catch (err: any) {
      console.error("Error fetching plan:", err);
      setSelectedPlan(null);
      setPaymentPhases([]);
      setPlanSource(null);
      setSnackbar({
        open: true,
        message: `Failed to load payment plan: ${
          err.message || "Unknown error"
        }`,
        severity: "error",
      });
    }
  }, [selectedSiteId, supabase]);

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    if (!selectedSiteId) {
      setPayments([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("client_payments")
        .select("*")
        .eq("site_id", selectedSiteId)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: `Failed to load payments: ${err.message}`,
        severity: "error",
      });
    }
  }, [supabase, selectedSiteId]);

  // Initialize
  useEffect(() => {
    setLoading(true);
    fetchPlanAndPhases().finally(() => setLoading(false));
  }, [fetchPlanAndPhases]);

  useEffect(() => {
    fetchPayments();
  }, [selectedSiteId, fetchPayments]);

  // Save Payment Plan
  const handleSavePlan = async () => {
    if (
      !selectedSiteId ||
      !planForm.plan_name ||
      !planForm.total_contract_amount
    ) {
      setSnackbar({
        open: true,
        message: "Please fill all required fields",
        severity: "error",
      });
      return;
    }

    try {
      const { error } = await supabase.from("client_payment_plans").insert({
        site_id: selectedSiteId,
        plan_name: planForm.plan_name,
        total_contract_amount: planForm.total_contract_amount,
        description: planForm.description || null,
        notes: planForm.notes || null,
        is_active: true,
      } as any);

      if (error) throw error;
      setSnackbar({
        open: true,
        message: "Payment plan created successfully!",
        severity: "success",
      });

      setPlanDialogOpen(false);
      setPlanForm({
        plan_name: "",
        total_contract_amount: 0,
        description: "",
        notes: "",
      });
      fetchPlanAndPhases();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: `Error saving plan: ${err.message}`,
        severity: "error",
      });
    }
  };

  // Save Payment Phase
  const handleSavePhase = async () => {
    if (!selectedPlan || !phaseForm.phase_name || phaseForm.percentage <= 0) {
      setSnackbar({
        open: true,
        message: "Please fill all required fields",
        severity: "error",
      });
      return;
    }

    try {
      const amount =
        (selectedPlan.total_contract_amount * phaseForm.percentage) / 100;

      const { error } = await supabase.from("payment_phases").insert({
        payment_plan_id: selectedPlan.id,
        phase_name: phaseForm.phase_name,
        description: phaseForm.description || null,
        percentage: phaseForm.percentage,
        amount: amount,
        expected_date: phaseForm.expected_date || null,
        sequence_order: phaseForm.sequence_order,
        is_milestone: false,
      } as any);

      if (error) throw error;
      setSnackbar({
        open: true,
        message: "Payment phase created successfully!",
        severity: "success",
      });

      setPhaseDialogOpen(false);
      setPhaseForm({
        phase_name: "",
        percentage: 0,
        expected_date: "",
        sequence_order: 0,
        description: "",
      });
      fetchPlanAndPhases();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: `Error saving phase: ${err.message}`,
        severity: "error",
      });
    }
  };

  const validateReceiptFile = (file: File) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      return "Only PDF, PNG, or JPG files are allowed.";
    }
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      return "File size must be 15MB or less.";
    }
    return null;
  };

  // Upload receipt to storage (optional)
  const uploadReceipt = async (file: File) => {
    const validationError = validateReceiptFile(file);
    if (validationError) {
      setReceiptError(validationError);
      throw new Error(validationError);
    }

    setUploadingReceipt(true);
    setUploadProgress(10);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${
        selectedSiteId || "site"
      }_client_payment_${Date.now()}.${ext}`;
      const filePath = `${selectedSiteId || "site"}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("client-payment-receipts")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("client-payment-receipts")
        .getPublicUrl(filePath);

      setUploadProgress(100);
      setReceiptError(null);
      return publicUrl;
    } finally {
      setUploadingReceipt(false);
      setTimeout(() => setUploadProgress(0), 1200);
    }
  };

  // Record Payment
  const handleRecordPayment = async () => {
    if (!selectedSiteId || !paymentForm.amount || paymentForm.amount <= 0) {
      setSnackbar({
        open: true,
        message: "Please fill all required fields",
        severity: "error",
      });
      return;
    }

    try {
      let receiptUrl = paymentForm.receipt_url;
      const fileToUpload =
        selectedReceiptFile || fileInputRef.current?.files?.[0];
      if (fileToUpload) {
        receiptUrl = await uploadReceipt(fileToUpload);
      }

      const { error } = await supabase.from("client_payments").insert({
        site_id: selectedSiteId,
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        amount: paymentForm.amount,
        transaction_reference: paymentForm.transaction_reference || null,
        notes: paymentForm.notes || null,
        is_verified: true,
        receipt_url: receiptUrl || null,
      } as any);

      if (error) throw error;
      setSnackbar({
        open: true,
        message: "Payment recorded successfully!",
        severity: "success",
      });

      setPaymentDialogOpen(false);
      setPaymentForm({
        payment_date: new Date().toISOString().split("T")[0],
        payment_mode: "bank_transfer",
        amount: 0,
        transaction_reference: "",
        notes: "",
        receipt_url: "",
      });
      setSelectedReceiptFile(null);
      setReceiptError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchPayments();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: `Error recording payment: ${err.message}`,
        severity: "error",
      });
    }
  };

  // Calculate stats
  const planStats = useMemo(() => {
    const totalContract =
      selectedPlan?.total_contract_amount || siteContractValue;
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    if (!totalContract) {
      return {
        totalAmount: 0,
        totalPaid,
        balance: 0,
        percentage: 0,
        totalPayments: payments.length,
      };
    }

    const balance = totalContract - totalPaid;
    const percentage = Math.round((totalPaid / totalContract) * 100);

    return {
      totalAmount: totalContract,
      totalPaid,
      balance,
      percentage,
      totalPayments: payments.length,
    };
  }, [selectedPlan, payments, siteContractValue]);

  // Phase coverage calculation
  const phaseProgress = useMemo(() => {
    if (!selectedPlan || paymentPhases.length === 0)
      return [] as Array<{
        phase: PaymentPhase;
        cumulativeTarget: number;
        paidOn?: string;
        status: "pending" | "on_time" | "delayed" | "advance";
      }>;

    const sortedPhases = [...paymentPhases].sort(
      (a, b) => (a.sequence_order || 0) - (b.sequence_order || 0)
    );
    let cumulative = 0;
    const payEvents = [...payments].sort(
      (a, b) =>
        new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
    );
    let payCursor = 0;
    const runningPaid: Array<{ date: string; amount: number }> = payEvents.map(
      (p) => ({
        date: p.payment_date,
        amount: p.amount,
      })
    );

    return sortedPhases.map((phase) => {
      cumulative += phase.amount || 0;
      let paidOn: string | undefined;
      let paidSum = 0;
      for (; payCursor < runningPaid.length; payCursor++) {
        paidSum += runningPaid[payCursor].amount;
        if (paidSum >= cumulative) {
          paidOn = runningPaid[payCursor].date;
          break;
        }
      }

      let status: "pending" | "on_time" | "delayed" | "advance" = "pending";
      if (paidOn && phase.expected_date) {
        const payDate = new Date(paidOn);
        const expDate = new Date(phase.expected_date);
        if (payDate < expDate) status = "advance";
        else if (payDate.getTime() === expDate.getTime()) status = "on_time";
        else status = "delayed";
      } else if (paidOn) {
        status = "on_time";
      }

      return {
        phase,
        cumulativeTarget: cumulative,
        paidOn,
        status,
      };
    });
  }, [paymentPhases, payments, selectedPlan]);

  const findPhaseReachedByPayment = useCallback(
    (payment: ClientPayment) => {
      if (!selectedPlan || paymentPhases.length === 0) return null;
      const sortedPhases = [...paymentPhases].sort(
        (a, b) => (a.sequence_order || 0) - (b.sequence_order || 0)
      );
      const paymentsSorted = [...payments]
        .sort(
          (a, b) =>
            new Date(a.payment_date).getTime() -
            new Date(b.payment_date).getTime()
        )
        .filter(
          (p) =>
            new Date(p.payment_date).getTime() <=
            new Date(payment.payment_date).getTime()
        );
      const cumulativePaid = paymentsSorted.reduce(
        (sum, p) => sum + p.amount,
        0
      );
      let cumulativeTarget = 0;
      let reachedPhase: PaymentPhase | null = null;
      for (const phase of sortedPhases) {
        cumulativeTarget += phase.amount || 0;
        if (cumulativePaid >= cumulativeTarget) {
          reachedPhase = phase;
        } else {
          break;
        }
      }
      return reachedPhase;
    },
    [paymentPhases, payments, selectedPlan]
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Client Payment Tracking" />

      {planSource && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip
            size="small"
            color="info"
            label={
              planSource === "site"
                ? "Shared from site payment milestones"
                : "Client payment plan"
            }
          />
        </Stack>
      )}

      {/* Key stats */}
      {selectedPlan ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "1fr 1fr 1fr",
            },
            gap: 2,
            mb: 3,
          }}
        >
          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="caption">
                Total Contract
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                ₹{planStats.totalAmount.toLocaleString("en-IN")}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="caption">
                Paid
              </Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">
                ₹{planStats.totalPaid.toLocaleString("en-IN")}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" variant="caption">
                Balance
              </Typography>
              <Typography variant="h5" fontWeight={700} color="warning.main">
                ₹{planStats.balance.toLocaleString("en-IN")}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ gridColumn: { xs: "1 / -1" } }}>
            <CardContent>
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}
              >
                <Typography color="textSecondary" variant="caption">
                  Payment Progress
                </Typography>
                <Typography fontWeight={700}>
                  {planStats.percentage}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={planStats.percentage}
              />
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ mt: 1, display: "block" }}
              >
                {planStats.totalPayments} payments recorded
              </Typography>
            </CardContent>
          </Card>
        </Box>
      ) : (
        <Paper sx={{ p: 3, textAlign: "center", mb: 3 }}>
          <Typography color="textSecondary" gutterBottom>
            No payment plan exists for this site yet. Create one to track
            progress.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setPlanDrawerOpen(true)}
          >
            Create Payment Plan
          </Button>
        </Paper>
      )}

      {/* Phase progress timeline */}
      {selectedPlan && paymentPhases.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Phase Coverage
          </Typography>
          <Stack spacing={1.5}>
            {phaseProgress.map((item) => {
              const { phase, status, paidOn, cumulativeTarget } = item;
              const statusMap: Record<string, { label: string; color: any }> = {
                pending: { label: "Pending", color: "default" },
                on_time: { label: "On time", color: "success" },
                delayed: { label: "Delayed", color: "warning" },
                advance: { label: "Advance", color: "info" },
              };
              return (
                <Box
                  key={phase.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={700} noWrap>
                      {phase.phase_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Target: ₹{(phase.amount || 0).toLocaleString("en-IN")} (
                      {phase.percentage}%) • Cumulative: ₹
                      {(cumulativeTarget || 0).toLocaleString("en-IN")}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      color={statusMap[status].color}
                      label={statusMap[status].label}
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      icon={<AccessTime fontSize="small" />}
                      label={
                        paidOn
                          ? `Paid ${new Date(paidOn).toLocaleDateString()}`
                          : phase.expected_date
                          ? `Due ${new Date(
                              phase.expected_date
                            ).toLocaleDateString()}`
                          : "Not due"
                      }
                      variant="outlined"
                    />
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Paper>
      )}

      {/* Payment table */}
      <Paper sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Client Payments
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Log every received payment with mode, reference, and optional
              receipt.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Timeline />}
              onClick={() => setPlanDrawerOpen(true)}
            >
              {paymentPhases.length
                ? "Show Payment Plan"
                : "Create Payment Plan"}
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setPaymentDialogOpen(true)}
            >
              Add Payment
            </Button>
          </Stack>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell>Date</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Phase Reached</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <Typography color="textSecondary">
                      No payments recorded yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => {
                  const reachedPhase = findPhaseReachedByPayment(payment);
                  const statusChip = (() => {
                    if (!reachedPhase || !reachedPhase.expected_date)
                      return { label: "Recorded", color: "default" as const };
                    const payDate = new Date(payment.payment_date);
                    const expDate = new Date(reachedPhase.expected_date);
                    if (payDate < expDate)
                      return { label: "Advance", color: "info" as const };
                    if (payDate.getTime() === expDate.getTime())
                      return { label: "On time", color: "success" as const };
                    return { label: "Delayed", color: "warning" as const };
                  })();

                  return (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={payment.payment_mode}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700}>
                          ₹{payment.amount.toLocaleString("en-IN")}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {payment.transaction_reference || "-"}
                      </TableCell>
                      <TableCell>
                        {reachedPhase ? (
                          <Tooltip
                            title={`Covers up to ${
                              reachedPhase.phase_name
                            } • Target ₹${reachedPhase.amount.toLocaleString(
                              "en-IN"
                            )}`}
                          >
                            <Chip
                              label={reachedPhase.phase_name}
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          </Tooltip>
                        ) : (
                          <Chip
                            label="Not mapped"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusChip.label}
                          size="small"
                          color={statusChip.color}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {payment.receipt_url ? (
                          <Button
                            size="small"
                            startIcon={<ReceiptLong />}
                            onClick={() =>
                              window.open(payment.receipt_url!, "_blank")
                            }
                          >
                            View
                          </Button>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            None
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {selectedSiteId && (
        <SitePaymentPlanDrawer
          open={planDrawerOpen}
          onClose={() => setPlanDrawerOpen(false)}
          supabase={supabase}
          siteId={selectedSiteId}
          siteName={selectedSite?.name}
          onPlanUpdated={({
            planName,
            totalAmount,
            phases,
          }: SitePlanUpdatePayload) => {
            setSelectedPlan({
              id: `site-${selectedSiteId}`,
              site_id: selectedSiteId,
              plan_name: planName,
              total_contract_amount: totalAmount,
              description: "Shared site payment milestones plan",
              notes: null,
              is_active: true,
              created_by: null,
              created_at: "",
              updated_at: "",
            } as ClientPaymentPlan);
            setPaymentPhases(phases);
            setPlanSource("site");
            setSiteContractValue(totalAmount);
          }}
        />
      )}

      {/* Plan Dialog (kept minimal) */}
      <Dialog
        open={planDialogOpen}
        onClose={() => setPlanDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Payment Plan</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Plan Name"
              value={planForm.plan_name}
              onChange={(e) =>
                setPlanForm({ ...planForm, plan_name: e.target.value })
              }
            />
            <TextField
              fullWidth
              label="Total Contract Amount"
              type="number"
              value={planForm.total_contract_amount}
              onChange={(e) =>
                setPlanForm({
                  ...planForm,
                  total_contract_amount: parseFloat(e.target.value) || 0,
                })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePlan} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Phase Dialog */}
      <Dialog
        open={phaseDialogOpen}
        onClose={() => setPhaseDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Payment Phase</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Phase Name"
              value={phaseForm.phase_name}
              onChange={(e) =>
                setPhaseForm({ ...phaseForm, phase_name: e.target.value })
              }
            />
            <TextField
              fullWidth
              label="Percentage (%)"
              type="number"
              value={phaseForm.percentage}
              onChange={(e) =>
                setPhaseForm({
                  ...phaseForm,
                  percentage: parseFloat(e.target.value) || 0,
                })
              }
            />
            <Typography variant="caption" color="textSecondary">
              Amount: ₹
              {selectedPlan
                ? (
                    (selectedPlan.total_contract_amount *
                      phaseForm.percentage) /
                    100
                  ).toLocaleString("en-IN")
                : "0"}
            </Typography>
            <TextField
              fullWidth
              label="Expected Payment Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={phaseForm.expected_date}
              onChange={(e) =>
                setPhaseForm({ ...phaseForm, expected_date: e.target.value })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPhaseDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePhase} variant="contained">
            Add Phase
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => {
          setPaymentDialogOpen(false);
          setSelectedReceiptFile(null);
          setReceiptError(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Client Payment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Payment Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={paymentForm.payment_date}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, payment_date: e.target.value })
              }
            />
            <FormControl fullWidth>
              <InputLabel>Payment Mode</InputLabel>
              <Select
                value={paymentForm.payment_mode}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    payment_mode: e.target.value,
                  })
                }
                label="Payment Mode"
              >
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="upi">UPI</MenuItem>
                <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                <MenuItem value="cheque">Cheque</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={paymentForm.amount}
              onChange={(e) =>
                setPaymentForm({
                  ...paymentForm,
                  amount: parseFloat(e.target.value) || 0,
                })
              }
            />
            <TextField
              fullWidth
              label="Reference (optional)"
              value={paymentForm.transaction_reference}
              onChange={(e) =>
                setPaymentForm({
                  ...paymentForm,
                  transaction_reference: e.target.value,
                })
              }
            />
            <TextField
              fullWidth
              label="Notes (optional)"
              multiline
              minRows={2}
              value={paymentForm.notes}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, notes: e.target.value })
              }
            />
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const err = validateReceiptFile(file);
                  if (err) {
                    setReceiptError(err);
                    setSelectedReceiptFile(null);
                    return;
                  }
                  setReceiptError(null);
                  setSelectedReceiptFile(file);
                  setPaymentForm({ ...paymentForm, receipt_url: file.name });
                }}
              />

              <Paper
                elevation={0}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setReceiptDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setReceiptDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setReceiptDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  const err = validateReceiptFile(file);
                  if (err) {
                    setReceiptError(err);
                    setSelectedReceiptFile(null);
                    return;
                  }
                  setReceiptError(null);
                  setSelectedReceiptFile(file);
                  setPaymentForm({ ...paymentForm, receipt_url: file.name });
                }}
                sx={(theme) => ({
                  p: 2,
                  border: "2px dashed",
                  borderColor: receiptDragActive
                    ? "primary.main"
                    : selectedReceiptFile
                    ? "success.main"
                    : "divider",
                  borderRadius: 2,
                  bgcolor: receiptDragActive
                    ? alpha(theme.palette.primary.main, 0.08)
                    : selectedReceiptFile
                    ? alpha(theme.palette.success.main, 0.05)
                    : "background.default",
                  transition: "all 0.2s ease",
                })}
              >
                {uploadingReceipt ? (
                  <Stack alignItems="center" spacing={1}>
                    <CircularProgress
                      size={32}
                      variant={uploadProgress ? "determinate" : "indeterminate"}
                      value={uploadProgress || undefined}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Uploading... {uploadProgress ? `${uploadProgress}%` : ""}
                    </Typography>
                  </Stack>
                ) : selectedReceiptFile ? (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={(theme) => ({
                        p: 1.2,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.success.main, 0.12),
                        display: "inline-flex",
                      })}
                    >
                      <CloudUpload color="success" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        noWrap
                        title={selectedReceiptFile.name}
                      >
                        {selectedReceiptFile.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(selectedReceiptFile.size)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Replace
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedReceiptFile(null);
                          setPaymentForm({ ...paymentForm, receipt_url: "" });
                          setReceiptError(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Stack alignItems="center" spacing={1}>
                    <CloudUpload
                      sx={{
                        fontSize: 36,
                        color: receiptDragActive
                          ? "primary.main"
                          : "action.disabled",
                      }}
                    />
                    <Typography variant="body2" fontWeight={600} align="center">
                      {receiptDragActive
                        ? "Drop your receipt here"
                        : "Drag & drop receipt (PDF/PNG/JPG)"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      align="center"
                    >
                      or
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse files
                    </Button>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      align="center"
                    >
                      Max 15MB • PNG, JPG, PDF
                    </Typography>
                  </Stack>
                )}
              </Paper>
              {receiptError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {receiptError}
                </Alert>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPaymentDialogOpen(false);
              setSelectedReceiptFile(null);
              setReceiptError(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRecordPayment}
            variant="contained"
            disabled={uploadingReceipt}
          >
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity as any}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
