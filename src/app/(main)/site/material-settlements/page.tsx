"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Skeleton,
  Alert,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Payment as PaymentIcon,
  CheckCircle as SettledIcon,
  Pending as PendingIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  Add as AddIcon,
  Receipt as BillIcon,
  Groups as GroupIcon,
  Store as OwnSiteIcon,
  Warning as WarningIcon,
  Remove as NoBillIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import MaterialWorkflowBar from "@/components/materials/MaterialWorkflowBar";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { hasEditPermission } from "@/lib/permissions";
import { useSiteMaterialExpenses, useDeleteMaterialPurchase } from "@/hooks/queries/useMaterialPurchases";
import type { MaterialPurchaseExpenseWithDetails, PurchaseOrderWithDetails } from "@/types/material.types";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { BillPreviewButton } from "@/components/common/BillViewerDialog";
import MaterialSettlementDialog from "@/components/materials/MaterialSettlementDialog";
import BillVerificationDialog from "@/components/materials/BillVerificationDialog";
import { useVerifyBill } from "@/hooks/queries/useBillVerification";
import { useRouter } from "next/navigation";

export default function MaterialSettlementsPage() {
  const { selectedSite } = useSite();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "settled">("all");

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<MaterialPurchaseExpenseWithDetails | null>(null);

  // Settlement dialog state
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [settlementPurchase, setSettlementPurchase] = useState<MaterialPurchaseExpenseWithDetails | null>(null);
  const [settlementPO, setSettlementPO] = useState<PurchaseOrderWithDetails | null>(null);

  // Bill verification dialog state (for direct verification from the chip)
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [verifyingPO, setVerifyingPO] = useState<PurchaseOrderWithDetails | null>(null);
  const [verifyingBillUrl, setVerifyingBillUrl] = useState<string | null>(null);

  // Hooks
  const { data: materialExpensesData, isLoading } = useSiteMaterialExpenses(selectedSite?.id);
  const deleteMutation = useDeleteMaterialPurchase();
  const verifyBillMutation = useVerifyBill();

  // Auth and permissions
  const { userProfile, user } = useAuth();
  const canEdit = hasEditPermission(userProfile?.role);

  // Extract data - memoized to prevent dependency issues
  const allPurchases = useMemo(() => materialExpensesData?.expenses || [], [materialExpensesData?.expenses]);
  const allAdvancePOs = useMemo(() => materialExpensesData?.advancePOs || [], [materialExpensesData?.advancePOs]);
  const totalAmount = materialExpensesData?.total || 0;

  // Create a unified list with type indicators for filtering and display
  type SettlementItem = (MaterialPurchaseExpenseWithDetails & { itemType: 'expense' }) | (PurchaseOrderWithDetails & { itemType: 'po' });

  const allItems = useMemo(() => {
    const expenses: SettlementItem[] = allPurchases.map(p => ({ ...p, itemType: 'expense' as const }));
    const pos: SettlementItem[] = allAdvancePOs.map(po => ({ ...po, itemType: 'po' as const }));
    return [...expenses, ...pos];
  }, [allPurchases, allAdvancePOs]);

  // Determine if a purchase expense is settled
  // Group stock purchases are settled when vendor is paid (is_paid = true)
  // Own site purchases are settled when settlement_reference exists
  const isExpenseSettled = (p: MaterialPurchaseExpenseWithDetails) => {
    if (p.purchase_type === "group_stock") return !!p.is_paid;
    return !!p.settlement_reference;
  };

  // Filter items by settlement status
  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return allItems;
    if (statusFilter === "pending") {
      return allItems.filter((item) => {
        if (item.itemType === 'expense') {
          return !isExpenseSettled(item as MaterialPurchaseExpenseWithDetails);
        } else {
          return !item.advance_paid;
        }
      });
    }
    if (statusFilter === "settled") {
      return allItems.filter((item) => {
        if (item.itemType === 'expense') {
          return isExpenseSettled(item as MaterialPurchaseExpenseWithDetails);
        } else {
          return !!item.advance_paid;
        }
      });
    }
    return allItems;
  }, [allItems, statusFilter]);

  // Helper function to get the correct amount for an expense
  // Uses the linked PO's total_amount (which reflects pricing mode changes) when available
  const getExpenseAmount = (expense: MaterialPurchaseExpenseWithDetails) => {
    if (expense.purchase_order?.total_amount) {
      return Number(expense.purchase_order.total_amount);
    }
    return Number(expense.total_amount || 0);
  };

  // Calculate summaries
  const summaries = useMemo(() => {
    const pendingExpenses = allPurchases.filter((p) => !isExpenseSettled(p));
    const settledExpenses = allPurchases.filter((p) => isExpenseSettled(p));
    const pendingPOs = allAdvancePOs.filter((po) => !po.advance_paid);
    const settledPOs = allAdvancePOs.filter((po) => !!po.advance_paid);

    // Calculate totals using the correct amounts (from linked PO when available)
    const allExpensesTotal = allPurchases.reduce((sum, p) => sum + getExpenseAmount(p), 0);
    const allPOsTotal = allAdvancePOs.reduce((sum, po) => sum + Number(po.total_amount || 0), 0);

    return {
      total: {
        count: allItems.length,
        amount: allExpensesTotal + allPOsTotal,
      },
      pending: {
        count: pendingExpenses.length + pendingPOs.length,
        amount: pendingExpenses.reduce((sum, p) => sum + getExpenseAmount(p), 0) +
                pendingPOs.reduce((sum, po) => sum + Number(po.total_amount || 0), 0),
      },
      settled: {
        count: settledExpenses.length + settledPOs.length,
        amount: settledExpenses.reduce((sum, p) => sum + getExpenseAmount(p), 0) +
                settledPOs.reduce((sum, po) => sum + Number(po.total_amount || 0), 0),
      },
    };
  }, [allPurchases, allAdvancePOs, allItems.length]);

  // Handle delete
  const handleDeleteClick = (purchase: MaterialPurchaseExpenseWithDetails) => {
    setSelectedPurchase(purchase);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedPurchase) return;
    try {
      await deleteMutation.mutateAsync(selectedPurchase.id);
      setDeleteConfirmOpen(false);
      setSelectedPurchase(null);
    } catch (error) {
      console.error("Failed to delete purchase:", error);
    }
  };

  // Handle settle - for both expenses and POs
  const handleSettle = (item: SettlementItem) => {
    if (item.itemType === 'expense') {
      setSettlementPurchase(item);
      setSettlementPO(null);
    } else {
      setSettlementPO(item);
      setSettlementPurchase(null);
    }
    setSettlementDialogOpen(true);
  };

  const handleSettlementClose = () => {
    setSettlementDialogOpen(false);
    setSettlementPurchase(null);
    setSettlementPO(null);
  };

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Material Settlements"
        subtitle={
          selectedSite?.name
            ? `Track and settle material purchases for ${selectedSite.name}`
            : "Track and settle material purchases"
        }
      />

      <MaterialWorkflowBar currentStep="settlements" />

      {/* Action Buttons */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push("/site/purchase-orders")}
        >
          New Purchase
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <InventoryIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Purchases
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h4" fontWeight={600} color="primary.main">
                    {formatCurrency(summaries.total.amount)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summaries.total.count} purchases
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PendingIcon color="warning" />
                <Typography variant="subtitle2" color="text.secondary">
                  Pending Settlement
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h4" fontWeight={600} color="warning.main">
                    {formatCurrency(summaries.pending.amount)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summaries.pending.count} purchases awaiting settlement
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <SettledIcon color="success" />
                <Typography variant="subtitle2" color="text.secondary">
                  Settled
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h4" fontWeight={600} color="success.main">
                    {formatCurrency(summaries.settled.amount)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summaries.settled.count} purchases settled
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Filter:
          </Typography>
          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={(_, value) => value && setStatusFilter(value)}
            size="small"
          >
            <ToggleButton value="all">All ({summaries.total.count})</ToggleButton>
            <ToggleButton value="pending" sx={{ color: "warning.main" }}>
              <PendingIcon sx={{ mr: 0.5, fontSize: 18 }} /> Pending ({summaries.pending.count})
            </ToggleButton>
            <ToggleButton value="settled" sx={{ color: "success.main" }}>
              <SettledIcon sx={{ mr: 0.5, fontSize: 18 }} /> Settled ({summaries.settled.count})
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Purchases Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ref Code</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>PO Number</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Materials</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Bill</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                  </TableRow>
                ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  // Determine item type and extract common fields
                  const isPO = item.itemType === 'po';
                  const purchase = isPO ? null : (item as MaterialPurchaseExpenseWithDetails);
                  const po = isPO ? (item as PurchaseOrderWithDetails) : null;

                  // Check if this is a group stock parent purchase (paying site's batch)
                  // Note: Allocated expenses (inter-site) are no longer shown here - they go to Material Expenses page
                  const isGroupStockParent = purchase ? purchase.purchase_type === "group_stock" : false;

                  // Extract common display fields
                  const refCode = purchase?.ref_code || po?.po_number || '';
                  const dateField = purchase?.purchase_date || po?.order_date || '';
                  const vendorName = item.vendor?.name || (purchase?.vendor_name) || '-';
                  // For expenses with linked PO, use the PO's total_amount (which is up-to-date with pricing changes)
                  // For advance POs or expenses without linked PO, use item.total_amount
                  const amount = purchase?.purchase_order?.total_amount
                    ? Number(purchase.purchase_order.total_amount)
                    : Number(item.total_amount || 0);
                  const materialsText = item.items && item.items.length > 0
                    ? item.items.map((i: any) => i.material?.name || "Unknown").join(", ")
                    : "Material purchase";

                  return (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} sx={{ fontFamily: "monospace" }}>
                        {refCode}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {isPO ? (
                        <Tooltip title="Advance payment PO - payment before delivery">
                          <Chip
                            icon={<PaymentIcon sx={{ fontSize: 16 }} />}
                            label="Advance PO"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ fontSize: "0.75rem" }}
                          />
                        </Tooltip>
                      ) : isGroupStockParent ? (
                        <Tooltip title="Group stock purchase - you paid the vendor">
                          <Chip
                            icon={<GroupIcon sx={{ fontSize: 16 }} />}
                            label="Group PO"
                            size="small"
                            color="secondary"
                            variant="outlined"
                            sx={{ fontSize: "0.75rem" }}
                          />
                        </Tooltip>
                      ) : (
                        <Chip
                          icon={<OwnSiteIcon sx={{ fontSize: 16 }} />}
                          label="Own Site"
                          size="small"
                          color="default"
                          variant="outlined"
                          sx={{ fontSize: "0.75rem" }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {po ? (
                        <Typography variant="body2" color="warning.main" sx={{ fontFamily: "monospace" }}>
                          {po.po_number} (Advance)
                        </Typography>
                      ) : purchase?.purchase_order?.po_number ? (
                        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: "monospace" }}>
                          {purchase.purchase_order.po_number}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(dateField)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {materialsText}
                      </Typography>
                      {item.items && item.items.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {item.items.length} item(s)
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {vendorName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {/* Show both original and paid amounts when bargained */}
                      {purchase?.amount_paid && purchase.amount_paid !== purchase.total_amount ? (
                        <>
                          <Typography
                            variant="body2"
                            sx={{ textDecoration: 'line-through', color: 'text.disabled' }}
                          >
                            {formatCurrency(amount)}
                          </Typography>
                          <Typography variant="body2" fontWeight={600} color="success.main">
                            {formatCurrency(purchase.amount_paid)}
                          </Typography>
                          <Typography variant="caption" color="success.main" display="block">
                            ({formatCurrency(amount - purchase.amount_paid)} saved)
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(amount)}
                        </Typography>
                      )}
                      {isPO && (
                        <Typography variant="caption" color="warning.main" display="block">
                          Advance payment
                        </Typography>
                      )}
                    </TableCell>
                    {/* Bill Status Cell */}
                    <TableCell>
                      {(() => {
                        // Get the effective PO (either direct PO or through purchase)
                        const effectivePO = po || purchase?.purchase_order;
                        const billUrl = effectivePO?.vendor_bill_url || purchase?.bill_url;
                        const isVerified = effectivePO?.bill_verified;

                        if (!billUrl) {
                          return (
                            <Chip
                              icon={<NoBillIcon sx={{ fontSize: 14 }} />}
                              label="No Bill"
                              size="small"
                              color="default"
                              variant="outlined"
                              sx={{ fontSize: "0.7rem" }}
                            />
                          );
                        }

                        return (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Chip
                              icon={isVerified ? <SettledIcon sx={{ fontSize: 14 }} /> : <WarningIcon sx={{ fontSize: 14 }} />}
                              label={isVerified ? "Verified" : "Unverified"}
                              size="small"
                              color={isVerified ? "success" : "warning"}
                              variant="outlined"
                              sx={{
                                fontSize: "0.7rem",
                                cursor: !isVerified ? "pointer" : "default",
                              }}
                              onClick={!isVerified && effectivePO ? (e) => {
                                e.stopPropagation();
                                setVerifyingPO(effectivePO as PurchaseOrderWithDetails);
                                setVerifyingBillUrl(billUrl || null);
                                setVerificationDialogOpen(true);
                              } : undefined}
                            />
                            <BillPreviewButton
                              billUrl={billUrl}
                              label=""
                              size="small"
                              variant="text"
                              showIcon
                            />
                          </Box>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {isPO ? (
                        // PO advance payment status
                        po!.advance_paid ? (
                          <Chip
                            icon={<SettledIcon />}
                            label="Advance Paid"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            icon={<PendingIcon />}
                            label="Payment Pending"
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        )
                      ) : isGroupStockParent ? (
                        // Group stock parent: show vendor payment status
                        purchase!.is_paid ? (
                          <Chip
                            icon={<SettledIcon />}
                            label="Vendor Paid"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            icon={<PendingIcon />}
                            label="Vendor Unpaid"
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        )
                      ) : purchase!.settlement_reference ? (
                        <Chip
                          icon={<SettledIcon />}
                          label="Settled"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          icon={<PendingIcon />}
                          label="Pending"
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {/* Pay Advance button for POs with advance payment timing */}
                        {isPO && !po!.advance_paid && canEdit && (
                          <Tooltip title="Record advance payment">
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => handleSettle(item)}
                              startIcon={<PaymentIcon />}
                            >
                              Pay Advance
                            </Button>
                          </Tooltip>
                        )}
                        {/* Pay Vendor button for group stock parent purchases */}
                        {isGroupStockParent && !purchase!.is_paid && canEdit && (
                          <Tooltip title="Record vendor payment">
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              onClick={() => handleSettle(item)}
                              startIcon={<PaymentIcon />}
                            >
                              Pay Vendor
                            </Button>
                          </Tooltip>
                        )}
                        {/* Settle button for own site purchases */}
                        {!isPO && !isGroupStockParent && !purchase!.settlement_reference && canEdit && (
                          <Tooltip title="Settle">
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => handleSettle(item)}
                              startIcon={<PaymentIcon />}
                            >
                              Settle
                            </Button>
                          </Tooltip>
                        )}
                        {/* Advance Paid indicator for POs */}
                        {isPO && po!.advance_paid && (
                          <Chip
                            icon={<SettledIcon />}
                            label="Advance Paid"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                        {/* Vendor Paid indicator for group stock */}
                        {isGroupStockParent && purchase!.is_paid && (
                          <Chip
                            icon={<SettledIcon />}
                            label="Vendor Paid"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                        {purchase && purchase.settlement_reference && !isGroupStockParent && (
                          <Tooltip title="View Settlement">
                            <IconButton size="small">
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canEdit && purchase && !purchase.settlement_reference && !isGroupStockParent && (
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(purchase)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <InventoryIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                      <Typography color="text.secondary">
                        No material purchases found
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        Create a purchase from the Purchase Orders page
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Info Box */}
      <Alert severity="info">
        <Typography variant="subtitle2" fontWeight={600}>
          How Material Settlements Work
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Material purchases need to be settled before they appear in Site Expenses:
        </Typography>
        <Box component="ul" sx={{ mt: 0.5, pl: 2, mb: 0 }}>
          <li>
            <Typography variant="body2">
              <strong>Own Site:</strong> Direct purchases for this site - settle to record payment
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>Group Settlement:</strong> Your share from inter-site batch settlement - automatically settled when batch is completed
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>Settled:</strong> Payment recorded - appears in All Site Expenses
            </Typography>
          </li>
        </Box>
      </Alert>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Material Purchase"
        message={`Are you sure you want to delete purchase ${selectedPurchase?.ref_code}? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setSelectedPurchase(null);
        }}
      />

      {/* Settlement Dialog */}
      <MaterialSettlementDialog
        open={settlementDialogOpen}
        purchase={settlementPurchase}
        purchaseOrder={settlementPO}
        onClose={handleSettlementClose}
        onSuccess={handleSettlementClose}
      />

      {/* Direct Bill Verification Dialog - triggered by clicking Unverified chip */}
      <BillVerificationDialog
        open={verificationDialogOpen}
        onClose={() => {
          setVerificationDialogOpen(false);
          setVerifyingPO(null);
          setVerifyingBillUrl(null);
        }}
        purchaseOrder={verifyingPO}
        billUrl={verifyingBillUrl}
        isVerifying={verifyBillMutation.isPending}
        onVerified={async (notes) => {
          if (!verifyingPO?.id || !user?.id) return;
          try {
            await verifyBillMutation.mutateAsync({
              poId: verifyingPO.id,
              userId: user.id,
              notes,
            });
            setVerificationDialogOpen(false);
            setVerifyingPO(null);
            setVerifyingBillUrl(null);
          } catch (error) {
            console.error("Failed to verify bill:", error);
          }
        }}
      />
    </Box>
  );
}
