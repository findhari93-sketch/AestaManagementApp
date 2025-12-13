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
 * Only admin can access user management, site creation, etc.
 */
export const hasAdminPermission = (role: UserRole | string | undefined | null): boolean => {
  return role === "admin";
};

/**
 * Check if user can manage users (admin only)
 */
export const canManageUsers = (role: UserRole | string | undefined | null): boolean => {
  return role === "admin";
};

/**
 * Check if user can manage sites (admin only)
 */
export const canManageSites = (role: UserRole | string | undefined | null): boolean => {
  return role === "admin";
};

/**
 * Check if user can manage construction phases (admin only)
 */
export const canManageConstructionPhases = (role: UserRole | string | undefined | null): boolean => {
  return role === "admin";
};

/**
 * Check if user can perform mass upload operations
 * Only Admin and Office staff can bulk upload data
 */
export const canPerformMassUpload = (role: UserRole | string | undefined | null): boolean => {
  return role === "admin" || role === "office";
};
