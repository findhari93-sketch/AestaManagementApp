"use client";

import { createContext, useContext } from "react";

export interface Company {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  city: string | null;
  is_active: boolean;
}

export interface CompanyMembership extends Company {
  role: string; // 'owner' | 'admin' | 'member'
  is_primary: boolean;
}

export interface CompaniesDataContextType {
  companies: CompanyMembership[];
  loading: boolean;
  isInitialized: boolean;
  error: string | null;
}

export const CompaniesDataContext = createContext<CompaniesDataContextType>({
  companies: [],
  loading: true,
  isInitialized: false,
  error: null,
});

export function useCompaniesData() {
  const context = useContext(CompaniesDataContext);
  if (!context) {
    throw new Error("useCompaniesData must be used within a CompanyProvider");
  }
  return context;
}
