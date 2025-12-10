'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

export interface SummaryItem {
  label: string;
  value: string | number;
  color?: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'inherit';
  icon?: React.ReactNode;
}

interface CollapsibleSummaryProps {
  title: string;
  primaryValue: string | number;
  primaryLabel: string;
  items: SummaryItem[];
  defaultExpanded?: boolean;
  storageKey?: string; // For remembering expand state
  primaryColor?: 'primary' | 'success' | 'error' | 'warning' | 'info';
}

export default function CollapsibleSummary({
  title,
  primaryValue,
  primaryLabel,
  items,
  defaultExpanded = false,
  storageKey,
  primaryColor = 'primary',
}: CollapsibleSummaryProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Load saved state from localStorage
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`summary_${storageKey}`);
      if (saved !== null) {
        setExpanded(saved === 'true');
      }
    }
  }, [storageKey]);

  const handleToggle = () => {
    const newState = !expanded;
    setExpanded(newState);
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`summary_${storageKey}`, String(newState));
    }
  };

  const getColor = (color?: SummaryItem['color']) => {
    if (!color || color === 'inherit') return 'text.primary';
    return `${color}.main`;
  };

  // Desktop: Always show expanded grid, no accordion
  if (!isMobile) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            sm: 'repeat(3, 1fr)',
            md: 'repeat(4, 1fr)',
            lg: `repeat(${Math.min(items.length + 1, 6)}, 1fr)`,
          },
          gap: 2,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          mb: 2,
        }}
      >
        {/* Primary stat */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1.5,
            borderRadius: 1,
            bgcolor: `${primaryColor}.light`,
            color: `${primaryColor}.dark`,
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            {primaryValue}
          </Typography>
          <Typography variant="caption" fontWeight={500}>
            {primaryLabel}
          </Typography>
        </Box>

        {/* Other stats */}
        {items.map((item, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {item.icon}
              <Typography
                variant="h6"
                fontWeight={600}
                color={getColor(item.color)}
              >
                {item.value}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }

  // Mobile: Collapsible accordion
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 1.5,
        border: `1px solid ${theme.palette.divider}`,
        mb: 1.5,
        overflow: 'hidden',
      }}
    >
      {/* Compact header - always visible */}
      <Box
        onClick={handleToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          cursor: 'pointer',
          bgcolor: expanded ? 'action.hover' : 'transparent',
          '&:active': { bgcolor: 'action.selected' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.7rem', fontWeight: 500 }}
          >
            {title}:
          </Typography>
          <Typography
            variant="body2"
            fontWeight={700}
            color={`${primaryColor}.main`}
            sx={{ fontSize: '0.85rem' }}
          >
            {primaryValue}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.65rem' }}
          >
            {primaryLabel}
          </Typography>
        </Box>
        <IconButton size="small" sx={{ p: 0.25 }}>
          {expanded ? (
            <ExpandLess sx={{ fontSize: 18 }} />
          ) : (
            <ExpandMore sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      </Box>

      {/* Expandable content */}
      <Collapse in={expanded}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 0.5,
            p: 1,
            pt: 0,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          {items.map((item, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 0.5,
                px: 1,
                bgcolor: 'action.hover',
                borderRadius: 0.5,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.65rem' }}
              >
                {item.label}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                {item.icon && (
                  <Box sx={{ fontSize: 12, display: 'flex' }}>{item.icon}</Box>
                )}
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color={getColor(item.color)}
                  sx={{ fontSize: '0.7rem' }}
                >
                  {item.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
