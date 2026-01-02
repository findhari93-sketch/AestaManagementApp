"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Grid,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Add as AddIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  AccountBalance as BalanceIcon,
  Receipt as ReceiptIcon,
  History as HistoryIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import { useSite } from "@/contexts/SiteContext";
import { useRentalSummary, useOverdueRentals } from "@/hooks/queries/useRentals";
import {
  OngoingRentalsList,
  RentalOrderDialog,
} from "@/components/rentals";
import { formatCurrency } from "@/lib/formatters";

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

export default function SiteRentalsPage() {
  const router = useRouter();
  const { selectedSite } = useSite();
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  const siteId = selectedSite?.id || "";

  const { data: summary, isLoading: loadingSummary } = useRentalSummary(siteId);
  const { data: overdueRentals = [] } = useOverdueRentals(siteId);

  const handleViewOrder = (orderId: string) => {
    router.push(`/site/rentals/${orderId}`);
  };

  const handleCreateOrder = () => {
    setOrderDialogOpen(true);
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

      {/* Quick Actions */}
      <Box display="flex" gap={1} mb={3} flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          startIcon={<HistoryIcon />}
          onClick={() => router.push("/site/rentals?tab=history")}
        >
          View History
        </Button>
      </Box>

      {/* Overdue Alert */}
      {overdueRentals.length > 0 && (
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

      {/* Ongoing Rentals List */}
      <OngoingRentalsList
        siteId={siteId}
        onViewOrder={handleViewOrder}
        onCreateOrder={handleCreateOrder}
        showOverdueAlert={false}
      />

      {/* Create Order Dialog */}
      <RentalOrderDialog
        open={orderDialogOpen}
        onClose={() => setOrderDialogOpen(false)}
        siteId={siteId}
      />
    </Box>
  );
}
