"use client";

import { useCompaniesData } from "./CompaniesDataContext";
import { useSelectedCompany } from "./SelectedCompanyContext";
import { useCompanyActions } from "./CompanyActionsContext";

/**
 * Combined hook for backward compatibility and convenience.
 * Prefer using individual hooks (useCompaniesData, useSelectedCompany, useCompanyActions)
 * to minimize re-renders in components that only need specific data.
 */
export function useCompany() {
  const { companies, loading, isInitialized, error } = useCompaniesData();
  const { selectedCompany } = useSelectedCompany();
  const { setSelectedCompany, refreshCompanies } = useCompanyActions();

  return {
    // Data
    companies,
    selectedCompany,

    // State
    loading,
    isInitialized,
    error,

    // Actions
    setSelectedCompany,
    refreshCompanies,

    // Computed
    hasCompany: !!selectedCompany,
    companyId: selectedCompany?.id || null,
    companyName: selectedCompany?.name || null,
    companyCode: selectedCompany?.code || null,
    userRole: selectedCompany?.role || null,
  };
}
