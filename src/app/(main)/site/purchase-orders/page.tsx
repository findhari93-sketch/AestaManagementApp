"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
  Fab,
  Tooltip,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  LocalShipping as DeliveryIcon,
  Send as SendIcon,
  Cancel as CancelIcon,
  Groups as GroupStockIcon,
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import RelatedPages from "@/components/layout/RelatedPages";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasAdminPermission, hasEditPermission } from "@/lib/permissions";
import {
  usePurchaseOrders,
  usePOSummary,
  useMarkPOAsOrdered,
  useCancelPurchaseOrder,
} from "@/hooks/queries/usePurchaseOrders";
import PurchaseOrderDialog from "@/components/materials/PurchaseOrderDialog";
import DeliveryDialog from "@/components/materials/DeliveryDialog";
import PODetailsDrawer from "@/components/materials/PODetailsDrawer";
import PODeleteConfirmationDialog from "@/components/materials/PODeleteConfirmationDialog";
import type {
  PurchaseOrderWithDetails,
  POStatus,
  PO_STATUS_LABELS,
} from "@/types/material.types";
import { formatCurrency, formatDate } from "@/lib/formatters";

const STATUS_COLORS: Record<POStatus, "default" | "info" | "warning" | "success" | "error"> = {
  draft: "default",
  pending_approval: "warning",
  approved: "info",
  ordered: "info",
  partial_delivered: "warning",
  delivered: "success",
  cancelled: "error",
};

const STATUS_LABELS: Record<POStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  ordered: "Ordered",
  partial_delivered: "Partial",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

type TabValue = "all" | "draft" | "active" | "delivered";

// Prefilled data from URL params (e.g., from material-search)
interface PrefilledPOData {
  vendorId?: string;
  materialId?: string;
  materialName?: string;
  unit?: string;
  source?: string;
}

