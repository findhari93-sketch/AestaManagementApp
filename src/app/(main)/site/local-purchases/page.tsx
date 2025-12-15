"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Skeleton,
  Alert,
  Button,
  Divider,
  IconButton,
  Stack,
  Fab,
  Tooltip,
} from "@mui/material";
import {
  Search as SearchIcon,
  Add as AddIcon,
  Receipt as ReceiptIcon,
  PhotoCamera as CameraIcon,
  Store as StoreIcon,
  CheckCircle as VerifiedIcon,
  Cancel as CancelledIcon,
  HourglassEmpty as PendingIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLocalPurchases } from "@/hooks/queries/useLocalPurchases";
import LocalPurchaseDialog from "@/components/materials/LocalPurchaseDialog";
import LocalPurchaseDetailDialog from "@/components/materials/LocalPurchaseDetailDialog";
import type {
  LocalPurchaseWithDetails,
  LocalPurchaseStatus,
} from "@/types/material.types";
import { LOCAL_PURCHASE_STATUS_LABELS } from "@/types/material.types";

// Format currency
const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Status colors
const statusColors: Record<LocalPurchaseStatus, "default" | "success" | "error"> = {
  draft: "default",
  completed: "success",
  cancelled: "error",
};

// Status icons
const statusIcons: Record<LocalPurchaseStatus, React.ReactNode> = {
  draft: <PendingIcon fontSize="small" />,
  completed: <VerifiedIcon fontSize="small" />,
  cancelled: <CancelledIcon fontSize="small" />,
};

export default function LocalPurchasesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] =
    useState<LocalPurchaseWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const isMobile = useIsMobile();

  // Fetch local purchases for current site
  const { data: purchases = [], isLoading } = useLocalPurchases(selectedSite?.id);

  // Filter purchases
  const filteredPurchases = useMemo(() => {
    let filtered = purchases;

    if (statusFilter) {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.vendor_name?.toLowerCase().includes(term) ||
          p.purchase_number?.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [purchases, statusFilter, searchTerm]);

  const handleOpenDialog = useCallback(() => {
    setSelectedPurchase(null);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedPurchase(null);
  }, []);

  const handleViewDetail = useCallback((purchase: LocalPurchaseWithDetails) => {
    setSelectedPurchase(purchase);
    setDetailDialogOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailDialogOpen(false);
    setSelectedPurchase(null);
  }, []);

  // Table columns
  const columns = useMemo<MRT_ColumnDef<LocalPurchaseWithDetails>[]>(
    () => [
      {
        accessorKey: "purchase_number",
        header: "Purchase #",
        size: 120,
        Cell: ({ row }) => (
          <Typography variant="body2" fontWeight="medium">
            {row.original.purchase_number || "-"}
          </Typography>
        ),
      },
      {
        accessorKey: "purchase_date",
        header: "Date",
        size: 100,
        Cell: ({ row }) => formatDate(row.original.purchase_date),
      },
      {
        accessorKey: "vendor_name",
        header: "Vendor",
        size: 180,
        Cell: ({ row }) => (
          <Box>
            <Typography variant="body2">{row.original.vendor_name}</Typography>
            {row.original.is_new_vendor && (
              <Chip label="New" size="small" color="info" sx={{ ml: 0.5 }} />
            )}
          </Box>
        ),
      },
      {
        accessorKey: "total_amount",
        header: "Amount",
        size: 100,
        Cell: ({ row }) => (
          <Typography variant="body2" fontWeight="medium">
            {formatCurrency(row.original.total_amount)}
          </Typography>
        ),
      },
      {
        accessorKey: "payment_mode",
        header: "Payment",
        size: 100,
        Cell: ({ row }) => {
          const mode = row.original.payment_mode;
          const label =
            mode === "cash"
              ? "Cash"
              : mode === "upi"
              ? "UPI"
              : mode === "engineer_own"
              ? "Own Money"
              : mode;
          return (
            <Chip
              label={label}
              size="small"
              color={mode === "engineer_own" ? "warning" : "default"}
              variant="outlined"
            />
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 100,
        Cell: ({ row }) => {
          const status = row.original.status as LocalPurchaseStatus;
          return (
            <Chip
              icon={statusIcons[status] as React.ReactElement}
              label={LOCAL_PURCHASE_STATUS_LABELS[status]}
              size="small"
              color={statusColors[status]}
            />
          );
        },
      },
      {
        accessorKey: "receipt_url",
        header: "Receipt",
        size: 80,
        Cell: ({ row }) =>
          row.original.receipt_url ? (
            <Tooltip title="View Receipt">
              <IconButton
                size="small"
                onClick={() => window.open(row.original.receipt_url!, "_blank")}
              >
                <ReceiptIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Typography variant="caption" color="text.secondary">
              No receipt
            </Typography>
          ),
      },
    ],
    []
  );

  // Summary stats
  const stats = useMemo(() => {
    return {
      total: purchases.length,
      totalAmount: purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0),
      ownMoney: purchases
        .filter((p) => p.payment_mode === "engineer_own")
        .reduce((sum, p) => sum + (p.total_amount || 0), 0),
      pendingReimbursement: purchases
        .filter((p) => p.payment_mode === "engineer_own" && !p.reimbursement_transaction_id)
        .reduce((sum, p) => sum + (p.total_amount || 0), 0),
    };
  }, [purchases]);

  return (
    <Box>
      <PageHeader
        title="Local Purchases"
        subtitle="Track small purchases made locally for the site"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
          >
            Add Purchase
          </Button>
        }
      />

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Total Purchases
              </Typography>
              <Typography variant="h5">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Total Amount
              </Typography>
              <Typography variant="h5">{formatCurrency(stats.totalAmount)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Own Money Used
              </Typography>
              <Typography variant="h5" color="warning.main">
                {formatCurrency(stats.ownMoney)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Pending Reimbursement
              </Typography>
              <Typography variant="h5" color="error.main">
                {formatCurrency(stats.pendingReimbursement)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search vendor, purchase #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <DataTable
          columns={columns}
          data={filteredPurchases}
          isLoading={isLoading}
          enableRowSelection={false}
          muiTableBodyRowProps={({ row }) => ({
            onClick: () => handleViewDetail(row.original),
            sx: { cursor: "pointer" },
          })}
        />
      </Card>

      {/* Mobile FAB */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="add purchase"
          onClick={handleOpenDialog}
          sx={{
            position: "fixed",
            bottom: 80,
            right: 16,
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Add/Edit Dialog */}
      <LocalPurchaseDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        siteId={selectedSite?.id}
        engineerId={userProfile?.id}
      />

      {/* Detail Dialog */}
      {selectedPurchase && (
        <LocalPurchaseDetailDialog
          open={detailDialogOpen}
          onClose={handleCloseDetail}
          purchase={selectedPurchase}
        />
      )}
    </Box>
  );
}
