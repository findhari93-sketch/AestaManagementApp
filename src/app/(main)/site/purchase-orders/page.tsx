"use client";

import { useMemo, useState, useCallback } from "react";
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
} from "@mui/icons-material";
import DataTable, { type MRT_ColumnDef } from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
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

export default function PurchaseOrdersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrderWithDetails | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithDetails | null>(null);
  const [currentTab, setCurrentTab] = useState<TabValue>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { userProfile, user } = useAuth();
  const { selectedSite } = useSite();
  const isMobile = useIsMobile();
  const canEdit = hasEditPermission(userProfile?.role);
  const isAdmin = hasAdminPermission(userProfile?.role);

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

  const handleDelete = useCallback(
    async (po: PurchaseOrderWithDetails) => {
      if (po.status !== "draft") {
        alert("Only draft POs can be deleted");
        return;
      }
      if (!confirm("Are you sure you want to delete this purchase order?")) return;
      try {
        await deletePO.mutateAsync({ id: po.id, siteId: po.site_id });
      } catch (error) {
        console.error("Failed to delete PO:", error);
      }
    },
    [deletePO]
  );

  const handleSubmitForApproval = useCallback(
    async (po: PurchaseOrderWithDetails) => {
      if (!confirm("Submit this PO for approval?")) return;
      try {
        await submitForApproval.mutateAsync(po.id);
      } catch (error) {
        console.error("Failed to submit PO:", error);
      }
    },
    [submitForApproval]
  );

  const handleApprove = useCallback(
    async (po: PurchaseOrderWithDetails) => {
      if (!user?.id) return;
      if (!confirm("Approve this purchase order?")) return;
      try {
        await approvePO.mutateAsync({ id: po.id, userId: user.id });
      } catch (error) {
        console.error("Failed to approve PO:", error);
      }
    },
    [approvePO, user?.id]
  );

  const handleMarkOrdered = useCallback(
    async (po: PurchaseOrderWithDetails) => {
      if (!confirm("Mark this PO as ordered (sent to vendor)?")) return;
      try {
        await markAsOrdered.mutateAsync(po.id);
      } catch (error) {
        console.error("Failed to update PO:", error);
      }
    },
    [markAsOrdered]
  );

  const handleCancel = useCallback(
    async (po: PurchaseOrderWithDetails) => {
      if (!user?.id) return;
      const reason = prompt("Enter cancellation reason:");
      if (reason === null) return;
      try {
        await cancelPO.mutateAsync({ id: po.id, userId: user.id, reason });
      } catch (error) {
        console.error("Failed to cancel PO:", error);
      }
    },
    [cancelPO, user?.id]
  );

  // Table columns
  const columns = useMemo<MRT_ColumnDef<PurchaseOrderWithDetails>[]>(
    () => [
      {
        accessorKey: "po_number",
        header: "PO Number",
        size: 130,
        Cell: ({ row }) => (
          <Box>
            <Typography
              variant="body2"
              fontWeight={500}
              sx={{ cursor: "pointer", color: "primary.main" }}
              onClick={() => handleViewDetails(row.original)}
            >
              {row.original.po_number}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(row.original.order_date)}
            </Typography>
          </Box>
        ),
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
        Cell: ({ row }) =>
          row.original.total_amount
            ? formatCurrency(row.original.total_amount)
            : "-",
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
    </Box>
  );
}
