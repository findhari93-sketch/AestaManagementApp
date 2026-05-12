"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useConfirmRentalDelivery } from "@/hooks/queries/useRentals";
import type { RentalOrderWithDetails } from "@/types/rental.types";

interface DeliveryVerificationFormProps {
  open: boolean;
  onClose: () => void;
  order: RentalOrderWithDetails;
}

export function DeliveryVerificationForm({ open, onClose, order }: DeliveryVerificationFormProps) {
  const confirmDelivery = useConfirmRentalDelivery();
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [actualTransportCost, setActualTransportCost] = useState(
    order.transport_cost_outward?.toString() ?? "0"
  );
  const [itemQtys, setItemQtys] = useState<Record<string, number>>(
    Object.fromEntries((order.items ?? []).map((i) => [i.id, i.quantity]))
  );

  const handleSubmit = async () => {
    await confirmDelivery.mutateAsync({
      orderId: order.id,
      deliveryDate,
      actualTransportCost: parseFloat(actualTransportCost) || 0,
      itemsReceived: Object.entries(itemQtys).map(([order_item_id, qty_received]) => ({
        order_item_id,
        qty_received,
      })),
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Verify Delivery — {order.rental_order_number}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Confirm items received and actual transport cost. Adjust quantity if fewer items arrived.
        </Typography>

        <TextField
          label="Delivery date"
          type="date"
          fullWidth
          size="small"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Items Received
        </Typography>
        <Stack spacing={1} sx={{ mb: 2 }}>
          {(order.items ?? []).map((item) => (
            <Box
              key={item.id}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 1,
                bgcolor: "action.hover",
                borderRadius: 1,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {item.rental_item?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ordered: {item.quantity} pcs
                </Typography>
              </Box>
              <TextField
                type="number"
                size="small"
                label="Received"
                value={itemQtys[item.id] ?? item.quantity}
                onChange={(e) =>
                  setItemQtys((prev) => ({
                    ...prev,
                    [item.id]: Math.max(0, Math.min(item.quantity, Number(e.target.value))),
                  }))
                }
                inputProps={{ min: 0, max: item.quantity }}
                sx={{ width: 100 }}
              />
            </Box>
          ))}
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <TextField
          label="Actual transport cost (outward)"
          type="number"
          fullWidth
          size="small"
          value={actualTransportCost}
          onChange={(e) => setActualTransportCost(e.target.value)}
          InputProps={{
            startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography>,
          }}
          helperText="Update if actual cost differs from PO estimate"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleSubmit}
          disabled={confirmDelivery.isPending}
          size="small"
        >
          Confirm Delivery → Mark Active
        </Button>
      </DialogActions>
    </Dialog>
  );
}
