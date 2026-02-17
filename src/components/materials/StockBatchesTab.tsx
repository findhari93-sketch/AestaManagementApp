'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Button,
  Grid,
  Skeleton,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material'
import {
  ViewModule as CardViewIcon,
  ViewList as ListViewIcon,
  Segment as GroupedViewIcon,
  Inventory as BatchesIcon,
  AddCircleOutline as RecordUsageIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
} from '@mui/icons-material'
import GroupStockBatchCard from '@/components/materials/GroupStockBatchCard'
import PurchaseBatchRow from '@/components/materials/PurchaseBatchRow'
import MaterialGroupSection from '@/components/materials/MaterialGroupSection'
import type { MaterialGroup } from '@/components/materials/MaterialGroupSection'
import type { GroupStockBatch } from '@/types/material.types'
import type { GroupStockTransaction } from '@/hooks/queries/useInterSiteSettlements'

interface StockBatchesTabProps {
  batches: any[]
  batchesWithUsage: any[]
  transactions: GroupStockTransaction[]
  isLoading: boolean
  currentSiteId: string | undefined
  allSites: Array<{ id: string; name: string }> | undefined
  groupName: string | undefined
  canEdit: boolean
  onConvertToOwnSite: (batch: GroupStockBatch) => void
  onCompleteBatch: (batch: GroupStockBatch) => void
  onSettleUsage: (
    batchRefCode: string,
    creditorSiteId: string,
    creditorSiteName: string,
    debtorSiteId: string,
    debtorSiteName: string,
    amount: number
  ) => void
  onViewTransaction: (tx: GroupStockTransaction) => void
  onEditTransaction: (tx: GroupStockTransaction) => void
  onDeleteTransaction: (tx: GroupStockTransaction) => void
  onRecordGroupUsage?: (materialId?: string) => void
}

