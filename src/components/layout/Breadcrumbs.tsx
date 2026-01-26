'use client'

import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box } from '@mui/material'
import { NavigateNext, Home } from '@mui/icons-material'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'

// Route to breadcrumb label mapping
const routeLabels: Record<string, string> = {
  // Company level
  'company': 'Company',
  'materials': 'Material Catalog',
  'material-search': 'Price Comparison',
  'vendors': 'Vendor Directory',
  'site-groups': 'Site Groups',
  'laborers': 'Laborers',
  'teams': 'Teams',
  'contracts': 'Contracts',
  'salary': 'Salary & Payments',
  'engineer-wallet': 'Engineer Wallet',
  'sites': 'Sites',
  'construction-phases': 'Construction Phases',
  'mass-upload': 'Mass Upload',
  'reports': 'Reports',
  'dashboard': 'Dashboard',
  'settings': 'Settings',

  // Site level
  'site': 'Site',
  'attendance': 'Attendance',
  'payments': 'Salary Settlements',
  'holidays': 'Holidays',
  'expenses': 'Daily Expenses',
  'my-wallet': 'My Wallet',
  'tea-shop': 'Tea Shop',
  'client-payments': 'Client Payments',
  'work-log': 'Daily Work Log',
  'inventory': 'Inventory',
  'stock': 'Stock Inventory',
  'material-usage': 'Daily Usage',
  'material-requests': 'Material Requests',
  'purchase-orders': 'Purchase Orders',
  'delivery-verification': 'Delivery Verification',
  'inter-site-settlement': 'Inter-Site Settlement',
  'subcontracts': 'Subcontracts',
}

// Get parent route for context
const getParentRoute = (path: string): string | null => {
  const parentMap: Record<string, string> = {
    '/company/material-search': '/company/materials',
    '/site/purchase-orders': '/site/material-requests',
    '/site/delivery-verification': '/site/purchase-orders',
  }
  return parentMap[path] || null
}

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  customItems?: BreadcrumbItem[]
  showHome?: boolean
}

export default function Breadcrumbs({ customItems, showHome = false }: BreadcrumbsProps) {
  const pathname = usePathname()

  // If custom items provided, use them
  if (customItems && customItems.length > 0) {
    return (
      <Box sx={{ mb: 1 }}>
        <MuiBreadcrumbs
          separator={<NavigateNext fontSize="small" />}
          sx={{
            '& .MuiBreadcrumbs-separator': { mx: 0.5 },
            '& .MuiBreadcrumbs-li': { fontSize: '0.75rem' },
          }}
        >
          {showHome && (
            <Link
              component={NextLink}
              href="/"
              color="inherit"
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              <Home sx={{ fontSize: 16, mr: 0.5 }} />
            </Link>
          )}
          {customItems.map((item, index) => {
            const isLast = index === customItems.length - 1
            return isLast ? (
              <Typography
                key={index}
                color="text.primary"
                sx={{ fontSize: '0.75rem', fontWeight: 500 }}
              >
                {item.label}
              </Typography>
            ) : (
              <Link
                key={index}
                component={NextLink}
                href={item.href || '#'}
                color="inherit"
                sx={{
                  fontSize: '0.75rem',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </MuiBreadcrumbs>
      </Box>
    )
  }

  // Auto-generate from pathname
  const segments = pathname.split('/').filter(Boolean)

  // Don't show breadcrumbs for top-level pages
  if (segments.length <= 1) return null

  const items: BreadcrumbItem[] = []
  let currentPath = ''

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')

    items.push({
      label,
      href: index < segments.length - 1 ? currentPath : undefined
    })
  })

  return (
    <Box sx={{ mb: 1 }}>
      <MuiBreadcrumbs
        separator={<NavigateNext fontSize="small" />}
        sx={{
          '& .MuiBreadcrumbs-separator': { mx: 0.5 },
          '& .MuiBreadcrumbs-li': { fontSize: '0.75rem' },
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return isLast ? (
            <Typography
              key={index}
              color="text.primary"
              sx={{ fontSize: '0.75rem', fontWeight: 500 }}
            >
              {item.label}
            </Typography>
          ) : (
            <Link
              key={index}
              component={NextLink}
              href={item.href || '#'}
              color="inherit"
              sx={{
                fontSize: '0.75rem',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </MuiBreadcrumbs>
    </Box>
  )
}
