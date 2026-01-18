'use client'

import { useState, useMemo } from 'react'
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
  Tabs,
  Tab,
  Fab,
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import {
  AccountBalance as SettlementIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as ApproveIcon,
  Visibility as ViewIcon,
  Schedule as PendingIcon,
  Done as DoneIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Add as AddIcon,
  History as HistoryIcon,
  Assessment as ReportIcon,
  Receipt as TransactionsIcon,
  ShoppingCart as PurchaseIcon,
  LocalShipping as UsageIcon,
  Inventory as BatchesIcon,
} from '@mui/icons-material'
import PageHeader from '@/components/layout/PageHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import RelatedPages from '@/components/layout/RelatedPages'
import { useSite } from '@/contexts/SiteContext'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSiteGroupMembership } from '@/hooks/queries/useSiteGroups'
import {
  useInterSiteSettlements,
  useSiteSettlementSummary,
  useInterSiteBalances,
  useGenerateSettlement,
  useApproveSettlement,
  useGroupStockTransactions,
} from '@/hooks/queries/useInterSiteSettlements'
import { useGroupStockBatches } from '@/hooks/queries/useMaterialPurchases'
import AddHistoricalPurchaseDialog from '@/components/materials/AddHistoricalPurchaseDialog'
import WeeklyUsageReportDialog from '@/components/materials/WeeklyUsageReportDialog'
import GroupStockBatchCard from '@/components/materials/GroupStockBatchCard'
import EditMaterialPurchaseDialog from '@/components/materials/EditMaterialPurchaseDialog'
import ConvertToOwnSiteDialog from '@/components/materials/ConvertToOwnSiteDialog'
import type { InterSiteSettlementWithDetails, InterSiteBalance, GroupStockBatch, MaterialPurchaseExpenseWithDetails } from '@/types/material.types'
import { SETTLEMENT_STATUS_COLORS, SETTLEMENT_STATUS_LABELS } from '@/types/material.types'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

