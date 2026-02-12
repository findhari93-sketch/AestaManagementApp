'use client'

import { Box, Chip, Typography } from '@mui/material'
import { useRouter, usePathname } from 'next/navigation'
import {
  Inventory as InventoryIcon,
  Store as StoreIcon,
  ShoppingCart as ShoppingCartIcon,
  Category as CategoryIcon,
  Construction as ConstructionIcon,
  LocalShipping as DeliveryIcon,
  Assignment as AssignmentIcon,
  AccountBalance as SettlementIcon,
  Groups as GroupsIcon,
  TrendingUp as TrendingUpIcon,
  CompareArrows as CompareArrowsIcon,
} from '@mui/icons-material'

interface RelatedPage {
  label: string
  path: string
  icon: React.ReactNode
}

// Define related pages for each route
const relatedPagesConfig: Record<string, RelatedPage[]> = {
  // Material Search - related to vendors, stock, POs
  '/company/material-search': [
    { label: 'Inventory', path: '/site/inventory', icon: <InventoryIcon fontSize="small" /> },
    { label: 'Vendors', path: '/company/vendors', icon: <StoreIcon fontSize="small" /> },
    { label: 'Purchase Orders', path: '/site/purchase-orders', icon: <ShoppingCartIcon fontSize="small" /> },
  ],

  // Material Catalog - related to search, vendors
  '/company/materials': [
    { label: 'Price Comparison', path: '/company/material-search', icon: <TrendingUpIcon fontSize="small" /> },
    { label: 'Vendors', path: '/company/vendors', icon: <StoreIcon fontSize="small" /> },
    { label: 'Inventory', path: '/site/inventory', icon: <InventoryIcon fontSize="small" /> },
  ],

  // Vendors - related to materials, search
  '/company/vendors': [
    { label: 'Price Comparison', path: '/company/material-search', icon: <TrendingUpIcon fontSize="small" /> },
    { label: 'Material Catalog', path: '/company/materials', icon: <CategoryIcon fontSize="small" /> },
    { label: 'Purchase Orders', path: '/site/purchase-orders', icon: <ShoppingCartIcon fontSize="small" /> },
  ],

  // Site Groups - related to stock, settlements
  '/company/site-groups': [
    { label: 'Inventory', path: '/site/inventory', icon: <InventoryIcon fontSize="small" /> },
    { label: 'Inter-Site Settlement', path: '/site/inter-site-settlement', icon: <SettlementIcon fontSize="small" /> },
    { label: 'Material Catalog', path: '/company/materials', icon: <CategoryIcon fontSize="small" /> },
  ],

  // Inventory - unified stock and usage page
  '/site/inventory': [
    { label: 'Material Requests', path: '/site/material-requests', icon: <AssignmentIcon fontSize="small" /> },
    { label: 'Deliveries', path: '/site/delivery-verification', icon: <DeliveryIcon fontSize="small" /> },
    { label: 'Inter-Site Settlement', path: '/site/inter-site-settlement', icon: <SettlementIcon fontSize="small" /> },
    { label: 'Price Comparison', path: '/company/material-search', icon: <TrendingUpIcon fontSize="small" /> },
  ],

  // Material Requests - related to POs, stock
  '/site/material-requests': [
    { label: 'Purchase Orders', path: '/site/purchase-orders', icon: <ShoppingCartIcon fontSize="small" /> },
    { label: 'Inventory', path: '/site/inventory', icon: <InventoryIcon fontSize="small" /> },
    { label: 'Price Comparison', path: '/company/material-search', icon: <TrendingUpIcon fontSize="small" /> },
  ],

  // Purchase Orders - related to deliveries, requests, vendors
  '/site/purchase-orders': [
    { label: 'Deliveries', path: '/site/delivery-verification', icon: <DeliveryIcon fontSize="small" /> },
    { label: 'Requests', path: '/site/material-requests', icon: <AssignmentIcon fontSize="small" /> },
    { label: 'Vendors', path: '/company/vendors', icon: <StoreIcon fontSize="small" /> },
    { label: 'Inventory', path: '/site/inventory', icon: <InventoryIcon fontSize="small" /> },
  ],

  // Delivery Verification - related to POs, stock
  '/site/delivery-verification': [
    { label: 'Purchase Orders', path: '/site/purchase-orders', icon: <ShoppingCartIcon fontSize="small" /> },
    { label: 'Inventory', path: '/site/inventory', icon: <InventoryIcon fontSize="small" /> },
  ],

  // Inter-Site Settlement - related to usage, site groups
  '/site/inter-site-settlement': [
    { label: 'Inventory', path: '/site/inventory', icon: <InventoryIcon fontSize="small" /> },
    { label: 'Site Groups', path: '/company/site-groups', icon: <GroupsIcon fontSize="small" /> },
  ],
}

interface RelatedPagesProps {
  customPages?: RelatedPage[]
  showTitle?: boolean
}

export default function RelatedPages({ customPages, showTitle = false }: RelatedPagesProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Get related pages for current path
  const relatedPages = customPages || relatedPagesConfig[pathname] || []

  // Don't render if no related pages
  if (relatedPages.length === 0) return null

  return (
    <Box sx={{ mb: 2 }}>
      {showTitle && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 0.5, display: 'block' }}
        >
          Related:
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {relatedPages.map((page, index) => (
          <Chip
            key={index}
            label={page.label}
            icon={page.icon as React.ReactElement}
            size="small"
            variant="outlined"
            onClick={() => router.push(page.path)}
            sx={{
              cursor: 'pointer',
              fontSize: '0.7rem',
              height: 24,
              '& .MuiChip-icon': { fontSize: 14 },
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'primary.main',
              },
            }}
          />
        ))}
      </Box>
    </Box>
  )
}
