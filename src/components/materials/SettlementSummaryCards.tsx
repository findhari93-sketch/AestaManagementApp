'use client'

import {
  Box,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Typography,
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as SettlementIcon,
} from '@mui/icons-material'
import { formatCurrency } from '@/lib/formatters'
import type { SiteSettlementSummary } from '@/types/material.types'

interface SettlementSummaryCardsProps {
  summary: SiteSettlementSummary | undefined
  isLoading: boolean
}

export default function SettlementSummaryCards({ summary, isLoading }: SettlementSummaryCardsProps) {
  const netBalance = summary?.net_balance || 0
  const unsettledCount = summary?.unsettled_count || 0
  const pendingCount = summary?.pending_settlements_count || 0

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {/* Others Owe You */}
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingUpIcon color="success" />
              <Typography variant="subtitle2" color="text.secondary">
                Others Owe You
              </Typography>
            </Box>
            {isLoading ? (
              <Skeleton variant="text" width={100} height={40} />
            ) : (
              <>
                <Typography variant="h4" fontWeight={600} color="success.main">
                  {formatCurrency(summary?.total_owed_to_you || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  From other sites using your materials
                  {(summary?.owed_to_you_count || 0) > 0 && (
                    <Typography component="span" variant="caption" sx={{ ml: 0.5, fontWeight: 600 }}>
                      ({summary?.owed_to_you_count} records)
                    </Typography>
                  )}
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* You Owe */}
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingDownIcon color="error" />
              <Typography variant="subtitle2" color="text.secondary">
                You Owe
              </Typography>
            </Box>
            {isLoading ? (
              <Skeleton variant="text" width={100} height={40} />
            ) : (
              <>
                <Typography variant="h4" fontWeight={600} color="error.main">
                  {formatCurrency(summary?.total_you_owe || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  For using materials paid by others
                  {(summary?.you_owe_count || 0) > 0 && (
                    <Typography component="span" variant="caption" sx={{ ml: 0.5, fontWeight: 600 }}>
                      ({summary?.you_owe_count} records)
                    </Typography>
                  )}
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Settlement Status (merged Net Balance + Pending) */}
      <Grid size={{ xs: 12, sm: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SettlementIcon color="primary" />
              <Typography variant="subtitle2" color="text.secondary">
                Settlement Status
              </Typography>
            </Box>
            {isLoading ? (
              <Skeleton variant="text" width={100} height={40} />
            ) : (
              <>
                <Typography
                  variant="h4"
                  fontWeight={600}
                  color={netBalance >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(netBalance)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {unsettledCount > 0 || pendingCount > 0 ? (
                    <>
                      {unsettledCount > 0 && `${unsettledCount} unsettled`}
                      {unsettledCount > 0 && pendingCount > 0 && ' · '}
                      {pendingCount > 0 && `${pendingCount} in progress`}
                    </>
                  ) : (
                    'All settled'
                  )}
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
