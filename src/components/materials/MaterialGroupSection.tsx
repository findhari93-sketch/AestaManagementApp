'use client'

import { Box, Chip, Collapse, Grid, LinearProgress, Typography } from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material'
import GroupStockBatchCard from '@/components/materials/GroupStockBatchCard'
import type { GroupStockBatch, BatchSiteAllocation } from '@/types/material.types'
import { formatCurrency } from '@/lib/formatters'

export interface MaterialGroup {
  materialName: string
  materialId: string
  unit: string
  batches: (GroupStockBatch & { site_allocations?: BatchSiteAllocation[] })[]
  totalAmount: number
  totalOriginalQty: number
  totalRemainingQty: number
  batchCount: number
  statusBreakdown: { in_stock: number; partial_used: number; completed: number }
}

interface MaterialGroupSectionProps {
  group: MaterialGroup
  expanded: boolean
  onToggle: () => void
  currentSiteId?: string
  onConvertToOwnSite: (batch: GroupStockBatch) => void
  onCompleteBatch: (batch: GroupStockBatch) => void
  onSettleUsage: (batch: any) => (siteId: string, siteName: string, amount: number) => void
  onRecordGroupUsage?: (materialId?: string) => void
}

export default function MaterialGroupSection({
  group,
  expanded,
  onToggle,
  currentSiteId,
  onConvertToOwnSite,
  onCompleteBatch,
  onSettleUsage,
  onRecordGroupUsage,
}: MaterialGroupSectionProps) {
  const usagePercent =
    group.totalOriginalQty > 0
      ? ((group.totalOriginalQty - group.totalRemainingQty) / group.totalOriginalQty) * 100
      : 0
  const progressColor =
    usagePercent >= 100 ? 'success' : usagePercent >= 50 ? 'warning' : 'primary'

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: expanded ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Clickable header */}
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 2 },
          px: 2,
          py: 1.5,
          cursor: 'pointer',
          bgcolor: expanded ? 'action.selected' : 'background.paper',
          '&:hover': { bgcolor: 'action.hover' },
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
        }}
      >
        {/* Expand icon */}
        {expanded ? (
          <ExpandMoreIcon sx={{ color: 'primary.main', flexShrink: 0 }} />
        ) : (
          <ChevronRightIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
        )}

        {/* Material name */}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 0, flexShrink: 1 }} noWrap>
          {group.materialName}
        </Typography>

        {/* Batch count */}
        <Chip
          label={`${group.batchCount} batch${group.batchCount !== 1 ? 'es' : ''}`}
          size="small"
          variant="outlined"
          sx={{ flexShrink: 0 }}
        />

        {/* Total amount */}
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, color: 'text.primary', flexShrink: 0, ml: { xs: 0, sm: 'auto' } }}
        >
          {formatCurrency(group.totalAmount)}
        </Typography>

        {/* Usage progress (hidden on xs) */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1, width: 140, flexShrink: 0 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(usagePercent, 100)}
            color={progressColor}
            sx={{ flex: 1, height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: 'right' }}>
            {Math.round(usagePercent)}%
          </Typography>
        </Box>

        {/* Status breakdown chips */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, flexShrink: 0 }}>
          {group.statusBreakdown.in_stock > 0 && (
            <Chip label={`${group.statusBreakdown.in_stock} In Stock`} size="small" color="info" variant="outlined" />
          )}
          {group.statusBreakdown.partial_used > 0 && (
            <Chip label={`${group.statusBreakdown.partial_used} Partial`} size="small" color="warning" variant="outlined" />
          )}
          {group.statusBreakdown.completed > 0 && (
            <Chip label={`${group.statusBreakdown.completed} Done`} size="small" color="success" variant="outlined" />
          )}
        </Box>
      </Box>

      {/* Expanded content: batch cards */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Grid container spacing={2}>
            {group.batches.map((batch) => (
              <Grid key={batch.ref_code || batch.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <GroupStockBatchCard
                  batch={batch}
                  onConvertToOwnSite={() => onConvertToOwnSite(batch)}
                  onComplete={() => onCompleteBatch(batch)}
                  onSettleUsage={onSettleUsage(batch)}
                  onRecordUsage={
                    onRecordGroupUsage
                      ? () => {
                          const materialId = batch.items?.[0]?.material_id
                          onRecordGroupUsage(materialId)
                        }
                      : undefined
                  }
                  currentSiteId={currentSiteId}
                  showActions
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Collapse>
    </Box>
  )
}
