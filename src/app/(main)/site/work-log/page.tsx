'use client'

export const dynamic = 'force-dynamic'

import { Box, Typography, Paper, Alert } from '@mui/material'
import { useSite } from '@/contexts/SiteContext'
import PageHeader from '@/components/layout/PageHeader'

export default function WorkLogPage() {
  const { selectedSite } = useSite()

  if (!selectedSite) {
    return (
      <Box>
        <PageHeader title="Daily Work Log" />
        <Alert severity="warning">Please select a site</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Daily Work Log"
        subtitle={`Track daily activities for ${selectedSite.name}`}
      />
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Coming Soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Daily work log with photo upload feature will be implemented here.
          Track morning plans, evening updates, and before/after photos.
        </Typography>
      </Paper>
    </Box>
  )
}
