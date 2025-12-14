"use client";

import { useState, useEffect } from "react";
import { useTheme, useMediaQuery } from "@mui/material";

/**
 * Hydration-safe mobile detection hook.
 *
 * This hook prevents hydration mismatches by:
 * 1. Always returning false on server and initial client render
 * 2. Only updating to actual screen size after component mounts (hydration complete)
 *
 * This ensures consistent HTML between server and client renders.
 */
export function useIsMobile(breakpoint: 'sm' | 'md' = 'sm'): boolean {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);

  // Check actual media query value
  const matches = useMediaQuery(theme.breakpoints.down(breakpoint), {
    defaultMatches: false, // Always start with false for SSR
  });

  // Only set mounted after hydration is complete
  useEffect(() => {
    setMounted(true);
  }, []);

  // Return false until mounted (prevents hydration mismatch)
  return mounted ? matches : false;
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
