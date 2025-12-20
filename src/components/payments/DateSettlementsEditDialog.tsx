"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  Link as LinkIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import dayjs from "dayjs";
import type { DailyPaymentRecord } from "@/types/payment.types";
import { getPayerSourceLabel, getPayerSourceColor } from "@/components/settlement/PayerSourceSelector";
import type { PayerSource } from "@/types/settlement.types";
import SubcontractLinkSelector from "./SubcontractLinkSelector";

interface DateSettlementsEditDialogProps {
  open: boolean;
  onClose: () => void;
  date: string;
  records: DailyPaymentRecord[];
  onSuccess?: () => void;
}

export default function DateSettlementsEditDialog({
  open,
  onClose,
  date,
  records,
  onSuccess,
}: DateSettlementsEditDialogProps) {
  const { selectedSite } = useSite();
  const supabase = useMemo(() => createClient(), []);

  // Form state for bulk editing
  const [selectedSubcontractId, setSelectedSubcontractId] = useState<string | null>(null);
  const [onlyUpdateUnlinked, setOnlyUpdateUnlinked] = useState(true);

  // UI state
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number) => `Rs.${amount.toLocaleString("en-IN")}`;

  const dailyRecords = records.filter((r) => r.sourceType === "daily");
  const marketRecords = records.filter((r) => r.sourceType === "market");

  // Count unlinked daily records
  const unlinkedDailyCount = dailyRecords.filter((r) => !r.subcontractId).length;

  // Records that will be updated based on current selection
  const recordsToUpdate = useMemo(() => {
    if (onlyUpdateUnlinked) {
      return dailyRecords.filter((r) => !r.subcontractId);
    }
    return dailyRecords;
  }, [dailyRecords, onlyUpdateUnlinked]);

  // Calculate total amount that will be linked
  const totalAmountToLink = recordsToUpdate.reduce((sum, r) => sum + r.amount, 0);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedSubcontractId(null);
      setOnlyUpdateUnlinked(true);
      setError(null);
    }
  }, [open]);

  // Handle bulk save
  const handleSave = async () => {
    if (!selectedSite || !selectedSubcontractId) {
      setError("Please select a subcontract to link");
      return;
    }

    if (recordsToUpdate.length === 0) {
      setError("No records to update");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Get all source IDs to update
      const sourceIds = recordsToUpdate.map((r) => r.sourceId);

      // Update daily_attendance records with subcontract_id
      const { error: attendanceError } = await supabase
        .from("daily_attendance")
        .update({ subcontract_id: selectedSubcontractId })
        .in("id", sourceIds);

      if (attendanceError) throw attendanceError;

      // Update linked expenses if they exist
      const expenseIds = recordsToUpdate
        .filter((r): r is DailyPaymentRecord & { expenseId: string } => !!r.expenseId)
        .map((r) => r.expenseId);

      if (expenseIds.length > 0) {
        const { error: expenseError } = await supabase
          .from("expenses")
          .update({ contract_id: selectedSubcontractId })
          .in("id", expenseIds);

        if (expenseError) {
          console.error("Error updating expenses:", expenseError);
          // Don't throw - this is non-critical
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Error updating settlements:", err);
      setError(err.message || "Failed to update settlements");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubcontractSelect = useCallback((id: string | null) => {
    setSelectedSubcontractId(id);
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6">Edit Settlements</Typography>
          <Typography variant="caption" color="text.secondary">
            {dayjs(date).format("dddd, DD MMM YYYY")} - {records.length} records
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {records.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            No records found for this date
          </Typography>
        ) : (
          <>
            {/* Records Table (Read-only display) */}
            <Typography variant="subtitle2" gutterBottom>
              Records for this date:
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Name / Role</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Paid By</TableCell>
                    <TableCell>Subcontract</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      sx={{
                        bgcolor: (!record.subcontractId && onlyUpdateUnlinked) || !onlyUpdateUnlinked
                          ? "action.selected"
                          : "inherit",
                      }}
                    >
                      <TableCell>
                        <Chip label="Daily" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{record.laborerName}</Typography>
                        {record.category && (
                          <Typography variant="caption" color="text.secondary">
                            {record.category}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          {formatCurrency(record.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {record.moneySource ? (
                          <Chip
                            label={getPayerSourceLabel(record.moneySource as PayerSource, record.moneySourceName || undefined)}
                            size="small"
                            variant="outlined"
                            color={getPayerSourceColor(record.moneySource as PayerSource)}
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.subcontractTitle ? (
                          <Chip
                            label={record.subcontractTitle}
                            size="small"
                            color="info"
                            variant="outlined"
                            icon={<LinkIcon sx={{ fontSize: 14 }} />}
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        ) : (
                          <Chip
                            label="Unlinked"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {record.isPaid ? (
                          <Chip label="Paid" size="small" color="success" sx={{ height: 18, fontSize: "0.6rem" }} />
                        ) : record.paidVia === "engineer_wallet" ? (
                          <Chip label="With Engineer" size="small" color="info" sx={{ height: 18, fontSize: "0.6rem" }} />
                        ) : (
                          <Chip label="Pending" size="small" color="warning" sx={{ height: 18, fontSize: "0.6rem" }} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {marketRecords.map((record) => (
                    <TableRow key={record.id} sx={{ opacity: 0.6 }}>
                      <TableCell>
                        <Chip label="Market" size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{record.role || record.laborerName}</Typography>
                        {record.count && record.count > 1 && (
                          <Typography variant="caption" color="text.secondary">
                            x{record.count}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          {formatCurrency(record.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {record.moneySource ? (
                          <Chip
                            label={getPayerSourceLabel(record.moneySource as PayerSource, record.moneySourceName || undefined)}
                            size="small"
                            variant="outlined"
                            color={getPayerSourceColor(record.moneySource as PayerSource)}
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label="N/A"
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: "0.65rem", color: 'text.disabled', borderColor: 'divider' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {record.isPaid ? (
                          <Chip label="Paid" size="small" color="success" sx={{ height: 18, fontSize: "0.6rem" }} />
                        ) : record.paidVia === "engineer_wallet" ? (
                          <Chip label="With Engineer" size="small" color="info" sx={{ height: 18, fontSize: "0.6rem" }} />
                        ) : (
                          <Chip label="Pending" size="small" color="warning" sx={{ height: 18, fontSize: "0.6rem" }} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {marketRecords.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Market records cannot be linked to subcontracts
              </Alert>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Bulk Edit Section - Only for Daily Records */}
            {dailyRecords.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LinkIcon fontSize="small" color="primary" />
                  Bulk Link to Subcontract
                </Typography>

                <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1, mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={onlyUpdateUnlinked}
                        onChange={(e) => setOnlyUpdateUnlinked(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        Only update unlinked records ({unlinkedDailyCount} of {dailyRecords.length})
                      </Typography>
                    }
                  />

                  <Box sx={{ mt: 2 }}>
                    <SubcontractLinkSelector
                      selectedSubcontractId={selectedSubcontractId}
                      onSelect={handleSubcontractSelect}
                      paymentAmount={totalAmountToLink}
                      showBalanceAfterPayment
                    />
                  </Box>

                  {selectedSubcontractId && recordsToUpdate.length > 0 && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                      {recordsToUpdate.length} record(s) totaling {formatCurrency(totalAmountToLink)} will be linked
                    </Alert>
                  )}
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={processing || !selectedSubcontractId || recordsToUpdate.length === 0}
          startIcon={processing ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {processing ? "Saving..." : `Link ${recordsToUpdate.length} Record(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
