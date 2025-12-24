"use client";

import React, { useEffect, useState } from "react";
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
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  Receipt as ReceiptIcon,
  SwapHoriz as SettlementIcon,
  ExpandMore as ExpandMoreIcon,
  People as PeopleIcon,
  AccountBalanceWallet as WalletIcon,
} from "@mui/icons-material";
import type { UnifiedSettlementRecord } from "@/types/wallet.types";
import { getPayerSourceLabel } from "@/components/settlement/PayerSourceSelector";
import type { PayerSource } from "@/types/settlement.types";
import { createClient } from "@/lib/supabase/client";
import dayjs from "dayjs";

interface LaborerBreakdown {
  laborer_id: string | null;
  laborer_name: string;
  amount: number;
  work_date: string;
  attendance_type: string;
}

interface BatchSource {
  batch_code: string;
  batch_transaction_id: string;
  amount_used: number;
  payer_source: string | null;
  payer_name: string | null;
  batch_date: string;
}

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
  const [laborers, setLaborers] = useState<LaborerBreakdown[]>([]);
  const [batchSources, setBatchSources] = useState<BatchSource[]>([]);
  const [loadingLaborers, setLoadingLaborers] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const supabase = createClient();

  // Fetch laborers and batch sources when dialog opens
  useEffect(() => {
    if (open && settlement && settlement.source === "settlement_group") {
      fetchLaborers();
      fetchBatchSources();
    } else {
      setLaborers([]);
      setBatchSources([]);
    }
  }, [open, settlement]);

  const fetchLaborers = async () => {
    if (!settlement) return;
    setLoadingLaborers(true);
    try {
      // Use any cast since the RPC function is defined in migration but not in generated types yet
      const { data, error } = await (supabase.rpc as any)("get_settlement_laborers", {
        p_settlement_group_id: settlement.id,
      });
      if (error) throw error;
      setLaborers((data as LaborerBreakdown[]) || []);
    } catch (err) {
      console.error("Error fetching laborers:", err);
      setLaborers([]);
    } finally {
      setLoadingLaborers(false);
    }
  };

  const fetchBatchSources = async () => {
    if (!settlement) return;
    setLoadingBatches(true);
    try {
      // Use any cast since the RPC function is defined in migration but not in generated types yet
      const { data, error } = await (supabase.rpc as any)("get_settlement_batch_sources", {
        p_settlement_group_id: settlement.id,
      });
      if (error) throw error;
      setBatchSources((data as BatchSource[]) || []);
    } catch (err) {
      console.error("Error fetching batch sources:", err);
      setBatchSources([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  if (!settlement) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <SettlementIcon color="primary" />
        Settlement Details
        {settlement.settlement_reference && (
          <Chip
            label={settlement.settlement_reference}
            size="small"
            color="info"
            sx={{ ml: 1, fontFamily: "monospace" }}
          />
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {/* Header info */}
          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Amount
            </Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">
              Rs.{settlement.total_amount.toLocaleString()}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Settlement Date
            </Typography>
            <Typography variant="body1">
              {dayjs(settlement.settlement_date).format("DD MMM YYYY")}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Laborers
            </Typography>
            <Typography variant="body1">{settlement.laborer_count || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
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

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 1 }} />
          </Grid>

          {/* Site and Engineer */}
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Site
            </Typography>
            <Typography variant="body1">{settlement.site_name || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Settled By
            </Typography>
            <Typography variant="body1">{settlement.engineer_name || "-"}</Typography>
          </Grid>

          {/* Payment details */}
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
                  label={settlement.payment_channel === "engineer_wallet" ? "Via Engineer Wallet" : "Direct"}
                  size="small"
                  color={settlement.payment_channel === "engineer_wallet" ? "warning" : "success"}
                  variant="outlined"
                />
              </Box>
            </Grid>
          )}

          {/* Batch Sources - Only for engineer_wallet settlements */}
          {settlement.payment_channel === "engineer_wallet" && settlement.source === "settlement_group" && (
            <Grid size={{ xs: 12 }}>
              <Accordion defaultExpanded={batchSources.length > 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <WalletIcon sx={{ mr: 1 }} color="primary" />
                  <Typography fontWeight={600}>
                    Wallet Batches Used {batchSources.length > 0 && `(${batchSources.length})`}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {loadingBatches ? (
                    <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : batchSources.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Batch Code</TableCell>
                            <TableCell>Source</TableCell>
                            <TableCell align="right">Amount Used</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {batchSources.map((batch, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <Chip
                                  label={batch.batch_code}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontFamily: "monospace" }}
                                />
                              </TableCell>
                              <TableCell>
                                {batch.payer_source
                                  ? getPayerSourceLabel(batch.payer_source as PayerSource)
                                  : "-"}
                                {batch.payer_name && ` (${batch.payer_name})`}
                              </TableCell>
                              <TableCell align="right">
                                Rs.{batch.amount_used.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                      No batch usage records found
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}

          {/* Laborers Breakdown */}
          {settlement.source === "settlement_group" && (
            <Grid size={{ xs: 12 }}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <PeopleIcon sx={{ mr: 1 }} color="primary" />
                  <Typography fontWeight={600}>
                    Laborers Paid {laborers.length > 0 && `(${laborers.length})`}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {loadingLaborers ? (
                    <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : laborers.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Work Date</TableCell>
                            <TableCell align="right">Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {laborers.map((laborer, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{laborer.laborer_name}</TableCell>
                              <TableCell>
                                <Chip
                                  label={laborer.attendance_type === "daily" ? "Daily" : "Market"}
                                  size="small"
                                  color={laborer.attendance_type === "daily" ? "primary" : "secondary"}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>{dayjs(laborer.work_date).format("DD MMM")}</TableCell>
                              <TableCell align="right">Rs.{laborer.amount.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                      No laborer records found
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}

          {/* Notes */}
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

          {/* Payment Proof */}
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

          {/* Created info */}
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

          {/* Cancelled warning */}
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
