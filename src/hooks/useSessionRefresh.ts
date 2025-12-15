"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook to refresh Supabase session on client-side navigation.
 *
 * Since middleware only runs on server requests, client-side navigation
 * doesn't trigger session refresh. This hook ensures the session is
 * validated and refreshed when navigating between pages.
 */
export function useSessionRefresh() {
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const refreshSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

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
      } catch (error) {
        console.error("Session refresh error:", error);
      }
    };

    refreshSession();
  }, [pathname, supabase]);
}
