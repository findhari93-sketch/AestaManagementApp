"use client";

import { useTheme, useMediaQuery } from "@mui/material";

/**
 * Hydration-safe mobile detection hook.
 *
 * This hook prevents hydration mismatches by using MUI's noSsr option.
 * On server and initial client render, it returns false (desktop layout).
 * After hydration, it updates to the actual value based on screen size.
 *
 * This ensures consistent HTML between server and client renders,
 * preventing the flickering issue on mobile devices.
 */
export function useIsMobile(breakpoint: 'sm' | 'md' = 'sm'): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down(breakpoint), {
    noSsr: true,           // Don't run on server - ensures consistent initial render
    defaultMatches: false, // Return false initially (desktop layout) for SSR consistency
  });
}

/**
 * Hydration-safe tablet detection hook.
 * Returns true for screens smaller than 'md' breakpoint (900px).
 */
export function useIsTablet(): boolean {
  return useIsMobile('md');
}

/**
 * Get both mobile and tablet status in one call.
 * Useful when a component needs both values.
 */
export function useResponsive(): { isMobile: boolean; isTablet: boolean } {
  const isMobile = useIsMobile('sm');
  const isTablet = useIsMobile('md');
  return { isMobile, isTablet };
}
