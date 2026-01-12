"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Button,
  Grid,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import {
  Add as AddIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  AccountBalance as BalanceIcon,
  Receipt as ReceiptIcon,
  Visibility as ViewIcon,
  CheckCircle as SettleIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import { useSite } from "@/contexts/SiteContext";
import {
  useRentalSummary,
  useOverdueRentals,
  useRentalOrders,
  useDeleteRentalOrder,
} from "@/hooks/queries/useRentals";
import {
  OngoingRentalsList,
  RentalOrderDialog,
} from "@/components/rentals";
import { formatCurrency } from "@/lib/formatters";
import {
  RENTAL_ORDER_STATUS_LABELS,
  RENTAL_ORDER_STATUS_COLORS,
  type RentalOrderStatus,
} from "@/types/rental.types";
import dayjs from "dayjs";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: "primary" | "success" | "warning" | "error";
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, icon, color = "primary", onClick }: StatCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.2s",
        "&:hover": onClick ? { boxShadow: 2 } : {},
      }}
      onClick={onClick}
    >
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h5" fontWeight={700} color={`${color}.main`}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            p: 1,
            borderRadius: 1,
            bgcolor: `${color}.50`,
            color: `${color}.main`,
          }}
        >
          {icon}
        </Box>
      </Box>
    </Paper>
  );
}

// Status badge colors
const getStatusColor = (status: RentalOrderStatus): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
  const colors: Record<RentalOrderStatus, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
    draft: "default",
    confirmed: "info",
    active: "primary",
    partially_returned: "warning",
    completed: "success",
    cancelled: "error",
  };
  return colors[status] || "default";
};

