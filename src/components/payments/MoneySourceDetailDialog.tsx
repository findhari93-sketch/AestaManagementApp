"use client";

import React from "react";
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
  Divider,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import dayjs from "dayjs";
import type { DailyPaymentRecord } from "@/types/payment.types";

interface MoneySourceDetailDialogProps {
  open: boolean;
  onClose: () => void;
  sourceName: string;
  records: DailyPaymentRecord[];
}

export default function MoneySourceDetailDialog({
  open,
  onClose,
  sourceName,
  records,
}: MoneySourceDetailDialogProps) {
  // Calculate total
  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
  const totalLaborers = records.reduce((sum, r) => sum + (r.count || 1), 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return `Rs.${amount.toLocaleString("en-IN")}`;
  };

  // Get status chip for a record
  const getStatusChip = (record: DailyPaymentRecord) => {
    if (record.isPaid) {
      return <Chip label="Paid" size="small" color="success" sx={{ height: 20, fontSize: "0.65rem" }} />;
    }
    if (record.paidVia === "engineer_wallet") {
      if (record.settlementStatus === "pending_confirmation") {
        return <Chip label="Awaiting" size="small" color="warning" sx={{ height: 20, fontSize: "0.65rem" }} />;
      }
      if (record.settlementStatus === "confirmed") {
        return <Chip label="Settled" size="small" color="success" sx={{ height: 20, fontSize: "0.65rem" }} />;
      }
      return <Chip label="With Engr" size="small" color="info" sx={{ height: 20, fontSize: "0.65rem" }} />;
    }
    return <Chip label="Pending" size="small" color="warning" sx={{ height: 20, fontSize: "0.65rem" }} />;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span">
            {sourceName} Payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {records.length} records | {totalLaborers} laborers
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell>Date</TableCell>
                <TableCell>Name / Role</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell>Ref Code</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <Typography variant="body2">
                      {dayjs(record.date).format("DD MMM YYYY")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(record.date).format("ddd")}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {record.laborerName}
                    </Typography>
                    {record.role && (
                      <Typography variant="caption" color="text.secondary">
                        {record.role}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {record.count || 1}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={500}>
                      {formatCurrency(record.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {getStatusChip(record)}
                  </TableCell>
                  <TableCell>
                    {record.settlementReference ? (
                      <Chip
                        label={record.settlementReference}
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: "monospace", fontSize: "0.65rem", height: 20 }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Total Row */}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Total
          </Typography>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="h6" fontWeight={600} color="primary.main">
              {formatCurrency(totalAmount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {records.length} payments | {totalLaborers} laborers
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
