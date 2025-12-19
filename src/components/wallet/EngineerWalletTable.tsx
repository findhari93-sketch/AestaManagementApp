"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  alpha,
  Divider,
  Button,
} from "@mui/material";
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Notifications as NotifyIcon,
  MoreVert as MoreVertIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  CheckCircle as PaidIcon,
  Schedule as PendingIcon,
  Receipt as ReceiptIcon,
  CalendarMonth as CalendarIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import dayjs from "dayjs";

interface LaborerDetail {
  id: string;
  name: string;
  type: "daily" | "market";
  role?: string;
  count?: number;
  amount: number;
  date: string;
}

interface PendingSettlementData {
  id: string;
  amount: number;
  companySettlementDate: string; // When company sent the money
  laborSalaryDates: string[]; // Unique dates of labor work
  description: string | null;
  proofUrl: string | null;
  siteName: string | null;
  dailyCount: number;
  marketCount: number;
  settlementStatus: string | null;
  laborers: LaborerDetail[];
}

interface EngineerWalletTableProps {
  settlements: PendingSettlementData[];
  loading?: boolean;
  onSettle: (id: string) => void;
  onView?: (settlement: PendingSettlementData) => void;
  onCancel?: (settlement: PendingSettlementData) => void;
  onNotify?: (settlement: PendingSettlementData) => void;
}

