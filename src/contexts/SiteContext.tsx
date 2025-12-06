"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Site } from "@/types/database.types";
import { useAuth } from "./AuthContext";

interface SiteContextType {
  sites: Site[];
  selectedSite: Site | null;
  setSelectedSite: (site: Site | null) => void;
  loading: boolean;
  refreshSites: () => Promise<void>;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const [supabase] = useState(() => createClient());

  // Use ref to track if we're currently fetching (prevents race conditions)
  const isFetchingRef = useRef(false);

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

      // Auto-select site using functional update (avoids stale closure)
      setSelectedSite((prevSelected) => {
        // Keep existing selection if valid
        if (prevSelected && sitesData.some((s) => s.id === prevSelected.id)) {
          return prevSelected;
        }

        // No sites available
        if (sitesData.length === 0) {
          return null;
        }

        // Try to restore from localStorage
        const savedSiteId = localStorage.getItem("selectedSiteId");
        if (savedSiteId) {
          const savedSite = sitesData.find((s) => s.id === savedSiteId);
          if (savedSite) {
            return savedSite;
          }
        }

        // Default to first site
        return sitesData[0];
      });
    } catch (error) {
      console.error("Error fetching sites:", error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userProfile, supabase]);

  useEffect(() => {
    if (userProfile) {
      fetchSites();
    } else {
      // Reset state when user logs out
      setSites([]);
      setSelectedSite(null);
      setLoading(false);
    }
  }, [userProfile, fetchSites]);

  useEffect(() => {
    if (selectedSite) {
      localStorage.setItem("selectedSiteId", selectedSite.id);
    }
  }, [selectedSite]);

  const refreshSites = useCallback(async () => {
    await fetchSites();
  }, [fetchSites]);

  const value = {
    sites,
    selectedSite,
    setSelectedSite,
    loading,
    refreshSites,
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
