"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, MenuItem, Alert,
} from "@mui/material";
import type { Database } from "@/types/database.types";
import type { SiteAdditionalWork } from "@/types/site.types";
import { useCreateClientPayment } from "@/hooks/queries/useClientPayments";

type PaymentMode = "cash" | "upi" | "bank_transfer" | "cheque";
type PaymentPhase = Database["public"]["Tables"]["payment_phases"]["Row"];

export interface RecordPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  phases: PaymentPhase[];
  additionalWorks: SiteAdditionalWork[];
}

type ApplyToOption = { value: string; label: string };

export function RecordPaymentDialog({
  open, onClose, siteId, phases, additionalWorks,
}: RecordPaymentDialogProps) {
  const create = useCreateClientPayment();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [applyTo, setApplyTo] = useState<string>("general");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMode("cash");
    setApplyTo("general");
    setNotes("");
    setError(null);
  }, [open]);

  const applyOptions: ApplyToOption[] = [
    { value: "general", label: "General (untagged)" },
    ...phases.map((p) => ({
      value: `phase:${p.id}`,
      label: `Base Phase: ${p.phase_name ?? `#${p.sequence_order}`}`,
    })),
    ...additionalWorks
      .filter((w) => w.status !== "cancelled")
      .map((w) => ({ value: `work:${w.id}`, label: `Extra: ${w.title}` })),
  ];

  async function handleSave() {
    setError(null);
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    const paymentPhaseId = applyTo.startsWith("phase:") ? applyTo.slice("phase:".length) : null;
    const taggedAdditionalWorkId = applyTo.startsWith("work:") ? applyTo.slice("work:".length) : null;

    try {
      await create.mutateAsync({
        siteId,
        amount: amountNum,
        paymentDate,
        paymentMode: mode,
        notes: notes || null,
        paymentPhaseId,
        taggedAdditionalWorkId,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record Client Payment</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} fullWidth required inputProps={{ min: 0, step: "0.01" }} />
            <TextField label="Payment date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
          <TextField select label="Mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} fullWidth>
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="upi">UPI</MenuItem>
            <MenuItem value="bank_transfer">Bank transfer</MenuItem>
            <MenuItem value="cheque">Cheque</MenuItem>
          </TextField>
          <TextField select label="Apply to" value={applyTo} onChange={(e) => setApplyTo(e.target.value)} fullWidth helperText="Defaults to general — only tag if it matters">
            {applyOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={create.isPending}>
          Record payment
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RecordPaymentDialog;