export default function EngineerWalletTable({
  settlements,
  loading = false,
  onSettle,
  onView,
  onCancel,
  onNotify,
}: EngineerWalletTableProps) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<PendingSettlementData | null>(null);

  // Handle menu open
  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    row: PendingSettlementData
  ) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `Rs.${amount.toLocaleString("en-IN")}`;
  };

  // Format date range for labor salary dates
  const formatLaborDates = (dates: string[]) => {
    if (dates.length === 0) return "-";
    if (dates.length === 1) return dayjs(dates[0]).format("DD MMM YYYY");

    // Sort dates
    const sorted = dates.sort();
    const first = dayjs(sorted[0]).format("DD MMM");
    const last = dayjs(sorted[sorted.length - 1]).format("DD MMM YYYY");
    return `${first} - ${last}`;
  };

  // Define columns
  const columns = useMemo<MRT_ColumnDef<PendingSettlementData>[]>(
    () => [
      {
        accessorKey: "companySettlementDate",
        header: "Company Sent",
        size: 130,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {dayjs(row.original.companySettlementDate).format("DD MMM YYYY")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Settlement Date
            </Typography>
          </Box>
        ),
      },
      {
        id: "laborDates",
        header: "Labor Date",
        size: 140,
        Cell: ({ row }) => (
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <CalendarIcon sx={{ fontSize: 14, color: "text.secondary" }} />
              <Typography variant="body2">
                {formatLaborDates(row.original.laborSalaryDates)}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Work Date(s)
            </Typography>
          </Box>
        ),
      },
      {
        accessorKey: "siteName",
        header: "Site",
        size: 150,
        Cell: ({ row }) => (
          <Typography variant="body2">
            {row.original.siteName || "-"}
          </Typography>
        ),
      },
      {
        id: "laborers",
        header: "Laborers",
        size: 130,
        Cell: ({ row }) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {row.original.dailyCount > 0 && (
              <Chip
                icon={<PersonIcon sx={{ fontSize: 14 }} />}
                label={`${row.original.dailyCount} daily`}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ height: 22, fontSize: "0.7rem" }}
              />
            )}
            {row.original.marketCount > 0 && (
              <Chip
                icon={<GroupsIcon sx={{ fontSize: 14 }} />}
                label={`${row.original.marketCount} market`}
                size="small"
                variant="outlined"
                color="secondary"
                sx={{ height: 22, fontSize: "0.7rem" }}
              />
            )}
            {row.original.dailyCount === 0 && row.original.marketCount === 0 && (
              <Typography variant="body2" color="text.secondary">-</Typography>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 110,
        Cell: ({ row }) => (
          <Typography variant="body2" fontWeight={700} color="warning.main">
            {formatCurrency(row.original.amount)}
          </Typography>
        ),
      },
      {
        accessorKey: "settlementStatus",
        header: "Status",
        size: 120,
        Cell: ({ row }) => {
          const status = row.original.settlementStatus;
          if (status === "cancelled") {
            return (
              <Chip
                label="Cancelled"
                size="small"
                color="error"
                sx={{ height: 22, fontSize: "0.7rem" }}
              />
            );
          }
          if (status === "pending_confirmation") {
            return (
              <Chip
                label="Awaiting Approval"
                size="small"
                color="warning"
                sx={{ height: 22, fontSize: "0.7rem" }}
              />
            );
          }
          if (status === "confirmed") {
            return (
              <Chip
                label="Confirmed"
                size="small"
                color="success"
                sx={{ height: 22, fontSize: "0.7rem" }}
              />
            );
          }
          // Default: pending_settlement or null
          return (
            <Chip
              icon={<PendingIcon sx={{ fontSize: 14 }} />}
              label="Pending"
              size="small"
              color="info"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.7rem" }}
            />
          );
        },
      },
      {
        accessorKey: "proofUrl",
        header: "Proof",
        size: 80,
        Cell: ({ row }) =>
          row.original.proofUrl ? (
            <Tooltip title="View payment proof from company">
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(row.original.proofUrl!, "_blank");
                }}
              >
                <ReceiptIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Typography variant="body2" color="text.secondary">-</Typography>
          ),
      },
    ],
    []
  );

  // Render expanded row detail panel
  const renderDetailPanel = ({ row }: { row: { original: PendingSettlementData } }) => {
    const { laborers, description } = row.original;

    return (
      <Box sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}

        {laborers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No laborer details available
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell>Type</TableCell>
                  <TableCell>Name / Role</TableCell>
                  <TableCell>Work Date</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {laborers.map((laborer) => (
                  <TableRow key={laborer.id}>
                    <TableCell>
                      <Chip
                        label={laborer.type === "daily" ? "Daily" : "Market"}
                        size="small"
                        color={laborer.type === "daily" ? "primary" : "secondary"}
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{laborer.name}</Typography>
                      {laborer.role && (
                        <Typography variant="caption" color="text.secondary">
                          {laborer.role}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {dayjs(laborer.date).format("DD MMM YYYY")}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{laborer.count || 1}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500}>
                        {formatCurrency(laborer.amount)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  };

  return (
    <>
      <DataTable<PendingSettlementData>
        columns={columns}
        data={settlements}
        isLoading={loading}
        enableExpanding
        renderDetailPanel={renderDetailPanel}
        enableRowActions
        positionActionsColumn="last"
        renderRowActions={({ row }) => {
          const status = row.original.settlementStatus;
          const isCancelled = status === "cancelled";
          const isConfirmed = status === "confirmed";
          const isAwaitingApproval = status === "pending_confirmation";
          const canSettle = !isCancelled && !isConfirmed && !isAwaitingApproval;

          return (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {/* Primary action - Settle (only for pending_settlement or null) */}
              {canSettle ? (
                <Button
                  variant="contained"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSettle(row.original.id);
                  }}
                  startIcon={<PaymentIcon sx={{ fontSize: 16 }} />}
                  sx={{ fontSize: "0.75rem", py: 0.5, px: 1.5 }}
                >
                  Settle
                </Button>
              ) : (
                <Typography
                  variant="caption"
                  color={isCancelled ? "error.main" : isConfirmed ? "success.main" : "warning.main"}
                  sx={{ fontStyle: "italic", alignSelf: "center" }}
                >
                  {isCancelled ? "Cancelled" : isConfirmed ? "Settled" : "Pending Approval"}
                </Typography>
              )}

              {/* More actions menu */}
              {(onView || onCancel || onNotify) && canSettle && (
                <Tooltip title="More actions">
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, row.original)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        }}
        initialState={{
          sorting: [{ id: "companySettlementDate", desc: true }],
        }}
        enablePagination={settlements.length > 10}
        pageSize={10}
        muiExpandButtonProps={({ row }) => ({
          sx: {
            color: row.original.laborers.length > 0 ? "primary.main" : "text.disabled",
          },
        })}
      />

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        {onView && (
          <MenuItem
            onClick={() => {
              if (selectedRow) onView(selectedRow);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <ViewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItem>
        )}

        {onNotify && (
          <MenuItem
            onClick={() => {
              if (selectedRow) onNotify(selectedRow);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <NotifyIcon fontSize="small" color="info" />
            </ListItemIcon>
            <ListItemText>Request Company</ListItemText>
          </MenuItem>
        )}

        {onCancel && (
          <>
            <Divider />
            <MenuItem
              onClick={() => {
                if (selectedRow) onCancel(selectedRow);
                handleMenuClose();
              }}
            >
              <ListItemIcon>
                <CancelIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Request Cancel</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}