export default function SiteRentalsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedSite } = useSite();
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RentalOrderStatus | "all">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rentalToDelete, setRentalToDelete] = useState<{ id: string; orderNumber: string } | null>(null);

  // Get tab from URL, default to "ongoing"
  const currentTab = searchParams.get("tab") || "ongoing";

  const siteId = selectedSite?.id || "";

  const { data: summary, isLoading: loadingSummary } = useRentalSummary(siteId);
  const { data: overdueRentals = [] } = useOverdueRentals(siteId);
  const deleteRentalOrder = useDeleteRentalOrder();

  // Fetch all rentals for the "all" and "history" tabs
  const { data: allRentals = [], isLoading: loadingAllRentals } = useRentalOrders(
    siteId,
    currentTab === "history"
      ? { status: "completed" }
      : currentTab === "all"
        ? (statusFilter !== "all" ? { status: statusFilter } : undefined)
        : undefined
  );

  // Filter rentals based on tab
  const displayedRentals = useMemo(() => {
    if (currentTab === "history") {
      return allRentals.filter(r => r.status === "completed" || r.status === "cancelled");
    }
    if (currentTab === "all") {
      if (statusFilter !== "all") {
        return allRentals.filter(r => r.status === statusFilter);
      }
      return allRentals;
    }
    return [];
  }, [allRentals, currentTab, statusFilter]);

  const handleViewOrder = (orderId: string) => {
    router.push(`/site/rentals/${orderId}`);
  };

  const handleCreateOrder = () => {
    setOrderDialogOpen(true);
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: string) => {
    router.push(`/site/rentals?tab=${newValue}`);
  };

  const handleDeleteClick = (id: string, orderNumber: string) => {
    setRentalToDelete({ id, orderNumber });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (rentalToDelete) {
      await deleteRentalOrder.mutateAsync(rentalToDelete.id);
      setDeleteDialogOpen(false);
      setRentalToDelete(null);
    }
  };

  if (!selectedSite) {
    return (
      <Box p={4}>
        <Alert severity="info">Please select a site to view rentals.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Rental Management"
        subtitle={`Track equipment and scaffolding rentals at ${selectedSite.name}`}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateOrder}
          >
            New Rental
          </Button>
        }
      />

      {/* Dashboard Stats */}
      {loadingSummary ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <StatCard
              title="Ongoing Rentals"
              value={summary?.ongoingCount || 0}
              icon={<InventoryIcon />}
              color="primary"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <StatCard
              title="Overdue"
              value={summary?.overdueCount || 0}
              subtitle={overdueRentals.length > 0 ? "Need attention" : undefined}
              icon={<WarningIcon />}
              color={summary?.overdueCount ? "error" : "success"}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <StatCard
              title="Accrued Cost"
              value={formatCurrency(summary?.totalAccruedCost || 0)}
              subtitle="Running total"
              icon={<ReceiptIcon />}
              color="warning"
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <StatCard
              title="Balance Due"
              value={formatCurrency(summary?.totalDue || 0)}
              subtitle={`Advances: ${formatCurrency(summary?.totalAdvancesPaid || 0)}`}
              icon={<BalanceIcon />}
              color={summary?.totalDue && summary.totalDue > 0 ? "error" : "success"}
            />
          </Grid>
        </Grid>
      )}

      {/* Overdue Alert */}
      {overdueRentals.length > 0 && currentTab === "ongoing" && (
        <Alert
          severity="error"
          icon={<WarningIcon />}
          sx={{ mb: 2 }}
          action={
            <Chip
              size="small"
              label={`${overdueRentals.length} overdue`}
              color="error"
            />
          }
        >
          <Typography variant="body2" fontWeight={600}>
            Overdue Rentals Require Attention
          </Typography>
          <Typography variant="caption">
            {overdueRentals
              .slice(0, 3)
              .map((r) => r.vendor?.shop_name || r.vendor?.name)
              .join(", ")}
            {overdueRentals.length > 3 && ` +${overdueRentals.length - 3} more`}
          </Typography>
        </Alert>
      )}

      {/* Tabs */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Ongoing" value="ongoing" />
          <Tab label="All Rentals" value="all" />
          <Tab label="History" value="history" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {currentTab === "ongoing" && (
        <OngoingRentalsList
          siteId={siteId}
          onViewOrder={handleViewOrder}
          onCreateOrder={handleCreateOrder}
          showOverdueAlert={false}
        />
      )}

      {(currentTab === "all" || currentTab === "history") && (
        <Paper variant="outlined">
          {/* Filter for All tab */}
          {currentTab === "all" && (
            <Box p={2} display="flex" gap={2} alignItems="center" borderBottom="1px solid" borderColor="divider">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value as RentalOrderStatus | "all")}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="partially_returned">Partially Returned</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                {displayedRentals.length} rental{displayedRentals.length !== 1 ? "s" : ""}
              </Typography>
            </Box>
          )}

          {loadingAllRentals ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : displayedRentals.length === 0 ? (
            <Box p={4} textAlign="center">
              <Typography color="text.secondary">
                {currentTab === "history"
                  ? "No completed rentals yet"
                  : "No rentals found"}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Order #</TableCell>
                    <TableCell>Vendor & Items</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Est. Total</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedRentals.map((rental) => {
                    const totalPaid = rental.total_advance_paid || 0;

                    // Get item details
                    const items = rental.items || [];

                    // Calculate duration correctly using expected_return_date if no actual
                    const endDateForCalc = rental.actual_return_date || rental.expected_return_date || rental.start_date;
                    const durationDays = Math.max(1, dayjs(endDateForCalc).diff(dayjs(rental.start_date), "day") + 1);

                    // Check if any item is hourly
                    const hasHourlyItems = items.some(item => item.rate_type === "hourly");

                    // Recalculate estimated total from items (in case stored value is wrong)
                    const itemsTotal = items.reduce((sum, item) => {
                      const rateType = item.rate_type || "daily";
                      if (rateType === "hourly") {
                        return sum + (item.quantity || 0) * (item.daily_rate_actual || 0) * (item.hours_used || 0);
                      } else {
                        return sum + (item.quantity || 0) * (item.daily_rate_actual || 0) * durationDays;
                      }
                    }, 0);
                    const transportTotal = (rental.transport_cost_outward || 0) +
                      (rental.loading_cost_outward || 0) +
                      (rental.unloading_cost_outward || 0);
                    const estimatedTotal = itemsTotal + transportTotal;
                    const balance = estimatedTotal - totalPaid;

                    // Get item summary
                    const itemSummary = items.map(item => {
                      const rateType = item.rate_type || "daily";
                      const rateLabel = rateType === "hourly"
                        ? `${item.hours_used || 0}hrs @ ₹${item.daily_rate_actual}/hr`
                        : `₹${item.daily_rate_actual}/day`;
                      return `${item.rental_item?.name || "Item"} (${item.quantity}x ${rateLabel})`;
                    }).join(", ");

                    return (
                      <TableRow
                        key={rental.id}
                        hover
                        sx={{ cursor: "pointer" }}
                        onClick={() => handleViewOrder(rental.id)}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {rental.rental_order_number}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {rental.vendor?.shop_name || rental.vendor?.name || "-"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {itemSummary || `${items.length} item(s)`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {dayjs(rental.start_date).format("DD MMM YY")}
                        </TableCell>
                        <TableCell>
                          {rental.actual_return_date ? (
                            <Typography variant="body2" color="success.main">
                              {dayjs(rental.actual_return_date).format("DD MMM YY")}
                            </Typography>
                          ) : rental.expected_return_date ? (
                            dayjs(rental.expected_return_date).format("DD MMM YY")
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {hasHourlyItems ? (
                            <Typography variant="body2">
                              {items.filter(i => i.rate_type === "hourly").reduce((sum, i) => sum + (i.hours_used || 0), 0)} hrs
                            </Typography>
                          ) : (
                            <Typography variant="body2">
                              {durationDays} day{durationDays !== 1 ? "s" : ""}
                            </Typography>
                          )}
                          {rental.actual_return_date && (
                            <Chip size="small" label="Returned" color="success" sx={{ ml: 0.5 }} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={RENTAL_ORDER_STATUS_LABELS[rental.status]}
                            color={getStatusColor(rental.status)}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(estimatedTotal)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(totalPaid)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            color={balance > 0 ? "error.main" : "success.main"}
                            fontWeight={500}
                          >
                            {formatCurrency(balance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewOrder(rental.id)}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {rental.status !== "completed" && rental.status !== "cancelled" && (
                            <Tooltip title="Settle">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleViewOrder(rental.id)}
                              >
                                <SettleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(rental.id, rental.rental_order_number)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Create Order Dialog */}
      <RentalOrderDialog
        open={orderDialogOpen}
        onClose={() => setOrderDialogOpen(false)}
        siteId={siteId}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Rental Order</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete rental order{" "}
            <strong>{rentalToDelete?.orderNumber}</strong>? This will also delete
            all associated advances, returns, and items. This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteRentalOrder.isPending}
          >
            {deleteRentalOrder.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
