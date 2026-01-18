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
  LinearProgress,
  IconButton,
  Tooltip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";
import {
  Receipt as ReceiptIcon,
  Edit as EditIcon,
  SwapHoriz as ConvertIcon,
  CheckCircle as CompleteIcon,
  Inventory as InventoryIcon,
  CalendarMonth as CalendarIcon,
  Store as StoreIcon,
  Payment as PaymentIcon,
  OpenInNew as OpenIcon,
} from "@mui/icons-material";
import type {
  GroupStockBatch,
  MaterialBatchStatus,
} from "@/types/material.types";
import {
  MATERIAL_BATCH_STATUS_LABELS,
  MATERIAL_BATCH_STATUS_COLORS,
  MATERIAL_PAYMENT_MODE_LABELS,
} from "@/types/material.types";
import { formatCurrency } from "@/lib/formatters";
import dayjs from "dayjs";

interface GroupStockBatchCardProps {
  batch: GroupStockBatch;
  onViewBill?: () => void;
  onEdit?: () => void;
  onConvertToOwnSite?: () => void;
  onComplete?: () => void;
  onClick?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

export default function GroupStockBatchCard({
  batch,
  onViewBill,
  onEdit,
  onConvertToOwnSite,
  onComplete,
  onClick,
  showActions = true,
  compact = false,
}: GroupStockBatchCardProps) {
  const usagePercent =
    batch.original_quantity > 0
      ? ((batch.original_quantity - batch.remaining_quantity) /
          batch.original_quantity) *
        100
      : 0;

  const isEditable = batch.status === "in_stock" || batch.status === "partial_used";
  const canConvert = batch.status === "in_stock" || batch.status === "partial_used";
  const canComplete = batch.status === "in_stock" || batch.status === "partial_used";

  // Get first 2 materials for display
  const displayItems = (batch.items || []).slice(0, 2);
  const hasMoreItems = (batch.items || []).length > 2;

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
      onClick={(e) => {
        if (onClick && !(e.target as HTMLElement).closest("button")) {
          onClick();
        }
      }}
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
            <Typography
              variant="body2"
              color="text.secondary"
              fontSize="0.75rem"
            >
              {batch.ref_code}
            </Typography>
            <Typography variant="subtitle1" fontWeight={600}>
              {formatCurrency(batch.total_amount)}
            </Typography>
          </Box>
          <Chip
            label={MATERIAL_BATCH_STATUS_LABELS[batch.status]}
            color={MATERIAL_BATCH_STATUS_COLORS[batch.status]}
            size="small"
          />
        </Box>

        {/* Date and Vendor */}
        <Box display="flex" flexWrap="wrap" gap={2} mb={1.5}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <CalendarIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary">
              {dayjs(batch.purchase_date).format("DD MMM YYYY")}
            </Typography>
          </Box>
          {batch.vendor_name && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <StoreIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="body2" color="text.secondary">
                {batch.vendor_name}
              </Typography>
            </Box>
          )}
          {batch.payment_source_site_name && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <PaymentIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="body2" color="text.secondary">
                Paid by: {batch.payment_source_site_name}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Materials */}
        {displayItems.length > 0 && (
          <Box mb={1.5}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              mb={0.5}
            >
              Materials
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.5}>
              {displayItems.map((item, idx) => (
                <Chip
                  key={idx}
                  label={`${item.material_name}${item.brand_name ? ` - ${item.brand_name}` : ""}`}
                  size="small"
                  variant="outlined"
                  sx={{ maxWidth: 200 }}
                />
              ))}
              {hasMoreItems && (
                <Chip
                  label={`+${(batch.items || []).length - 2} more`}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              )}
            </Box>
          </Box>
        )}

        {/* Usage Progress */}
        {!compact && (
          <Box mb={1.5}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={0.5}
            >
              <Typography variant="caption" color="text.secondary">
                Stock Usage
              </Typography>
              <Typography variant="caption" fontWeight={500}>
                {usagePercent.toFixed(0)}% used
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={usagePercent}
              sx={{
                height: 8,
                borderRadius: 1,
                bgcolor: "grey.200",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 1,
                  bgcolor:
                    usagePercent >= 100
                      ? "success.main"
                      : usagePercent >= 50
                      ? "warning.main"
                      : "primary.main",
                },
              }}
            />
            <Box display="flex" justifyContent="space-between" mt={0.5}>
              <Typography variant="caption" color="text.secondary">
                Remaining: {batch.remaining_quantity.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Original: {batch.original_quantity.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Payment Info */}
        {batch.payment_mode && (
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={MATERIAL_PAYMENT_MODE_LABELS[batch.payment_mode]}
              size="small"
              variant="outlined"
              color="primary"
            />
            {batch.payment_reference && (
              <Typography variant="caption" color="text.secondary">
                Ref: {batch.payment_reference}
              </Typography>
            )}
          </Box>
        )}

        {/* Site Usage Breakdown - for expanded view */}
        {!compact && batch.site_usage && batch.site_usage.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              mb={1}
            >
              Usage by Site
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ py: 0.5, fontSize: "0.75rem" }}>
                    Site
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ py: 0.5, fontSize: "0.75rem" }}
                  >
                    Quantity
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ py: 0.5, fontSize: "0.75rem" }}
                  >
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batch.site_usage.map((usage, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ py: 0.5, fontSize: "0.75rem" }}>
                      {usage.site_name}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ py: 0.5, fontSize: "0.75rem" }}
                    >
                      {usage.quantity_used.toFixed(2)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ py: 0.5, fontSize: "0.75rem" }}
                    >
                      {formatCurrency(usage.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>

      {showActions && (
        <>
          <Divider />
          <CardActions sx={{ justifyContent: "flex-end", gap: 1 }}>
            {batch.bill_url && (
              <Tooltip title="View Bill">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onViewBill) {
                      onViewBill();
                    } else {
                      window.open(batch.bill_url!, "_blank");
                    }
                  }}
                >
                  <ReceiptIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isEditable && onEdit && (
              <Tooltip title="Edit Purchase">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canConvert && onConvertToOwnSite && (
              <Button
                size="small"
                startIcon={<ConvertIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  onConvertToOwnSite();
                }}
              >
                Convert
              </Button>
            )}
            {canComplete && onComplete && (
              <Button
                size="small"
                variant="contained"
                startIcon={<CompleteIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete();
                }}
              >
                Complete
              </Button>
            )}
          </CardActions>
        </>
      )}
    </Card>
  );
}
