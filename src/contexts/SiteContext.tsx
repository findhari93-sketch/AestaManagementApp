"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

  const fetchSites = async () => {
    try {
      setLoading(true);

      let query = supabase.from("sites").select("*").order("name");

      // Filter by assigned sites if user is not admin
      if (userProfile?.role !== "admin" && userProfile?.assigned_sites) {
        query = query.in("id", userProfile.assigned_sites);
      }

      const { data, error } = await query;

      if (error) throw error;

      const sitesData: Site[] = data || [];
      setSites(sitesData);

      // Auto-select first site if none selected
      if (sitesData.length > 0 && !selectedSite) {
        const savedSiteId = localStorage.getItem("selectedSiteId");
        if (savedSiteId) {
          const savedSite = sitesData.find((s) => s.id === savedSiteId);
          if (savedSite) {
            setSelectedSite(savedSite);
          } else {
            setSelectedSite(sitesData[0]);
          }
        } else {
          setSelectedSite(sitesData[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching sites:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      fetchSites();
    }
  }, [userProfile]);

  useEffect(() => {
    if (selectedSite) {
      localStorage.setItem("selectedSiteId", selectedSite.id);
    }
  }, [selectedSite]);

  const refreshSites = async () => {
    await fetchSites();
  };

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
