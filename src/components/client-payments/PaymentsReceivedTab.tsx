"use client";

import React, { useState } from "react";
import {
  Box, Button, Chip, Paper, Stack, Typography,
  Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";
import { Add, Receipt } from "@mui/icons-material";
import type { Database } from "@/types/database.types";
import type { SiteAdditionalWork } from "@/types/site.types";
import { formatINR } from "@/components/payments/KpiTile";
import { formatDateDDMMMYY } from "@/lib/formatters";
import RecordPaymentDialog from "./RecordPaymentDialog";

type ClientPayment = Database["public"]["Tables"]["client_payments"]["Row"];
type PaymentPhase = Database["public"]["Tables"]["payment_phases"]["Row"];

export interface PaymentsReceivedTabProps {
  siteId: string;
  payments: ClientPayment[];
  phases: PaymentPhase[];
  additionalWorks: SiteAdditionalWork[];
}

function applyToLabel(
  payment: ClientPayment,
  phases: PaymentPhase[],
  works: SiteAdditionalWork[],
): { label: string; color: "default" | "info" | "primary" } {
  if (payment.tagged_additional_work_id) {
    const w = works.find((x) => x.id === payment.tagged_additional_work_id);
    return { label: w ? `Extra: ${w.title}` : "Extra (deleted)", color: "info" };
  }
  if (payment.payment_phase_id) {
    const p = phases.find((x) => x.id === payment.payment_phase_id);
    return { label: p ? `Phase: ${p.phase_name ?? `#${p.sequence_order}`}` : "Phase (deleted)", color: "primary" };
  }
  return { label: "General", color: "default" };
}

export function PaymentsReceivedTab({ siteId, payments, phases, additionalWorks }: PaymentsReceivedTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">Payments Received ({payments.length})</Typography>
        <Button startIcon={<Add />} onClick={() => setDialogOpen(true)} variant="contained" size="small">
          Record Payment
        </Button>
      </Stack>

      {payments.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          <Typography>No payments recorded yet.</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>Apply to</TableCell>
                <TableCell>Receipt</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments
                .slice()
                .sort((a, b) => (b.payment_date ?? "").localeCompare(a.payment_date ?? ""))
                .map((p) => {
                  const tag = applyToLabel(p, phases, additionalWorks);
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell>{formatDateDDMMMYY(p.payment_date)}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        {formatINR(Number(p.amount))}
                      </TableCell>
                      <TableCell><Chip size="small" label={p.payment_mode} /></TableCell>
                      <TableCell><Chip size="small" color={tag.color} label={tag.label} /></TableCell>
                      <TableCell>
                        {p.receipt_url ? (
                          <Button size="small" startIcon={<Receipt />} href={p.receipt_url} target="_blank" rel="noopener noreferrer">View</Button>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{p.notes ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </Paper>
      )}

      <RecordPaymentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        siteId={siteId}
        phases={phases}
        additionalWorks={additionalWorks}
      />
    </Stack>
  );
}

export default PaymentsReceivedTab;
