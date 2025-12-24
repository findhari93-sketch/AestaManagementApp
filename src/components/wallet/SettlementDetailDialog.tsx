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
  Alert,
} from "@mui/material";
import {
  Receipt as ReceiptIcon,
  SwapHoriz as SettlementIcon,
  Payment as PaymentIcon,
} from "@mui/icons-material";
import type { UnifiedSettlementRecord } from "@/types/wallet.types";
import { getPayerSourceLabel } from "@/components/settlement/PayerSourceSelector";
import dayjs from "dayjs";

interface SettlementDetailDialogProps {
  open: boolean;
  onClose: () => void;
  settlement: UnifiedSettlementRecord | null;
}

export default function SettlementDetailDialog({
  open,
  onClose,
  settlement,
}: SettlementDetailDialogProps) {
  if (!settlement) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <SettlementIcon color="primary" />
        Settlement Details
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Source
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={settlement.source === "legacy" ? "Legacy" : "Settlement Group"}
                size="small"
                color={settlement.source === "legacy" ? "default" : "primary"}
                variant="outlined"
              />
            </Box>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Amount
            </Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">
              Rs.{settlement.total_amount.toLocaleString()}
            </Typography>
          </Grid>

          {settlement.settlement_reference && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                Reference Code
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={settlement.settlement_reference}
                  size="small"
                  color="info"
                  sx={{ fontFamily: "monospace" }}
                />
              </Box>
            </Grid>
          )}

          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Settlement Date
            </Typography>
            <Typography variant="body1">
              {dayjs(settlement.settlement_date).format("DD MMM YYYY")}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Laborers
            </Typography>
            <Typography variant="body1">{settlement.laborer_count || "-"}</Typography>
          </Grid>

          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Site
            </Typography>
            <Typography variant="body1">{settlement.site_name || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Engineer
            </Typography>
            <Typography variant="body1">{settlement.engineer_name || "-"}</Typography>
          </Grid>

          {settlement.payment_mode && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Payment Mode
              </Typography>
              <Typography variant="body1" sx={{ textTransform: "capitalize" }}>
                {settlement.payment_mode}
              </Typography>
            </Grid>
          )}

          {settlement.payer_source && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Payer Source
              </Typography>
              <Typography variant="body1">
                {getPayerSourceLabel(settlement.payer_source)}
                {settlement.payer_name ? ` (${settlement.payer_name})` : ""}
              </Typography>
            </Grid>
          )}

          {settlement.payment_channel && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Payment Channel
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={settlement.payment_channel === "engineer_wallet" ? "Via Engineer" : "Direct"}
                  size="small"
                  color={settlement.payment_channel === "engineer_wallet" ? "warning" : "success"}
                  variant="outlined"
                />
              </Box>
            </Grid>
          )}

          {/* Legacy-specific: settlement type */}
          {settlement.settlement_type && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Settlement Type
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={
                    settlement.settlement_type === "company_to_engineer"
                      ? "Company → Engineer"
                      : "Engineer → Company"
                  }
                  size="small"
                  color={settlement.settlement_type === "company_to_engineer" ? "success" : "info"}
                />
              </Box>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 1 }} />
          </Grid>

          {settlement.notes && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                Notes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {settlement.notes}
              </Typography>
            </Grid>
          )}

          {settlement.proof_url && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                Payment Proof
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Link href={settlement.proof_url} target="_blank" rel="noopener">
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
              Created By
            </Typography>
            <Typography variant="body2">{settlement.created_by_name || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Created At
            </Typography>
            <Typography variant="body2">
              {dayjs(settlement.created_at).format("DD MMM YYYY HH:mm")}
            </Typography>
          </Grid>

          {settlement.is_cancelled && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="error">
                <Typography variant="body2" fontWeight={600}>
                  This settlement has been cancelled
                </Typography>
                {settlement.cancellation_reason && (
                  <Typography variant="body2">
                    Reason: {settlement.cancellation_reason}
                  </Typography>
                )}
              </Alert>
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
