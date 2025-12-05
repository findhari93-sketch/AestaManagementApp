'use client'

export const dynamic = 'force-dynamic'

import { Box, Typography, Paper, Alert } from '@mui/material'
import { useSite } from '@/contexts/SiteContext'
import PageHeader from '@/components/layout/PageHeader'

export default function SiteReportsPage() {
  const { selectedSite } = useSite()

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Site Reports" />
        <Alert severity="warning">Please select a site</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Site Reports"
        subtitle={`Reports and analytics for ${selectedSite.name}`}
      />
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Coming Soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Site-specific reports including monthly expenses, labor costs,
          material usage, and attendance summaries.
        </Typography>
      </Paper>
    </Box>
  )
}
