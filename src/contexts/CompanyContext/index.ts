// Main provider
export { CompanyProvider } from "./CompanyProvider";

// Individual contexts for granular subscriptions
export { CompaniesDataContext, useCompaniesData } from "./CompaniesDataContext";
export { SelectedCompanyContext, useSelectedCompany } from "./SelectedCompanyContext";
export { CompanyActionsContext, useCompanyActions } from "./CompanyActionsContext";

// Combined hook (use sparingly - prefer individual hooks to minimize re-renders)
export { useCompany } from "./useCompany";

// Types
export type { Company, CompanyMembership, CompaniesDataContextType } from "./CompaniesDataContext";
export type { SelectedCompanyContextType } from "./SelectedCompanyContext";
export type { CompanyActionsContextType } from "./CompanyActionsContext";
