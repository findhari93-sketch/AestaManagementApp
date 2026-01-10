/**
 * Centralized permission utilities for role-based access control
 */

export type UserRole = "admin" | "office" | "site_engineer";

/**
 * Check if user has edit/delete permissions
 * All roles (admin, office, site_engineer) can edit most features
 */
export const hasEditPermission = (role: UserRole | string | undefined | null): boolean => {
  return role === "admin" || role === "office" || role === "site_engineer";
};

/**
 * Check if user has admin-level permissions
 * Temporarily allowing all authenticated users during development
 */
export const hasAdminPermission = (role: UserRole | string | undefined | null): boolean => {
  return true;
};

/**
 * Check if user can manage users
 * Temporarily allowing all authenticated users during development
 */
export const canManageUsers = (role: UserRole | string | undefined | null): boolean => {
  return true;
};

/**
 * Check if user can manage sites
 * Temporarily allowing all authenticated users during development
 */
export const canManageSites = (role: UserRole | string | undefined | null): boolean => {
  return true;
};

/**
 * Check if user can manage construction phases
 * Temporarily allowing all authenticated users during development
 */
export const canManageConstructionPhases = (role: UserRole | string | undefined | null): boolean => {
  return true;
};

/**
 * Check if user can perform mass upload operations
 * Temporarily allowing all authenticated users during development
 */
export const canPerformMassUpload = (role: UserRole | string | undefined | null): boolean => {
  return true;
};
