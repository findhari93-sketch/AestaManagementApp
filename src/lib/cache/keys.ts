/**
 * Standardized Query Key Factory
 * 
 * Provides consistent query key patterns for all data entities.
 * This enables better cache management, invalidation, and persistence.
 * 
 * Key Structure:
 * - Level 1: Entity type (e.g., 'sites', 'attendance')
 * - Level 2: Scope (e.g., 'all', 'byId', 'list')
 * - Level 3+: Filters/params (e.g., siteId, date ranges)
 */

export const queryKeys = {
  // ==================== REFERENCE DATA (24hr cache) ====================
  // Rarely changes, can be cached for extended periods
  
  sites: {
    all: ['sites'] as const,
    byId: (id: string) => ['sites', id] as const,
    list: () => ['sites', 'list'] as const,
  },

  teams: {
    all: ['teams'] as const,
    bySite: (siteId: string) => ['teams', 'site', siteId] as const,
    byId: (id: string) => ['teams', id] as const,
  },

  laborers: {
    all: ['laborers'] as const,
    list: () => ['laborers', 'list'] as const,
    bySite: (siteId: string) => ['laborers', 'site', siteId] as const,
    byId: (id: string) => ['laborers', id] as const,
    daily: () => ['laborers', 'type', 'daily_market'] as const,
    contract: () => ['laborers', 'type', 'contract'] as const,
  },

  laborCategories: {
    all: ['labor-categories'] as const,
    list: () => ['labor-categories', 'list'] as const,
  },

  laborRoles: {
    all: ['labor-roles'] as const,
    list: () => ['labor-roles', 'list'] as const,
  },

  materials: {
    all: ['materials'] as const,
    list: () => ['materials', 'list'] as const,
    byId: (id: string) => ['materials', id] as const,
  },

  vendors: {
    all: ['vendors'] as const,
    list: () => ['vendors', 'list'] as const,
    byId: (id: string) => ['vendors', id] as const,
  },

  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
    byId: (id: string) => ['users', id] as const,
    profile: (userId: string) => ['users', 'profile', userId] as const,
  },

  subcontracts: {
    all: ['subcontracts'] as const,
    bySite: (siteId: string) => ['subcontracts', 'site', siteId] as const,
    byId: (id: string) => ['subcontracts', id] as const,
    active: (siteId: string) => ['subcontracts', 'site', siteId, 'active'] as const,
  },

  // ==================== TRANSACTIONAL DATA (5min cache) ====================
  // Frequently updated, needs regular refresh
  
  attendance: {
    all: ['attendance'] as const,
    byDate: (siteId: string, date: string) => 
      ['attendance', 'site', siteId, 'date', date] as const,
    dateRange: (siteId: string, from: string, to: string) => 
      ['attendance', 'site', siteId, 'range', { from, to }] as const,
    active: (siteId: string) => 
      ['attendance', 'site', siteId, 'active'] as const,
    today: (siteId: string) => 
      ['attendance', 'site', siteId, 'today'] as const,
  },

  marketAttendance: {
    all: ['market-attendance'] as const,
    byDate: (siteId: string, date: string) => 
      ['market-attendance', 'site', siteId, 'date', date] as const,
    dateRange: (siteId: string, from: string, to: string) => 
      ['market-attendance', 'site', siteId, 'range', { from, to }] as const,
  },

  expenses: {
    all: ['expenses'] as const,
    bySite: (siteId: string) => ['expenses', 'site', siteId] as const,
    byDate: (siteId: string, date: string) => 
      ['expenses', 'site', siteId, 'date', date] as const,
    dateRange: (siteId: string, from: string, to: string) => 
      ['expenses', 'site', siteId, 'range', { from, to }] as const,
  },

  salaryPeriods: {
    all: ['salary-periods'] as const,
    bySite: (siteId: string) => ['salary-periods', 'site', siteId] as const,
    byId: (id: string) => ['salary-periods', id] as const,
    detailed: (siteId: string) => 
      ['salary-periods', 'site', siteId, 'detailed'] as const,
    pending: (siteId: string) => 
      ['salary-periods', 'site', siteId, 'pending'] as const,
  },

  clientPayments: {
    all: ['client-payments'] as const,
    bySite: (siteId: string) => ['client-payments', 'site', siteId] as const,
    pending: (siteId: string) => 
      ['client-payments', 'site', siteId, 'pending'] as const,
  },

  teaShop: {
    all: ['tea-shop'] as const,
    entries: (siteId: string) => ['tea-shop', 'site', siteId, 'entries'] as const,
    settlements: (siteId: string) => 
      ['tea-shop', 'site', siteId, 'settlements'] as const,
    pending: (siteId: string) => 
      ['tea-shop', 'site', siteId, 'pending'] as const,
  },

  // ==================== INVENTORY DATA (5min cache) ====================
  
  materialStock: {
    all: ['material-stock'] as const,
    bySite: (siteId: string) => ['material-stock', 'site', siteId] as const,
    summary: (siteId: string) => 
      ['material-stock', 'site', siteId, 'summary'] as const,
    lowStock: (siteId: string) => 
      ['material-stock', 'site', siteId, 'low-stock'] as const,
  },

  materialUsage: {
    all: ['material-usage'] as const,
    bySite: (siteId: string) => ['material-usage', 'site', siteId] as const,
    byDate: (siteId: string, date: string) => 
      ['material-usage', 'site', siteId, 'date', date] as const,
  },

  materialRequests: {
    all: ['material-requests'] as const,
    bySite: (siteId: string) => ['material-requests', 'site', siteId] as const,
    pending: (siteId: string) => 
      ['material-requests', 'site', siteId, 'pending'] as const,
  },

  purchaseOrders: {
    all: ['purchase-orders'] as const,
    bySite: (siteId: string) => ['purchase-orders', 'site', siteId] as const,
    pending: (siteId: string) => 
      ['purchase-orders', 'site', siteId, 'pending'] as const,
  },

  // ==================== DASHBOARD / AGGREGATED DATA (2min cache) ====================
  // Frequently viewed, needs to be relatively fresh
  
  dashboard: {
    all: ['dashboard'] as const,
    site: (siteId: string) => ['dashboard', 'site', siteId] as const,
    company: () => ['dashboard', 'company'] as const,
    metrics: (siteId: string) => ['dashboard', 'site', siteId, 'metrics'] as const,
  },

  reports: {
    all: ['reports'] as const,
    attendance: (siteId: string, from: string, to: string) => 
      ['reports', 'attendance', siteId, { from, to }] as const,
    expenses: (siteId: string, from: string, to: string) => 
      ['reports', 'expenses', siteId, { from, to }] as const,
    payments: (siteId: string, from: string, to: string) => 
      ['reports', 'payments', siteId, { from, to }] as const,
  },

  stats: {
    all: ['stats'] as const,
    company: () => ['stats', 'company'] as const,
    site: (siteId: string) => ['stats', 'site', siteId] as const,
  },
} as const;

