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
  // Initialize from localStorage cache immediately for instant restoration
  // This prevents the "no site selected" flash during navigation
  const [sites, setSites] = useState<Site[]>(() => getStoredSites());

  const [selectedSite, setSelectedSiteState] = useState<Site | null>(() => {
    const cachedSites = getStoredSites();
    const savedSiteId = getStoredSiteId();
    if (savedSiteId && cachedSites.length > 0) {
      const found = cachedSites.find((s) => s.id === savedSiteId);
      return found || cachedSites[0] || null;
    }
    return cachedSites[0] || null;
  });

  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const { userProfile } = useAuth();
  const [supabase] = useState(() => createClient());

  // Use ref to track if we're currently fetching (prevents race conditions)
  const isFetchingRef = useRef(false);

  // Wrapper to set site and persist to localStorage
  const setSelectedSite = useCallback((site: Site | null) => {
    setSelectedSiteState(site);
    storeSiteId(site?.id || null);
  }, []);

  const fetchSites = useCallback(async () => {
    // Prevent concurrent fetches (race condition fix)
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);

    try {
      let query = supabase.from("sites").select("*").order("name");

      // Filter by assigned sites if user is not admin
      if (userProfile?.role !== "admin" && userProfile?.assigned_sites) {
        query = query.in("id", userProfile.assigned_sites);
      }

      const { data, error } = await query;

      if (error) throw error;

      const sitesData: Site[] = data || [];
      setSites(sitesData);

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
    } catch (error) {
      console.error("Error fetching sites:", error);
    } finally {
      setLoading(false);
      setIsInitialized(true);
      isFetchingRef.current = false;
    }
  }, [userProfile, supabase]);

  useEffect(() => {
    if (userProfile) {
      fetchSites();
    } else {
      // Reset state when user logs out
      setSites([]);
      setSelectedSiteState(null);
      storeSiteId(null);
      setLoading(false);
      setIsInitialized(true);
    }
  }, [userProfile, fetchSites]);

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
