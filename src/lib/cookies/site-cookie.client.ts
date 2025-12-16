"use client";

export const SELECTED_SITE_COOKIE = "selectedSiteId";

// Cookie max age: 1 year in seconds
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Client-side function to set the selected site ID cookie.
 * Called when user changes site selection.
 */
export function setSelectedSiteCookie(siteId: string | null): void {
  if (typeof document === "undefined") return;

  if (siteId) {
    document.cookie = `${SELECTED_SITE_COOKIE}=${siteId}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  } else {
    // Delete cookie by setting max-age to 0
    document.cookie = `${SELECTED_SITE_COOKIE}=; path=/; max-age=0`;
  }
}

/**
 * Client-side function to read the selected site ID from cookies.
 * Useful for initial hydration and checking current cookie state.
 */
export function getSelectedSiteCookie(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(^| )${SELECTED_SITE_COOKIE}=([^;]+)`)
  );
  return match ? match[2] : null;
}
