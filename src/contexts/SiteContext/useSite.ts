/**
 * Backwards compatibility hook
 *
 * Returns all site context data in one object.
 * Components using this will re-render whenever ANY part of the site context changes.
 *
 * For better performance, use the specific hooks instead:
 * - useSelectedSite() - only re-renders on selected site change
 * - useSitesData() - only re-renders on sites list change
 * - useSiteActions() - never re-renders
 */

import { useSitesData } from "./SitesDataContext";
import { useSelectedSite } from "./SelectedSiteContext";
import { useSiteActions } from "./SiteActionsContext";

export function useSite() {
  const { sites, loading, isInitialized, error } = useSitesData();
  const { selectedSite } = useSelectedSite();
  const { setSelectedSite, refreshSites } = useSiteActions();

  return {
    sites,
    selectedSite,
    setSelectedSite,
    loading,
    refreshSites,
    isInitialized,
    error,
  };
}
