"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Paper,
  Divider,
  alpha,
  Collapse,
  Grid,
} from "@mui/material";
import {
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  AccountBalance as AccountIcon,
  Wallet as WalletIcon,
  Groups as GroupsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import dayjs from "dayjs";

interface LaborerPayment {
  laborerId: string;
  laborerName: string;
  laborerRole: string | null;
  amount: number;
  paymentReference: string | null;
  paymentType: string;
}

interface SettlementDetails {
  settlementGroupId: string;
  settlementReference: string;
  settlementDate: string;
  totalAmount: number;
  laborerCount: number;
  paymentChannel: string;
  paymentMode: string | null;
  payerSource: string | null;
  payerName: string | null;
  proofUrls: string[];
  notes: string | null;
  subcontractId: string | null;
  subcontractTitle: string | null;
  createdByName: string | null;
  createdAt: string;
  isCancelled: boolean;
  laborers: LaborerPayment[];
}

interface SettlementRefDetailDialogProps {
  open: boolean;
  settlementReference: string | null;
  onClose: () => void;
  onEdit?: (details: SettlementDetails) => void;
  onDelete?: (details: SettlementDetails) => void;
  canEdit?: boolean;
  contractOnly?: boolean; // Filter to show only contract laborers
}

function getPaymentModeLabel(mode: string | null | undefined): string {
  if (!mode) return "N/A";
  switch (mode) {
    case "upi":
      return "UPI";
    case "cash":
      return "Cash";
    case "net_banking":
      return "Net Banking";
    case "company_direct_online":
      return "Direct (Online)";
    case "via_site_engineer":
      return "Via Engineer";
    default:
      return mode;
  }
}

function getPayerSourceLabel(
  source: string | null | undefined,
  customName?: string | null
): string {
  if (!source) return "N/A";
  switch (source) {
    case "own_money":
      return "Own Money";
    case "amma_money":
    case "mothers_money":
      return "Amma Money";
    case "client_money":
      return "Client Money";
    case "trust_account":
      return "Trust Account";
    case "other_site_money":
      return customName || "Other Site Money";
    case "custom":
      return customName || "Custom";
    default:
      return source;
  }
}

function getPaymentChannelLabel(channel: string): string {
  switch (channel) {
    case "direct":
      return "Direct Payment";
    case "engineer_wallet":
      return "Via Engineer Wallet";
    default:
      return channel;
  }
}

async function getSettlementDetailsByReference(
  supabase: any,
  reference: string,
  contractOnly: boolean = false
): Promise<SettlementDetails | null> {
  try {
    // Query settlement_groups
    const { data: sg, error: sgError } = await supabase
      .from("settlement_groups")
      .select(
        `
        id,
        settlement_reference,
        settlement_date,
        total_amount,
        laborer_count,
        payment_channel,
        payment_mode,
        payer_source,
        payer_name,
        proof_url,
        notes,
        subcontract_id,
        is_cancelled,
        created_at,
        created_by_name,
        subcontracts(title)
      `
      )
      .eq("settlement_reference", reference)
      .single();

    if (sgError || !sg) {
      console.error("Settlement group not found:", sgError);
      return null;
    }

    // Query labor_payments linked to this settlement
    // If contractOnly, filter to only contract laborers (consistent with History dialog)
    let paymentsQuery = supabase
      .from("labor_payments")
      .select(
        `
        id,
        laborer_id,
        amount,
        payment_reference,
        payment_type,
        is_under_contract,
        laborers(name, labor_roles(name))
      `
      )
      .eq("settlement_group_id", sg.id);

    if (contractOnly) {
      paymentsQuery = paymentsQuery.eq("is_under_contract", true);
    }

    const { data: payments, error: paymentsError } = await paymentsQuery
      .order("amount", { ascending: false });

    const laborers: LaborerPayment[] = (payments || []).map((p: any) => ({
      laborerId: p.laborer_id,
      laborerName: p.laborers?.name || "Unknown",
      laborerRole: p.laborers?.labor_roles?.name || null,
      amount: p.amount,
      paymentReference: p.payment_reference,
      paymentType: p.payment_type || "salary",
    }));

    // Calculate total from laborers (more accurate than settlement_groups.total_amount)
    const calculatedTotal = laborers.reduce((sum, l) => sum + l.amount, 0);

    // Collect proof URLs
    const proofUrls: string[] = [];
    if (sg.proof_url) {
      // Could be a single URL or JSON array
      try {
        const parsed = JSON.parse(sg.proof_url);
        if (Array.isArray(parsed)) {
          proofUrls.push(...parsed);
        } else {
          proofUrls.push(sg.proof_url);
        }
      } catch {
        proofUrls.push(sg.proof_url);
      }
    }

    return {
      settlementGroupId: sg.id,
      settlementReference: sg.settlement_reference,
      settlementDate: sg.settlement_date,
      // Use calculated total from actual payments (not settlement_groups.total_amount which may include non-contract laborers)
      totalAmount: calculatedTotal || sg.total_amount,
      laborerCount: laborers.length,
      paymentChannel: sg.payment_channel,
      paymentMode: sg.payment_mode,
      payerSource: sg.payer_source,
      payerName: sg.payer_name,
      proofUrls,
      notes: sg.notes,
      subcontractId: sg.subcontract_id,
      subcontractTitle: (sg as any).subcontracts?.title || null,
      createdByName: sg.created_by_name,
      createdAt: sg.created_at,
      isCancelled: sg.is_cancelled,
      laborers,
    };
  } catch (err: any) {
    console.error("Error fetching settlement details:", err);
    return null;
  }
}

export default function SettlementRefDetailDialog({
  open,
  settlementReference,
  onClose,
  onEdit,
  onDelete,
  canEdit = false,
  contractOnly = false,
}: SettlementRefDetailDialogProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<SettlementDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [laborersExpanded, setLaborersExpanded] = useState(true);
  const [proofsExpanded, setProofsExpanded] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!open || !settlementReference) {
        setDetails(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getSettlementDetailsByReference(
          supabase,
          settlementReference,
          contractOnly
        );
        if (data) {
          setDetails(data);
        } else {
          setError("Settlement not found");
        }
      } catch (err: any) {
        console.error("Error fetching settlement details:", err);
        setError(err.message || "Failed to load settlement details");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [open, settlementReference, supabase, contractOnly]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ReceiptIcon color="primary" />
            <Typography variant="h6">Settlement Details</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ py: 2 }}>
            {error}
          </Typography>
        ) : details ? (
          <Box>
            {/* Reference Code & Status */}
            <Box
              sx={{
                mb: 3,
                p: 2,
                bgcolor: details.isCancelled
                  ? alpha("#f44336", 0.1)
                  : "action.hover",
                borderRadius: 1,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Settlement Reference
                </Typography>
                <Typography variant="h6" fontFamily="monospace">
                  {details.settlementReference}
                </Typography>
              </Box>
              {details.isCancelled && (
                <Chip label="Cancelled" color="error" size="small" />
              )}
            </Box>

            {/* Amount and Summary */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Total Amount
                </Typography>
                <Typography variant="h5" fontWeight={600} color="success.main">
                  Rs.{details.totalAmount.toLocaleString()}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <GroupsIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Laborers
                  </Typography>
                </Box>
                <Typography variant="h6">
                  {details.laborerCount || details.laborers.length}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Settlement Date
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={500}>
                  {dayjs(details.settlementDate).format("MMM D, YYYY")}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <AccountIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Payment Mode
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={500}>
                  {getPaymentModeLabel(details.paymentMode)}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Payment Details */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  Payment Channel
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {getPaymentChannelLabel(details.paymentChannel)}
                </Typography>
              </Grid>
              {details.payerSource && (
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <WalletIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      Money Source
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={500}>
                    {getPayerSourceLabel(details.payerSource, details.payerName)}
                  </Typography>
                </Grid>
              )}
              {details.subcontractTitle && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <LinkIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      Linked Subcontract
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={500}>
                    {details.subcontractTitle}
                  </Typography>
                </Grid>
              )}
            </Grid>

            {/* Laborers Section */}
            {details.laborers.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    py: 1,
                  }}
                  onClick={() => setLaborersExpanded(!laborersExpanded)}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PersonIcon color="action" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Laborers ({details.laborers.length})
                    </Typography>
                  </Box>
                  {laborersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>
                <Collapse in={laborersExpanded}>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ mt: 1 }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Payment Ref</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {details.laborers.map((laborer, idx) => (
                          <TableRow key={laborer.laborerId + idx}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>
                                {laborer.laborerName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {laborer.laborerRole || "-"}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500}>
                                Rs.{laborer.amount.toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {laborer.paymentReference ? (
                                <Chip
                                  label={laborer.paymentReference}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.7rem",
                                  }}
                                />
                              ) : (
                                "-"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Box>
            )}

            {/* No Laborers Message (for daily/market settlements) */}
            {details.laborers.length === 0 && (
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  textAlign: "center",
                }}
              >
                <GroupsIcon color="action" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  This is a bulk settlement for {details.laborerCount} laborers.
                  <br />
                  Individual payment records are linked to attendance records.
                </Typography>
              </Box>
            )}

            {/* Payment Proofs */}
            {details.proofUrls.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    py: 1,
                  }}
                  onClick={() => setProofsExpanded(!proofsExpanded)}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ImageIcon color="action" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Payment Proofs ({details.proofUrls.length})
                    </Typography>
                  </Box>
                  {proofsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>
                <Collapse in={proofsExpanded}>
                  <Box
                    sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 }}
                  >
                    {details.proofUrls.map((url, idx) => (
                      <Box
                        key={idx}
                        component="a"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: "block",
                          borderRadius: 1,
                          overflow: "hidden",
                          border: "1px solid",
                          borderColor: "divider",
                          "&:hover": {
                            borderColor: "primary.main",
                          },
                        }}
                      >
                        <Box
                          component="img"
                          src={url}
                          alt={`Proof ${idx + 1}`}
                          sx={{
                            width: 150,
                            height: 100,
                            objectFit: "cover",
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )}

            {/* Notes */}
            {details.notes && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Notes
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    p: 1.5,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {details.notes}
                </Typography>
              </Box>
            )}

            {/* Footer Info */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                pt: 2,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Recorded by: {details.createdByName || "Unknown"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {dayjs(details.createdAt).format("MMM D, YYYY h:mm A")}
              </Typography>
            </Box>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: canEdit && details && !details.isCancelled ? "space-between" : "flex-end" }}>
        {canEdit && details && !details.isCancelled && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              color="primary"
              startIcon={<EditIcon />}
              onClick={() => {
                onEdit?.(details);
                onClose();
              }}
            >
              Edit
            </Button>
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                onDelete?.(details);
                onClose();
              }}
            >
              Delete
            </Button>
          </Box>
        )}
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
