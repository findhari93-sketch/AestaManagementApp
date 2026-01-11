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
 * Redirects to login page if session is expired or times out.
 */
export function useSessionRefresh() {
  const pathname = usePathname();
  const lastRefreshRef = useRef<number>(0);
  const DEBOUNCE_MS = 2000; // Don't refresh more than once every 2 seconds
  const SESSION_TIMEOUT = 5000; // 5 seconds

  useEffect(() => {
    const now = Date.now();

    // Debounce: Skip if we refreshed recently
    if (now - lastRefreshRef.current < DEBOUNCE_MS) {
      return;
    }

    let didTimeout = false;

    const refreshSession = async () => {
      // Get singleton client inside effect to avoid dependency issues
      const supabase = createClient();

      // Add timeout to prevent hanging and redirect on timeout
      const timeoutId = setTimeout(() => {
        didTimeout = true;
        console.warn("Session refresh timed out - redirecting to login");
        window.location.href = "/login?session_expired=true";
      }, SESSION_TIMEOUT);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        clearTimeout(timeoutId);

        if (didTimeout) return; // Already redirecting

        if (error || !session) {
          // Session invalid - redirect to login
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
        clearTimeout(timeoutId);
        if (!didTimeout) {
          console.error("Session refresh error:", error);
          window.location.href = "/login?session_expired=true";
        }
      }
    };

    refreshSession();
  }, [pathname]); // Only depend on pathname, not supabase
}
