'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  AccountBalance as SettlementIcon,
  CompareArrows as CompareArrowsIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
  onGenerateSettlement: (balance: InterSiteBalance, materialIds?: string[]) => void
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
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set())

  const togglePair = (key: string) => {
    setExpandedPairs(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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

  const renderMaterialRows = (balance: InterSiteBalance, pairKey: string) => {
    const materials = balance.material_breakdown || []
    if (materials.length === 0) return null

    return (
      <Collapse in={expandedPairs.has(pairKey)} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 2, pr: 1, pb: 1, pt: 0.5 }}>
          {materials.map((mat) => (
            <Box
              key={mat.material_id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
                px: 1,
                borderBottom: '1px dashed',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 500 }}>
                {mat.material_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {mat.quantity} {mat.unit}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ ml: 'auto', mr: 1 }}>
                {formatCurrency(mat.total_amount)}
              </Typography>
              {mat.has_unpaid_vendor && (
                <Tooltip title="Vendor unpaid for this material">
                  <WarningIcon sx={{ fontSize: 16, color: 'error.main' }} />
                </Tooltip>
              )}
              <Button
                size="small"
                variant="text"
                onClick={() => onGenerateSettlement(balance, [mat.material_id])}
                disabled={generatePending || mat.has_unpaid_vendor}
                sx={{ minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
              >
                Generate
              </Button>
            </Box>
          ))}
        </Box>
      </Collapse>
    )
  }

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
              {reciprocalPairs.map((pair, pairIdx) => {
                const pairKeyA = `reciprocal-${pairIdx}-A`
                const pairKeyB = `reciprocal-${pairIdx}-B`
                const hasMaterialsA = (pair.balanceA.material_breakdown || []).length > 0
                const hasMaterialsB = (pair.balanceB.material_breakdown || []).length > 0

                return (
                  <Box
                    key={`pair-${pairIdx}`}
                    sx={{
                      borderRadius: 1,
                      bgcolor: 'primary.50',
                      border: '1px solid',
                      borderColor: 'primary.200',
                      mb: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <Box sx={{ p: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <CompareArrowsIcon fontSize="small" color="primary" />
                        <Typography variant="caption" fontWeight={600} color="primary.main">
                          Reciprocal Debts — Can be Net Settled
                        </Typography>
                      </Box>

                      {/* Balance A row */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, flexWrap: 'wrap' }}>
                        {hasMaterialsA && (
                          <IconButton size="small" onClick={() => togglePair(pairKeyA)} sx={{ p: 0.25 }}>
                            {expandedPairs.has(pairKeyA) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        )}
                        <Chip label={pair.balanceA.debtor_site_name} size="small" color="error" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">owes</Typography>
                        <ArrowForwardIcon sx={{ fontSize: 16 }} color="action" />
                        <Chip label={pair.balanceA.creditor_site_name} size="small" color="success" variant="outlined" />
                        <Chip
                          label={`${pair.balanceA.material_breakdown?.length || 0} materials`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                        <Typography variant="body2" fontWeight={700} sx={{ ml: 'auto' }}>
                          {formatCurrency(pair.balanceA.total_amount_owed)}
                        </Typography>
                      </Box>
                      {renderMaterialRows(pair.balanceA, pairKeyA)}

                      {/* Balance B row */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, flexWrap: 'wrap' }}>
                        {hasMaterialsB && (
                          <IconButton size="small" onClick={() => togglePair(pairKeyB)} sx={{ p: 0.25 }}>
                            {expandedPairs.has(pairKeyB) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        )}
                        <Chip label={pair.balanceB.debtor_site_name} size="small" color="error" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">owes</Typography>
                        <ArrowForwardIcon sx={{ fontSize: 16 }} color="action" />
                        <Chip label={pair.balanceB.creditor_site_name} size="small" color="success" variant="outlined" />
                        <Chip
                          label={`${pair.balanceB.material_breakdown?.length || 0} materials`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                        <Typography variant="body2" fontWeight={700} sx={{ ml: 'auto' }}>
                          {formatCurrency(pair.balanceB.total_amount_owed)}
                        </Typography>
                      </Box>
                      {renderMaterialRows(pair.balanceB, pairKeyB)}

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
                  </Box>
                )
              })}
            </Box>
          )}

          {/* Non-reciprocal unsettled balances */}
          {nonReciprocalBalances.map((balance, index) => {
            const isCreditor = balance.creditor_site_id === currentSiteId
            const isDebtor = balance.debtor_site_id === currentSiteId
            const pairKey = `balance-${index}`
            const hasMaterials = (balance.material_breakdown || []).length > 0

            return (
              <Box
                key={pairKey}
                sx={{
                  borderRadius: 1,
                  bgcolor: isCreditor ? 'success.50' : isDebtor ? 'error.50' : 'grey.50',
                  border: '1px solid',
                  borderColor: isCreditor ? 'success.200' : isDebtor ? 'error.200' : 'divider',
                  overflow: 'hidden',
                }}
              >
                {/* Site pair header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    flexWrap: 'wrap',
                  }}
                >
                  {hasMaterials && (
                    <IconButton size="small" onClick={() => togglePair(pairKey)} sx={{ p: 0.25 }}>
                      {expandedPairs.has(pairKey) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  )}

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

                  {/* Material count chip */}
                  {hasMaterials && (
                    <Chip
                      label={`${balance.material_breakdown.length} material${balance.material_breakdown.length > 1 ? 's' : ''}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                      onClick={() => togglePair(pairKey)}
                    />
                  )}

                  {/* Amount */}
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ ml: 'auto' }}
                    color={isCreditor ? 'success.main' : isDebtor ? 'error.main' : 'text.primary'}
                  >
                    {formatCurrency(balance.total_amount_owed)}
                  </Typography>

                  {/* Vendor unpaid warning */}
                  {balance.has_unpaid_vendor && (
                    <Tooltip title="Creditor site has not yet settled with the vendor. Vendor payment should be completed in Material Settlements before generating inter-site settlement.">
                      <Chip
                        icon={<WarningIcon sx={{ fontSize: 14 }} />}
                        label="Vendor Unpaid"
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 22 }}
                      />
                    </Tooltip>
                  )}

                  {/* Unsettled badge */}
                  <Chip
                    label="Unsettled"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />

                  {/* Generate All action */}
                  <Tooltip title={balance.has_unpaid_vendor ? "Vendor must be paid first. Go to Material Settlements to mark vendor as paid." : "Generate settlement for all materials"}>
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onGenerateSettlement(balance)}
                        disabled={generatePending || !!balance.has_unpaid_vendor}
                        sx={{ minWidth: 'auto', px: 1.5 }}
                      >
                        {hasMaterials ? 'Generate All' : 'Generate'}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>

                {/* Material breakdown rows */}
                {renderMaterialRows(balance, pairKey)}
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

                {/* Amount - show remaining (pending) amount, not total */}
                <Tooltip
                  title={
                    (settlement.paid_amount || 0) > 0
                      ? `Total: ${formatCurrency(settlement.total_amount)} | Paid: ${formatCurrency(settlement.paid_amount || 0)} | Remaining: ${formatCurrency(settlement.total_amount - (settlement.paid_amount || 0))}`
                      : `Total: ${formatCurrency(settlement.total_amount)}`
                  }
                >
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ ml: 'auto' }}
                    color={isCreditor ? 'success.main' : isDebtor ? 'error.main' : 'text.primary'}
                  >
                    {formatCurrency(settlement.total_amount - (settlement.paid_amount || 0))}
                  </Typography>
                </Tooltip>

                {/* Status badge - show Partially Paid when offset has been applied */}
                <Chip
                  label={
                    settlement.status === 'pending' && (settlement.paid_amount || 0) > 0
                      ? 'Partially Paid'
                      : settlement.status === 'pending'
                        ? 'Pending'
                        : 'Approved'
                  }
                  size="small"
                  color={settlement.status === 'pending' && (settlement.paid_amount || 0) > 0 ? 'warning' : 'info'}
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
