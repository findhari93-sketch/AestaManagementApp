/**
 * Split Site Context
 *
 * This module provides fine-grained control over site context re-renders.
 * Components only re-render when the specific data they subscribe to changes.
 *
 * Usage:
 *
 * 1. For components that only need the selected site:
 *    const { selectedSite } = useSelectedSite();
 *    // Only re-renders when selected site changes
 *
 * 2. For components that only need the sites list:
 *    const { sites, loading } = useSitesData();
 *    // Only re-renders when sites list changes
 *
 * 3. For components that only need actions:
 *    const { setSelectedSite, refreshSites } = useSiteActions();
 *    // Never re-renders
 *
 * 4. For backwards compatibility (re-renders on any change):
 *    const { sites, selectedSite, setSelectedSite } = useSite();
 *    // Re-renders when anything changes (use sparingly)
 */

// Export provider
export { SiteProvider } from "./SiteProvider";

// Export individual hooks (recommended)
export { useSitesData } from "./SitesDataContext";
export { useSelectedSite } from "./SelectedSiteContext";
export { useSiteActions } from "./SiteActionsContext";

// Export combined hook for backwards compatibility
export { useSite } from "./useSite";
