'use client'

import { useMemo } from 'react'
import {
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material'
import {
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  AccountBalance as SettlementIcon,
  CompareArrows as CompareArrowsIcon,
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/formatters'
import type { InterSiteBalance, InterSiteSettlementWithDetails } from '@/types/material.types'

interface ReciprocalPair {
  balanceA: InterSiteBalance
  balanceB: InterSiteBalance
  offsetAmount: number
  netRemaining: number
  netPayerName: string
  netReceiverName: string
}

interface SettlementLedgerProps {
  balances: InterSiteBalance[]
  pendingSettlements: InterSiteSettlementWithDetails[]
  currentSiteId: string | undefined
  isLoading: boolean
  onGenerateSettlement: (balance: InterSiteBalance) => void
  onSettlePayment: (settlement: InterSiteSettlementWithDetails) => void
  onNetSettle?: (balanceA: InterSiteBalance, balanceB: InterSiteBalance) => void
  generatePending?: boolean
}

export default function SettlementLedger({
  balances,
  pendingSettlements,
  currentSiteId,
  isLoading,
  onGenerateSettlement,
  onSettlePayment,
  onNetSettle,
  generatePending,
}: SettlementLedgerProps) {
  const hasItems = balances.length > 0 || pendingSettlements.length > 0

  // Detect reciprocal balance pairs (A owes B and B owes A)
  const { reciprocalPairs, nonReciprocalBalances } = useMemo(() => {
    const pairs: ReciprocalPair[] = []
    const matched = new Set<number>()

    for (let i = 0; i < balances.length; i++) {
      if (matched.has(i)) continue
      for (let j = i + 1; j < balances.length; j++) {
        if (matched.has(j)) continue
        const a = balances[i]
        const b = balances[j]
        // Check if A's debtor is B's creditor and vice versa
        if (
          a.debtor_site_id === b.creditor_site_id &&
          a.creditor_site_id === b.debtor_site_id
        ) {
          const offsetAmount = Math.min(a.total_amount_owed, b.total_amount_owed)
          const netRemaining = Math.round(Math.abs(a.total_amount_owed - b.total_amount_owed) * 100) / 100
          const largerIsA = a.total_amount_owed > b.total_amount_owed
          pairs.push({
            balanceA: a,
            balanceB: b,
            offsetAmount,
            netRemaining,
            netPayerName: largerIsA ? a.debtor_site_name : b.debtor_site_name,
            netReceiverName: largerIsA ? a.creditor_site_name : b.creditor_site_name,
          })
          matched.add(i)
          matched.add(j)
          break
        }
      }
    }

    const remaining = balances.filter((_, idx) => !matched.has(idx))
    return { reciprocalPairs: pairs, nonReciprocalBalances: remaining }
  }, [balances])

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <SettlementIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
        <Typography variant="subtitle2" fontWeight={600}>
          Who Owes Whom
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Box>
      ) : !hasItems ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
          <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            All settled! No pending balances.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Reciprocal Pairs - Net Settlement */}
          {reciprocalPairs.length > 0 && (
            <Box sx={{ mb: 1 }}>
              {reciprocalPairs.map((pair, pairIdx) => (
                <Box
                  key={`pair-${pairIdx}`}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'primary.50',
                    border: '1px solid',
                    borderColor: 'primary.200',
                    mb: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <CompareArrowsIcon fontSize="small" color="primary" />
                    <Typography variant="caption" fontWeight={600} color="primary.main">
                      Reciprocal Debts — Can be Net Settled
                    </Typography>
                  </Box>

                  {/* Balance A row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={pair.balanceA.debtor_site_name} size="small" color="error" variant="outlined" />
                    <Typography variant="caption" color="text.secondary">owes</Typography>
                    <ArrowForwardIcon sx={{ fontSize: 16 }} color="action" />
                    <Chip label={pair.balanceA.creditor_site_name} size="small" color="success" variant="outlined" />
                    <Typography variant="body2" fontWeight={700} sx={{ ml: 'auto' }}>
                      {formatCurrency(pair.balanceA.total_amount_owed)}
                    </Typography>
                  </Box>

                  {/* Balance B row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={pair.balanceB.debtor_site_name} size="small" color="error" variant="outlined" />
                    <Typography variant="caption" color="text.secondary">owes</Typography>
                    <ArrowForwardIcon sx={{ fontSize: 16 }} color="action" />
                    <Chip label={pair.balanceB.creditor_site_name} size="small" color="success" variant="outlined" />
                    <Typography variant="body2" fontWeight={700} sx={{ ml: 'auto' }}>
                      {formatCurrency(pair.balanceB.total_amount_owed)}
                    </Typography>
                  </Box>

                  {/* Net calculation summary */}
                  <Box
                    sx={{
                      mt: 1,
                      pt: 1,
                      borderTop: '1px dashed',
                      borderColor: 'primary.200',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Offset: {formatCurrency(pair.offsetAmount)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">•</Typography>
                    <Typography variant="caption" fontWeight={600} color={pair.netRemaining > 0 ? 'warning.main' : 'success.main'}>
                      {pair.netRemaining > 0
                        ? `Net: ${pair.netPayerName} pays ${formatCurrency(pair.netRemaining)}`
                        : 'Fully settles (equal amounts)'}
                    </Typography>
                    {onNetSettle && (
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<CompareArrowsIcon />}
                        onClick={() => onNetSettle(pair.balanceA, pair.balanceB)}
                        disabled={generatePending}
                        sx={{ ml: 'auto', minWidth: 'auto', px: 1.5 }}
                      >
                        Net Settle
                      </Button>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Non-reciprocal unsettled balances */}
          {nonReciprocalBalances.map((balance, index) => {
            const isCreditor = balance.creditor_site_id === currentSiteId
            const isDebtor = balance.debtor_site_id === currentSiteId

            return (
              <Box
                key={`balance-${index}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  borderRadius: 1,
                  bgcolor: isCreditor ? 'success.50' : isDebtor ? 'error.50' : 'grey.50',
                  border: '1px solid',
                  borderColor: isCreditor ? 'success.200' : isDebtor ? 'error.200' : 'divider',
                  flexWrap: 'wrap',
                }}
              >
                {/* Debtor (Owes) */}
                <Chip
                  label={balance.debtor_site_name}
                  size="small"
                  color={isDebtor ? 'error' : 'default'}
                  variant={isDebtor ? 'filled' : 'outlined'}
                />

                <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5 }}>owes</Typography>
                <ArrowForwardIcon fontSize="small" color="action" />

                {/* Creditor (Paid) */}
                <Chip
                  label={balance.creditor_site_name}
                  size="small"
                  color={isCreditor ? 'success' : 'default'}
                  variant={isCreditor ? 'filled' : 'outlined'}
                />

                {/* Amount */}
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ ml: 'auto' }}
                  color={isCreditor ? 'success.main' : isDebtor ? 'error.main' : 'text.primary'}
                >
                  {formatCurrency(balance.total_amount_owed)}
                </Typography>

                {/* Unsettled badge */}
                <Chip
                  label="Unsettled"
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />

                {/* Action */}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onGenerateSettlement(balance)}
                  disabled={generatePending}
                  sx={{ minWidth: 'auto', px: 1.5 }}
                >
                  Generate
                </Button>
              </Box>
            )
          })}

          {/* Pending settlements */}
          {pendingSettlements.map((settlement) => {
            const isCreditor = settlement.from_site_id === currentSiteId
            const isDebtor = settlement.to_site_id === currentSiteId

            return (
              <Box
                key={`settlement-${settlement.id}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  borderRadius: 1,
                  bgcolor: isCreditor ? 'success.50' : isDebtor ? 'error.50' : 'grey.50',
                  border: '1px solid',
                  borderColor: isCreditor ? 'success.200' : isDebtor ? 'error.200' : 'divider',
                  flexWrap: 'wrap',
                }}
              >
                {/* Debtor (To - owes money) */}
                <Chip
                  label={settlement.to_site?.name || 'Unknown'}
                  size="small"
                  color={isDebtor ? 'error' : 'default'}
                  variant={isDebtor ? 'filled' : 'outlined'}
                />

                <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5 }}>owes</Typography>
                <ArrowForwardIcon fontSize="small" color="action" />

                {/* Creditor (From - paid for materials) */}
                <Chip
                  label={settlement.from_site?.name || 'Unknown'}
                  size="small"
                  color={isCreditor ? 'success' : 'default'}
                  variant={isCreditor ? 'filled' : 'outlined'}
                />

                {/* Amount */}
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ ml: 'auto' }}
                  color={isCreditor ? 'success.main' : isDebtor ? 'error.main' : 'text.primary'}
                >
                  {formatCurrency(settlement.total_amount)}
                </Typography>

                {/* Status badge */}
                <Chip
                  label={settlement.status === 'pending' ? 'Pending' : 'Approved'}
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />

                {/* Settle action */}
                {(isCreditor || isDebtor) && (
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={() => onSettlePayment(settlement)}
                    sx={{ minWidth: 'auto', px: 1.5 }}
                  >
                    Settle
                  </Button>
                )}
              </Box>
            )
          })}
        </Box>
      )}
    </Paper>
  )
}
