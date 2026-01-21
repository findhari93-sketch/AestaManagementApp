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
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { hasEditPermission } from "@/lib/permissions";
import { useSiteMaterialExpenses, useDeleteMaterialPurchase } from "@/hooks/queries/useMaterialPurchases";
import type { MaterialPurchaseExpenseWithDetails } from "@/types/material.types";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import MaterialSettlementDialog from "@/components/materials/MaterialSettlementDialog";
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

  // Hooks
  const { data: materialExpensesData, isLoading } = useSiteMaterialExpenses(selectedSite?.id);
  const deleteMutation = useDeleteMaterialPurchase();

  // Auth and permissions
  const { userProfile } = useAuth();
  const canEdit = hasEditPermission(userProfile?.role);

  // Extract data
  const allPurchases = materialExpensesData?.expenses || [];
  const totalAmount = materialExpensesData?.total || 0;

  // Filter purchases by settlement status
  const filteredPurchases = useMemo(() => {
    if (statusFilter === "all") return allPurchases;
    // For now, consider all purchases as "pending" settlement
    // Once we add settlement_status field, we'll filter properly
    if (statusFilter === "pending") {
      return allPurchases.filter((p) => !p.settlement_reference);
    }
    if (statusFilter === "settled") {
      return allPurchases.filter((p) => !!p.settlement_reference);
    }
    return allPurchases;
  }, [allPurchases, statusFilter]);

  // Calculate summaries
  const summaries = useMemo(() => {
    const pending = allPurchases.filter((p) => !p.settlement_reference);
    const settled = allPurchases.filter((p) => !!p.settlement_reference);

    return {
      total: {
        count: allPurchases.length,
        amount: totalAmount,
      },
      pending: {
        count: pending.length,
        amount: pending.reduce((sum, p) => sum + Number(p.total_amount || 0), 0),
      },
      settled: {
        count: settled.length,
        amount: settled.reduce((sum, p) => sum + Number(p.total_amount || 0), 0),
      },
    };
  }, [allPurchases, totalAmount]);

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

  // Handle settle
  const handleSettle = (purchase: MaterialPurchaseExpenseWithDetails) => {
    setSettlementPurchase(purchase);
    setSettlementDialogOpen(true);
  };

  const handleSettlementClose = () => {
    setSettlementDialogOpen(false);
    setSettlementPurchase(null);
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
                  </TableRow>
                ))
              ) : filteredPurchases.length > 0 ? (
                filteredPurchases.map((purchase) => {
                  // Check if this is from a group settlement (has original_batch_code)
                  const isFromGroupSettlement = !!purchase.original_batch_code;

                  return (
                  <TableRow key={purchase.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} sx={{ fontFamily: "monospace" }}>
                        {purchase.ref_code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {isFromGroupSettlement ? (
                        <Tooltip title={`From batch ${purchase.original_batch_code}`}>
                          <Chip
                            icon={<GroupIcon sx={{ fontSize: 16 }} />}
                            label="Group"
                            size="small"
                            color="info"
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
                      {purchase.purchase_order?.po_number ? (
                        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: "monospace" }}>
                          {purchase.purchase_order.po_number}
                        </Typography>
                      ) : isFromGroupSettlement ? (
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                          {purchase.original_batch_code}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(purchase.purchase_date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {purchase.items && purchase.items.length > 0
                          ? purchase.items.map((i) => i.material?.name || "Unknown").join(", ")
                          : "Material purchase"}
                      </Typography>
                      {purchase.items && purchase.items.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {purchase.items.length} item(s)
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {purchase.vendor?.name || purchase.vendor_name || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(Number(purchase.total_amount || 0))}
                      </Typography>
                      {isFromGroupSettlement && (
                        <Typography variant="caption" color="success.main" display="block">
                          Usage settled
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {purchase.settlement_reference ? (
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
                        {/* View Bill Button - shown when bill_url exists */}
                        {purchase.bill_url && (
                          <Tooltip title="View Bill">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => window.open(purchase.bill_url!, "_blank")}
                            >
                              <BillIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {!purchase.settlement_reference && canEdit && !isFromGroupSettlement && (
                          <Tooltip title="Settle">
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => handleSettle(purchase)}
                              startIcon={<PaymentIcon />}
                            >
                              Settle
                            </Button>
                          </Tooltip>
                        )}
                        {purchase.settlement_reference && (
                          <Tooltip title="View Settlement">
                            <IconButton size="small">
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canEdit && !purchase.settlement_reference && !isFromGroupSettlement && (
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
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
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
        onClose={handleSettlementClose}
        onSuccess={handleSettlementClose}
      />
    </Box>
  );
}
