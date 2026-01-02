"use client";

import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Store as StoreIcon,
  CalendarMonth as CalendarIcon,
  Warning as WarningIcon,
  ArrowForward as ArrowIcon,
  Undo as ReturnIcon,
  Payment as PaymentIcon,
} from "@mui/icons-material";
import type { RentalOrderWithDetails } from "@/types/rental.types";
import {
  RENTAL_ORDER_STATUS_LABELS,
  RENTAL_ORDER_STATUS_COLORS,
} from "@/types/rental.types";
import dayjs from "dayjs";

interface RentalOrderCardProps {
  order: RentalOrderWithDetails;
  onClick?: () => void;
  onRecordReturn?: () => void;
  onRecordAdvance?: () => void;
  compact?: boolean;
}

export default function RentalOrderCard({
  order,
  onClick,
  onRecordReturn,
  onRecordAdvance,
  compact = false,
}: RentalOrderCardProps) {
  const accruedCost = order.accrued_rental_cost || 0;
  const advancesPaid = order.total_advance_paid || 0;
  const balanceDue = accruedCost - advancesPaid;

  // Count items summary
  const totalItems = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
  const returnedItems = (order.items || []).reduce(
    (sum, item) => sum + item.quantity_returned,
    0
  );
  const outstandingItems = totalItems - returnedItems;

  // Get unique item names (first 2)
  const itemNames = (order.items || [])
    .slice(0, 2)
    .map((item) => item.rental_item?.name || "Unknown")
    .join(", ");
  const hasMoreItems = (order.items || []).length > 2;

  // Status color mapping for MUI Chip
  const getChipColor = (
    status: keyof typeof RENTAL_ORDER_STATUS_COLORS
  ): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    const colorMap: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
      default: "primary",
      secondary: "secondary",
      destructive: "error",
      outline: "default",
    };
    return colorMap[RENTAL_ORDER_STATUS_COLORS[status]] || "default";
  };

  return (
    <Card
      variant="outlined"
      sx={{
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.2s",
        "&:hover": onClick
          ? {
              boxShadow: 2,
            }
          : {},
      }}
      onClick={onClick}
    >
      <CardContent sx={{ pb: compact ? 1 : 2 }}>
        {/* Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={1}
        >
          <Box>
            <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
              {order.rental_order_number}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <StoreIcon fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                {order.vendor?.shop_name || order.vendor?.name}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            {order.is_overdue && (
              <Chip
                size="small"
                icon={<WarningIcon />}
                label="Overdue"
                color="error"
              />
            )}
            <Chip
              size="small"
              label={RENTAL_ORDER_STATUS_LABELS[order.status]}
              color={getChipColor(order.status)}
              variant={order.status === "active" ? "filled" : "outlined"}
            />
          </Box>
        </Box>

        {/* Items Summary */}
        <Typography variant="body2" color="text.secondary" mb={1}>
          {itemNames}
          {hasMoreItems && ` +${(order.items || []).length - 2} more`}
        </Typography>

        {/* Dates */}
        <Box display="flex" alignItems="center" gap={2} mb={1.5}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <CalendarIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {dayjs(order.start_date).format("DD MMM")}
            </Typography>
          </Box>
          {order.expected_return_date && (
            <>
              <ArrowIcon fontSize="small" color="disabled" />
              <Typography
                variant="body2"
                color={order.is_overdue ? "error.main" : "text.secondary"}
              >
                {dayjs(order.expected_return_date).format("DD MMM")}
              </Typography>
            </>
          )}
          <Typography variant="caption" color="text.secondary">
            ({order.days_since_start || 0} days)
          </Typography>
        </Box>

        {/* Items Progress */}
        {!compact && (
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={1.5}
            p={1}
            bgcolor="grey.50"
            borderRadius={1}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Items
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {outstandingItems} outstanding / {totalItems} total
              </Typography>
            </Box>
            {returnedItems > 0 && (
              <Chip
                size="small"
                label={`${returnedItems} returned`}
                color="success"
                variant="outlined"
              />
            )}
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Financial Summary */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-end">
          <Box>
            <Typography variant="caption" color="text.secondary">
              Accrued Cost
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              ₹{accruedCost.toLocaleString()}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="success.main">
              Advances
            </Typography>
            <Typography variant="body2" color="success.main">
              ₹{advancesPaid.toLocaleString()}
            </Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="caption" color="text.secondary">
              Balance
            </Typography>
            <Typography
              variant="body1"
              fontWeight={700}
              color={balanceDue > 0 ? "error.main" : "success.main"}
            >
              ₹{balanceDue.toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </CardContent>

      {/* Actions */}
      {(onRecordReturn || onRecordAdvance) && (
        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
          {onRecordReturn && outstandingItems > 0 && (
            <Tooltip title="Record Return">
              <Button
                size="small"
                startIcon={<ReturnIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  onRecordReturn();
                }}
              >
                Return
              </Button>
            </Tooltip>
          )}
          {onRecordAdvance && (
            <Tooltip title="Record Advance">
              <Button
                size="small"
                startIcon={<PaymentIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  onRecordAdvance();
                }}
              >
                Advance
              </Button>
            </Tooltip>
          )}
        </CardActions>
      )}
    </Card>
  );
}
