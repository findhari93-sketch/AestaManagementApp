'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  ArrowForward as ArrowForwardIcon,
  Done as DoneIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  AccountBalance as SettlementIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { SETTLEMENT_STATUS_COLORS, SETTLEMENT_STATUS_LABELS } from '@/types/material.types'
import type { InterSiteBalance, InterSiteSettlementWithDetails } from '@/types/material.types'

type StatusFilter = 'all' | 'unsettled' | 'in_progress' | 'settled' | 'cancelled'

interface UnifiedRow {
  type: 'unsettled' | 'settlement'
  id: string
  fromSiteId: string
  fromSiteName: string
  toSiteId: string
  toSiteName: string
  amount: number
  paidAmount?: number
  status: string
  period?: string
  code?: string
  date?: string
  raw: InterSiteBalance | InterSiteSettlementWithDetails
}

interface SettlementsTabProps {
  balances: InterSiteBalance[]
  settlements: InterSiteSettlementWithDetails[]
  currentSiteId: string | undefined
  isLoading: boolean
  canEdit: boolean
  onGenerateSettlement: (balance: InterSiteBalance) => void
  onSettlePayment: (settlement: InterSiteSettlementWithDetails) => void
  onDeleteSettlement: (settlementId: string) => void
  onCancelSettlement: (settlementId: string, type: 'completed' | 'pending') => void
  onDeleteUnsettledBalance: (balance: InterSiteBalance) => void
  generatePending?: boolean
  cancelPending?: boolean
  deletePending?: boolean
  deleteUnsettledPending?: boolean
}

