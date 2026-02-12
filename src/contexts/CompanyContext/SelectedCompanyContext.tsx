"use client";

import { createContext, useContext } from "react";
import type { CompanyMembership } from "./CompaniesDataContext";

export interface SelectedCompanyContextType {
  selectedCompany: CompanyMembership | null;
}

export const SelectedCompanyContext = createContext<SelectedCompanyContextType>({
  selectedCompany: null,
});

export function useSelectedCompany() {
  const context = useContext(SelectedCompanyContext);
  if (!context) {
    throw new Error("useSelectedCompany must be used within a CompanyProvider");
  }
  return context;
}
