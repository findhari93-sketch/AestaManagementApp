"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Today as TodayIcon,
} from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createClient } from "@/lib/supabase/client";
import { weekStartOf, weekEndOf } from "@/lib/utils/weekUtils";
import { useContractHeadcount } from "@/hooks/queries/useContractHeadcount";
import type {
  ContractPaymentType,
  PaymentChannel,
  PaymentMode,
} from "@/hooks/queries/useContractPayments";

interface WeeklyHeadcountSettleDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  siteId: string;
  contractId: string;
  contractTitle: string;
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

interface DayBreakdown {
  date: string;
  perRole: Array<{
    roleId: string;
    roleName: string;
    units: number;
    rate: number;
    subtotal: number;
  }>;
  dailyTotal: number;
}

/**
 * Settle a headcount-mode contract for one Sun-Sat week:
 *  - shows the per-day per-role breakdown of headcount × rates for the week
 *  - proposed amount = sum of implied labor value across the 7 days
 *  - confirm → INSERT subcontract_payments row of type weekly_advance
 *    with period_from_date / period_to_date set to the week boundaries
 *
 * Engineer can override the amount before confirming (e.g. round it,
 * deduct any pre-paid daily money). Note field captures the rationale.
 */
export function WeeklyHeadcountSettleDialog({
  open,
  onClose,
  onSaved,
  siteId,
  contractId,
  contractTitle,
}: WeeklyHeadcountSettleDialogProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Anchor day for the week — defaults to today; arrows shift by 7 days.
  const [anchor, setAnchor] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const weekStart = weekStartOf(anchor);
  const weekEnd = weekEndOf(anchor);
  const weekStartStr = weekStart.format("YYYY-MM-DD");
  const weekEndStr = weekEnd.format("YYYY-MM-DD");

  const [amountOverride, setAmountOverride] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [paymentChannel, setPaymentChannel] =
    useState<PaymentChannel>("via_site_engineer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useContractHeadcount(open ? contractId : undefined);

  useEffect(() => {
    if (!open) return;
    setAnchor(dayjs().format("YYYY-MM-DD"));
    setAmountOverride("");
    setPaymentMode("cash");
    setPaymentChannel("via_site_engineer");
    setReference("");
    setNote("");
    setError(null);
  }, [open, contractId]);

  const { breakdown, weekTotal } = useMemo(() => {
    if (!data) return { breakdown: [] as DayBreakdown[], weekTotal: 0 };
    const rateById = new Map(
      data.rates.map((r) => [r.roleId, { name: r.roleName, rate: r.dailyRate }])
    );
    // Group entries by date, only those within [weekStartStr, weekEndStr]
    const byDate = new Map<
      string,
      Array<{ roleId: string; units: number }>
    >();
    for (const entry of data.recent) {
      if (entry.attendanceDate < weekStartStr || entry.attendanceDate > weekEndStr) {
        continue;
      }
      const arr = byDate.get(entry.attendanceDate) ?? [];
      arr.push({ roleId: entry.roleId, units: entry.units });
      byDate.set(entry.attendanceDate, arr);
    }
    const days: DayBreakdown[] = [];
    let total = 0;
    // Build a row for each of the 7 calendar days even if empty — this makes
    // it obvious to the engineer which days had no headcount entered.
    for (let i = 0; i < 7; i++) {
      const day = weekStart.add(i, "day").format("YYYY-MM-DD");
      const entries = byDate.get(day) ?? [];
      const perRole = entries.map((e) => {
        const meta = rateById.get(e.roleId);
        const rate = meta?.rate ?? 0;
        const subtotal = e.units * rate;
        total += subtotal;
        return {
          roleId: e.roleId,
          roleName: meta?.name ?? "Unknown role",
          units: e.units,
          rate,
          subtotal,
        };
      });
      const dailyTotal = perRole.reduce((s, r) => s + r.subtotal, 0);
      days.push({ date: day, perRole, dailyTotal });
    }
    return { breakdown: days, weekTotal: total };
  }, [data, weekStart, weekStartStr, weekEndStr]);

  const proposedAmount = weekTotal;
  const overrideNum = Number(amountOverride || "0");
  const finalAmount =
    amountOverride !== "" && !Number.isNaN(overrideNum) && overrideNum > 0
      ? overrideNum
      : proposedAmount;

  const canSubmit =
    !submitting && finalAmount > 0 && !Number.isNaN(finalAmount);

  const handleShiftWeek = (deltaDays: number) => {
    setAnchor((cur) => dayjs(cur).add(deltaDays, "day").format("YYYY-MM-DD"));
  };

  const handleThisWeek = () => {
    setAnchor(dayjs().format("YYYY-MM-DD"));
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const sb = supabase as any;
      const insertRes = await sb
        .from("subcontract_payments")
        .insert({
          contract_id: contractId,
          amount: finalAmount,
          payment_date: weekEndStr,
          payment_type: "weekly_advance" as ContractPaymentType,
          payment_mode: paymentMode,
          payment_channel: paymentChannel,
          reference_number: reference.trim() || null,
          comments:
            note.trim() ||
            `Weekly settlement ${weekStartStr} to ${weekEndStr} based on headcount × rates (₹${formatINR(proposedAmount)} computed${
              finalAmount !== proposedAmount
                ? `, paid ₹${formatINR(finalAmount)}`
                : ""
            })`,
          period_from_date: weekStartStr,
          period_to_date: weekEndStr,
          is_deleted: false,
        })
        .select("id")
        .single();
      if (insertRes.error) throw insertRes.error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contract-payments", contractId] }),
        queryClient.invalidateQueries({
          queryKey: ["trade-reconciliations", "site", siteId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["trade-activity", "site", siteId],
        }),
      ]);
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("subcontracts-changed");
        bc.postMessage({ siteId, contractId, kind: "weekly_settle", at: Date.now() });
        bc.close();
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentWeek =
    weekStartStr === weekStartOf(dayjs()).format("YYYY-MM-DD");

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>
        Settle for the week
        <Typography variant="caption" color="text.secondary" component="div">
          {contractTitle}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {/* Week selector */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Tooltip title="Previous week">
                <IconButton size="small" onClick={() => handleShiftWeek(-7)}>
                  <PrevIcon />
                </IconButton>
              </Tooltip>
              <Typography variant="subtitle2">
                {weekStart.format("D MMM")} — {weekEnd.format("D MMM YYYY")}
                {isCurrentWeek && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="primary.main"
                    sx={{ ml: 1 }}
                  >
                    · this week
                  </Typography>
                )}
              </Typography>
              <Tooltip title="Next week">
                <IconButton size="small" onClick={() => handleShiftWeek(7)}>
                  <NextIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            {!isCurrentWeek && (
              <Button
                size="small"
                startIcon={<TodayIcon />}
                onClick={handleThisWeek}
              >
                This week
              </Button>
            )}
          </Stack>

          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : data && data.rates.length === 0 ? (
            <Alert severity="info">
              No role rate card set for this contract. Open the contract in the
              Subcontracts page to configure roles, then come back to settle.
            </Alert>
          ) : (
            <>
              {/* Per-day breakdown */}
              <Paper variant="outlined" sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Roles &amp; units</TableCell>
                      <TableCell align="right">Day total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {breakdown.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>
                          <Typography variant="body2">
                            {dayjs(day.date).format("ddd D")}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {day.perRole.length === 0 ? (
                            <Typography variant="caption" color="text.secondary">
                              —
                            </Typography>
                          ) : (
                            <Stack direction="row" flexWrap="wrap" gap={1}>
                              {day.perRole.map((r) => (
                                <Typography
                                  key={r.roleId}
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {r.roleName} × {r.units} (₹{formatINR(r.rate)})
                                </Typography>
                              ))}
                            </Stack>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={day.dailyTotal > 0 ? "text.primary" : "text.secondary"}
                          >
                            {day.dailyTotal > 0 ? `₹${formatINR(day.dailyTotal)}` : "—"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ "& td": { borderBottom: "none", fontWeight: 600 } }}>
                      <TableCell colSpan={2}>Week total (computed)</TableCell>
                      <TableCell align="right">
                        ₹{formatINR(proposedAmount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              <Divider />

              {/* Override + payment metadata */}
              <Stack spacing={1.5}>
                <TextField
                  label={`Amount to pay (default = ₹${formatINR(proposedAmount)})`}
                  value={amountOverride}
                  onChange={(e) =>
                    setAmountOverride(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  size="small"
                  placeholder={String(proposedAmount)}
                  helperText={
                    amountOverride === ""
                      ? "Leave blank to settle the computed amount"
                      : finalAmount !== proposedAmount
                      ? `Will pay ₹${formatINR(finalAmount)} (${
                          finalAmount > proposedAmount ? "+" : ""
                        }${formatINR(finalAmount - proposedAmount)} vs computed)`
                      : "Matches computed amount"
                  }
                />

                <Box>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Payment mode
                  </Typography>
                  <ToggleButtonGroup
                    value={paymentMode}
                    exclusive
                    onChange={(_, v) => v && setPaymentMode(v)}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="cash">Cash</ToggleButton>
                    <ToggleButton value="upi">UPI</ToggleButton>
                    <ToggleButton value="bank_transfer">Transfer</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Paid via
                  </Typography>
                  <ToggleButtonGroup
                    value={paymentChannel}
                    exclusive
                    onChange={(_, v) => v && setPaymentChannel(v)}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="via_site_engineer">Site engineer</ToggleButton>
                    <ToggleButton value="mesthri_at_office">Office cash</ToggleButton>
                    <ToggleButton value="company_direct_online">Company online</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <TextField
                  label="Reference (optional)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  size="small"
                  placeholder="e.g. UPI txn id"
                />

                <TextField
                  label="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  size="small"
                  multiline
                  minRows={2}
                />
              </Stack>
            </>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
          startIcon={submitting ? <CircularProgress size={14} /> : null}
        >
          {submitting
            ? "Settling…"
            : `Settle ₹${formatINR(finalAmount)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

