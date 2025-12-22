"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Paper,
  Chip,
  TablePagination,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  Tooltip,
} from "@mui/material";
import {
  Close as CloseIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  Receipt as ReceiptIcon,
  Image as ImageIcon,
} from "@mui/icons-material";
import { createClient } from "@/lib/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import {
  getContractPaymentHistory,
  ContractPaymentHistoryRecord,
} from "@/lib/services/settlementService";
import dayjs from "dayjs";

interface ContractPaymentHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  onViewPayment?: (reference: string) => void;
}

function getPaymentTypeLabel(type: string): string {
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

function getPaymentTypeColor(type: string): "success" | "warning" | "default" {
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

function getPaymentModeLabel(mode: string | null): string {
  if (!mode) return "N/A";
  switch (mode) {
    case "upi":
      return "UPI";
    case "cash":
      return "Cash";
    case "net_banking":
      return "Net Banking";
    default:
      return mode;
  }
}

export default function ContractPaymentHistoryDialog({
  open,
  onClose,
  onViewPayment,
}: ContractPaymentHistoryDialogProps) {
  const supabase = createClient();
  const { selectedSite } = useSite();

  // Data state
  const [payments, setPayments] = useState<ContractPaymentHistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Fetch data
  const fetchPayments = useCallback(async () => {
    if (!open || !selectedSite) return;

    setLoading(true);
    try {
      const result = await getContractPaymentHistory(supabase, selectedSite.id, {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      });

      setPayments(result.payments);
      setTotal(result.total);
    } catch (err) {
      console.error("Error fetching payment history:", err);
    } finally {
      setLoading(false);
    }
  }, [open, selectedSite, supabase, page, rowsPerPage]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Reset pagination when dialog opens
  useEffect(() => {
    if (open) {
      setPage(0);
      setSearchTerm("");
      setTypeFilter("all");
    }
  }, [open]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewPayment = (payment: ContractPaymentHistoryRecord) => {
    // Prefer paymentReference (PAY-*), fallback to settlementReference (SET-*)
    const reference = payment.paymentReference || payment.settlementReference;
    if (reference && onViewPayment) {
      onViewPayment(reference);
    }
  };

  // Filter payments locally (search and type filter)
  const filteredPayments = payments.filter((p) => {
    // Type filter
    if (typeFilter !== "all" && p.paymentType !== typeFilter) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        p.laborerName.toLowerCase().includes(search) ||
        p.paymentReference?.toLowerCase().includes(search) ||
        p.settlementReference?.toLowerCase().includes(search) ||
        p.paidBy.toLowerCase().includes(search)
      );
    }

    return true;
  });

  // Group payments by date for display
  const groupedByDate = filteredPayments.reduce((acc, payment) => {
    const date = dayjs(payment.actualPaymentDate).format("YYYY-MM-DD");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(payment);
    return acc;
  }, {} as Record<string, ContractPaymentHistoryRecord[]>);

  const sortedDates = Object.keys(groupedByDate).sort((a, b) =>
    dayjs(b).diff(dayjs(a))
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">Contract Payment History</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Filters */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search by laborer, reference, or paid by..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="salary">Salary</MenuItem>
              <MenuItem value="advance">Advance</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Summary */}
        <Box sx={{ mb: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Total: <strong>{total}</strong> payments
            {filteredPayments.length !== payments.length && (
              <> | Showing: <strong>{filteredPayments.length}</strong> filtered</>
            )}
            {" | "}
            Total Amount: <strong>Rs.{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</strong>
          </Typography>
        </Box>

        {/* Loading */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredPayments.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            No payment records found
          </Typography>
        ) : (
          <>
            {/* Payments grouped by date */}
            {sortedDates.map((date) => (
              <Box key={date} sx={{ mb: 3 }}>
                {/* Date header */}
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 1,
                    py: 0.5,
                    px: 1,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    borderRadius: 1,
                  }}
                >
                  {dayjs(date).format("dddd, MMM D, YYYY")}
                  <Chip
                    size="small"
                    label={`${groupedByDate[date].length} payment${groupedByDate[date].length > 1 ? "s" : ""}`}
                    sx={{ ml: 1, bgcolor: "rgba(255,255,255,0.2)", color: "inherit" }}
                  />
                </Typography>

                {/* Payments table */}
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Laborer</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Mode</TableCell>
                        <TableCell>Paid By</TableCell>
                        <TableCell>Subcontract</TableCell>
                        <TableCell align="center">Proof</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupedByDate[date].map((payment) => (
                        <TableRow
                          key={payment.id}
                          hover
                          sx={{ cursor: onViewPayment ? "pointer" : "default" }}
                          onClick={() => handleViewPayment(payment)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {payment.laborerName}
                            </Typography>
                            {payment.laborerRole && (
                              <Typography variant="caption" color="text.secondary">
                                {payment.laborerRole}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Click to view details">
                              <Chip
                                size="small"
                                icon={<ReceiptIcon fontSize="small" />}
                                label={payment.paymentReference || payment.settlementReference || "N/A"}
                                variant="outlined"
                                sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={600}>
                              Rs.{payment.amount.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={getPaymentTypeLabel(payment.paymentType)}
                              color={getPaymentTypeColor(payment.paymentType)}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {getPaymentModeLabel(payment.paymentMode)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {payment.paidBy}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {payment.subcontractTitle ? (
                              <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                                {payment.subcontractTitle}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                -
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {payment.proofUrl ? (
                              <Tooltip title="View proof">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(payment.proofUrl!, "_blank");
                                  }}
                                >
                                  <ImageIcon fontSize="small" color="primary" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                -
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))}

            {/* Pagination */}
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
