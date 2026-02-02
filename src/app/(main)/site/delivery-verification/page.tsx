"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  Grid,
  Skeleton,
  Alert,
  Button,
  Divider,
  Stack,
  Badge,
} from "@mui/material";
import {
  LocalShipping as DeliveryIcon,
  CheckCircle as VerifiedIcon,
  Warning as DisputedIcon,
  Cancel as RejectedIcon,
  ShoppingCart as POIcon,
  Groups as GroupStockIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import { useSite } from "@/contexts/SiteContext";
import {
  useDeliveriesWithVerification,
  usePOsAwaitingDelivery,
  type POAwaitingDelivery,
} from "@/hooks/queries/useDeliveryVerification";
import RecordAndVerifyDeliveryDialog from "@/components/materials/RecordAndVerifyDeliveryDialog";
import type { DeliveryVerificationStatus, PurchaseOrderWithDetails } from "@/types/material.types";

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

// Status icons and colors
const statusConfig: Record<
  DeliveryVerificationStatus,
  { icon: React.ReactNode; color: "default" | "success" | "warning" | "error"; label: string }
> = {
  pending: {
    icon: <DisputedIcon fontSize="small" />,
    color: "default",
    label: "Pending",
  },
  verified: {
    icon: <VerifiedIcon fontSize="small" />,
    color: "success",
    label: "Verified",
  },
  disputed: {
    icon: <DisputedIcon fontSize="small" />,
    color: "warning",
    label: "Disputed",
  },
  rejected: {
    icon: <RejectedIcon fontSize="small" />,
    color: "error",
    label: "Rejected",
  },
};

// Type for delivery data from hooks
interface DeliveryData {
  id: string;
  grn_number: string | null;
  po_number: string | null;
  vendor_name: string | null;
  site_id: string;
  delivery_date: string;
  total_value: number | null;
  item_count: number;
  vehicle_number: string | null;
  driver_name: string | null;
  verification_status?: string;
}

export default function DeliveryVerificationPage() {
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<POAwaitingDelivery | null>(null);
  const [activeTab, setActiveTab] = useState<"awaiting" | "disputed" | "all">("awaiting");

  const { selectedSite } = useSite();

  // Fetch POs awaiting delivery
  const { data: posAwaitingDelivery = [], isLoading: posLoading } =
    usePOsAwaitingDelivery(selectedSite?.id);

  // Fetch all deliveries with verification status
  const { data: allDeliveries = [], isLoading: allLoading } =
    useDeliveriesWithVerification(selectedSite?.id);

  const handleRecordDelivery = useCallback((po: POAwaitingDelivery) => {
    setSelectedPO(po);
    setDeliveryDialogOpen(true);
  }, []);

  const handleCloseDeliveryDialog = useCallback(() => {
    setDeliveryDialogOpen(false);
    setSelectedPO(null);
  }, []);

  // Filter deliveries by status
  const recentDeliveries = useMemo(() => {
    return allDeliveries.slice(0, 20);
  }, [allDeliveries]);

  const disputedDeliveries = useMemo(() => {
    return allDeliveries.filter(
      (d: DeliveryData) => d.verification_status === "disputed"
    );
  }, [allDeliveries]);

  return (
    <Box>
      <PageHeader
        title="Delivery Management"
        subtitle="Record deliveries and add materials to stock"
      />

      {/* Disputed Alert */}
      {disputedDeliveries.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>{disputedDeliveries.length} deliveries</strong> have issues
          flagged and need review.
        </Alert>
      )}

      {/* Tab Buttons */}
      <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
        <Button
          variant={activeTab === "awaiting" ? "contained" : "outlined"}
          onClick={() => setActiveTab("awaiting")}
          startIcon={
            <Badge badgeContent={posAwaitingDelivery.length} color="primary">
              <POIcon />
            </Badge>
          }
        >
          Awaiting Delivery
        </Button>
        {disputedDeliveries.length > 0 && (
          <Button
            variant={activeTab === "disputed" ? "contained" : "outlined"}
            onClick={() => setActiveTab("disputed")}
            startIcon={
              <Badge badgeContent={disputedDeliveries.length} color="error">
                <DisputedIcon />
              </Badge>
            }
          >
            Disputed
          </Button>
        )}
        <Button
          variant={activeTab === "all" ? "contained" : "outlined"}
          onClick={() => setActiveTab("all")}
          startIcon={<DeliveryIcon />}
        >
          Recent Deliveries
        </Button>
      </Box>

      {/* Content */}
      {activeTab === "awaiting" ? (
        // POs Awaiting Delivery
        posLoading ? (
          <Grid container spacing={2}>
            {[1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <Skeleton height={280} variant="rounded" />
              </Grid>
            ))}
          </Grid>
        ) : posAwaitingDelivery.length === 0 ? (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: "center", py: 4 }}>
                <POIcon sx={{ fontSize: 64, mb: 2, color: "text.secondary" }} />
                <Typography variant="h6" gutterBottom>
                  No Orders Awaiting Delivery
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  All purchase orders have been delivered or are not yet
                  ordered.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {posAwaitingDelivery.map((po) => (
              <Grid key={po.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: "pointer",
                    "&:hover": { borderColor: "primary.main", boxShadow: 1 },
                    transition: "all 0.2s",
                  }}
                  onClick={() => handleRecordDelivery(po)}
                >
                  <CardContent>
                    <Stack spacing={1.5}>
                      {/* Header */}
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {po.po_number}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Ordered: {formatDate(po.order_date)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          {po.is_group_stock && (
                            <Chip
                              icon={<GroupStockIcon fontSize="small" />}
                              label="Group"
                              size="small"
                              color="secondary"
                            />
                          )}
                          <Chip
                            label={po.status === "partial_delivered" ? "Partial" : "Ordered"}
                            size="small"
                            color={po.status === "partial_delivered" ? "warning" : "info"}
                          />
                        </Stack>
                      </Box>

                      <Divider />

                      {/* Vendor */}
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Vendor
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {po.vendor_name || "-"}
                        </Typography>
                      </Box>

                      {/* Items Summary */}
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Items
                          </Typography>
                          <Typography variant="body2">
                            {po.item_count} item{po.item_count !== 1 ? "s" : ""}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography variant="caption" color="text.secondary">
                            Total Value
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="primary">
                            {formatCurrency(po.total_amount)}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Expected Delivery */}
                      {po.expected_delivery_date && (
                        <Chip
                          label={`Expected: ${formatDate(po.expected_delivery_date)}`}
                          size="small"
                          variant="outlined"
                        />
                      )}

                      {/* Action Button */}
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<DeliveryIcon />}
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRecordDelivery(po);
                        }}
                      >
                        Record & Verify
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )
      ) : activeTab === "disputed" ? (
        // Disputed Deliveries
        allLoading ? (
          <Grid container spacing={2}>
            {[1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <Skeleton height={200} variant="rounded" />
              </Grid>
            ))}
          </Grid>
        ) : disputedDeliveries.length === 0 ? (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: "center", py: 4 }}>
                <VerifiedIcon
                  sx={{ fontSize: 64, mb: 2, color: "success.main" }}
                />
                <Typography variant="h6" gutterBottom>
                  No Disputed Deliveries
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  All deliveries have been verified without issues.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {(disputedDeliveries as DeliveryData[]).map((delivery) => {
              const config = statusConfig.disputed;
              return (
                <Grid key={delivery.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined" sx={{ borderColor: "warning.main" }}>
                    <CardContent>
                      <Stack spacing={1}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Typography variant="subtitle2">
                            {delivery.grn_number || "GRN"}
                          </Typography>
                          <Chip
                            icon={config.icon as React.ReactElement}
                            label={config.label}
                            size="small"
                            color={config.color}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {delivery.po_number || "Direct Delivery"}
                        </Typography>
                        <Typography variant="body2">
                          {delivery.vendor_name || "-"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(delivery.delivery_date)}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )
      ) : (
        // Recent Deliveries
        allLoading ? (
          <Grid container spacing={2}>
            {[1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <Skeleton height={200} variant="rounded" />
              </Grid>
            ))}
          </Grid>
        ) : recentDeliveries.length === 0 ? (
          <Alert severity="info">No deliveries found for this site.</Alert>
        ) : (
          <Grid container spacing={2}>
            {(recentDeliveries as DeliveryData[]).map((delivery) => {
              const status = (delivery.verification_status ||
                "verified") as DeliveryVerificationStatus;
              const config = statusConfig[status];

              return (
                <Grid key={delivery.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Typography variant="subtitle2">
                            {delivery.grn_number || "GRN"}
                          </Typography>
                          <Chip
                            icon={config.icon as React.ReactElement}
                            label={config.label}
                            size="small"
                            color={config.color}
                          />
                        </Box>
                        <Typography variant="body2">
                          {delivery.vendor_name || "-"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(delivery.delivery_date)}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )
      )}

      {/* Record & Verify Delivery Dialog - combines recording and verification */}
      {selectedPO && (
        <RecordAndVerifyDeliveryDialog
          open={deliveryDialogOpen}
          onClose={handleCloseDeliveryDialog}
          purchaseOrder={transformPOForDialog(selectedPO)}
          siteId={selectedSite?.id || ""}
        />
      )}
    </Box>
  );
}

// Helper function to transform POAwaitingDelivery to PurchaseOrderWithDetails format
function transformPOForDialog(po: POAwaitingDelivery): PurchaseOrderWithDetails {
  // Create a partial object with the fields DeliveryDialog actually uses
  // and cast to PurchaseOrderWithDetails
  return {
    id: po.id,
    po_number: po.po_number,
    site_id: po.site_id,
    vendor_id: po.vendor_id || "",
    status: po.status,
    order_date: po.order_date,
    expected_delivery_date: po.expected_delivery_date,
    total_amount: po.total_amount,
    internal_notes: po.is_group_stock
      ? JSON.stringify({ is_group_stock: true, site_group_id: po.site_group_id })
      : null,
    vendor: po.vendor_name
      ? { id: po.vendor_id || "", name: po.vendor_name }
      : undefined,
    items: po.items.map((item) => ({
      id: item.id,
      po_id: po.id,
      material_id: item.material_id,
      brand_id: item.brand_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      received_qty: item.received_qty,
      pending_qty: item.quantity - item.received_qty,
      total_amount: item.quantity * item.unit_price,
      material: {
        id: item.material_id,
        name: item.material_name || "",
        code: "",
        unit: item.unit || "nos",
      },
      brand: item.brand_id
        ? { id: item.brand_id, brand_name: item.brand_name || "" }
        : null,
    })),
  } as unknown as PurchaseOrderWithDetails;
}
