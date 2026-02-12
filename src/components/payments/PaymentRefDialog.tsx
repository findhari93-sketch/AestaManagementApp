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
} from "@mui/material";
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  AccountBalance as AccountIcon,
  Link as LinkIcon,
  Wallet as WalletIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { getPaymentByReference } from "@/lib/services/settlementService";
import dayjs from "dayjs";
import type { PaymentDetails, ContractPaymentType } from "@/types/payment.types";

interface PaymentRefDialogProps {
  open: boolean;
  paymentReference: string | null;
  onClose: () => void;
  onEdit?: (paymentDetails: PaymentDetails) => void;
  onDelete?: (paymentDetails: PaymentDetails) => void;
}

function getPaymentTypeLabel(type: ContractPaymentType): string {
  switch (type) {
    case "salary":
      return "Salary";
    case "advance":
      return "Advance";
    case "other":
      return "Other";
    default:
      return type;
  }
}

function getPaymentTypeColor(type: ContractPaymentType): "success" | "warning" | "default" {
  switch (type) {
    case "salary":
      return "success";
    case "advance":
      return "warning";
    case "other":
      return "default";
    default:
      return "default";
  }
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

function getPayerSourceLabel(source: string | null | undefined, customName?: string | null): string {
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

export default function PaymentRefDialog({
  open,
  paymentReference,
  onClose,
  onEdit,
  onDelete,
}: PaymentRefDialogProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!open || !paymentReference) {
        setDetails(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getPaymentByReference(supabase, paymentReference);
        if (data) {
          setDetails(data);
        } else {
          setError("Payment not found");
        }
      } catch (err: any) {
        console.error("Error fetching payment details:", err);
        setError(err.message || "Failed to load payment details");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [open, paymentReference, supabase]);

  const handleEdit = () => {
    if (details && onEdit) {
      onEdit(details);
    }
  };

  const handleDelete = () => {
    if (details && onDelete) {
      onDelete(details);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ReceiptIcon color="primary" />
            <Typography variant="h6" component="span">Payment Details</Typography>
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
            {/* Reference Code */}
            <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Payment Reference
              </Typography>
              <Typography variant="h6" fontFamily="monospace">
                {details.paymentReference}
              </Typography>
            </Box>

            {/* Amount and Type */}
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Amount
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  Rs.{details.amount.toLocaleString()}
                </Typography>
              </Box>
              <Chip
                label={getPaymentTypeLabel(details.paymentType)}
                color={getPaymentTypeColor(details.paymentType)}
                size="small"
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Details Grid */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {/* Laborer */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Laborer
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={500}>
                  {details.laborerName}
                </Typography>
                {details.laborerRole && (
                  <Typography variant="caption" color="text.secondary">
                    {details.laborerRole}
                  </Typography>
                )}
              </Box>

              {/* Payment Date */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Payment Date
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={500}>
                  {dayjs(details.actualPaymentDate).format("MMM D, YYYY")}
                </Typography>
              </Box>

              {/* Payment Mode */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                  <AccountIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Payment Mode
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={500}>
                  {getPaymentModeLabel(details.paymentMode)}
                </Typography>
              </Box>

              {/* Paid By */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Paid By
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {details.paidBy || "N/A"}
                </Typography>
              </Box>

              {/* Money Source */}
              {details.payerSource && (
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                    <WalletIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      Money Source
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={500}>
                    {getPayerSourceLabel(details.payerSource, details.payerName)}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Subcontract */}
            {details.subcontractTitle && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                  <LinkIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Linked Subcontract
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={500}>
                  {details.subcontractTitle}
                </Typography>
              </Box>
            )}

            {/* Weeks Covered (for salary payments) */}
            {details.paymentType === "salary" && details.weeksCovered.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Weeks Covered
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Week</TableCell>
                        <TableCell align="right">Amount Allocated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {details.weeksCovered.map((week, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {dayjs(week.weekStart).format("MMM D")} -{" "}
                            {dayjs(week.weekEnd).format("MMM D, YYYY")}
                          </TableCell>
                          <TableCell align="right">
                            Rs.{week.allocatedAmount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Payment Proof */}
            {details.proofUrl && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Payment Proof
                </Typography>
                <Box
                  component="img"
                  src={details.proofUrl}
                  alt="Payment proof"
                  sx={{
                    maxWidth: "100%",
                    maxHeight: 200,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
              </Box>
            )}

            {/* Notes */}
            {details.notes && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Notes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {details.notes}
                </Typography>
              </Box>
            )}

            {/* Settlement Reference */}
            {details.settlementReference && (
              <Box sx={{ mt: 3, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Settlement Reference
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {details.settlementReference}
                </Typography>
              </Box>
            )}

            {/* Created At */}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              Recorded: {dayjs(details.createdAt).format("MMM D, YYYY h:mm A")}
            </Typography>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Box>
          {onDelete && details && details.laborerId && (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
            >
              Cancel Payment
            </Button>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose}>Close</Button>
          {onEdit && details && details.laborerId && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={handleEdit}
            >
              Edit Payment
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
