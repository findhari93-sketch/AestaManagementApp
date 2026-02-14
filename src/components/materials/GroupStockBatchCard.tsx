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
  Add as AddIcon,
  AccountBalance as SettleIcon,
} from "@mui/icons-material";
import type {
  GroupStockBatch,
  MaterialBatchStatus,
  BatchSiteAllocation,
} from "@/types/material.types";
import {
  MATERIAL_BATCH_STATUS_LABELS,
  MATERIAL_BATCH_STATUS_COLORS,
  MATERIAL_PAYMENT_MODE_LABELS,
  BATCH_USAGE_SETTLEMENT_STATUS_LABELS,
  BATCH_USAGE_SETTLEMENT_STATUS_COLORS,
} from "@/types/material.types";
import { formatCurrency } from "@/lib/formatters";
import dayjs from "dayjs";

interface GroupStockBatchCardProps {
  batch: GroupStockBatch & { site_allocations?: BatchSiteAllocation[] };
  onViewBill?: () => void;
  onEdit?: () => void;
  onConvertToOwnSite?: () => void;
  onComplete?: () => void;
  onRecordUsage?: () => void;
  onSettleUsage?: (siteId: string, siteName: string, amount: number) => void;
  onClick?: () => void;
  showActions?: boolean;
  compact?: boolean;
  currentSiteId?: string;
}

export default function GroupStockBatchCard({
  batch,
  onViewBill,
  onEdit,
  onConvertToOwnSite,
  onComplete,
  onRecordUsage,
  onSettleUsage,
  onClick,
  showActions = true,
  compact = false,
  currentSiteId,
}: GroupStockBatchCardProps) {
  const originalQty = batch.original_quantity ?? 0;
  const remainingQty = batch.remaining_quantity ?? 0;
  const usagePercent =
    originalQty > 0
      ? ((originalQty - remainingQty) / originalQty) * 100
      : 0;

  // Compute display status from actual quantities (not DB status) to handle stale data
  // e.g. DB may say 'completed' but remaining_qty > 0 after usage deletion
  const computedStatus: MaterialBatchStatus =
    batch.status === "converted" ? "converted" :
    (remainingQty <= 0 && originalQty > 0) ? "completed" :
    usagePercent > 0 ? "partial_used" : "recorded";

  const isEditable = computedStatus === "partial_used" || computedStatus === "recorded";
  const canConvert = computedStatus === "partial_used" || computedStatus === "recorded";
  const canComplete = computedStatus === "partial_used" || computedStatus === "recorded";

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
            {/* Show both original and paid amounts when bargained */}
            {batch.amount_paid && batch.amount_paid !== batch.total_amount ? (
              <Box>
                <Typography
                  variant="body2"
                  sx={{ textDecoration: 'line-through', color: 'text.disabled' }}
                >
                  {formatCurrency(batch.total_amount)}
                </Typography>
                <Typography variant="subtitle1" fontWeight={600} color="success.main">
                  {formatCurrency(batch.amount_paid)}
                </Typography>
              </Box>
            ) : (
              <Typography variant="subtitle1" fontWeight={600}>
                {formatCurrency(batch.total_amount)}
              </Typography>
            )}
          </Box>
          <Chip
            label={MATERIAL_BATCH_STATUS_LABELS[computedStatus]}
            color={MATERIAL_BATCH_STATUS_COLORS[computedStatus]}
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
              {displayItems.map((item: any, idx) => {
                // Handle both transformed data (material_name) and raw query data (material.name)
                const materialLabel = item.material_name || item.material?.name || 'Unknown Material';
                const brandLabel = item.brand_name || item.brand?.brand_name ? ` - ${item.brand_name || item.brand?.brand_name}` : '';
                return (
                  <Chip
                    key={idx}
                    label={`${materialLabel}${brandLabel}`}
                    size="small"
                    variant="outlined"
                    sx={{ maxWidth: 200 }}
                  />
                );
              })}
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
                {batch.status === "completed" ? "100% allocated" : `${usagePercent.toFixed(0)}% used`}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={batch.status === "completed" ? 100 : usagePercent}
              sx={{
                height: 8,
                borderRadius: 1,
                bgcolor: "grey.200",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 1,
                  bgcolor:
                    batch.status === "completed" || usagePercent >= 100
                      ? "success.main"
                      : usagePercent >= 50
                      ? "warning.main"
                      : "primary.main",
                },
              }}
            />
            <Box display="flex" justifyContent="space-between" mt={0.5}>
              {batch.status === "completed" ? (
                <Typography variant="caption" color="success.main" fontWeight={500}>
                  ✓ All materials allocated (including self-use)
                </Typography>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary">
                    Remaining: {(batch.remaining_quantity ?? 0).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Original: {(batch.original_quantity ?? 0).toFixed(2)}
                  </Typography>
                </>
              )}
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

        {/* Site Usage Breakdown - enhanced with settlement status */}
        {!compact && (batch.site_allocations || batch.site_usage) && ((batch.site_allocations?.length ?? 0) > 0 || (batch.site_usage?.length ?? 0) > 0) && (
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
                  <TableCell
                    align="center"
                    sx={{ py: 0.5, fontSize: "0.75rem" }}
                  >
                    Status
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(batch.site_allocations || batch.site_usage || []).map((usage: any, idx: number) => {
                  const isPayer = usage.is_payer || usage.site_id === batch.payment_source_site_id;
                  const settlementStatus = usage.settlement_status || (isPayer ? "self_use" : "pending");
                  const canSettle = settlementStatus === "pending" && onSettleUsage && usage.site_id === currentSiteId;

                  return (
                    <TableRow key={idx}>
                      <TableCell sx={{ py: 0.5, fontSize: "0.75rem" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          {usage.site_name}
                          {isPayer && (
                            <Chip
                              label="Payer"
                              size="small"
                              color="success"
                              sx={{ height: 18, fontSize: "0.65rem" }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ py: 0.5, fontSize: "0.75rem" }}
                      >
                        {(usage.quantity_used || 0).toFixed(2)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ py: 0.5, fontSize: "0.75rem" }}
                      >
                        {formatCurrency(usage.amount || 0)}
                      </TableCell>
                      <TableCell align="center" sx={{ py: 0.5, fontSize: "0.75rem" }}>
                        {canSettle ? (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            sx={{ minWidth: 60, fontSize: "0.7rem", py: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSettleUsage(usage.site_id, usage.site_name, usage.amount);
                            }}
                          >
                            Settle
                          </Button>
                        ) : (
                          <Chip
                            label={BATCH_USAGE_SETTLEMENT_STATUS_LABELS[settlementStatus as keyof typeof BATCH_USAGE_SETTLEMENT_STATUS_LABELS] || settlementStatus}
                            size="small"
                            color={BATCH_USAGE_SETTLEMENT_STATUS_COLORS[settlementStatus as keyof typeof BATCH_USAGE_SETTLEMENT_STATUS_COLORS] || "default"}
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>

      {showActions && (
        <>
          <Divider />
          <CardActions sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            {/* Left side - Record Usage */}
            <Box>
              {isEditable && onRecordUsage && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRecordUsage();
                  }}
                >
                  Record Usage
                </Button>
              )}
            </Box>

            {/* Right side - Other actions */}
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
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
            </Box>
          </CardActions>
        </>
      )}
    </Card>
  );
}
