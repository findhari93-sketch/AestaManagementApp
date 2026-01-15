"use client";

import { createContext, useContext } from "react";
import { Site } from "@/types/database.types";

/**
 * Context for the currently selected site
 * This changes frequently when user switches sites
 */
interface SelectedSiteContextType {
  selectedSite: Site | null;
}

export const SelectedSiteContext = createContext<
  SelectedSiteContextType | undefined
>(undefined);

export function useSelectedSite() {
  const context = useContext(SelectedSiteContext);
  if (context === undefined) {
    throw new Error("useSelectedSite must be used within a SiteProvider");
  }
  return context;
}
