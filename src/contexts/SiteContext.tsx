"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Site } from "@/types/database.types";
import { useAuth } from "./AuthContext";

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
  // Initialize with empty values to match server render (prevents hydration mismatch)
  // localStorage restoration happens in useEffect after hydration
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSiteState] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userProfile, loading: authLoading } = useAuth();
  const [supabase] = useState(() => createClient());

  // Use ref to track if we're currently fetching (prevents race conditions)
  const isFetchingRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Wrapper to set site and persist to localStorage
  const setSelectedSite = useCallback((site: Site | null) => {
    setSelectedSiteState(site);
    storeSiteId(site?.id || null);
  }, []);

  const fetchSites = useCallback(async (isRetry = false) => {
    // Prevent concurrent fetches (race condition fix)
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    if (!isRetry) {
      setError(null);
      retryCountRef.current = 0;
    }

    try {
      console.log("[SiteContext] Fetching sites...", {
        userRole: userProfile?.role,
        assignedSites: userProfile?.assigned_sites,
        retryCount: retryCountRef.current
      });

      let query = supabase.from("sites").select("*").order("name");

      // Filter by assigned sites if user is not admin
      if (userProfile?.role !== "admin" && userProfile?.assigned_sites) {
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
      setError(null);
      retryCountRef.current = 0;

      // Cache sites for next load (instant restoration)
      storeSites(sitesData);

      // Update selected site if needed using functional update
      setSelectedSiteState((prevSelected) => {
        // Keep existing selection if it's still valid
        if (prevSelected && sitesData.some((s) => s.id === prevSelected.id)) {
          return prevSelected;
        }

        // No sites available
        if (sitesData.length === 0) {
          storeSiteId(null);
          return null;
        }

        // Try to restore from localStorage
        const savedSiteId = getStoredSiteId();
        if (savedSiteId) {
          const savedSite = sitesData.find((s) => s.id === savedSiteId);
          if (savedSite) {
            return savedSite;
          }
        }

        // Default to first site
        const firstSite = sitesData[0];
        storeSiteId(firstSite.id);
        return firstSite;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch sites";
      console.error("[SiteContext] Error fetching sites:", errorMessage);

      // Retry logic for network errors
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`[SiteContext] Retrying... (${retryCountRef.current}/${maxRetries})`);
        isFetchingRef.current = false;

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
        setTimeout(() => fetchSites(true), delay);
        return;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsInitialized(true);
      isFetchingRef.current = false;
    }
  }, [userProfile, supabase]);

  // Restore from localStorage AFTER hydration (prevents hydration mismatch)
  useEffect(() => {
    // Mark as hydrated
    setIsHydrated(true);

    // Restore cached sites and selection from localStorage
    const cachedSites = getStoredSites();
    const savedSiteId = getStoredSiteId();

    if (cachedSites.length > 0) {
      setSites(cachedSites);

      if (savedSiteId) {
        const found = cachedSites.find((s) => s.id === savedSiteId);
        setSelectedSiteState(found || cachedSites[0] || null);
      } else {
        setSelectedSiteState(cachedSites[0] || null);
      }
    }
  }, []); // Run once after hydration

  useEffect(() => {
    // Only fetch after hydration is complete
    if (!isHydrated) return;

    // Wait for auth to finish loading before making decisions
    if (authLoading) return;

    if (userProfile) {
      fetchSites();
    } else {
      // Only reset state when user is actually logged out (auth finished loading with no user)
      // Don't clear localStorage to preserve site selection for next login
      setSites([]);
      setSelectedSiteState(null);
      setLoading(false);
      setIsInitialized(true);
    }
  }, [userProfile, fetchSites, isHydrated, authLoading]);

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
