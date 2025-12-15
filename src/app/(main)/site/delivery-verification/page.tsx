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
  HourglassEmpty as PendingIcon,
  PhotoCamera as CameraIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  usePendingDeliveryVerifications,
  useDeliveriesWithVerification,
} from "@/hooks/queries/useDeliveryVerification";
import DeliveryVerificationDialog from "@/components/materials/DeliveryVerificationDialog";
import type { DeliveryVerificationStatus } from "@/types/material.types";

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
    icon: <PendingIcon fontSize="small" />,
    color: "default",
    label: "Pending Verification",
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

// Delivery Card for pending verifications
function PendingDeliveryCard({
  delivery,
  onClick,
}: {
  delivery: DeliveryData;
  onClick: () => void;
}) {
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        cursor: "pointer",
        "&:hover": { borderColor: "primary.main", boxShadow: 1 },
        transition: "all 0.2s",
      }}
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
                {delivery.grn_number || "GRN"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {delivery.po_number || "Direct Delivery"}
              </Typography>
            </Box>
            <Chip
              icon={<PendingIcon fontSize="small" />}
              label="Verify Now"
              size="small"
              color="warning"
            />
          </Box>

          <Divider />

          {/* Vendor & Date */}
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Vendor
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {delivery.vendor_name || "-"}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="caption" color="text.secondary">
                Delivery Date
              </Typography>
              <Typography variant="body2">
                {formatDate(delivery.delivery_date)}
              </Typography>
            </Box>
          </Box>

          {/* Items & Value */}
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Items
              </Typography>
              <Typography variant="body2">
                {delivery.item_count || 0} items
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="caption" color="text.secondary">
                Total Value
              </Typography>
              <Typography variant="body2" fontWeight="medium" color="primary">
                {formatCurrency(delivery.total_value)}
              </Typography>
            </Box>
          </Box>

          {/* Vehicle Info */}
          {delivery.vehicle_number && (
            <Box sx={{ display: "flex", gap: 1 }}>
              <Chip
                label={`Vehicle: ${delivery.vehicle_number}`}
                size="small"
                variant="outlined"
              />
              {delivery.driver_name && (
                <Chip
                  label={delivery.driver_name}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          )}

          {/* Action Button */}
          <Button
            variant="contained"
            startIcon={<CameraIcon />}
            fullWidth
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            Verify with Photos
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DeliveryVerificationPage() {
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  const { userProfile } = useAuth();
  const { selectedSite } = useSite();
  const isMobile = useIsMobile();

  // Fetch pending deliveries
  const { data: pendingDeliveries = [], isLoading: pendingLoading } =
    usePendingDeliveryVerifications(selectedSite?.id);

  // Fetch all deliveries with verification status
  const { data: allDeliveries = [], isLoading: allLoading } =
    useDeliveriesWithVerification(selectedSite?.id);

  const handleVerifyClick = useCallback((deliveryId: string) => {
    setSelectedDeliveryId(deliveryId);
    setVerificationDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setVerificationDialogOpen(false);
    setSelectedDeliveryId(null);
  }, []);

  // Filter recent deliveries for "all" tab
  const recentDeliveries = useMemo(() => {
    return allDeliveries.slice(0, 20);
  }, [allDeliveries]);

  return (
    <Box>
      <PageHeader
        title="Delivery Verification"
        subtitle="Verify deliveries with photos before adding to stock"
      />

      {/* Pending Count Alert */}
      {pendingDeliveries.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>{pendingDeliveries.length} deliveries</strong> are pending
          verification. Stock won&apos;t be updated until verified.
        </Alert>
      )}

      {/* Tab Buttons */}
      <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
        <Button
          variant={activeTab === "pending" ? "contained" : "outlined"}
          onClick={() => setActiveTab("pending")}
          startIcon={
            <Badge badgeContent={pendingDeliveries.length} color="error">
              <PendingIcon />
            </Badge>
          }
        >
          Pending Verification
        </Button>
        <Button
          variant={activeTab === "all" ? "contained" : "outlined"}
          onClick={() => setActiveTab("all")}
          startIcon={<DeliveryIcon />}
        >
          Recent Deliveries
        </Button>
      </Box>

      {/* Content */}
      {activeTab === "pending" ? (
        // Pending Deliveries
        pendingLoading ? (
          <Grid container spacing={2}>
            {[1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <Skeleton height={280} variant="rounded" />
              </Grid>
            ))}
          </Grid>
        ) : pendingDeliveries.length === 0 ? (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: "center", py: 4 }}>
                <VerifiedIcon
                  sx={{ fontSize: 64, mb: 2, color: "success.main" }}
                />
                <Typography variant="h6" gutterBottom>
                  All Caught Up!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No pending deliveries to verify at this time.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {(pendingDeliveries as DeliveryData[]).map((delivery) => (
              <Grid key={delivery.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <PendingDeliveryCard
                  delivery={delivery}
                  onClick={() => handleVerifyClick(delivery.id)}
                />
              </Grid>
            ))}
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
                "pending") as DeliveryVerificationStatus;
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
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(delivery.delivery_date)}
                          </Typography>
                          {status === "pending" && (
                            <Button
                              size="small"
                              onClick={() =>
                                handleVerifyClick(delivery.id)
                              }
                            >
                              Verify
                            </Button>
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )
      )}

      {/* Verification Dialog */}
      {selectedDeliveryId && (
        <DeliveryVerificationDialog
          open={verificationDialogOpen}
          onClose={handleCloseDialog}
          deliveryId={selectedDeliveryId}
          userId={userProfile?.id}
        />
      )}
    </Box>
  );
}
