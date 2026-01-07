"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, useEffect, useRef } from "react";
import { createIDBPersister } from "@/lib/cache/persistor";
import { initBackgroundSync, stopBackgroundSync } from "@/lib/cache/sync";
import {
  startRealtimeListeners,
  stopRealtimeListeners,
} from "@/lib/supabase/realtime";
import { useSite } from "@/contexts/SiteContext";
import { useTab } from "@/providers/TabProvider";

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
            staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh (increased to reduce refetches)
            gcTime: 30 * 60 * 1000, // 30 minutes - cache garbage collection
            retry: (failureCount, error: any) => {
              // Don't retry on 400 Bad Request - these are programming errors
              if (error?.status === 400 || error?.message?.includes("400")) {
                console.error("[QueryClient] 400 Bad Request - not retrying:", error);
                return false;
              }
              // Don't retry on 401/403 - auth issues
              if (error?.status === 401 || error?.status === 403) {
                return false;
              }
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
            refetchOnWindowFocus: false, // Disabled - prevents refetch cascade on tab focus
            refetchOnReconnect: true, // Refetch when network reconnects
            refetchOnMount: true, // Only refetch if data is stale (not "always")
            networkMode: "online", // Online mode to prevent showing stale data from wrong site
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
      // Removed onSuccess invalidation - it was causing refetch cascade after cache restore
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
 * Separated to access SiteContext and TabProvider
 * Waits for tab coordination to be ready before initializing
 */
function SyncInitializer({ queryClient }: { queryClient: QueryClient }) {
  const { selectedSite } = useSite();
  const { isReady: isTabReady, isLeader } = useTab();
  const previousSiteIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Wait for tab coordination to be ready
    if (!isTabReady) {
      return;
    }

    const currentSiteId = selectedSite?.id;
    const previousSiteId = previousSiteIdRef.current;

    // Clear old site's cached queries when switching sites
    // This prevents stale data from appearing when navigating
    if (currentSiteId && previousSiteId !== currentSiteId) {
      console.log(`Site changed from ${previousSiteId || 'none'} to ${currentSiteId}, clearing site-specific cache`);

      // Cancel any in-flight queries first
      queryClient.cancelQueries();

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

      // Reset query cache state for removed queries to ensure fresh fetches
      queryClient.resetQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          if (!Array.isArray(queryKey) || queryKey.length === 0) {
            return false;
          }
          const firstKey = String(queryKey[0]);
          return !PRESERVED_QUERY_PREFIXES.some(prefix => firstKey.startsWith(prefix));
        },
      });
    }

    // Update the ref for next comparison
    previousSiteIdRef.current = currentSiteId;

    // Initialize/re-initialize background sync for current site
    // The sync module will handle leader/follower behavior internally
    initBackgroundSync(queryClient, currentSiteId);

    // Stop old listeners and start new ones for current site
    // The realtime module will handle leader/follower behavior internally
    stopRealtimeListeners();
    startRealtimeListeners(queryClient, currentSiteId);

    console.log(`[SyncInitializer] Initialized - isLeader: ${isLeader}, siteId: ${currentSiteId}`);

    // Cleanup on unmount
    return () => {
      stopBackgroundSync();
      stopRealtimeListeners();
    };
  }, [queryClient, selectedSite?.id, isTabReady, isLeader]);

  return null;
}

// RouteChangeHandler REMOVED - was causing refetch cascade on every navigation
// React Query's built-in staleTime handles data freshness automatically