export default function StockBatchesTab({
  batches,
  batchesWithUsage,
  transactions,
  isLoading,
  currentSiteId,
  allSites,
  groupName,
  canEdit,
  onConvertToOwnSite,
  onCompleteBatch,
  onSettleUsage,
  onViewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onRecordGroupUsage,
}: StockBatchesTabProps) {
  const [viewMode, setViewMode] = useState<'grouped' | 'card' | 'list'>('grouped')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'partial_used' | 'completed'>('all')
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const sourceBatches = batchesWithUsage.length > 0 ? batchesWithUsage : batches

  // Filter batches by computed status (based on actual usage, not DB status)
  const filteredBatches = useMemo(() => {
    let filtered = sourceBatches

    if (statusFilter !== 'all') {
      filtered = filtered.filter((batch: any) => {
        const originalQty = batch.original_quantity ?? 0
        const remainingQty = batch.remaining_quantity ?? 0
        const usagePercent = originalQty > 0 ? ((originalQty - remainingQty) / originalQty) * 100 : 0

        // Compute status from actual quantities (not DB status) to handle stale data
        const computedStatus =
          batch.status === 'converted' ? 'completed' :
          (remainingQty <= 0 && originalQty > 0) ? 'completed' :
          usagePercent > 0 ? 'partial_used' : 'in_stock'

        return computedStatus === statusFilter
      })
    }

    // Site filter for card view
    if (siteFilter !== 'all') {
      filtered = filtered.filter((batch: any) =>
        batch.payment_source_site_id === siteFilter ||
        (batch.site_allocations && batch.site_allocations.some((alloc: any) =>
          alloc.site_id === siteFilter
        ))
      )
    }

    return filtered
  }, [sourceBatches, statusFilter, siteFilter])

  // Group transactions by batch for list view
  const groupedTransactions = useMemo(() => {
    if (viewMode !== 'list') return []

    return filteredBatches.map((batch: any) => ({
      batch,
      transactions: transactions.filter(tx => {
        if (tx.batch_ref_code === batch.ref_code) return true
        if (tx.reference_id === batch.id) return true
        if (tx.inventory_id === batch.inventory_id) return true
        if (tx.transaction_type === 'purchase' &&
            tx.material_id === batch.material_id &&
            tx.transaction_date === batch.purchase_date) {
          return true
        }
        return false
      })
    }))
  }, [filteredBatches, transactions, viewMode])

  // Group batches by material for grouped view
  const materialGroups = useMemo((): MaterialGroup[] => {
    if (viewMode !== 'grouped') return []

    const groupMap = new Map<string, MaterialGroup>()

    filteredBatches.forEach((batch: any) => {
      const items = batch.items || []
      // Use primary material (highest quantity item)
      const primaryItem = items.length > 0
        ? items.reduce((best: any, item: any) =>
            (item.quantity || 0) > (best.quantity || 0) ? item : best,
            items[0]
          )
        : null

      const materialName = primaryItem?.material_name
        || primaryItem?.material?.name
        || batch.material?.name
        || 'Other Materials'
      const materialId = primaryItem?.material_id || batch.material_id || 'unknown'
      const unit = primaryItem?.unit || primaryItem?.material?.unit || 'nos'

      if (!groupMap.has(materialName)) {
        groupMap.set(materialName, {
          materialName,
          materialId,
          unit,
          batches: [],
          totalAmount: 0,
          totalOriginalQty: 0,
          totalRemainingQty: 0,
          batchCount: 0,
          statusBreakdown: { in_stock: 0, partial_used: 0, completed: 0 },
        })
      }

      const group = groupMap.get(materialName)!
      group.batches.push(batch)
      group.totalAmount += batch.total_amount || 0
      group.totalOriginalQty += batch.original_quantity || 0
      group.totalRemainingQty += batch.remaining_quantity || 0
      group.batchCount += 1

      // Compute status for breakdown
      const originalQty = batch.original_quantity ?? 0
      const remainingQty = batch.remaining_quantity ?? 0
      const usagePercent = originalQty > 0 ? ((originalQty - remainingQty) / originalQty) * 100 : 0
      const computedStatus =
        batch.status === 'converted' ? 'completed' :
        (remainingQty <= 0 && originalQty > 0) ? 'completed' :
        usagePercent > 0 ? 'partial_used' : 'in_stock'
      group.statusBreakdown[computedStatus as keyof typeof group.statusBreakdown] += 1
    })

    return Array.from(groupMap.values()).sort((a, b) =>
      a.materialName.localeCompare(b.materialName)
    )
  }, [filteredBatches, viewMode])

  const handleSettleUsage = (batch: any) => (
    siteId: string,
    siteName: string,
    amount: number
  ) => {
    onSettleUsage(
      batch.ref_code,
      batch.payment_source_site_id || batch.payment_source_site_id,
      batch.paying_site?.name || batch.payment_source_site_name || 'Paying Site',
      siteId,
      siteName,
      amount
    )
  }

  const handleToggleGroup = (materialName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(materialName)) {
        next.delete(materialName)
      } else {
        next.add(materialName)
      }
      return next
    })
  }

  const allExpanded = materialGroups.length > 0 && expandedGroups.size === materialGroups.length

  const handleExpandCollapseAll = () => {
    if (allExpanded) {
      setExpandedGroups(new Set())
    } else {
      setExpandedGroups(new Set(materialGroups.map(g => g.materialName)))
    }
  }

  return (
    <Box>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, value) => value && setStatusFilter(value)}
          size="small"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="in_stock">In Stock</ToggleButton>
          <ToggleButton value="partial_used">Partial Used</ToggleButton>
          <ToggleButton value="completed">Completed</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          select
          size="small"
          label="Site"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All Sites</MenuItem>
          {allSites?.map((site) => (
            <MenuItem key={site.id} value={site.id}>
              {site.name}
              {site.id === currentSiteId && ' (Current)'}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          {onRecordGroupUsage && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<RecordUsageIcon />}
              onClick={() => onRecordGroupUsage()}
            >
              Record Usage
            </Button>
          )}

          {viewMode === 'grouped' && materialGroups.length > 1 && (
            <Tooltip title={allExpanded ? 'Collapse All' : 'Expand All'}>
              <IconButton size="small" onClick={handleExpandCollapseAll}>
                {allExpanded ? <CollapseAllIcon fontSize="small" /> : <ExpandAllIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}

          <Typography variant="body2" color="text.secondary">
            {filteredBatches.length} of {sourceBatches.length} batches
          </Typography>

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, value) => value && setViewMode(value)}
            size="small"
          >
            <ToggleButton value="grouped">
              <Tooltip title="Grouped by Material">
                <GroupedViewIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="card">
              <Tooltip title="Card View">
                <CardViewIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="list">
              <Tooltip title="List View">
                <ListViewIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Grouped View */}
      {viewMode === 'grouped' && (
        <>
          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
              ))}
            </Box>
          ) : materialGroups.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {materialGroups.map((group) => (
                <MaterialGroupSection
                  key={group.materialName}
                  group={group}
                  expanded={expandedGroups.has(group.materialName)}
                  onToggle={() => handleToggleGroup(group.materialName)}
                  currentSiteId={currentSiteId}
                  onConvertToOwnSite={onConvertToOwnSite}
                  onCompleteBatch={onCompleteBatch}
                  onSettleUsage={handleSettleUsage}
                  onRecordGroupUsage={onRecordGroupUsage}
                />
              ))}
            </Box>
          ) : (
            <EmptyState groupName={groupName} batchCount={sourceBatches.length} />
          )}
        </>
      )}

      {/* Card View */}
      {viewMode === 'card' && (
        <>
          {isLoading ? (
            <Grid container spacing={2}>
              {[...Array(4)].map((_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
                </Grid>
              ))}
            </Grid>
          ) : filteredBatches.length > 0 ? (
            <Grid container spacing={2}>
              {filteredBatches.map((batch: any) => (
                <Grid key={batch.ref_code} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <GroupStockBatchCard
                    batch={batch}
                    onConvertToOwnSite={() => onConvertToOwnSite(batch)}
                    onComplete={() => onCompleteBatch(batch)}
                    onSettleUsage={handleSettleUsage(batch)}
                    onRecordUsage={onRecordGroupUsage ? () => {
                      const materialId = batch.items?.[0]?.material_id
                      onRecordGroupUsage(materialId)
                    } : undefined}
                    currentSiteId={currentSiteId}
                    showActions
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <EmptyState groupName={groupName} batchCount={sourceBatches.length} />
          )}
        </>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 48 }}></TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Material</TableCell>
                <TableCell align="right">Quantity & Usage</TableCell>
                <TableCell align="right">Unit Cost</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Paid By</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(10)].map((_, j) => (
                      <TableCell key={j}><Skeleton /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : groupedTransactions.length > 0 ? (
                groupedTransactions.map((group: any) => (
                  <PurchaseBatchRow
                    key={group.batch.ref_code}
                    batch={group.batch}
                    transactions={group.transactions}
                    currentSiteId={currentSiteId}
                    onViewTransaction={onViewTransaction}
                    onEditTransaction={onEditTransaction}
                    onDeleteTransaction={onDeleteTransaction}
                    canEdit={canEdit}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <EmptyState groupName={groupName} batchCount={sourceBatches.length} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

function EmptyState({ groupName, batchCount }: { groupName?: string; batchCount: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
      <BatchesIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
      <Typography color="text.secondary" variant="h6">
        No group stock batches
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ mb: 2, textAlign: 'center' }}>
        Create a Purchase Order with &quot;Group Stock&quot; enabled and record delivery.
        <br />
        Batches are automatically created when Group POs are delivered.
      </Typography>
      {groupName && (
        <Alert severity="info" sx={{ maxWidth: 500 }}>
          <Typography variant="body2">
            You&apos;re in the group <strong>{groupName}</strong>.
            {batchCount === 0 ? (
              <> Create your first group stock purchase from the Purchase Orders page.</>
            ) : (
              <> Try adjusting the filters to see existing batches.</>
            )}
          </Typography>
        </Alert>
      )}
    </Box>
  )
}
