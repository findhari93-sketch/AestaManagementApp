'use client'

import { Box, Typography, IconButton, Tooltip, useMediaQuery, useTheme } from '@mui/material'
import { ArrowBack, Refresh } from '@mui/icons-material'
import { useRouter } from 'next/navigation'

interface PageHeaderProps {
  title: string
  subtitle?: string
  onRefresh?: () => void
  isLoading?: boolean
  showBack?: boolean
  actions?: React.ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  onRefresh,
  isLoading = false,
  showBack = true,
  actions,
}: PageHeaderProps) {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const handleBack = () => {
    router.back()
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'flex-start' },
        gap: { xs: 1.5, sm: 0 },
        mb: { xs: 2, sm: 3 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
        {showBack && (
          <Tooltip title="Go back">
            <IconButton
              onClick={handleBack}
              size={isMobile ? 'small' : 'medium'}
              sx={{
                mr: { xs: 0.5, sm: 1 },
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <ArrowBack fontSize={isMobile ? 'small' : 'medium'} />
            </IconButton>
          </Tooltip>
        )}
        <Box>
          <Typography
            variant={isMobile ? 'h6' : 'h5'}
            fontWeight={600}
            sx={{ fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' } }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flexWrap: 'wrap' }}>
        {onRefresh && (
          <Tooltip title="Refresh data">
            <IconButton
              onClick={onRefresh}
              disabled={isLoading}
              size={isMobile ? 'small' : 'medium'}
              sx={{
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
                animation: isLoading ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            >
              <Refresh fontSize={isMobile ? 'small' : 'medium'} />
            </IconButton>
          </Tooltip>
        )}
        {actions}
      </Box>
    </Box>
  )
}