export default function PurchaseOrdersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrderWithDetails | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithDetails | null>(null);
  const [currentTab, setCurrentTab] = useState<TabValue>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [prefilledData, setPrefilledData] = useState<PrefilledPOData | null>(null);

  // Confirmation dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPO, setDeletingPO] = useState<PurchaseOrderWithDetails | null>(null);

  const [placeOrderDialogOpen, setPlaceOrderDialogOpen] = useState(false);
  const [placingOrderPO, setPlacingOrderPO] = useState<PurchaseOrderWithDetails | null>(null);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingPO, setCancellingPO] = useState<PurchaseOrderWithDetails | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");

  const searchParams = useSearchParams();
  const router = useRouter();
  const { userProfile, user } = useAuth();
  const { selectedSite } = useSite();
  const isMobile = useIsMobile();
  const canEdit = hasEditPermission(userProfile?.role);
  const isAdmin = hasAdminPermission(userProfile?.role);

  // Track if we've already processed URL params
  const hasProcessedParams = useRef(false);

  // Extract specific param values to use as stable dependencies
  const isNewParam = searchParams.get("new");
  const vendorIdParam = searchParams.get("vendorId");
  const materialIdParam = searchParams.get("materialId");
  const materialNameParam = searchParams.get("materialName");
  const unitParam = searchParams.get("unit");
  const sourceParam = searchParams.get("source");

  // Handle URL params for prefilled data (from material-search)
  useEffect(() => {
    if (hasProcessedParams.current) return;

    const isNew = isNewParam === "true";
    if (isNew && (vendorIdParam || materialIdParam)) {
      hasProcessedParams.current = true;

      setPrefilledData({
        vendorId: vendorIdParam || undefined,
        materialId: materialIdParam || undefined,
        materialName: materialNameParam || undefined,
        unit: unitParam || undefined,
        source: sourceParam || undefined,
      });

      // Auto-open the dialog
      setDialogOpen(true);

      // Clean up URL params after reading
      router.replace("/site/purchase-orders", { scroll: false });
    }
  }, [isNewParam, vendorIdParam, materialIdParam, materialNameParam, unitParam, sourceParam, router]);

  const { data: allPOs = [], isLoading } = usePurchaseOrders(selectedSite?.id);
  const { data: summary } = usePOSummary(selectedSite?.id);

  const markAsOrdered = useMarkPOAsOrdered();
  const cancelPO = useCancelPurchaseOrder();

  // Filter POs based on tab and search
  const filteredPOs = useMemo(() => {
    let filtered = allPOs;

    // Filter by tab
    switch (currentTab) {
      case "draft":
        filtered = filtered.filter((po) => po.status === "draft");
        break;
      case "active":
        filtered = filtered.filter((po) =>
          ["ordered", "partial_delivered"].includes(po.status)
        );
        break;
      case "delivered":
        filtered = filtered.filter((po) => po.status === "delivered");
        break;
    }

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (po) =>
          po.po_number.toLowerCase().includes(term) ||
          po.vendor?.name?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [allPOs, currentTab, searchTerm]);

  const handleOpenDialog = useCallback((po?: PurchaseOrderWithDetails) => {
    setEditingPO(po || null);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingPO(null);
    setPrefilledData(null); // Clear prefilled data on close
  }, []);

  const handleOpenDeliveryDialog = useCallback((po: PurchaseOrderWithDetails) => {
    setSelectedPO(po);
    setDeliveryDialogOpen(true);
  }, []);

  const handleCloseDeliveryDialog = useCallback(() => {
    setDeliveryDialogOpen(false);
    setSelectedPO(null);
  }, []);

  const handleViewDetails = useCallback((po: PurchaseOrderWithDetails) => {
    setSelectedPO(po);
    setDetailsDrawerOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailsDrawerOpen(false);
    setSelectedPO(null);
  }, []);

  const handleDelete = useCallback((po: PurchaseOrderWithDetails) => {
    setDeletingPO(po);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeletingPO(null);
  }, []);

  // Place order - moves draft PO directly to ordered status
  const handlePlaceOrder = useCallback((po: PurchaseOrderWithDetails) => {
    setPlacingOrderPO(po);
    setPlaceOrderDialogOpen(true);
  }, []);

  const handleConfirmPlaceOrder = useCallback(async () => {
    if (!placingOrderPO) return;
    try {
      await markAsOrdered.mutateAsync(placingOrderPO.id);
      setPlaceOrderDialogOpen(false);
      setPlacingOrderPO(null);
    } catch (error) {
      console.error("Failed to place order:", error);
    }
  }, [markAsOrdered, placingOrderPO]);

  const handleCancel = useCallback((po: PurchaseOrderWithDetails) => {
    setCancellingPO(po);
    setCancelReason("");
    setCancelError("");
    setCancelDialogOpen(true);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!cancellingPO || !user?.id) return;
    setCancelError("");
    try {
      await cancelPO.mutateAsync({ id: cancellingPO.id, userId: user.id, reason: cancelReason });
      setCancelDialogOpen(false);
      setCancellingPO(null);
      setCancelReason("");
    } catch (error: any) {
      console.error("Failed to cancel PO:", error);
      setCancelError(error?.message || "Failed to cancel purchase order. Please try again.");
    }
  }, [cancelPO, cancellingPO, cancelReason, user?.id]);

  // Table columns
  const columns = useMemo<MRT_ColumnDef<PurchaseOrderWithDetails>[]>(
    () => [
      {
        accessorKey: "po_number",
        header: "PO Number",
        size: 160,
        Cell: ({ row }) => {
          // Parse internal_notes if it's a JSON string
          let parsedNotes: { is_group_stock?: boolean; site_group_id?: string } | null = null;
          if (row.original.internal_notes) {
            try {
              parsedNotes = typeof row.original.internal_notes === "string"
                ? JSON.parse(row.original.internal_notes)
                : row.original.internal_notes;
            } catch {
              // Ignore parse errors
            }
          }
          const isGroupStock = parsedNotes?.is_group_stock === true;
          return (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  sx={{ cursor: "pointer", color: "primary.main" }}
                  onClick={() => handleViewDetails(row.original)}
                >
                  {row.original.po_number}
                </Typography>
                {isGroupStock && (
                  <Tooltip title="Group Stock Purchase">
                    <Chip
                      icon={<GroupStockIcon sx={{ fontSize: 14 }} />}
                      label="Group"
                      size="small"
                      color="secondary"
                      sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-icon": { ml: 0.5 } }}
                    />
                  </Tooltip>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {formatDate(row.original.order_date)}
              </Typography>
            </Box>
          );
        },
      },
      {
        accessorKey: "vendor.name",
        header: "Vendor",
        size: 180,
        Cell: ({ row }) => row.original.vendor?.name || "-",
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 130,
        Cell: ({ row }) => (
          <Chip
            label={STATUS_LABELS[row.original.status]}
            color={STATUS_COLORS[row.original.status]}
            size="small"
          />
        ),
      },
      {
        accessorKey: "total_amount",
        header: "Amount",
        size: 120,
        Cell: ({ row }) => {
          const itemsTotal = row.original.total_amount || 0;
          const transportCost = row.original.transport_cost || 0;
          const grandTotal = itemsTotal + transportCost;
          return grandTotal > 0 ? formatCurrency(grandTotal) : "-";
        },
      },
      {
        accessorKey: "items",
        header: "Items",
        size: 80,
        Cell: ({ row }) => row.original.items?.length || 0,
      },
      {
        accessorKey: "expected_delivery_date",
        header: "Expected",
        size: 110,
        Cell: ({ row }) =>
          row.original.expected_delivery_date
            ? formatDate(row.original.expected_delivery_date)
            : "-",
      },
    ],
    [handleViewDetails]
  );

  // Row actions
  const renderRowActions = useCallback(
    ({ row }: { row: { original: PurchaseOrderWithDetails } }) => {
      const po = row.original;
      return (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => handleViewDetails(po)}>
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Draft POs - can edit, place order, or delete */}
          {po.status === "draft" && canEdit && (
            <>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleOpenDialog(po)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Place Order">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handlePlaceOrder(po)}
                >
                  <SendIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(po)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* Ordered or Partial - can record delivery */}
          {["ordered", "partial_delivered"].includes(po.status) && canEdit && (
            <Tooltip title="Record Delivery">
              <IconButton
                size="small"
                color="success"
                onClick={() => handleOpenDeliveryDialog(po)}
              >
                <DeliveryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* Cancelled - can delete */}
          {po.status === "cancelled" && canEdit && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDelete(po)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* Delivered - can edit and delete */}
          {po.status === "delivered" && canEdit && (
            <>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleOpenDialog(po)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(po)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      );
    },
    [
      canEdit,
      handleViewDetails,
      handleOpenDialog,
      handlePlaceOrder,
      handleDelete,
      handleOpenDeliveryDialog,
    ]
  );

  if (!selectedSite) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">
          Please select a site to manage purchase orders
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Purchase Orders"
        actions={
          !isMobile && canEdit ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Create PO
            </Button>
          ) : null
        }
      />

      <RelatedPages />

      {/* Show info when coming from material-search */}
      {prefilledData?.source === "material-search" && dialogOpen && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Creating purchase order from Price Comparison. Vendor and material will be pre-filled.
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Draft
              </Typography>
              <Typography variant="h5">{summary?.draft || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Active Orders
              </Typography>
              <Typography variant="h5" color="info.main">
                {(summary?.ordered || 0) +
                  (summary?.partial_delivered || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Delivered
              </Typography>
              <Typography variant="h5" color="success.main">
                {summary?.delivered || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Total
              </Typography>
              <Typography variant="h5">
                {(summary?.draft || 0) +
                  (summary?.ordered || 0) +
                  (summary?.partial_delivered || 0) +
                  (summary?.delivered || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs and Search */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={currentTab}
          onChange={(_, v) => setCurrentTab(v)}
          sx={{ mb: 2 }}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons="auto"
        >
          <Tab label="All" value="all" />
          <Tab label="Draft" value="draft" />
          <Tab label="Active" value="active" />
          <Tab label="Delivered" value="delivered" />
        </Tabs>

        <TextField
          size="small"
          placeholder="Search PO number or vendor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 280 }}
        />
      </Box>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredPOs}
        isLoading={isLoading}
        enableRowActions
        renderRowActions={renderRowActions}
        mobileHiddenColumns={["items", "expected_delivery_date"]}
        initialState={{
          sorting: [{ id: "po_number", desc: true }],
        }}
      />

      {/* Mobile FAB */}
      {isMobile && canEdit && (
        <Fab
          color="primary"
          sx={{ position: "fixed", bottom: 16, right: 16 }}
          onClick={() => handleOpenDialog()}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Create/Edit PO Dialog */}
      <PurchaseOrderDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        purchaseOrder={editingPO}
        siteId={selectedSite.id}
        prefilledVendorId={prefilledData?.vendorId}
        prefilledMaterialId={prefilledData?.materialId}
        prefilledMaterialName={prefilledData?.materialName}
        prefilledUnit={prefilledData?.unit}
      />

      {/* Delivery Dialog */}
      <DeliveryDialog
        open={deliveryDialogOpen}
        onClose={handleCloseDeliveryDialog}
        purchaseOrder={selectedPO}
        siteId={selectedSite.id}
      />

      {/* PO Details Drawer */}
      <PODetailsDrawer
        open={detailsDrawerOpen}
        onClose={handleCloseDetails}
        purchaseOrder={selectedPO}
        onRecordDelivery={handleOpenDeliveryDialog}
        onEdit={handleOpenDialog}
        canEdit={canEdit}
        isAdmin={isAdmin}
      />

      {/* Cancellation Reason Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => {
          setCancelDialogOpen(false);
          setCancellingPO(null);
          setCancelReason("");
          setCancelError("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Cancel Purchase Order</DialogTitle>
        <DialogContent>
          {cancelError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {cancelError}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Are you sure you want to cancel PO <strong>{cancellingPO?.po_number}</strong>?
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Cancellation Reason"
            placeholder="Enter reason for cancellation"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setCancelDialogOpen(false);
              setCancellingPO(null);
              setCancelReason("");
              setCancelError("");
            }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmCancel}
            disabled={cancelPO.isPending}
            startIcon={cancelPO.isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {cancelPO.isPending ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog with Impact Summary */}
      <PODeleteConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingPO(null);
        }}
        poId={deletingPO?.id}
        poNumber={deletingPO?.po_number}
        siteId={selectedSite?.id || ""}
        onSuccess={handleDeleteSuccess}
      />

      {/* Place Order Confirmation Dialog */}
      <Dialog
        open={placeOrderDialogOpen}
        onClose={() => {
          setPlaceOrderDialogOpen(false);
          setPlacingOrderPO(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Place Order</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to place order for PO <strong>{placingOrderPO?.po_number}</strong>? This indicates the order has been sent to the vendor.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setPlaceOrderDialogOpen(false);
              setPlacingOrderPO(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmPlaceOrder}
            disabled={markAsOrdered.isPending}
            startIcon={markAsOrdered.isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {markAsOrdered.isPending ? "Placing Order..." : "Place Order"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
