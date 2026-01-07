"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Site } from "@/types/database.types";
import { useAuth } from "./AuthContext";
import {
  setSelectedSiteCookie,
  getSelectedSiteCookie,
} from "@/lib/cookies/site-cookie.client";

// Storage keys
const SELECTED_SITE_KEY = "selectedSiteId";
const SITES_CACHE_KEY = "cachedSites";

interface SiteContextType {
  sites: Site[];
  selectedSite: Site | null;
  setSelectedSite: (site: Site | null) => void;
  loading: boolean;
  refreshSites: () => Promise<void>;
  isInitialized: boolean;
  error: string | null;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

// Helper functions to safely access localStorage
function getStoredSiteId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SELECTED_SITE_KEY);
  } catch {
    return null;
  }
}

function getStoredSites(): Site[] {
  if (typeof window === "undefined") return [];
  try {
    const cached = localStorage.getItem(SITES_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

function storeSiteId(siteId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (siteId) {
      localStorage.setItem(SELECTED_SITE_KEY, siteId);
    } else {
      localStorage.removeItem(SELECTED_SITE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function storeSites(sites: Site[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SITES_CACHE_KEY, JSON.stringify(sites));
  } catch {
    // Ignore storage errors
  }
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSiteState] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userProfile, loading: authLoading } = useAuth();
  const [supabase] = useState(() => createClient());

  // Ref to prevent duplicate fetches
  const hasFetchedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Wrapper to set site and persist to localStorage AND cookie
  const setSelectedSite = useCallback((site: Site | null) => {
    setSelectedSiteState(site);
    storeSiteId(site?.id || null);
    setSelectedSiteCookie(site?.id || null); // Also set cookie for server components
  }, []);

  // Fetch sites from database
  const fetchSites = useCallback(async () => {
    if (!userProfile) {
      console.log("[SiteContext] No user profile, skipping fetch");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[SiteContext] Fetching sites...", {
        userRole: userProfile.role,
        assignedSites: userProfile.assigned_sites,
      });

      let query = supabase.from("sites").select("*").order("name");

      // Filter by assigned sites if user is not admin
      if (userProfile.role !== "admin" && userProfile.assigned_sites) {
        query = query.in("id", userProfile.assigned_sites);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error("[SiteContext] Query error:", queryError);
        throw queryError;
      }

      const sitesData: Site[] = data || [];
      console.log("[SiteContext] Sites fetched:", sitesData.length);

      setSites(sitesData);
      storeSites(sitesData);

      // Update selected site
      setSelectedSiteState((prevSelected) => {
        // Keep existing selection if valid, but use FRESH data from sitesData
        if (prevSelected) {
          const freshSite = sitesData.find((s) => s.id === prevSelected.id);
          if (freshSite) {
            return freshSite; // Return fresh data, not stale cached data
          }
        }

        // No sites available
        if (sitesData.length === 0) {
          storeSiteId(null);
          setSelectedSiteCookie(null);
          return null;
        }

        // Try to restore from cookie first, then localStorage
        const cookieSiteId = getSelectedSiteCookie();
        const localStorageSiteId = getStoredSiteId();
        const savedSiteId = cookieSiteId || localStorageSiteId;

        if (savedSiteId) {
          const savedSite = sitesData.find((s) => s.id === savedSiteId);
          if (savedSite) {
            // Ensure both storage mechanisms are synced
            storeSiteId(savedSite.id);
            setSelectedSiteCookie(savedSite.id);
            return savedSite;
          }
        }

        // Default to first site
        const firstSite = sitesData[0];
        storeSiteId(firstSite.id);
        setSelectedSiteCookie(firstSite.id);
        return firstSite;
      });

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch sites";
      console.error("[SiteContext] Error fetching sites:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [userProfile, supabase]);

  // Restore from localStorage/cookie on mount (client-side only)
  useEffect(() => {
    const cachedSites = getStoredSites();
    // Check cookie first (for SSR consistency), then localStorage
    const cookieSiteId = getSelectedSiteCookie();
    const localStorageSiteId = getStoredSiteId();
    const savedSiteId = cookieSiteId || localStorageSiteId;

    if (cachedSites.length > 0) {
      console.log("[SiteContext] Restoring from cache:", cachedSites.length, "sites");
      setSites(cachedSites);

      if (savedSiteId) {
        const found = cachedSites.find((s) => s.id === savedSiteId);
        const selectedSite = found || cachedSites[0] || null;
        setSelectedSiteState(selectedSite);
        // Sync cookie if it was missing but localStorage had value
        if (!cookieSiteId && localStorageSiteId && selectedSite) {
          setSelectedSiteCookie(selectedSite.id);
        }
      } else {
        const firstSite = cachedSites[0] || null;
        setSelectedSiteState(firstSite);
        if (firstSite) {
          setSelectedSiteCookie(firstSite.id);
        }
      }
    }
  }, []);

  // Fetch sites when auth is ready
  useEffect(() => {
    console.log("[SiteContext] Effect triggered:", { authLoading, hasUserProfile: !!userProfile });

    // Wait for auth to finish loading
    if (authLoading) {
      console.log("[SiteContext] Auth still loading, waiting...");
      return;
    }

    if (userProfile) {
      // Only fetch if user changed or haven't fetched yet
      const currentUserId = userProfile.id;
      if (!hasFetchedRef.current || lastUserIdRef.current !== currentUserId) {
        console.log("[SiteContext] User profile available, fetching sites");
        hasFetchedRef.current = true;
        lastUserIdRef.current = currentUserId;
        fetchSites();
      }
    } else {
      // User logged out - reset state
      console.log("[SiteContext] No user profile, clearing state");
      hasFetchedRef.current = false;
      lastUserIdRef.current = null;
      setSites([]);
      setSelectedSiteState(null);
      setLoading(false);
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.id]);

  // Cross-tab sync: Listen for site changes from other tabs
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      // Only handle changes to the selected site key
      if (e.key !== SELECTED_SITE_KEY) return;

      const newSiteId = e.newValue;
      console.log("[SiteContext] Storage event - site changed in another tab:", newSiteId);

      // If site was cleared in another tab
      if (!newSiteId) {
        setSelectedSiteState(null);
        return;
      }

      // If site ID is the same as current, ignore
      if (selectedSite?.id === newSiteId) return;

      // Find the site in our list and update
      const newSite = sites.find((s) => s.id === newSiteId);
      if (newSite) {
        console.log("[SiteContext] Syncing site from another tab:", newSite.name);
        setSelectedSiteState(newSite);
        setSelectedSiteCookie(newSite.id); // Sync cookie too
      } else {
        // Site not in our list - might need to refresh sites
        console.log("[SiteContext] Site from another tab not in local list, refreshing...");
        fetchSites();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [selectedSite?.id, sites, fetchSites]);

  const refreshSites = useCallback(async () => {
    await fetchSites();
  }, [fetchSites]);

  const value = {
    sites,
    selectedSite,
    setSelectedSite,
    loading,
    refreshSites,
    isInitialized,
    error,
  };

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const context = useContext(SiteContext);
  if (context === undefined) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return context;
}
