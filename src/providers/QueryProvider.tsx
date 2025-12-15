"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, useEffect, useRef } from "react";
import { createIDBPersister } from "@/lib/cache/persistor";
import { initBackgroundSync, stopBackgroundSync } from "@/lib/cache/sync";
import {
  startRealtimeListeners,
  stopRealtimeListeners,
} from "@/lib/supabase/realtime";
import { useSite } from "@/contexts/SiteContext";

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1 * 60 * 1000, // 1 minute - data considered fresh
            gcTime: 30 * 60 * 1000, // 30 minutes - cache garbage collection
            retry: 3, // Retry failed requests 3 times for better reliability
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
            refetchOnWindowFocus: true, // Refetch when tab regains focus
            refetchOnReconnect: true, // Refetch when network reconnects
            networkMode: "online", // Only fetch when online
          },
          mutations: {
            retry: 1,
            networkMode: "online",
          },
        },
      })
  );

  const [persister] = useState(() => createIDBPersister());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours max age for persisted data
        buster: "v1", // Change this to invalidate all persisted cache
      }}
    >
      <SyncInitializer queryClient={queryClient} />
      {children}
    </PersistQueryClientProvider>
  );
}

/**
 * Queries that should be preserved across site changes
 * (user profile, auth, sites list, etc.)
 */
const PRESERVED_QUERY_PREFIXES = ["user", "auth", "sites", "profile", "notifications"];

/**
 * Component to initialize background sync
 * Separated to access SiteContext
 */
function SyncInitializer({ queryClient }: { queryClient: QueryClient }) {
  const { selectedSite } = useSite();
  const previousSiteIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentSiteId = selectedSite?.id;
    const previousSiteId = previousSiteIdRef.current;

    // Clear old site's cached queries when switching sites
    // This prevents stale data from appearing when navigating
    if (previousSiteId && currentSiteId && previousSiteId !== currentSiteId) {
      console.log(`Site changed from ${previousSiteId} to ${currentSiteId}, clearing site-specific cache`);

      // Remove all queries EXCEPT preserved ones (user, auth, sites, etc.)
      queryClient.removeQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          if (!Array.isArray(queryKey) || queryKey.length === 0) {
            return false; // Don't remove malformed keys
          }

          const firstKey = String(queryKey[0]);

          // Keep preserved queries (user profile, auth, sites list)
          if (PRESERVED_QUERY_PREFIXES.some(prefix => firstKey.startsWith(prefix))) {
            return false;
          }

          // Remove all other queries (they are site-specific)
          return true;
        },
      });
    }

    // Update the ref for next comparison
    previousSiteIdRef.current = currentSiteId;

    // Initialize/re-initialize background sync for current site
    initBackgroundSync(queryClient, currentSiteId);

    // Stop old listeners and start new ones for current site
    stopRealtimeListeners();
    startRealtimeListeners(queryClient, currentSiteId);

    // Cleanup on unmount
    return () => {
      stopBackgroundSync();
      stopRealtimeListeners();
    };
  }, [queryClient, selectedSite?.id]);

  return null;
}
