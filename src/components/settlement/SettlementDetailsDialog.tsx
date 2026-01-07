"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
  Paper,
  alpha,
  TextField,
} from "@mui/material";
import {
  Close as CloseIcon,
  CheckCircle,
  Cancel,
  AccountBalanceWallet,
  CurrencyRupee,
  Person,
  CalendarToday,
  Image as ImageIcon,
  Notes,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTransactionWithLaborers,
  confirmSettlement,
  disputeSettlement,
  TransactionWithLaborers,
} from "@/lib/services/notificationService";
import dayjs from "dayjs";

interface SettlementDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  onSuccess?: () => void;
}

export default function SettlementDetailsDialog({
  open,
  onClose,
  transactionId,
  onSuccess,
}: SettlementDetailsDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { userProfile } = useAuth();
  const [supabase] = useState(() => createClient());

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] =
    useState<TransactionWithLaborers | null>(null);

  // Dispute state
  const [showDispute, setShowDispute] = useState(false);
  const [disputeNotes, setDisputeNotes] = useState("");

  // Fetch transaction details on open
  useEffect(() => {
    if (open && transactionId) {
      fetchTransaction();
    }
  }, [open, transactionId]);

  const fetchTransaction = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await getTransactionWithLaborers(
      supabase,
      transactionId
    );
    if (error) {
      setError(error.message || "Failed to load transaction details");
    } else {
      setTransaction(data);
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!transaction || !userProfile) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await confirmSettlement(
        supabase,
        transactionId,
        userProfile.id,
        userProfile.name || userProfile.email
      );

      if (error) {
        setError(error.message || "Failed to confirm settlement");
      } else {
        onSuccess?.();
        handleClose();
      }
    } catch (err: any) {
      console.error("[SettlementDetailsDialog] Confirm error:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      // ALWAYS reset submitting state to prevent button from staying locked
      setSubmitting(false);
    }
  };

  const handleDispute = async () => {
    if (!transaction || !disputeNotes.trim()) {
      setError("Please provide dispute notes");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await disputeSettlement(
        supabase,
        transactionId,
        disputeNotes
      );

      if (error) {
        setError(error.message || "Failed to dispute settlement");
      } else {
        onSuccess?.();
        handleClose();
      }
    } catch (err: any) {
      console.error("[SettlementDetailsDialog] Dispute error:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      // ALWAYS reset submitting state to prevent button from staying locked
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setShowDispute(false);
    setDisputeNotes("");
    setError(null);
    setTransaction(null);
    onClose();
  };

  const openProofImage = () => {
    if (transaction?.settlement_proof_url) {
      window.open(transaction.settlement_proof_url, "_blank");
    }
  };

  const isConfirmed = transaction?.settlement_status === "confirmed";
  const isDisputed = transaction?.settlement_status === "disputed";
  const isPendingConfirmation =
    transaction?.settlement_status === "pending_confirmation";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AccountBalanceWallet color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Settlement Details
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 200,
            }}
          >
            <CircularProgress />
          </Box>
        ) : error && !transaction ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : transaction ? (
          <Box>
            {/* Status Badge */}
            <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
              {isConfirmed && (
                <Chip
                  icon={<CheckCircle />}
                  label="Confirmed"
                  color="success"
                  variant="filled"
                />
              )}
              {isDisputed && (
                <Chip
                  icon={<Cancel />}
                  label="Disputed"
                  color="error"
                  variant="filled"
                />
              )}
              {isPendingConfirmation && (
                <Chip
                  label="Pending Confirmation"
                  color="warning"
                  variant="filled"
                />
              )}
            </Box>

            {/* Transaction Summary */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 3,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Amount
                </Typography>
                <Chip
                  icon={<CurrencyRupee sx={{ fontSize: 16 }} />}
                  label={transaction.amount.toLocaleString("en-IN")}
                  color="primary"
                  size="medium"
                  sx={{ fontWeight: 700, fontSize: "1rem" }}
                />
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CalendarToday sx={{ fontSize: 14, color: "text.secondary" }} />
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(transaction.transaction_date).format("DD MMM YYYY")}
                  </Typography>
                </Box>
                {transaction.engineer_name && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Person sx={{ fontSize: 14, color: "text.secondary" }} />
                    <Typography variant="caption" color="text.secondary">
                      {transaction.engineer_name}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Settlement Details */}
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Settlement Information
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Payment Mode
                </Typography>
                <Chip
                  size="small"
                  label={
                    transaction.settlement_mode === "upi"
                      ? "UPI / Online"
                      : "Cash"
                  }
                  variant="outlined"
                />
              </Box>

              {/* UPI Proof */}
              {transaction.settlement_mode === "upi" &&
                transaction.settlement_proof_url && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Payment Screenshot
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<ImageIcon />}
                      onClick={openProofImage}
                      size="small"
                    >
                      View Screenshot
                    </Button>
                  </Box>
                )}

              {/* Cash Reason */}
              {transaction.settlement_mode === "cash" &&
                transaction.settlement_reason && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      <Notes fontSize="small" />
                      Notes
                    </Typography>
                    <Typography variant="body2">
                      {transaction.settlement_reason}
                    </Typography>
                  </Box>
                )}
            </Paper>

            {/* Laborer Details */}
            {(transaction.daily_attendance.length > 0 ||
              transaction.market_attendance.length > 0) && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Person fontSize="small" />
                  Laborers Paid (
                  {transaction.daily_attendance.length +
                    transaction.market_attendance.length}
                  )
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ maxHeight: 150, overflow: "auto" }}
                >
                  <List dense disablePadding>
                    {transaction.daily_attendance.map((da) => (
                      <ListItem
                        key={da.id}
                        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
                      >
                        <ListItemText
                          primary={da.laborer_name}
                          secondary={dayjs(da.date).format("DD MMM")}
                        />
                        <Chip
                          size="small"
                          label={`₹${da.daily_earnings.toLocaleString("en-IN")}`}
                          variant="outlined"
                        />
                      </ListItem>
                    ))}
                    {transaction.market_attendance.map((ma) => (
                      <ListItem
                        key={ma.id}
                        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
                      >
                        <ListItemText
                          primary={`${ma.role_name} (${ma.count} laborers)`}
                          secondary={`${dayjs(ma.date).format("DD MMM")} • ₹${ma.rate_per_person}/person`}
                        />
                        <Chip
                          size="small"
                          label={`₹${ma.total_cost.toLocaleString("en-IN")}`}
                          variant="outlined"
                          color="secondary"
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            )}

            {/* Dispute Notes (if disputed) */}
            {isDisputed && transaction.dispute_notes && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Dispute Reason:
                </Typography>
                <Typography variant="body2">
                  {transaction.dispute_notes}
                </Typography>
              </Alert>
            )}

            {/* Dispute Form */}
            {showDispute && (
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Dispute Notes *"
                  placeholder="Explain why you are disputing this settlement..."
                  value={disputeNotes}
                  onChange={(e) => setDisputeNotes(e.target.value)}
                  error={!disputeNotes.trim() && error !== null}
                />
              </Box>
            )}

            {error && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}
          </Box>
        ) : null}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Close
        </Button>

        {/* Show confirm/dispute buttons only for pending confirmations */}
        {isPendingConfirmation && !showDispute && (
          <>
            <Button
              color="error"
              onClick={() => setShowDispute(true)}
              disabled={submitting}
            >
              Dispute
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleConfirm}
              disabled={submitting}
              startIcon={
                submitting ? <CircularProgress size={16} /> : <CheckCircle />
              }
            >
              {submitting ? "Confirming..." : "Confirm Settlement"}
            </Button>
          </>
        )}

        {/* Show dispute submit when dispute form is open */}
        {showDispute && (
          <>
            <Button onClick={() => setShowDispute(false)} disabled={submitting}>
              Cancel Dispute
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDispute}
              disabled={submitting || !disputeNotes.trim()}
              startIcon={
                submitting ? <CircularProgress size={16} /> : <Cancel />
              }
            >
              {submitting ? "Submitting..." : "Submit Dispute"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
