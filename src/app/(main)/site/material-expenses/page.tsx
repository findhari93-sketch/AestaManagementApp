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
} from "@mui/material";
import {
  Receipt as ExpenseIcon,
  Store as OwnSiteIcon,
  Groups as GroupIcon,
  Person as SelfUseIcon,
  Receipt as BillIcon,
  TrendingUp as TotalIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { useSite } from "@/contexts/SiteContext";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  useSiteLevelMaterialExpenses,
  type SiteMaterialExpense,
} from "@/hooks/queries/useMaterialPurchases";

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
  const [typeFilter, setTypeFilter] = useState<"all" | SiteMaterialExpense["type"]>("all");

  // Fetch site-level material expenses
  const { data: expensesData, isLoading } = useSiteLevelMaterialExpenses(selectedSite?.id);

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
    </Box>
  );
}
