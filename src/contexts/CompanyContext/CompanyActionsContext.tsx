"use client";

import { createContext, useContext } from "react";
import type { CompanyMembership } from "./CompaniesDataContext";

export interface CompanyActionsContextType {
  setSelectedCompany: (company: CompanyMembership | null) => void;
  refreshCompanies: () => Promise<void>;
}

export const CompanyActionsContext = createContext<CompanyActionsContextType>({
  setSelectedCompany: () => {},
  refreshCompanies: async () => {},
});

export function useCompanyActions() {
  const context = useContext(CompanyActionsContext);
  if (!context) {
    throw new Error("useCompanyActions must be used within a CompanyProvider");
  }
  return context;
}
