'use client'

import { useState } from 'react'
import {
  TableRow,
  TableCell,
  IconButton,
  Typography,
  Chip,
  Box,
  Collapse,
  Table,
  TableHead,
  TableBody,
  Tooltip,
  LinearProgress,
} from '@mui/material'
import {
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  ShoppingCart as PurchaseIcon,
  LocalShipping as UsageIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as SettledIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { GroupStockBatch, BatchSiteAllocation } from '@/types/material.types'
import type { GroupStockTransaction } from '@/hooks/queries/useInterSiteSettlements'

interface PurchaseBatchRowProps {
  batch: GroupStockBatch
  transactions: GroupStockTransaction[]
  currentSiteId?: string
  onViewTransaction: (tx: GroupStockTransaction) => void
  onEditTransaction: (tx: GroupStockTransaction) => void
  onDeleteTransaction: (tx: GroupStockTransaction) => void
  canEdit: boolean
}

export default function PurchaseBatchRow({
  batch,
  transactions,
  currentSiteId,
  onViewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  canEdit,
}: PurchaseBatchRowProps) {
  const [open, setOpen] = useState(false)

  // Get material info from batch - handle different data structures
  // From useGroupStockBatches: items[].material_name (transformed)
  // From useBatchesWithUsage: items[].material.name (raw Supabase)
  const firstItem = batch.items?.[0]
  const materialName = batch.material?.name
    || firstItem?.material_name
    || (firstItem as any)?.material?.name
    || 'Unknown'
  const materialUnit = batch.material?.unit
    || firstItem?.unit
    || (firstItem as any)?.material?.unit
    || 'nos'
  const brandName = batch.brand?.brand_name
    || firstItem?.brand_name
    || (firstItem as any)?.brand?.brand_name

  // Get purchase transaction for this batch
  const purchaseTransaction = transactions.find(tx => tx.transaction_type === 'purchase')

  // Get usage transactions for this batch
  const usageTransactions = transactions.filter(tx => tx.transaction_type === 'usage')

  // Create a fallback transaction object from batch data for actions
  // This allows actions to work even when there's no matching transaction in group_stock_transactions
  // We add _isBatchFallback flag to identify this is a batch, not a real transaction
  const fallbackTransaction: (GroupStockTransaction & { _isBatchFallback?: boolean; _batchRefCode?: string }) | null = !purchaseTransaction && batch ? ({
    id: batch.id || '',
    transaction_type: 'purchase',
    transaction_date: batch.purchase_date,
    quantity: batch.original_quantity || 0,
    unit_cost: batch.total_amount && batch.original_quantity
      ? batch.total_amount / batch.original_quantity
      : 0,
    total_cost: batch.total_amount || 0,
    notes: batch.notes,
    batch_ref_code: batch.ref_code,
    material_id: batch.items?.[0]?.material_id || '',
    material: batch.material,
    brand_id: batch.items?.[0]?.brand_id,
    brand: batch.brand,
    payment_source_site_id: batch.payment_source_site_id || batch.paying_site?.id,
    payment_source_site: batch.paying_site || (batch.payment_source_site_name ? { id: batch.payment_source_site_id, name: batch.payment_source_site_name } : undefined),
    usage_site_id: undefined,
    usage_site: undefined,
    site_group_id: batch.site_group_id || '',
    inventory_id: undefined,
    reference_type: 'batch',
    reference_id: batch.id,
    recorded_by: undefined,
    settlement_id: undefined,
    created_at: new Date().toISOString(),
    // Flag to identify this is a batch fallback, not a real transaction
    _isBatchFallback: true,
    _batchRefCode: batch.ref_code,
  } as unknown as GroupStockTransaction & { _isBatchFallback: boolean; _batchRefCode: string }) : null

  // Use purchase transaction if available, otherwise use fallback
  const actionTransaction = purchaseTransaction || fallbackTransaction

  // Calculate usage percentage
  const usedQuantity = batch.original_quantity - batch.remaining_quantity
  const usagePercentage = batch.original_quantity > 0
    ? (usedQuantity / batch.original_quantity) * 100
    : 0

  // Get site allocations (usage breakdown by site)
  const siteAllocations = batch.site_allocations || []

  // Determine if current site is the payer
  const isCurrentSitePayer = batch.payment_source_site_id === currentSiteId

  // Check if there's any usage data to display
  const hasUsageData = usageTransactions.length > 0 || siteAllocations.length > 0 || usedQuantity > 0

  // Debug: Log data structure (can be removed after testing)
  if (process.env.NODE_ENV === 'development' && hasUsageData) {
    console.log('PurchaseBatchRow Debug:', {
      batchRefCode: batch.ref_code,
      usedQuantity,
      usagePercentage,
      siteAllocationsCount: siteAllocations.length,
      usageTransactionsCount: usageTransactions.length,
      siteAllocations: siteAllocations.length > 0 ? siteAllocations : 'none',
      transactions: transactions.length
    })
  }

  return (
    <>
      {/* Main Purchase Row (Collapsed View) */}
      <TableRow
        hover
        sx={{
          '& > *': { borderBottom: open ? 'none !important' : undefined },
          bgcolor: isCurrentSitePayer ? 'success.50' : undefined,
        }}
      >
        {/* Expand/Collapse Button */}
        <TableCell sx={{ width: 48 }}>
          <IconButton
            size="small"
            onClick={() => setOpen(!open)}
            disabled={!hasUsageData}
          >
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>

        {/* Date */}
        <TableCell>
          <Typography variant="body2">
            {formatDate(actionTransaction?.transaction_date || batch.purchase_date)}
          </Typography>
        </TableCell>

        {/* Type Badge */}
        <TableCell>
          <Chip
            icon={<PurchaseIcon />}
            label="Purchase"
            size="small"
            color="success"
            variant="outlined"
          />
        </TableCell>

        {/* Material */}
        <TableCell>
          <Typography variant="body2" fontWeight={500}>
            {materialName}
          </Typography>
          {brandName && (
            <Typography variant="caption" color="text.secondary">
              {brandName}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" display="block">
            Batch: {batch.ref_code}
          </Typography>
        </TableCell>

        {/* Quantity with Usage Progress */}
        <TableCell align="right">
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {batch.original_quantity} {materialUnit}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Used: {usedQuantity} ({usagePercentage.toFixed(0)}%)
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(usagePercentage, 100)}
              color={usagePercentage > 100 ? 'error' : 'primary'}
              sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
            />
          </Box>
        </TableCell>

        {/* Unit Cost */}
        <TableCell align="right">
          {formatCurrency(actionTransaction?.unit_cost || 0)}
        </TableCell>

        {/* Total Cost - show both original and paid amounts when bargained */}
        <TableCell align="right">
          {batch.amount_paid && batch.amount_paid !== batch.total_amount ? (
            <Box>
              <Typography
                variant="body2"
                sx={{ textDecoration: 'line-through', color: 'text.disabled' }}
              >
                {formatCurrency(batch.total_amount || 0)}
              </Typography>
              <Typography fontWeight={500} color="success.main">
                {formatCurrency(batch.amount_paid)}
              </Typography>
            </Box>
          ) : (
            <Typography fontWeight={500}>
              {formatCurrency(batch.total_amount || 0)}
            </Typography>
          )}
        </TableCell>

        {/* Paid By */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Paid by:</Typography>
            <Chip
              label={batch.paying_site?.name || batch.payment_source_site_name || 'Unknown'}
              size="small"
              color={isCurrentSitePayer ? 'success' : 'default'}
              variant="outlined"
            />
          </Box>
        </TableCell>

        {/* Notes */}
        <TableCell>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              maxWidth: 150,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {actionTransaction?.notes || batch.notes || '-'}
          </Typography>
        </TableCell>

        {/* Actions */}
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {actionTransaction && (
              <>
                <Tooltip title="View Details">
                  <IconButton size="small" onClick={() => onViewTransaction(actionTransaction)}>
                    <ViewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {canEdit && (
                  <>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => onEditTransaction(actionTransaction)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => onDeleteTransaction(actionTransaction)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </>
            )}
          </Box>
        </TableCell>
      </TableRow>

      {/* Expanded View - Usage Details */}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Usage Breakdown
              </Typography>

              {siteAllocations.length > 0 || usageTransactions.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Site</TableCell>
                      <TableCell align="right">Quantity Used</TableCell>
                      <TableCell align="right">Unit Cost</TableCell>
                      <TableCell align="right">Total Cost</TableCell>
                      <TableCell>Settlement Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Show site allocations if available */}
                    {siteAllocations.length > 0 ? (
                      siteAllocations.map((allocation: BatchSiteAllocation, index: number) => {
                        const usageTx = usageTransactions.find(tx => tx.usage_site_id === allocation.site_id)
                        const isCurrentSite = allocation.site_id === currentSiteId
                        const isSelfUse = allocation.is_payer && allocation.site_id === allocation.site_id

                        return (
                          <TableRow
                            key={index}
                            sx={{
                              bgcolor: isCurrentSite ? 'primary.50' : undefined,
                            }}
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <UsageIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                <Typography variant="body2" fontWeight={isCurrentSite ? 600 : 400}>
                                  {allocation.site_name}
                                </Typography>
                                {isCurrentSite && (
                                  <Chip label="You" size="small" color="primary" sx={{ height: 20, ml: 0.5 }} />
                                )}
                                {isSelfUse && (
                                  <Chip label="Self Use" size="small" variant="outlined" sx={{ height: 20, ml: 0.5 }} />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="warning.main">
                                {allocation.quantity_used} {materialUnit}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(actionTransaction?.unit_cost || 0)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500}>
                                {formatCurrency(allocation.amount || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {isSelfUse ? (
                                <Chip
                                  label="Self Use"
                                  size="small"
                                  color="default"
                                  variant="outlined"
                                />
                              ) : allocation.settlement_status === 'settled' ? (
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
                            <TableCell align="center">
                              {usageTx && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                  <Tooltip title="View Details">
                                    <IconButton size="small" onClick={() => onViewTransaction(usageTx)}>
                                      <ViewIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  {canEdit && !isSelfUse && (
                                    <>
                                      <Tooltip title="Edit">
                                        <IconButton size="small" onClick={() => onEditTransaction(usageTx)}>
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete">
                                        <IconButton size="small" color="error" onClick={() => onDeleteTransaction(usageTx)}>
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  )}
                                </Box>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      /* Fallback: Show individual usage transactions if no site allocations */
                      usageTransactions.map((usageTx) => (
                        <TableRow key={usageTx.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <UsageIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                              <Typography variant="body2">
                                {usageTx.usage_site?.name || 'Unknown'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="warning.main">
                              {Math.abs(usageTx.quantity)} {usageTx.material?.unit || 'nos'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(usageTx.unit_cost || 0)}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={500}>
                              {formatCurrency(Math.abs(usageTx.total_cost || 0))}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {usageTx.settlement_id ? (
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
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                              <Tooltip title="View Details">
                                <IconButton size="small" onClick={() => onViewTransaction(usageTx)}>
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {canEdit && (
                                <>
                                  <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => onEditTransaction(usageTx)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton size="small" color="error" onClick={() => onDeleteTransaction(usageTx)}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 3,
                    color: 'text.secondary',
                  }}
                >
                  <UsageIcon sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
                  <Typography variant="body2">
                    {usedQuantity > 0
                      ? `Usage detected (${usedQuantity} ${materialUnit}) but detailed breakdown not available`
                      : 'No usage recorded for this purchase yet'}
                  </Typography>
                  {usedQuantity > 0 && (
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                      The usage data may still be syncing. Try refreshing the page.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}
