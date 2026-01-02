"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Button,
  Chip,
} from "@mui/material";
import {
  Add as AddIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { useOngoingRentals, useOverdueRentals } from "@/hooks/queries/useRentals";
import RentalOrderCard from "./RentalOrderCard";
import RentalReturnDialog from "./RentalReturnDialog";
import RentalAdvanceDialog from "./RentalAdvanceDialog";
import type { RentalOrderWithDetails } from "@/types/rental.types";

interface OngoingRentalsListProps {
  siteId: string;
  onViewOrder?: (orderId: string) => void;
  onCreateOrder?: () => void;
  showOverdueAlert?: boolean;
}

export default function OngoingRentalsList({
  siteId,
  onViewOrder,
  onCreateOrder,
  showOverdueAlert = true,
}: OngoingRentalsListProps) {
  const { data: ongoingRentals = [], isLoading, error } = useOngoingRentals(siteId);
  const { data: overdueRentals = [] } = useOverdueRentals(siteId);

  const [selectedOrder, setSelectedOrder] = useState<RentalOrderWithDetails | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);

  const handleRecordReturn = (order: RentalOrderWithDetails) => {
    setSelectedOrder(order);
    setReturnDialogOpen(true);
  };

  const handleRecordAdvance = (order: RentalOrderWithDetails) => {
    setSelectedOrder(order);
    setAdvanceDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load ongoing rentals. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Overdue Alert */}
      {showOverdueAlert && overdueRentals.length > 0 && (
        <Alert
          severity="warning"
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
            Overdue Rentals
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {overdueRentals.map((r) => r.vendor?.shop_name || r.vendor?.name).join(", ")}
          </Typography>
        </Alert>
      )}

      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">Ongoing Rentals</Typography>
          <Chip
            size="small"
            label={ongoingRentals.length}
            color="primary"
            variant="outlined"
          />
        </Box>
        {onCreateOrder && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={onCreateOrder}
          >
            New Rental
          </Button>
        )}
      </Box>

      {/* Rentals List */}
      {ongoingRentals.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            No ongoing rentals at this site.
          </Typography>
          {onCreateOrder && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onCreateOrder}
              sx={{ mt: 2 }}
            >
              Create New Rental
            </Button>
          )}
        </Paper>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {ongoingRentals.map((order) => (
            <RentalOrderCard
              key={order.id}
              order={order}
              onClick={() => onViewOrder?.(order.id)}
              onRecordReturn={() => handleRecordReturn(order)}
              onRecordAdvance={() => handleRecordAdvance(order)}
            />
          ))}
        </Box>
      )}

      {/* Return Dialog */}
      {selectedOrder && (
        <RentalReturnDialog
          open={returnDialogOpen}
          onClose={() => {
            setReturnDialogOpen(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}

      {/* Advance Dialog */}
      {selectedOrder && (
        <RentalAdvanceDialog
          open={advanceDialogOpen}
          onClose={() => {
            setAdvanceDialogOpen(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}
    </Box>
  );
}
