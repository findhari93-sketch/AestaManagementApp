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
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Groups as GroupsIcon,
  Domain as DomainIcon,
  Inventory as InventoryIcon,
  AccountBalance as SettlementIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import PageHeader from '@/components/layout/PageHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import RelatedPages from '@/components/layout/RelatedPages'
import { useSiteGroupsWithSites } from '@/hooks/queries/useSiteGroups'
import { formatCurrency } from '@/lib/formatters'

export default function SiteGroupsPage() {
  const { data: siteGroups, isLoading, error } = useSiteGroupsWithSites()

  return (
    <Box>
      <Breadcrumbs />

      <PageHeader
        title="Site Groups"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled
          >
            Create Group
          </Button>
        }
      />

      <RelatedPages />

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <GroupsIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Groups
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={600}>
                {isLoading ? <Skeleton width={40} /> : siteGroups?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <DomainIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Sites
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={600}>
                {isLoading ? (
                  <Skeleton width={40} />
                ) : (
                  siteGroups?.reduce((acc, g) => acc + (g.sites?.length || 0), 0) || 0
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <InventoryIcon color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Shared Stock Value
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={600}>
                {isLoading ? <Skeleton width={80} /> : formatCurrency(0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <SettlementIcon color="warning" />
                <Typography variant="subtitle2" color="text.secondary">
                  Pending Settlements
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={600} color="warning.main">
                {isLoading ? <Skeleton width={40} /> : 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load site groups: {(error as Error).message}
        </Alert>
      )}

      {/* Site Groups Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Group Name</TableCell>
              <TableCell>Sites</TableCell>
              <TableCell align="right">Shared Stock Items</TableCell>
              <TableCell align="right">Stock Value</TableCell>
              <TableCell align="right">Pending Balance</TableCell>
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
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                </TableRow>
              ))
            ) : siteGroups && siteGroups.length > 0 ? (
              siteGroups.map((group) => (
                <TableRow key={group.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupsIcon fontSize="small" color="primary" />
                      <Typography fontWeight={500}>{group.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {group.sites?.map((site: { id: string; name: string }) => (
                        <Chip
                          key={site.id}
                          label={site.name}
                          size="small"
                          variant="outlined"
                          icon={<DomainIcon />}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell align="right">0</TableCell>
                  <TableCell align="right">{formatCurrency(0)}</TableCell>
                  <TableCell align="right">{formatCurrency(0)}</TableCell>
                  <TableCell>
                    <Chip
                      label={group.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={group.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                      <Tooltip title="View Stock">
                        <IconButton size="small">
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Group">
                        <IconButton size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <GroupsIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                    <Typography color="text.secondary">
                      No site groups found
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Create a site group to enable material sharing between sites
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Info Box */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          About Site Groups
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Site groups allow multiple construction sites to share materials. When one site pays for materials
          and another site uses them, the system tracks the cost allocation and calculates inter-site settlements
          on a weekly basis.
        </Typography>
      </Alert>
    </Box>
  )
}
