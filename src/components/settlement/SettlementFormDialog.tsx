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
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
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
} from "@mui/material";
import {
  Close as CloseIcon,
  AccountBalanceWallet,
  CurrencyRupee,
  Person,
  CalendarToday,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import FileUploader, { UploadedFile } from "@/components/common/FileUploader";
import {
  getTransactionWithLaborers,
  submitSettlement,
  TransactionWithLaborers,
} from "@/lib/services/notificationService";
import { SettlementMode } from "@/types/settlement.types";
import dayjs from "dayjs";

interface SettlementFormDialogProps {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  onSuccess?: () => void;
}

export default function SettlementFormDialog({
  open,
  onClose,
  transactionId,
  onSuccess,
}: SettlementFormDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const [supabase] = useState(() => createClient());

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] =
    useState<TransactionWithLaborers | null>(null);

  // Form state
  const [settlementMode, setSettlementMode] = useState<SettlementMode>("upi");
  const [proofFile, setProofFile] = useState<UploadedFile | null>(null);
  const [reason, setReason] = useState("");

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

  const handleSubmit = async () => {
    if (!transaction || !userProfile) return;

    // Validate
    if (settlementMode === "upi" && !proofFile) {
      setError("Please upload payment screenshot for UPI payment");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error } = await submitSettlement(
      supabase,
      transactionId,
      settlementMode,
      userProfile.id,
      userProfile.name || userProfile.email,
      proofFile?.url,
      reason || undefined,
      selectedSite?.name
    );

    setSubmitting(false);

    if (error) {
      setError(error.message || "Failed to submit settlement");
    } else {
      onSuccess?.();
      handleClose();
    }
  };

  const handleClose = () => {
    setSettlementMode("upi");
    setProofFile(null);
    setReason("");
    setError(null);
    setTransaction(null);
    onClose();
  };

  const totalLaborerAmount =
    (transaction?.daily_attendance.reduce(
      (sum, da) => sum + da.daily_earnings,
      0
    ) || 0) +
    (transaction?.market_attendance.reduce((sum, ma) => sum + ma.total_cost, 0) ||
      0);

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
            Settle Payment
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
                  Amount Received
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
                {transaction.description && (
                  <Typography variant="caption" color="text.secondary">
                    {transaction.description}
                  </Typography>
                )}
              </Box>
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
                  Laborers to Pay (
                  {transaction.daily_attendance.length +
                    transaction.market_attendance.length}
                  )
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ maxHeight: 200, overflow: "auto" }}
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
                {totalLaborerAmount > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: "block" }}
                  >
                    Total laborer amount: ₹{totalLaborerAmount.toLocaleString("en-IN")}
                  </Typography>
                )}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Settlement Mode Selection */}
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Payment Mode
            </Typography>
            <RadioGroup
              value={settlementMode}
              onChange={(e) => setSettlementMode(e.target.value as SettlementMode)}
              sx={{ mb: 2 }}
            >
              <FormControlLabel
                value="upi"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      UPI / Online Transfer
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Screenshot required
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="cash"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Cash
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Optional reason/notes
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>

            {/* Conditional Fields */}
            {settlementMode === "upi" ? (
              <Box sx={{ mb: 2 }}>
                <FileUploader
                  supabase={supabase}
                  bucketName="settlement-proofs"
                  folderPath={`settlements/${transactionId}`}
                  fileNamePrefix="proof"
                  accept="image"
                  maxSizeMB={10}
                  label="Payment Screenshot *"
                  helperText="Upload screenshot of UPI/bank transfer"
                  value={proofFile}
                  onUpload={(file) => setProofFile(file)}
                  onRemove={() => setProofFile(null)}
                  compact
                />
              </Box>
            ) : (
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason / Notes (Optional)"
                placeholder="Enter any notes about the cash payment..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                sx={{ mb: 2 }}
              />
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Box>
        ) : null}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            loading ||
            submitting ||
            !transaction ||
            (settlementMode === "upi" && !proofFile)
          }
          startIcon={submitting ? <CircularProgress size={16} /> : null}
        >
          {submitting ? "Submitting..." : "Submit Settlement"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
