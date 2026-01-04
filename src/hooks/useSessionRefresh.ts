"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook to refresh Supabase session on client-side navigation.
 *
 * Since middleware only runs on server requests, client-side navigation
 * doesn't trigger session refresh. This hook ensures the session is
 * validated and refreshed when navigating between pages.
 *
 * Optimized to:
 * - Use singleton client (no new instance per render)
 * - Debounce rapid navigation changes
 * - Add timeout to prevent hanging
 */
export function useSessionRefresh() {
  const pathname = usePathname();
  const lastRefreshRef = useRef<number>(0);
  const DEBOUNCE_MS = 2000; // Don't refresh more than once every 2 seconds

  useEffect(() => {
    const now = Date.now();

    // Debounce: Skip if we refreshed recently
    if (now - lastRefreshRef.current < DEBOUNCE_MS) {
      return;
    }

    const refreshSession = async () => {
      // Get singleton client inside effect to avoid dependency issues
      const supabase = createClient();

      // Add timeout to prevent hanging (5s for consistency with ensureFreshSession)
      const timeoutId = setTimeout(() => {
        console.warn("Session refresh timed out");
      }, 5000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        clearTimeout(timeoutId);

        if (error || !session) {
          // Session invalid - auth context will handle redirect
          return;
        }

        // Check if token needs refresh (within 5 minutes of expiry)
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const fiveMinutesFromNow = Math.floor(Date.now() / 1000) + 300;
          if (expiresAt < fiveMinutesFromNow) {
            await supabase.auth.refreshSession();
          }
        }

        lastRefreshRef.current = Date.now();
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("Session refresh error:", error);
      }
    };

    refreshSession();
  }, [pathname]); // Only depend on pathname, not supabase
}