/**
 * Cache TTL (Time To Live) configurations in milliseconds
 */
export const cacheTTL = {
  // Reference data - rarely changes
  reference: 24 * 60 * 60 * 1000, // 24 hours
  
  // Transactional data - frequently updated
  transactional: 5 * 60 * 1000, // 5 minutes
  
  // Dashboard/aggregated data - balance between freshness and performance
  dashboard: 2 * 60 * 1000, // 2 minutes
  
  // Real-time critical data - very short cache
  realtime: 30 * 1000, // 30 seconds
} as const;

/**
 * Helper to determine cache TTL based on query key
 * Handles complex query keys like ['attendance', 'site', siteId, 'today']
 */
export function getCacheTTL(queryKey: readonly unknown[]): number {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    return cacheTTL.transactional;
  }

  const entity = queryKey[0] as string;

  // Reference data entities - 24 hour cache
  const referenceEntities = [
    'sites',
    'teams',
    'laborers',
    'labor-categories',
    'labor-roles',
    'materials',
    'vendors',
    'users',
    'subcontracts',
  ];

  // Dashboard/stats entities - 2 minute cache
  const dashboardEntities = ['dashboard', 'reports', 'stats'];

  // Real-time critical entities (checked by prefix) - 30 second cache
  const realtimeEntities = ['attendance', 'market-attendance'];

  if (referenceEntities.includes(entity)) {
    return cacheTTL.reference;
  }

  if (dashboardEntities.includes(entity)) {
    return cacheTTL.dashboard;
  }

  // For attendance queries, check if it's a "today" or "active" query
  // These need shorter TTL for real-time updates
  if (realtimeEntities.includes(entity)) {
    // Check the last element of the query key for real-time indicators
    const lastElement = queryKey[queryKey.length - 1];
    if (lastElement === 'today' || lastElement === 'active') {
      return cacheTTL.realtime;
    }
    // Regular attendance queries get transactional TTL
    return cacheTTL.transactional;
  }

  // Default to transactional TTL
  return cacheTTL.transactional;
}

/**
 * Helper to check if a query should be persisted
 * Some queries (like user sessions) should not be persisted to IndexedDB
 */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    return true;
  }

  const entity = queryKey[0] as string;

  // Don't persist sensitive or session-specific data
  const noPersistEntities = ['auth-session', 'temp', 'preview'];

  return !noPersistEntities.includes(entity);
}