export default function InterSiteSettlementPage() {
  const { selectedSite } = useSite()
  const [tabValue, setTabValue] = useState(0)
  const [historicalPurchaseOpen, setHistoricalPurchaseOpen] = useState(false)
  const [usageReportOpen, setUsageReportOpen] = useState(false)

  // Dialog states for batch management
  const [editPurchaseOpen, setEditPurchaseOpen] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<GroupStockBatch | null>(null)

  // Filters for transactions tab
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'purchase' | 'usage'>('all')

  // Filter for batches tab
  const [batchStatusFilter, setBatchStatusFilter] = useState<'all' | 'in_stock' | 'partial_used' | 'completed'>('all')

  // Hooks
  const { data: groupMembership, isLoading: membershipLoading } = useSiteGroupMembership(
    selectedSite?.id
  )
  const { data: summary, isLoading: summaryLoading } = useSiteSettlementSummary(
    selectedSite?.id
  )
  const { data: balances = [], isLoading: balancesLoading } = useInterSiteBalances(
    groupMembership?.groupId
  )
  const { data: settlements = [], isLoading: settlementsLoading } = useInterSiteSettlements(
    selectedSite?.id
  )
  const { data: transactions = [], isLoading: transactionsLoading } = useGroupStockTransactions(
    groupMembership?.groupId,
    { limit: 100 }
  )
  const { data: batches = [], isLoading: batchesLoading } = useGroupStockBatches(
    groupMembership?.groupId,
    { enabled: !!groupMembership?.groupId }
  )

  const generateSettlement = useGenerateSettlement()
  const approveSettlement = useApproveSettlement()

  const isLoading = membershipLoading || summaryLoading || balancesLoading || settlementsLoading || transactionsLoading || batchesLoading

  // Filter settlements by status
  const pendingSettlements = settlements.filter(
    (s) => s.status === 'pending' || s.status === 'approved'
  )
  const completedSettlements = settlements.filter(
    (s) => s.status === 'settled' || s.status === 'cancelled'
  )

  // Filter transactions based on selected filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== 'all' && tx.transaction_type !== typeFilter) {
        return false
      }
      // Site filter
      if (siteFilter !== 'all') {
        if (tx.transaction_type === 'purchase') {
          return tx.payment_source_site_id === siteFilter
        } else if (tx.transaction_type === 'usage') {
          return tx.usage_site_id === siteFilter
        }
      }
      return true
    })
  }, [transactions, siteFilter, typeFilter])

  // Filter batches based on status
  const filteredBatches = useMemo(() => {
    if (batchStatusFilter === 'all') return batches
    return batches.filter((batch) => batch.status === batchStatusFilter)
  }, [batches, batchStatusFilter])

  // Batch action handlers
  const handleEditBatch = (batch: GroupStockBatch) => {
    setSelectedBatch(batch)
    setEditPurchaseOpen(true)
  }

  const handleConvertBatch = (batch: GroupStockBatch) => {
    setSelectedBatch(batch)
    setConvertDialogOpen(true)
  }

  const handleCompleteBatch = (batch: GroupStockBatch) => {
    // TODO: Open batch completion dialog
    console.log('Complete batch:', batch.ref_code)
  }

  // Calculate per-site summaries from transactions
  const siteSummaries = useMemo(() => {
    const summaryMap = new Map<string, {
      siteId: string
      siteName: string
      totalPaid: number
      totalUsed: number
      purchaseCount: number
      usageCount: number
    }>()

    // Initialize with all sites from group membership
    groupMembership?.allSites?.forEach((site) => {
      summaryMap.set(site.id, {
        siteId: site.id,
        siteName: site.name,
        totalPaid: 0,
        totalUsed: 0,
        purchaseCount: 0,
        usageCount: 0,
      })
    })

    // Calculate totals from transactions
    transactions.forEach((tx) => {
      if (tx.transaction_type === 'purchase' && tx.payment_source_site_id) {
        const existing = summaryMap.get(tx.payment_source_site_id)
        if (existing) {
          existing.totalPaid += Math.abs(tx.total_cost || 0)
          existing.purchaseCount += 1
        }
      } else if (tx.transaction_type === 'usage' && tx.usage_site_id) {
        const existing = summaryMap.get(tx.usage_site_id)
        if (existing) {
          existing.totalUsed += Math.abs(tx.total_cost || 0)
          existing.usageCount += 1
        }
      }
    })

    return Array.from(summaryMap.values())
  }, [transactions, groupMembership?.allSites])

  // Handle generate settlement from balance
  const handleGenerateSettlement = async (balance: InterSiteBalance) => {
    if (!groupMembership?.groupId) return

    try {
      await generateSettlement.mutateAsync({
        siteGroupId: balance.site_group_id,
        fromSiteId: balance.creditor_site_id,
        toSiteId: balance.debtor_site_id,
        year: balance.year,
        weekNumber: balance.week_number,
      })
    } catch (error) {
      console.error('Failed to generate settlement:', error)
    }
  }

  // Handle approve settlement
  const handleApproveSettlement = async (settlementId: string) => {
    try {
      await approveSettlement.mutateAsync({ settlementId })
    } catch (error) {
      console.error('Failed to approve settlement:', error)
    }
  }

  // Not in a group - show message
  if (!membershipLoading && !groupMembership?.isInGroup) {
    return (
      <Box>
        <Breadcrumbs />
        <PageHeader
          title="Inter-Site Settlement"
          subtitle="Track and settle material costs between sites"
        />
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Site Not in a Group
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            This feature is only available for sites that are part of a site group.
            Site groups allow multiple nearby sites to share materials and track costs between them.
          </Typography>
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Inter-Site Settlement"
        subtitle={
          groupMembership?.groupName
            ? `Track and settle material costs in ${groupMembership.groupName}`
            : 'Track and settle material costs between sites'
        }
      />

      <RelatedPages />

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={() => setHistoricalPurchaseOpen(true)}
        >
          Add Historical Purchase
        </Button>
        <Button
          variant="contained"
          startIcon={<ReportIcon />}
          onClick={() => setUsageReportOpen(true)}
        >
          Record Weekly Usage
        </Button>
      </Box>

      {/* Balance Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUpIcon color="success" />
                <Typography variant="subtitle2" color="text.secondary">
                  You Are Owed
                </Typography>
              </Box>
              {summaryLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h4" fontWeight={600} color="success.main">
                    {formatCurrency(summary?.total_owed_to_you || 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    From other sites using your materials
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingDownIcon color="error" />
                <Typography variant="subtitle2" color="text.secondary">
                  You Owe
                </Typography>
              </Box>
              {summaryLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography variant="h4" fontWeight={600} color="error.main">
                    {formatCurrency(summary?.total_you_owe || 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    For using materials paid by others
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <SettlementIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Net Balance
                </Typography>
              </Box>
              {summaryLoading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <>
                  <Typography
                    variant="h4"
                    fontWeight={600}
                    color={(summary?.net_balance || 0) >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(summary?.net_balance || 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Overall settlement position
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PendingIcon color="warning" />
                <Typography variant="subtitle2" color="text.secondary">
                  Pending
                </Typography>
              </Box>
              {summaryLoading ? (
                <Skeleton variant="text" width={60} height={40} />
              ) : (
                <>
                  <Typography variant="h4" fontWeight={600} color="warning.main">
                    {summary?.pending_settlements_count || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Settlements awaiting action
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Per-Site Expense Summary */}
      {siteSummaries.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
            Expense Breakdown by Site
          </Typography>
          <Grid container spacing={2}>
            {siteSummaries.map((site) => (
              <Grid key={site.siteId} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor: site.siteId === selectedSite?.id ? 'primary.50' : 'transparent',
                    borderColor: site.siteId === selectedSite?.id ? 'primary.main' : 'divider',
                  }}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {site.siteName}
                        {site.siteId === selectedSite?.id && (
                          <Chip label="Current" size="small" color="primary" sx={{ ml: 1, height: 20 }} />
                        )}
                      </Typography>
                    </Box>
                    <Grid container spacing={1}>
                      <Grid size={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PurchaseIcon sx={{ fontSize: 16, color: 'success.main' }} />
                          <Typography variant="caption" color="text.secondary">Paid</Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="success.main">
                          {formatCurrency(site.totalPaid)}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {site.purchaseCount} purchases
                        </Typography>
                      </Grid>
                      <Grid size={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <UsageIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                          <Typography variant="caption" color="text.secondary">Used</Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="warning.main">
                          {formatCurrency(site.totalUsed)}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {site.usageCount} usages
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Transactions" icon={<TransactionsIcon />} iconPosition="start" />
          <Tab label="Batches" icon={<BatchesIcon />} iconPosition="start" />
          <Tab label="Unsettled Balances" icon={<PendingIcon />} iconPosition="start" />
          <Tab label="Pending Settlements" icon={<SettlementIcon />} iconPosition="start" />
          <Tab label="Completed" icon={<DoneIcon />} iconPosition="start" />
        </Tabs>

        {/* Tab 0: Transactions */}
        <TabPanel value={tabValue} index={0}>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label="Filter by Site"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">All Sites</MenuItem>
              {groupMembership?.allSites?.map((site) => (
                <MenuItem key={site.id} value={site.id}>
                  {site.name}
                  {site.id === selectedSite?.id && ' (Current)'}
                </MenuItem>
              ))}
            </TextField>

            <ToggleButtonGroup
              value={typeFilter}
              exclusive
              onChange={(_, value) => value && setTypeFilter(value)}
              size="small"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="purchase" sx={{ color: 'success.main' }}>
                <PurchaseIcon sx={{ mr: 0.5, fontSize: 18 }} /> Purchases
              </ToggleButton>
              <ToggleButton value="usage" sx={{ color: 'warning.main' }}>
                <UsageIcon sx={{ mr: 0.5, fontSize: 18 }} /> Usage
              </ToggleButton>
            </ToggleButtonGroup>

            {(siteFilter !== 'all' || typeFilter !== 'all') && (
              <Button
                size="small"
                onClick={() => {
                  setSiteFilter('all')
                  setTypeFilter('all')
                }}
              >
                Clear Filters
              </Button>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Material</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Unit Cost</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Paid By / Used By</TableCell>
                  <TableCell>Notes</TableCell>
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
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(tx.transaction_date)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={tx.transaction_type === 'purchase' ? <PurchaseIcon /> : <UsageIcon />}
                          label={tx.transaction_type.charAt(0).toUpperCase() + tx.transaction_type.slice(1)}
                          size="small"
                          color={tx.transaction_type === 'purchase' ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {tx.material?.name || 'Unknown'}
                        </Typography>
                        {tx.brand?.brand_name && (
                          <Typography variant="caption" color="text.secondary">
                            {tx.brand.brand_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={tx.quantity > 0 ? 'success.main' : 'error.main'}
                        >
                          {tx.quantity > 0 ? '+' : ''}{tx.quantity} {tx.material?.unit || ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(tx.unit_cost || 0)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={500}>
                          {formatCurrency(Math.abs(tx.total_cost || 0))}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {tx.transaction_type === 'purchase' && tx.payment_source_site && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Paid by:</Typography>
                            <Chip label={tx.payment_source_site.name} size="small" color="success" variant="outlined" />
                          </Box>
                        )}
                        {tx.transaction_type === 'usage' && tx.usage_site && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Used by:</Typography>
                            <Chip label={tx.usage_site.name} size="small" color="warning" variant="outlined" />
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 150, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.notes || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <TransactionsIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Typography color="text.secondary">
                          No transactions yet
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          Add a historical purchase or record weekly usage to see transactions here
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 1: Batches */}
        <TabPanel value={tabValue} index={1}>
          {/* Status Filter */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <ToggleButtonGroup
              value={batchStatusFilter}
              exclusive
              onChange={(_, value) => value && setBatchStatusFilter(value)}
              size="small"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="in_stock">In Stock</ToggleButton>
              <ToggleButton value="partial_used">Partial Used</ToggleButton>
              <ToggleButton value="completed">Completed</ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              Showing {filteredBatches.length} of {batches.length} batches
            </Typography>
          </Box>

          {/* Batch Cards Grid */}
          {batchesLoading ? (
            <Grid container spacing={2}>
              {[...Array(4)].map((_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
                </Grid>
              ))}
            </Grid>
          ) : filteredBatches.length > 0 ? (
            <Grid container spacing={2}>
              {filteredBatches.map((batch) => (
                <Grid key={batch.ref_code} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <GroupStockBatchCard
                    batch={batch}
                    // TODO: Edit requires fetching MaterialPurchaseExpenseWithDetails by ref_code
                    // onEdit={() => handleEditBatch(batch)}
                    onConvertToOwnSite={() => handleConvertBatch(batch)}
                    onComplete={() => handleCompleteBatch(batch)}
                    showActions
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
              <BatchesIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary" variant="h6">
                No group stock batches
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                Add historical purchases with "Group Stock" type to see batches here
              </Typography>
              <Button
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => setHistoricalPurchaseOpen(true)}
              >
                Add Historical Purchase
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Tab 2: Unsettled Balances */}
        <TabPanel value={tabValue} index={2}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell>Creditor (Paid)</TableCell>
                  <TableCell></TableCell>
                  <TableCell>Debtor (Used)</TableCell>
                  <TableCell align="right">Amount Owed</TableCell>
                  <TableCell align="right">Transactions</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton width={24} /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                    </TableRow>
                  ))
                ) : balances.length > 0 ? (
                  balances.map((balance, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography variant="body2">
                          Week {balance.week_number}, {balance.year}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {balance.week_start} to {balance.week_end}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={balance.creditor_site_name}
                          size="small"
                          color={balance.creditor_site_id === selectedSite?.id ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <ArrowForwardIcon fontSize="small" color="action" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={balance.debtor_site_name}
                          size="small"
                          color={balance.debtor_site_id === selectedSite?.id ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(balance.total_amount_owed)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {balance.transaction_count}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Generate Settlement">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleGenerateSettlement(balance)}
                            disabled={generateSettlement.isPending}
                          >
                            Generate
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <DoneIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Typography color="text.secondary">
                          No unsettled balances
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          Record material usage to create settlement entries
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 3: Pending Settlements */}
        <TabPanel value={tabValue} index={3}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Settlement Code</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>From Site</TableCell>
                  <TableCell></TableCell>
                  <TableCell>To Site</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton width={24} /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                    </TableRow>
                  ))
                ) : pendingSettlements.length > 0 ? (
                  pendingSettlements.map((settlement) => (
                    <TableRow key={settlement.id} hover>
                      <TableCell>
                        <Typography fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                          {settlement.settlement_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          Week {settlement.week_number}, {settlement.year}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.from_site?.name || 'Unknown'} size="small" />
                      </TableCell>
                      <TableCell>
                        <ArrowForwardIcon fontSize="small" color="action" />
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.to_site?.name || 'Unknown'} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(settlement.total_amount)}
                        </Typography>
                        {settlement.paid_amount > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Paid: {formatCurrency(settlement.paid_amount)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={SETTLEMENT_STATUS_LABELS[settlement.status]}
                          size="small"
                          color={SETTLEMENT_STATUS_COLORS[settlement.status]}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton size="small">
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {settlement.status === 'pending' &&
                            settlement.from_site_id === selectedSite?.id && (
                              <Tooltip title="Approve">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleApproveSettlement(settlement.id)}
                                  disabled={approveSettlement.isPending}
                                >
                                  <ApproveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <SettlementIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Typography color="text.secondary">
                          No pending settlements
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          Generate settlements from unsettled balances
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 4: Completed */}
        <TabPanel value={tabValue} index={4}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Settlement Code</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>From Site</TableCell>
                  <TableCell></TableCell>
                  <TableCell>To Site</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Settled Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {completedSettlements.length > 0 ? (
                  completedSettlements.map((settlement) => (
                    <TableRow key={settlement.id} hover>
                      <TableCell>
                        <Typography fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                          {settlement.settlement_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          Week {settlement.week_number}, {settlement.year}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.from_site?.name || 'Unknown'} size="small" />
                      </TableCell>
                      <TableCell>
                        <ArrowForwardIcon fontSize="small" color="action" />
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.to_site?.name || 'Unknown'} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(settlement.total_amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={SETTLEMENT_STATUS_LABELS[settlement.status]}
                          size="small"
                          color={SETTLEMENT_STATUS_COLORS[settlement.status]}
                        />
                      </TableCell>
                      <TableCell>
                        {settlement.settled_at
                          ? formatDate(settlement.settled_at)
                          : settlement.cancelled_at
                          ? formatDate(settlement.cancelled_at)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <DoneIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Typography color="text.secondary">
                          No completed settlements yet
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Info Box */}
      <Alert severity="info">
        <Typography variant="subtitle2" fontWeight={600}>
          How Inter-Site Settlement Works
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          When sites share materials:
        </Typography>
        <Box component="ul" sx={{ mt: 0.5, pl: 2, mb: 0 }}>
          <li>
            <Typography variant="body2">
              Site A pays for materials (e.g., 1000 bricks at Rs.10 = Rs.10,000)
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Site B uses 300 bricks from shared stock
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Weekly settlement shows Site B owes Site A Rs.3,000
            </Typography>
          </li>
        </Box>
      </Alert>

      {/* Dialogs */}
      {selectedSite?.id && (
        <>
          <AddHistoricalPurchaseDialog
            open={historicalPurchaseOpen}
            onClose={() => setHistoricalPurchaseOpen(false)}
            siteId={selectedSite.id}
          />
          <WeeklyUsageReportDialog
            open={usageReportOpen}
            onClose={() => setUsageReportOpen(false)}
            siteId={selectedSite.id}
          />
          <ConvertToOwnSiteDialog
            open={convertDialogOpen}
            onClose={() => {
              setConvertDialogOpen(false)
              setSelectedBatch(null)
            }}
            batch={selectedBatch}
            siteId={selectedSite.id}
          />
        </>
      )}

      {/* Mobile FAB */}
      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
      >
        <Fab
          color="primary"
          onClick={() => setUsageReportOpen(true)}
        >
          <AddIcon />
        </Fab>
      </Box>
    </Box>
  )
}
