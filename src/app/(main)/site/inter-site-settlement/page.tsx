'use client'

import { useState } from 'react'
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
  Divider,
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
} from '@mui/icons-material'
import PageHeader from '@/components/layout/PageHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import RelatedPages from '@/components/layout/RelatedPages'
import { useSite } from '@/contexts/SiteContext'
import { formatCurrency, formatDate } from '@/lib/formatters'

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

  // Placeholder data - will be replaced with real hook
  const isLoading = false
  const pendingSettlements: Array<{
    id: string
    settlement_code: string
    from_site: string
    to_site: string
    period: string
    amount: number
    status: string
  }> = []
  const completedSettlements: Array<{
    id: string
    settlement_code: string
    from_site: string
    to_site: string
    period: string
    amount: number
    settled_at: string
  }> = []

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Inter-Site Settlement"
        subtitle="Track and settle material costs between sites in your group"
      />

      <RelatedPages />

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
              <Typography variant="h4" fontWeight={600} color="success.main">
                {formatCurrency(0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                From other sites using your materials
              </Typography>
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
              <Typography variant="h4" fontWeight={600} color="error.main">
                {formatCurrency(0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                For using materials paid by others
              </Typography>
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
              <Typography variant="h4" fontWeight={600}>
                {formatCurrency(0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Overall settlement position
              </Typography>
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
              <Typography variant="h4" fontWeight={600} color="warning.main">
                0
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Settlements awaiting action
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Pending Settlements" icon={<PendingIcon />} iconPosition="start" />
          <Tab label="Completed" icon={<DoneIcon />} iconPosition="start" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
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
                      <TableCell>{settlement.period}</TableCell>
                      <TableCell>
                        <Chip label={settlement.from_site} size="small" />
                      </TableCell>
                      <TableCell>
                        <ArrowForwardIcon fontSize="small" color="action" />
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.to_site} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(settlement.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={settlement.status}
                          size="small"
                          color={settlement.status === 'pending' ? 'warning' : 'info'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton size="small">
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Approve">
                            <IconButton size="small" color="success">
                              <ApproveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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
                          Settlements are generated weekly based on material usage
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
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
                      <TableCell>{settlement.period}</TableCell>
                      <TableCell>
                        <Chip label={settlement.from_site} size="small" />
                      </TableCell>
                      <TableCell>
                        <ArrowForwardIcon fontSize="small" color="action" />
                      </TableCell>
                      <TableCell>
                        <Chip label={settlement.to_site} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {formatCurrency(settlement.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(settlement.settled_at)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
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
    </Box>
  )
}
