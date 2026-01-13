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
 * Only redirects to login if session is actually invalid, not on timeouts.
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

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          // Session actually invalid - redirect to login
          console.warn("Session invalid - redirecting to login");
          window.location.href = "/login?session_expired=true";
          return;
        }

        // Check if token needs refresh (within 5 minutes of expiry)
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const fiveMinutesFromNow = Math.floor(Date.now() / 1000) + 300;
          if (expiresAt < fiveMinutesFromNow) {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.warn("Session refresh failed - redirecting to login");
              window.location.href = "/login?session_expired=true";
              return;
            }
          }
        }

        lastRefreshRef.current = Date.now();
      } catch (error) {
        // Network errors or slow responses should not log the user out
        // They may still have a valid session - just the check failed
        console.warn("Session refresh check failed (network issue?):", error);
      }
    };

    refreshSession();
  }, [pathname]); // Only depend on pathname, not supabase
}
