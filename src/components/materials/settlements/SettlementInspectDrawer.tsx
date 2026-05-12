"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Drawer,
  IconButton,
  Tabs,
  Tab,
  Typography,
  Divider,
  Chip,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Close as CloseIcon,
  Payment as PaymentIcon,
  Receipt as BillIcon,
  Edit as EditIcon,
  Groups as GroupIcon,
} from "@mui/icons-material";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { BillPreviewButton } from "@/components/common/BillViewerDialog";
import type {
  MaterialPurchaseExpenseWithDetails,
  PurchaseOrderWithDetails,
} from "@/types/material.types";
import SourceChip from "./SourceChip";
import {
  getAgeInDays,
  getItemAmount,
  getItemDate,
  getItemRefCode,
  getItemVendorName,
  getSettlementType,
  isItemSettled,
  type SettlementItem,
} from "./settlementClassifiers";

interface Props {
  item: SettlementItem | null;
  open: boolean;
  onClose: () => void;
  currentSiteId: string | undefined;
  canEdit: boolean;
  onSettle: (item: SettlementItem) => void;
  onEdit: (purchase: MaterialPurchaseExpenseWithDetails) => void;
}

type TabKey = "bill" | "items" | "group";

export default function SettlementInspectDrawer({
  item,
  open,
  onClose,
  currentSiteId,
  canEdit,
  onSettle,
  onEdit,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [tab, setTab] = useState<TabKey>("bill");

  useEffect(() => {
    if (open) setTab("bill");
  }, [open, item?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!item) return null;

  const purchase = item.itemType === "expense" ? (item as MaterialPurchaseExpenseWithDetails) : null;
  const po = item.itemType === "po" ? (item as PurchaseOrderWithDetails) : null;
  const kind = getSettlementType(item);
  const settled = isItemSettled(item);
  const billUrl = po?.vendor_bill_url || purchase?.purchase_order?.vendor_bill_url || purchase?.bill_url || null;
  const billVerified = po?.bill_verified || purchase?.purchase_order?.bill_verified || false;
  const isCrossSiteRow = !!purchase && purchase.site_id !== currentSiteId;
  const showGroupTab = kind === "group_po";

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant={isMobile ? "temporary" : "persistent"}
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        sx: {
          width: isMobile ? "100%" : 480,
          border: 0,
          borderLeft: `1px solid ${theme.palette.divider}`,
          boxShadow: isMobile ? undefined : 8,
        },
      }}
      sx={{ ...(isMobile ? {} : { "& .MuiBackdrop-root": { display: "none" } }) }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: "monospace" }} noWrap>
              {getItemRefCode(item)}
            </Typography>
            <SourceChip item={item} />
          </Box>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {getItemVendorName(item)} · {formatDate(getItemDate(item))} · {getAgeInDays(item)}d ago
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close pane">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: `1px solid ${theme.palette.divider}`, minHeight: 40 }}
      >
        <Tab value="bill" label="Bill" sx={{ minHeight: 40, fontSize: "0.8rem" }} />
        <Tab value="items" label={`Items (${item.items?.length || 0})`} sx={{ minHeight: 40, fontSize: "0.8rem" }} />
        {showGroupTab && <Tab value="group" label="Group" sx={{ minHeight: 40, fontSize: "0.8rem" }} />}
      </Tabs>

      {/* Body */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        {tab === "bill" && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Amount
              </Typography>
              <Typography variant="h5" fontWeight={700} color={settled ? "success.main" : "warning.main"}>
                {formatCurrency(getItemAmount(item))}
              </Typography>
              {purchase?.amount_paid && Number(purchase.amount_paid) !== Number(purchase.total_amount) && (
                <Typography variant="caption" color="success.main">
                  Paid {formatCurrency(Number(purchase.amount_paid))} · saved {formatCurrency(getItemAmount(item) - Number(purchase.amount_paid))}
                </Typography>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Status
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                {settled ? (
                  <Chip
                    label={kind === "advance" ? "Advance paid" : kind === "group_po" ? "Vendor paid" : "Settled"}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                ) : (
                  <Chip label="Pending" size="small" color="warning" variant="outlined" />
                )}
              </Box>
            </Box>

            {purchase?.purchase_order?.po_number && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Purchase Order
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace", mt: 0.5 }}>
                  {purchase.purchase_order.po_number}
                </Typography>
              </Box>
            )}

            {purchase?.original_batch_code && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Source batch
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace", mt: 0.5 }}>
                  {purchase.original_batch_code}
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Payer site
              </Typography>
              <Typography
                variant="body2"
                color={isCrossSiteRow ? "info.main" : "text.primary"}
                sx={{ mt: 0.5, fontWeight: isCrossSiteRow ? 600 : 400 }}
              >
                {purchase?.paying_site?.name || (purchase ? "This site" : "—")}
                {isCrossSiteRow && " (cross-site)"}
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Vendor bill
              </Typography>
              {billUrl ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    icon={<BillIcon sx={{ fontSize: 14 }} />}
                    label={billVerified ? "Verified" : "Unverified"}
                    size="small"
                    color={billVerified ? "success" : "warning"}
                    variant="outlined"
                  />
                  <BillPreviewButton billUrl={billUrl} label="View bill" size="small" />
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No bill attached
                </Typography>
              )}
            </Box>

            {purchase?.notes && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Notes
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {purchase.notes}
                </Typography>
              </Box>
            )}
          </Stack>
        )}

        {tab === "items" && (
          <Box>
            {item.items && item.items.length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Material</TableCell>
                    <TableCell>Brand</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {item.items.map((lineItem: any, idx: number) => (
                    <TableRow key={lineItem.id || idx}>
                      <TableCell>
                        <Typography variant="body2">{lineItem.material?.name || "Unknown"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {lineItem.brand?.brand_name || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {lineItem.quantity} {lineItem.material?.unit || ""}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{formatCurrency(lineItem.unit_price || 0)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>
                          {formatCurrency(lineItem.total_price || 0)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No line items recorded for this purchase.
              </Typography>
            )}
          </Box>
        )}

        {tab === "group" && showGroupTab && purchase && (
          <Stack spacing={2}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <GroupIcon color="secondary" />
              <Typography variant="subtitle2" fontWeight={700}>
                Group Purchase
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              This vendor bill is owned by a site group. Any member site can record the vendor payment
              and (re)assign the paying site at the moment of settlement.
            </Typography>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Currently assigned payer
              </Typography>
              <Chip
                icon={<GroupIcon sx={{ fontSize: 14 }} />}
                label={purchase.paying_site?.name || "Original site"}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ mt: 0.5 }}
              />
            </Box>
            {isCrossSiteRow && (
              <Typography variant="caption" color="info.main">
                You can settle this on behalf of {purchase.paying_site?.name || "the original site"}, or
                reassign the payer to your current site in the Settle dialog.
              </Typography>
            )}
          </Stack>
        )}
      </Box>

      {/* Footer actions */}
      <Box
        sx={{
          borderTop: `1px solid ${theme.palette.divider}`,
          p: 1.5,
          display: "flex",
          gap: 1,
          justifyContent: "flex-end",
        }}
      >
        {canEdit && purchase && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => onEdit(purchase)}
          >
            Edit
          </Button>
        )}
        {canEdit && !settled && (
          <Button
            size="small"
            variant="contained"
            startIcon={<PaymentIcon />}
            onClick={() => onSettle(item)}
          >
            Settle
          </Button>
        )}
      </Box>
    </Drawer>
  );
}
