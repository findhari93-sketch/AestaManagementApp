"use client";

import { createContext, useContext } from "react";
import { Site } from "@/types/database.types";

/**
 * Context for the sites list
 * This rarely changes (only when sites are added/removed)
 */
interface SitesDataContextType {
  sites: Site[];
  loading: boolean;
  isInitialized: boolean;
  error: string | null;
}

export const SitesDataContext = createContext<SitesDataContextType | undefined>(
  undefined
);

export function useSitesData() {
  const context = useContext(SitesDataContext);
  if (context === undefined) {
    throw new Error("useSitesData must be used within a SiteProvider");
  }
  return context;
}
