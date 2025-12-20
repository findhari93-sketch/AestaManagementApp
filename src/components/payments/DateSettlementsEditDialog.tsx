"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
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
  Tooltip,
} from "@mui/material";
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import type { DailyPaymentRecord } from "@/types/payment.types";
import { getPayerSourceLabel, getPayerSourceColor } from "@/components/settlement/PayerSourceSelector";
import type { PayerSource } from "@/types/settlement.types";
import SettlementEditDialog from "./SettlementEditDialog";

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
  const [editingRecord, setEditingRecord] = useState<DailyPaymentRecord | null>(null);

  const formatCurrency = (amount: number) => `Rs.${amount.toLocaleString("en-IN")}`;

  const dailyRecords = records.filter((r) => r.sourceType === "daily");
  const marketRecords = records.filter((r) => r.sourceType === "market");

  const handleEditSuccess = () => {
    setEditingRecord(null);
    onSuccess?.();
  };

  return (
    <>
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
          {records.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No records found for this date
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell>Type</TableCell>
                    <TableCell>Name / Role</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Paid By</TableCell>
                    <TableCell>Subcontract</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyRecords.map((record) => (
                    <TableRow key={record.id} hover>
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
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.65rem", color: 'text.disabled', borderColor: 'divider' }}
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
                      <TableCell align="center">
                        <Tooltip title="Edit settlement details">
                          <IconButton
                            size="small"
                            onClick={() => setEditingRecord(record)}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}

                  {marketRecords.map((record) => (
                    <TableRow key={record.id} hover>
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
                          label="Unlinked"
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
                      <TableCell align="center">
                        <Tooltip title="Edit settlement details">
                          <IconButton
                            size="small"
                            onClick={() => setEditingRecord(record)}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      {/* Individual Record Edit Dialog */}
      <SettlementEditDialog
        open={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        record={editingRecord}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
