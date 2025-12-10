'use client'

import {
  FormControl,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  SelectChangeEvent,
} from '@mui/material'
import { LocationOn } from '@mui/icons-material'
import { useSite } from '@/contexts/SiteContext'

export default function SiteSelector() {
  const { sites, selectedSite, setSelectedSite, loading } = useSite()

  const handleChange = (event: SelectChangeEvent) => {
    const site = sites.find((s) => s.id === event.target.value)
    if (site) {
      setSelectedSite(site)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocationOn sx={{ color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          Loading sites...
        </Typography>
      </Box>
    )
  }

  if (sites.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocationOn sx={{ color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          No sites available
        </Typography>
      </Box>
    )
  }

  return (
    <FormControl size="small" sx={{ minWidth: { xs: 100, sm: 250 }, maxWidth: { xs: 160, sm: 'none' } }}>
      <Select
        value={selectedSite?.id || ''}
        onChange={handleChange}
        displayEmpty
        sx={{
          bgcolor: 'background.paper',
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.5, sm: 1 },
            py: { xs: 0.5, sm: 1 },
          },
        }}
        renderValue={(value) => {
          const site = sites.find((s) => s.id === value)
          if (!site) return 'Select Site'
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, overflow: 'hidden' }}>
              <LocationOn sx={{ fontSize: { xs: 16, sm: 20 }, color: 'primary.main', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                  }}
                >
                  {site.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', sm: 'block' } }}
                >
                  {site.city}
                </Typography>
              </Box>
              <Chip
                label={site.status}
                size="small"
                color={
                  site.status === 'active'
                    ? 'success'
                    : site.status === 'planning'
                    ? 'info'
                    : site.status === 'on_hold'
                    ? 'warning'
                    : 'default'
                }
                sx={{ ml: 'auto', height: 20, fontSize: '0.625rem', flexShrink: 0, display: { xs: 'none', sm: 'flex' } }}
              />
            </Box>
          )
        }}
      >
        {sites.map((site) => (
          <MenuItem key={site.id} value={site.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <LocationOn sx={{ fontSize: 20, color: 'primary.main' }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  {site.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {site.city}
                </Typography>
              </Box>
              <Chip
                label={site.status}
                size="small"
                color={
                  site.status === 'active'
                    ? 'success'
                    : site.status === 'planning'
                    ? 'info'
                    : site.status === 'on_hold'
                    ? 'warning'
                    : 'default'
                }
                sx={{ height: 20, fontSize: '0.625rem' }}
              />
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
