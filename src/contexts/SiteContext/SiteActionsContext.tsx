"use client";

import { createContext, useContext } from "react";
import { Site } from "@/types/database.types";

/**
 * Context for site actions
 * These are stable functions that never change
 */
interface SiteActionsContextType {
  setSelectedSite: (site: Site | null) => void;
  refreshSites: () => Promise<void>;
}

export const SiteActionsContext = createContext<
  SiteActionsContextType | undefined
>(undefined);

export function useSiteActions() {
  const context = useContext(SiteActionsContext);
  if (context === undefined) {
    throw new Error("useSiteActions must be used within a SiteProvider");
  }
  return context;
}
