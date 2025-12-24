"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  Grid,
  Link,
} from "@mui/material";
import {
  ArrowDownward as ReceivedIcon,
  ArrowUpward as SpentIcon,
  Undo as ReturnIcon,
  AccountBalanceWallet as WalletIcon,
  Receipt as ReceiptIcon,
} from "@mui/icons-material";
import type { SiteEngineerTransactionType } from "@/types/database.types";
import dayjs from "dayjs";

interface TransactionWithDetails {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  site_id: string | null;
  description: string | null;
  recipient_type: string | null;
  payment_mode: string;
  proof_url: string | null;
  notes: string | null;
  is_settled: boolean | null;
  recorded_by: string | null;
  created_at: string | null;
  batch_code?: string | null;
  settlement_reference?: string | null;
  payer_source?: string | null;
  payer_name?: string | null;
  user_name?: string;
  site_name?: string;
}

interface TransactionDetailDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: TransactionWithDetails | null;
}

function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case "received_from_company":
      return "Received from Company";
    case "spent_on_behalf":
      return "Spent on Behalf";
    case "used_own_money":
      return "Used Own Money";
    case "returned_to_company":
      return "Returned to Company";
    default:
      return type;
  }
}

function getTransactionIcon(type: string) {
  switch (type) {
    case "received_from_company":
      return <ReceivedIcon color="success" />;
    case "spent_on_behalf":
      return <SpentIcon color="error" />;
    case "used_own_money":
      return <WalletIcon color="warning" />;
    case "returned_to_company":
      return <ReturnIcon color="info" />;
    default:
      return <WalletIcon />;
  }
}

export default function TransactionDetailDialog({
  open,
  onClose,
  transaction,
}: TransactionDetailDialogProps) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {getTransactionIcon(transaction.transaction_type)}
        Transaction Details
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Type
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={getTransactionTypeLabel(transaction.transaction_type)}
                size="small"
                color={
                  transaction.transaction_type === "received_from_company"
                    ? "success"
                    : transaction.transaction_type === "returned_to_company"
                    ? "info"
                    : "error"
                }
              />
            </Box>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Amount
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {transaction.transaction_type === "received_from_company" ? "+" : "-"}
              Rs.{transaction.amount.toLocaleString()}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Date
            </Typography>
            <Typography variant="body1">
              {dayjs(transaction.transaction_date).format("DD MMM YYYY")}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Engineer
            </Typography>
            <Typography variant="body1">{transaction.user_name || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Site
            </Typography>
            <Typography variant="body1">{transaction.site_name || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Payment Mode
            </Typography>
            <Typography variant="body1" sx={{ textTransform: "capitalize" }}>
              {transaction.payment_mode}
            </Typography>
          </Grid>

          {transaction.batch_code && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Batch Code
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={transaction.batch_code}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: "monospace" }}
                />
              </Box>
            </Grid>
          )}

          {transaction.settlement_reference && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Settlement Reference
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={transaction.settlement_reference}
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ fontFamily: "monospace" }}
                />
              </Box>
            </Grid>
          )}

          {transaction.payer_source && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Payer Source
              </Typography>
              <Typography variant="body1" sx={{ textTransform: "capitalize" }}>
                {transaction.payer_source.replace(/_/g, " ")}
                {transaction.payer_name ? ` (${transaction.payer_name})` : ""}
              </Typography>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 1 }} />
          </Grid>

          {transaction.description && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">{transaction.description}</Typography>
            </Grid>
          )}

          {transaction.notes && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                Notes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {transaction.notes}
              </Typography>
            </Grid>
          )}

          {transaction.proof_url && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                Payment Proof
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Link href={transaction.proof_url} target="_blank" rel="noopener">
                  <Button size="small" startIcon={<ReceiptIcon />} variant="outlined">
                    View Proof
                  </Button>
                </Link>
              </Box>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 1 }} />
          </Grid>

          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Recorded By
            </Typography>
            <Typography variant="body2">{transaction.recorded_by || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Created At
            </Typography>
            <Typography variant="body2">
              {transaction.created_at ? dayjs(transaction.created_at).format("DD MMM YYYY HH:mm") : "-"}
            </Typography>
          </Grid>

          {transaction.transaction_type === "used_own_money" && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                Reimbursement Status
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={transaction.is_settled ? "Settled" : "Pending"}
                  size="small"
                  color={transaction.is_settled ? "success" : "warning"}
                />
              </Box>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
