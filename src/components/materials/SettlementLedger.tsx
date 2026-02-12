'use client'

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
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/formatters'
import type { InterSiteBalance, InterSiteSettlementWithDetails } from '@/types/material.types'

interface SettlementLedgerProps {
  balances: InterSiteBalance[]
  pendingSettlements: InterSiteSettlementWithDetails[]
  currentSiteId: string | undefined
  isLoading: boolean
  onGenerateSettlement: (balance: InterSiteBalance) => void
  onSettlePayment: (settlement: InterSiteSettlementWithDetails) => void
  generatePending?: boolean
}

export default function SettlementLedger({
  balances,
  pendingSettlements,
  currentSiteId,
  isLoading,
  onGenerateSettlement,
  onSettlePayment,
  generatePending,
}: SettlementLedgerProps) {
  const hasItems = balances.length > 0 || pendingSettlements.length > 0

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
          {/* Unsettled balances */}
          {balances.map((balance, index) => {
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
