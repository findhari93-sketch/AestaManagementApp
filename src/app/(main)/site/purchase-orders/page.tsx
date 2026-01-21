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
  Stack,
  Drawer,
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
  CheckCircle as ApproveIcon,
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
  useDeletePurchaseOrder,
  useSubmitPOForApproval,
  useApprovePurchaseOrder,
  useMarkPOAsOrdered,
  useCancelPurchaseOrder,
} from "@/hooks/queries/usePurchaseOrders";
import PurchaseOrderDialog from "@/components/materials/PurchaseOrderDialog";
import DeliveryDialog from "@/components/materials/DeliveryDialog";
import PODetailsDrawer from "@/components/materials/PODetailsDrawer";
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

type TabValue = "all" | "draft" | "pending" | "active" | "delivered";

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
  const [deleteError, setDeleteError] = useState("");

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submittingPO, setSubmittingPO] = useState<PurchaseOrderWithDetails | null>(null);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingPO, setApprovingPO] = useState<PurchaseOrderWithDetails | null>(null);

  const [markOrderedDialogOpen, setMarkOrderedDialogOpen] = useState(false);
  const [markingOrderedPO, setMarkingOrderedPO] = useState<PurchaseOrderWithDetails | null>(null);

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

  const deletePO = useDeletePurchaseOrder();
  const submitForApproval = useSubmitPOForApproval();
  const approvePO = useApprovePurchaseOrder();
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
      case "pending":
        filtered = filtered.filter((po) => po.status === "pending_approval");
        break;
      case "active":
        filtered = filtered.filter((po) =>
          ["approved", "ordered", "partial_delivered"].includes(po.status)
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
    setDeleteError("");
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingPO) return;
    setDeleteError("");
    try {
      await deletePO.mutateAsync({ id: deletingPO.id, siteId: deletingPO.site_id });
      setDeleteDialogOpen(false);
      setDeletingPO(null);
    } catch (error) {
      console.error("Failed to delete PO:", error);
      const message = error instanceof Error ? error.message : "Failed to delete purchase order";
      setDeleteError(message);
    }
  }, [deletePO, deletingPO]);

  const handleSubmitForApproval = useCallback((po: PurchaseOrderWithDetails) => {
    setSubmittingPO(po);
    setSubmitDialogOpen(true);
  }, []);

  const handleConfirmSubmit = useCallback(async () => {
    if (!submittingPO) return;
    try {
      await submitForApproval.mutateAsync(submittingPO.id);
      setSubmitDialogOpen(false);
      setSubmittingPO(null);
    } catch (error) {
      console.error("Failed to submit PO:", error);
    }
  }, [submitForApproval, submittingPO]);

  const handleApprove = useCallback((po: PurchaseOrderWithDetails) => {
    setApprovingPO(po);
    setApproveDialogOpen(true);
  }, []);

  const handleConfirmApprove = useCallback(async () => {
    if (!approvingPO || !user?.id) return;
    try {
      await approvePO.mutateAsync({ id: approvingPO.id, userId: user.id });
      setApproveDialogOpen(false);
      setApprovingPO(null);
    } catch (error) {
      console.error("Failed to approve PO:", error);
    }
  }, [approvePO, approvingPO, user?.id]);

  const handleMarkOrdered = useCallback((po: PurchaseOrderWithDetails) => {
    setMarkingOrderedPO(po);
    setMarkOrderedDialogOpen(true);
  }, []);

  const handleConfirmMarkOrdered = useCallback(async () => {
    if (!markingOrderedPO) return;
    try {
      await markAsOrdered.mutateAsync(markingOrderedPO.id);
      setMarkOrderedDialogOpen(false);
      setMarkingOrderedPO(null);
    } catch (error) {
      console.error("Failed to update PO:", error);
    }
  }, [markAsOrdered, markingOrderedPO]);

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

          {po.status === "draft" && canEdit && (
            <>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleOpenDialog(po)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Submit for Approval">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleSubmitForApproval(po)}
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

          {po.status === "pending_approval" && isAdmin && (
            <>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleOpenDialog(po)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Approve">
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleApprove(po)}
                >
                  <ApproveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleCancel(po)}
                >
                  <CancelIcon fontSize="small" />
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

          {po.status === "approved" && canEdit && (
            <Tooltip title="Mark as Ordered">
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleMarkOrdered(po)}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

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
      isAdmin,
      handleViewDetails,
      handleOpenDialog,
      handleSubmitForApproval,
      handleDelete,
      handleApprove,
      handleCancel,
      handleMarkOrdered,
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
                Pending Approval
              </Typography>
              <Typography variant="h5" color="warning.main">
                {summary?.pending_approval || 0}
              </Typography>
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
                {(summary?.approved || 0) +
                  (summary?.ordered || 0) +
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
          <Tab label="Pending" value="pending" />
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingPO(null);
          setDeleteError("");
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Purchase Order</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete PO <strong>{deletingPO?.po_number}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeletingPO(null);
              setDeleteError("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deletePO.isPending}
            startIcon={deletePO.isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {deletePO.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Submit for Approval Confirmation Dialog */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => {
          setSubmitDialogOpen(false);
          setSubmittingPO(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Submit for Approval</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to submit PO <strong>{submittingPO?.po_number}</strong> for approval?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setSubmitDialogOpen(false);
              setSubmittingPO(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmSubmit}
            disabled={submitForApproval.isPending}
            startIcon={submitForApproval.isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {submitForApproval.isPending ? "Submitting..." : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => {
          setApproveDialogOpen(false);
          setApprovingPO(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Approve Purchase Order</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to approve PO <strong>{approvingPO?.po_number}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setApproveDialogOpen(false);
              setApprovingPO(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmApprove}
            disabled={approvePO.isPending}
            startIcon={approvePO.isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {approvePO.isPending ? "Approving..." : "Approve"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark as Ordered Confirmation Dialog */}
      <Dialog
        open={markOrderedDialogOpen}
        onClose={() => {
          setMarkOrderedDialogOpen(false);
          setMarkingOrderedPO(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Mark as Ordered</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to mark PO <strong>{markingOrderedPO?.po_number}</strong> as ordered? This indicates the order has been placed with the vendor.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setMarkOrderedDialogOpen(false);
              setMarkingOrderedPO(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmMarkOrdered}
            disabled={markAsOrdered.isPending}
            startIcon={markAsOrdered.isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {markAsOrdered.isPending ? "Updating..." : "Mark as Ordered"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