export default function SettlementsTab({
  balances,
  settlements,
  currentSiteId,
  isLoading,
  canEdit,
  onGenerateSettlement,
  onSettlePayment,
  onDeleteSettlement,
  onCancelSettlement,
  onDeleteUnsettledBalance,
  generatePending,
  cancelPending,
  deletePending,
  deleteUnsettledPending,
}: SettlementsTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Unify balances and settlements into a single list
  const unifiedRows = useMemo(() => {
    const rows: UnifiedRow[] = []

    // Add unsettled balances (fromSite = debtor/who owes, toSite = creditor/who is owed)
    balances.forEach((balance, index) => {
      rows.push({
        type: 'unsettled',
        id: `balance-${index}`,
        fromSiteId: balance.debtor_site_id,
        fromSiteName: balance.debtor_site_name,
        toSiteId: balance.creditor_site_id,
        toSiteName: balance.creditor_site_name,
        amount: balance.total_amount_owed,
        status: 'unsettled',
        period: `Week ${balance.week_number}, ${balance.year}`,
        raw: balance,
      })
    })

    // Add settlements
    settlements.forEach((settlement) => {
      let mappedStatus: string
      if (settlement.status === 'pending' || settlement.status === 'approved') {
        mappedStatus = 'in_progress'
      } else {
        mappedStatus = settlement.status // 'settled' or 'cancelled'
      }

      // fromSite = debtor/who owes (to_site), toSite = creditor/who is owed (from_site)
      rows.push({
        type: 'settlement',
        id: settlement.id,
        fromSiteId: settlement.to_site_id,
        fromSiteName: settlement.to_site?.name || 'Unknown',
        toSiteId: settlement.from_site_id,
        toSiteName: settlement.from_site?.name || 'Unknown',
        amount: settlement.total_amount,
        paidAmount: settlement.paid_amount > 0 ? settlement.paid_amount : undefined,
        status: mappedStatus,
        period: `Week ${settlement.week_number}, ${settlement.year}`,
        code: settlement.settlement_code,
        date: settlement.settled_at || settlement.cancelled_at || settlement.created_at,
        raw: settlement,
      })
    })

    return rows
  }, [balances, settlements])

  // Apply status filter
  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return unifiedRows
    return unifiedRows.filter(row => row.status === statusFilter)
  }, [unifiedRows, statusFilter])

  // Count per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: unifiedRows.length, unsettled: 0, in_progress: 0, settled: 0, cancelled: 0 }
    unifiedRows.forEach(row => {
      if (counts[row.status] !== undefined) counts[row.status]++
    })
    return counts
  }, [unifiedRows])

  const getStatusChip = (row: UnifiedRow) => {
    switch (row.status) {
      case 'unsettled': {
        const balance = row.raw as InterSiteBalance
        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Chip label="Unsettled" size="small" color="warning" />
            {balance.has_unpaid_vendor && (
              <Tooltip title="Vendor not yet paid by creditor site">
                <Chip icon={<WarningIcon sx={{ fontSize: 14 }} />} label="Vendor Unpaid" size="small" color="error" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
              </Tooltip>
            )}
          </Box>
        )
      }
      case 'in_progress':
        return <Chip label={SETTLEMENT_STATUS_LABELS[(row.raw as InterSiteSettlementWithDetails).status]} size="small" color={SETTLEMENT_STATUS_COLORS[(row.raw as InterSiteSettlementWithDetails).status]} />
      case 'settled':
        return <Chip label="Settled" size="small" color="success" />
      case 'cancelled':
        return <Chip label="Cancelled" size="small" color="default" />
      default:
        return null
    }
  }

  const getActions = (row: UnifiedRow) => {
    if (row.type === 'unsettled') {
      const balance = row.raw as InterSiteBalance
      return (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center' }}>
          {balance.has_unpaid_vendor && (
            <Tooltip title="Vendor must be paid first in Material Settlements">
              <WarningIcon fontSize="small" color="error" />
            </Tooltip>
          )}
          <Tooltip title={balance.has_unpaid_vendor ? "Vendor must be paid first. Go to Material Settlements to mark vendor as paid." : ""}>
            <span>
              <Button
                size="small"
                variant="outlined"
                onClick={() => onGenerateSettlement(balance)}
                disabled={generatePending || !!balance.has_unpaid_vendor}
              >
                Generate
              </Button>
            </span>
          </Tooltip>
          {canEdit && (
            <Tooltip title="Delete Usage Records">
              <IconButton
                size="small"
                color="error"
                onClick={() => onDeleteUnsettledBalance(balance)}
                disabled={deleteUnsettledPending}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    }

    const settlement = row.raw as InterSiteSettlementWithDetails

    if (row.status === 'in_progress') {
      return (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          {(settlement.to_site_id === currentSiteId || settlement.from_site_id === currentSiteId) && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => onSettlePayment(settlement)}
            >
              Settle
            </Button>
          )}
          {canEdit && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={() => onCancelSettlement(settlement.id, 'pending')}
              disabled={cancelPending}
            >
              Cancel
            </Button>
          )}
        </Box>
      )
    }

    if (row.status === 'settled' && canEdit) {
      return (
        <Button
          size="small"
          variant="outlined"
          color="warning"
          onClick={() => onCancelSettlement(settlement.id, 'completed')}
          disabled={cancelPending}
        >
          Cancel
        </Button>
      )
    }

    if (row.status === 'cancelled' && canEdit) {
      return (
        <Tooltip title="Delete Cancelled Settlement">
          <IconButton
            size="small"
            color="error"
            onClick={() => onDeleteSettlement(settlement.id)}
            disabled={deletePending}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    }

    return null
  }

  return (
    <Box>
      {/* Status filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, value) => value && setStatusFilter(value)}
          size="small"
        >
          <ToggleButton value="all">
            All ({statusCounts.all})
          </ToggleButton>
          <ToggleButton value="unsettled" sx={{ color: 'warning.main' }}>
            Unsettled ({statusCounts.unsettled})
          </ToggleButton>
          <ToggleButton value="in_progress" sx={{ color: 'info.main' }}>
            In Progress ({statusCounts.in_progress})
          </ToggleButton>
          <ToggleButton value="settled" sx={{ color: 'success.main' }}>
            Settled ({statusCounts.settled})
          </ToggleButton>
          <ToggleButton value="cancelled">
            Cancelled ({statusCounts.cancelled})
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Who Owes</TableCell>
              <TableCell sx={{ width: 32 }}></TableCell>
              <TableCell>Owes To (Paid)</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(9)].map((_, j) => (
                    <TableCell key={j}><Skeleton /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredRows.length > 0 ? (
              filteredRows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    {row.code ? (
                      <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                        {row.code}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.period}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.fromSiteName}
                      size="small"
                      color={row.fromSiteId === currentSiteId ? 'error' : 'default'}
                      variant={row.fromSiteId === currentSiteId ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <ArrowForwardIcon fontSize="small" color="action" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.toSiteName}
                      size="small"
                      color={row.toSiteId === currentSiteId ? 'success' : 'default'}
                      variant={row.toSiteId === currentSiteId ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={600}>
                      {formatCurrency(row.amount)}
                    </Typography>
                    {row.paidAmount && (
                      <Typography variant="caption" color="text.secondary">
                        Paid: {formatCurrency(row.paidAmount)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusChip(row)}
                  </TableCell>
                  <TableCell>
                    {row.date ? (
                      <Typography variant="body2">{formatDate(row.date)}</Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled">-</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {getActions(row)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    {statusFilter === 'all' ? (
                      <>
                        <DoneIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Typography color="text.secondary">
                          No settlements yet
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          Record material usage from inventory to create settlement entries
                        </Typography>
                      </>
                    ) : (
                      <>
                        <SettlementIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                        <Typography color="text.secondary">
                          No {statusFilter.replace('_', ' ')} settlements
                        </Typography>
                      </>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
