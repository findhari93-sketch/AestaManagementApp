'use client'

import { Box, Typography, IconButton, Tooltip } from '@mui/material'
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

  const handleBack = () => {
    router.back()
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        mb: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {showBack && (
          <Tooltip title="Go back">
            <IconButton
              onClick={handleBack}
              sx={{
                mr: 1,
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <ArrowBack />
            </IconButton>
          </Tooltip>
        )}
        <Box>
          <Typography variant="h5" fontWeight={600}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {onRefresh && (
          <Tooltip title="Refresh data">
            <IconButton
              onClick={onRefresh}
              disabled={isLoading}
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
              <Refresh />
            </IconButton>
          </Tooltip>
        )}
        {actions}
      </Box>
    </Box>
  )
}
