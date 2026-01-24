"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
} from "@mui/material";
import {
  Receipt as ExpenseIcon,
  Store as OwnSiteIcon,
  Groups as GroupIcon,
  Person as SelfUseIcon,
  Receipt as BillIcon,
  TrendingUp as TotalIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { useSite } from "@/contexts/SiteContext";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  useSiteLevelMaterialExpenses,
  useDeleteMaterialPurchase,
  useDeleteAllocatedExpense,
  type SiteMaterialExpense,
} from "@/hooks/queries/useMaterialPurchases";
import { useRouter } from "next/navigation";

// Type config for display
const typeConfig: Record<
  SiteMaterialExpense["type"],
  { icon: React.ReactNode; label: string; color: "default" | "info" | "secondary" }
> = {
  own_site: {
    icon: <OwnSiteIcon fontSize="small" />,
    label: "Own Site",
    color: "default",
  },
  allocated: {
    icon: <GroupIcon fontSize="small" />,
    label: "From Group",
    color: "info",
  },
  self_use: {
    icon: <SelfUseIcon fontSize="small" />,
    label: "Self Use",
    color: "secondary",
  },
};

export default function MaterialExpensesPage() {
  const { selectedSite } = useSite();
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<"all" | SiteMaterialExpense["type"]>("all");

  // Menu and dialog state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedExpense, setSelectedExpense] = useState<SiteMaterialExpense | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [navigationDialogOpen, setNavigationDialogOpen] = useState(false);

  // Fetch site-level material expenses
  const { data: expensesData, isLoading } = useSiteLevelMaterialExpenses(selectedSite?.id);

  // Delete mutations
  const deleteMutation = useDeleteMaterialPurchase();
  const deleteAllocatedMutation = useDeleteAllocatedExpense();

  // Extract data
  const allExpenses = expensesData?.expenses || [];
  const totalAmount = expensesData?.total || 0;

  // Filter expenses by type
  const filteredExpenses = useMemo(() => {
    if (typeFilter === "all") return allExpenses;
    return allExpenses.filter((e) => e.type === typeFilter);
  }, [allExpenses, typeFilter]);

  // Calculate summaries by type
  const summaries = useMemo(() => {
    const ownSite = allExpenses.filter((e) => e.type === "own_site");
    const allocated = allExpenses.filter((e) => e.type === "allocated");
    const selfUse = allExpenses.filter((e) => e.type === "self_use");

    return {
      total: {
        count: allExpenses.length,
        amount: totalAmount,
      },
      own_site: {
        count: ownSite.length,
        amount: ownSite.reduce((sum, e) => sum + e.amount, 0),
      },
      allocated: {
        count: allocated.length,
        amount: allocated.reduce((sum, e) => sum + e.amount, 0),
      },
      self_use: {
        count: selfUse.length,
        amount: selfUse.reduce((sum, e) => sum + e.amount, 0),
      },
    };
  }, [allExpenses, totalAmount]);

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, expense: SiteMaterialExpense) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedExpense(expense);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleView = () => {
    setViewDialogOpen(true);
    handleMenuClose();
  };

  const handleViewClose = () => {
    setViewDialogOpen(false);
    setSelectedExpense(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    if (selectedExpense?.type === "allocated") {
      // For allocated expenses, show navigation dialog
      setNavigationDialogOpen(true);
    } else {
      // For own_site and self_use, navigate to edit page (if exists)
      // For now, just close - can be extended later
    }
  };

  const handleDelete = () => {
    handleMenuClose();
    // Show delete confirmation for all expense types
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedExpense?.purchase_expense_id) return;

    try {
      if (selectedExpense.type === "allocated" && selectedExpense.settlement_reference) {
        // For allocated expenses, use the special hook that cancels the settlement
        await deleteAllocatedMutation.mutateAsync({
          expenseId: selectedExpense.purchase_expense_id,
          settlementReference: selectedExpense.settlement_reference,
        });
      } else {
        // For own_site and self_use, use the regular delete
        await deleteMutation.mutateAsync(selectedExpense.purchase_expense_id);
      }
      setDeleteDialogOpen(false);
      setSelectedExpense(null);
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  };

  // Check if any delete mutation is pending
  const isDeletePending = deleteMutation.isPending || deleteAllocatedMutation.isPending;

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedExpense(null);
  };

  const handleNavigateToSettlement = () => {
    setNavigationDialogOpen(false);
    // Navigate to Inter-Site Settlement page with the settlement reference
    const settlementRef = selectedExpense?.settlement_reference || selectedExpense?.batch_ref_code;
    router.push(`/site/inter-site-settlement${settlementRef ? `?highlight=${encodeURIComponent(settlementRef)}` : ""}`);
    setSelectedExpense(null);
  };

  const handleNavigationCancel = () => {
    setNavigationDialogOpen(false);
    setSelectedExpense(null);
  };

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Material Expenses"
        subtitle={
          selectedSite?.name
            ? `Actual material costs for ${selectedSite.name}`
            : "Actual material costs attributed to this site"
        }
      />

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <TotalIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Expenses
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
                    {summaries.total.count} expenses
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <OwnSiteIcon color="action" />
                <Typography variant="subtitle2" color="text.secondary">
                  Own Site Purchases
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h5" fontWeight={600}>
                    {formatCurrency(summaries.own_site.amount)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summaries.own_site.count} purchases
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <GroupIcon color="info" />
                <Typography variant="subtitle2" color="text.secondary">
                  From Group Settlement
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h5" fontWeight={600} color="info.main">
                    {formatCurrency(summaries.allocated.amount)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summaries.allocated.count} allocations
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <SelfUseIcon color="secondary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Self Use (Group)
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h5" fontWeight={600} color="secondary.main">
                    {formatCurrency(summaries.self_use.amount)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summaries.self_use.count} self-use portions
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
            value={typeFilter}
            exclusive
            onChange={(_, value) => value && setTypeFilter(value)}
            size="small"
          >
            <ToggleButton value="all">All ({summaries.total.count})</ToggleButton>
            <ToggleButton value="own_site">
              <OwnSiteIcon sx={{ mr: 0.5, fontSize: 18 }} /> Own Site ({summaries.own_site.count})
            </ToggleButton>
            <ToggleButton value="allocated" sx={{ color: "info.main" }}>
              <GroupIcon sx={{ mr: 0.5, fontSize: 18 }} /> From Group ({summaries.allocated.count})
            </ToggleButton>
            <ToggleButton value="self_use" sx={{ color: "secondary.main" }}>
              <SelfUseIcon sx={{ mr: 0.5, fontSize: 18 }} /> Self Use ({summaries.self_use.count})
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Expenses Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Ref Code</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Material</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Source</TableCell>
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
                  </TableRow>
                ))
              ) : filteredExpenses.length > 0 ? (
                filteredExpenses.map((expense) => {
                  const config = typeConfig[expense.type];

                  return (
                    <TableRow key={expense.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(expense.purchase_date)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                          {expense.ref_code || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={config.icon as React.ReactElement}
                          label={config.label}
                          size="small"
                          color={config.color}
                          variant="outlined"
                          sx={{ fontSize: "0.75rem" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {expense.material_name}
                        </Typography>
                        {expense.brand_name && (
                          <Typography variant="caption" color="text.secondary">
                            {expense.brand_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {expense.quantity ? (
                          <Typography variant="body2">
                            {expense.quantity} {expense.unit}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          {formatCurrency(expense.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                          {expense.source_ref}
                        </Typography>
                        {expense.vendor_name && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {expense.vendor_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          {expense.bill_url && (
                            <Tooltip title="View Bill">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => window.open(expense.bill_url!, "_blank")}
                              >
                                <BillIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Actions">
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuOpen(e, expense)}
                            >
                              <MoreIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <ExpenseIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                      <Typography color="text.secondary">
                        No material expenses found
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        Expenses will appear here after purchases are settled
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
          Understanding Material Expenses
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          This page shows the actual material costs attributed to this site:
        </Typography>
        <Box component="ul" sx={{ mt: 0.5, pl: 2, mb: 0 }}>
          <li>
            <Typography variant="body2">
              <strong>Own Site:</strong> Direct purchases made for and paid by this site
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>From Group:</strong> Your share from inter-site settlements (materials you used from group purchases)
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>Self Use:</strong> Your portion of group purchases you paid for (creditor self-use)
            </Typography>
          </li>
        </Box>
      </Alert>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleView}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        {selectedExpense?.type === "allocated" && [
          // For allocated expenses, show "Go to Settlement" and "Delete & Cancel" options
          <MenuItem key="go-to-settlement" onClick={handleNavigateToSettlement}>
            <ListItemIcon>
              <GroupIcon fontSize="small" color="info" />
            </ListItemIcon>
            <ListItemText>Go to Settlement</ListItemText>
          </MenuItem>,
          <Divider key="divider-allocated" />,
          <MenuItem
            key="delete-allocated"
            onClick={handleDelete}
            sx={{ color: "error.main" }}
            disabled={isDeletePending}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete & Cancel Settlement</ListItemText>
          </MenuItem>,
        ]}
        {selectedExpense?.type !== "allocated" && [
          // For own_site and self_use, show Edit/Delete options
          <MenuItem key="edit" onClick={handleEdit} disabled>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>,
          <Divider key="divider-other" />,
          <MenuItem
            key="delete"
            onClick={handleDelete}
            sx={{ color: "error.main" }}
            disabled={isDeletePending}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>,
        ]}
      </Menu>

      {/* View Details Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={handleViewClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Material Expense Details
          {selectedExpense && (
            <Chip
              label={typeConfig[selectedExpense.type].label}
              size="small"
              color={typeConfig[selectedExpense.type].color}
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent dividers>
          {selectedExpense && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Reference Code
                </Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {selectedExpense.ref_code}
                </Typography>
              </Box>

              <Divider />

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Purchase Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(selectedExpense.purchase_date)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="body1" fontWeight={600} color="primary.main">
                    {formatCurrency(selectedExpense.amount)}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Material
                  </Typography>
                  <Typography variant="body1">
                    {selectedExpense.material_name}
                  </Typography>
                  {selectedExpense.brand_name && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedExpense.brand_name}
                    </Typography>
                  )}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Quantity
                  </Typography>
                  <Typography variant="body1">
                    {selectedExpense.quantity
                      ? `${selectedExpense.quantity} ${selectedExpense.unit || ""}`
                      : "-"}
                  </Typography>
                </Box>
              </Box>

              {selectedExpense.vendor_name && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Vendor
                    </Typography>
                    <Typography variant="body1">
                      {selectedExpense.vendor_name}
                    </Typography>
                  </Box>
                </>
              )}

              {(selectedExpense.type === "allocated" || selectedExpense.type === "self_use") && selectedExpense.settlement_reference && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Settlement Reference
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedExpense.settlement_reference}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {selectedExpense.type === "allocated"
                        ? "This expense is from an inter-site settlement where you paid for materials used from a group purchase."
                        : "This expense represents your self-use portion from a group purchase you paid for."}
                    </Typography>
                  </Box>
                </>
              )}

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Source
                </Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {selectedExpense.source_ref}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleViewClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedExpense?.type === "allocated" ? "Delete Expense & Cancel Settlement" : "Delete Expense"}
        </DialogTitle>
        <DialogContent>
          {selectedExpense?.type === "allocated" ? (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={600}>
                  Warning: This will cancel the inter-site settlement
                </Typography>
              </Alert>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Deleting this allocated expense will:
              </Typography>
              <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                <li>
                  <Typography variant="body2">
                    Cancel the settlement made in Inter-Site Settlement
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Reset usage records back to &quot;pending&quot; status
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Remove this expense from your records
                  </Typography>
                </li>
              </Box>
            </>
          ) : (
            <Typography variant="body1">
              Are you sure you want to delete this expense?
            </Typography>
          )}
          {selectedExpense && (
            <Box sx={{ mt: 2, p: 2, bgcolor: selectedExpense.type === "allocated" ? "warning.lighter" : "grey.100", borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {selectedExpense.ref_code}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {selectedExpense.material_name}
              </Typography>
              <Typography variant="body2" color="primary.main" fontWeight={600}>
                {formatCurrency(selectedExpense.amount)}
              </Typography>
              {selectedExpense.type === "allocated" && selectedExpense.settlement_reference && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Settlement: {selectedExpense.settlement_reference}
                </Typography>
              )}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeletePending}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeletePending}
          >
            {isDeletePending ? "Deleting..." : selectedExpense?.type === "allocated" ? "Delete & Cancel Settlement" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Navigation Dialog for Allocated Expenses */}
      <Dialog
        open={navigationDialogOpen}
        onClose={handleNavigationCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Linked to Inter-Site Settlement</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This expense was created from an Inter-Site Settlement. To modify or delete it, you need to update the source record.
          </Typography>
          {selectedExpense && (
            <Box sx={{ p: 2, bgcolor: "info.lighter", borderRadius: 1, border: "1px solid", borderColor: "info.light" }}>
              <Typography variant="caption" color="text.secondary">
                Settlement Reference
              </Typography>
              <Typography variant="body1" fontFamily="monospace" fontWeight={500}>
                {selectedExpense.settlement_reference || selectedExpense.batch_ref_code}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Amount: {formatCurrency(selectedExpense.amount)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleNavigationCancel}>Cancel</Button>
          <Button
            onClick={handleNavigateToSettlement}
            variant="contained"
            color="info"
          >
            Go to Inter-Site Settlement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
