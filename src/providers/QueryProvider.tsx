"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, useEffect, useRef } from "react";
import { createIDBPersister } from "@/lib/cache/persistor";
import { shouldPersistQuery } from "@/lib/cache/keys";
import { initBackgroundSync, stopBackgroundSync } from "@/lib/cache/sync";
import { useSite } from "@/contexts/SiteContext";
import { useTab } from "@/providers/TabProvider";
import { SessionExpiredError } from "@/lib/supabase/client";

/**
 * Checks if an error is a session/auth related error that should redirect to login.
 * Be precise - only catch actual auth failures, not network timeouts or generic errors.
 */
function isSessionError(error: unknown): boolean {
  if (error instanceof SessionExpiredError) {
    return true;
  }

  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    // Check for Supabase auth error codes and HTTP status codes
    if (err.code === "PGRST301" || err.status === 401 || err.status === 403) {
      return true;
    }
    // Be more specific about auth-related error messages
    // Avoid matching generic "session" or "token" strings which may appear in other contexts
    const message = String(err.message || "").toLowerCase();
    if (
      message.includes("jwt expired") ||
      message.includes("invalid jwt") ||
      message.includes("not authenticated") ||
      message.includes("session expired") ||
      message.includes("invalid refresh token") ||
      message.includes("refresh token not found")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Redirects to login page with session expired flag.
 */
function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    window.location.href = "/login?session_expired=true";
  }
}

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
            // Smart window focus refetch: only refetch if data is older than default staleTime
            // This prevents refetch cascade on tab focus while still refreshing stale data
            refetchOnWindowFocus: (query) => {
              const age = Date.now() - (query.state.dataUpdatedAt || 0);
              const defaultStaleTime = 5 * 60 * 1000; // 5 minutes
              return age > defaultStaleTime;
            },
            refetchOnReconnect: true, // Refetch when network reconnects
            refetchOnMount: true, // Refetch if data is stale
            networkMode: "online", // Online mode to prevent showing stale data from wrong site
          },
          mutations: {
            retry: (failureCount, error: any) => {
              // Don't retry on client errors (4xx) - these won't succeed on retry
              // 400 = Bad Request (invalid data)
              // 401/403 = Auth issues
              // 409 = Conflict (unique constraint violation, already exists)
              // 422 = Validation error
              const status = error?.status || error?.code;
              if (status === 400 || status === 401 || status === 403 || status === 409 || status === 422) {
                console.warn(`[QueryClient] Mutation failed with ${status} - not retrying`);
                return false;
              }
              // Only retry server errors (5xx) and network errors once
              return failureCount < 1;
            },
            networkMode: "online",
            onError: (error) => {
              // Redirect to login on session/auth errors
              if (isSessionError(error)) {
                console.warn("[QueryClient] Session error detected, redirecting to login");
                redirectToLogin();
              }
            },
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
        buster: "v2", // Change this to invalidate all persisted cache
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            return shouldPersistQuery(query.queryKey);
          },
        },
      }}
      onSuccess={() => {
        // After cache restoration, invalidate queries that are past the default staleTime
        // This ensures stale data gets refreshed while still showing cached data immediately
        const defaultStaleTime = 5 * 60 * 1000; // 5 minutes
        queryClient.invalidateQueries({
          predicate: (query) => {
            const age = Date.now() - (query.state.dataUpdatedAt || 0);
            // Only invalidate if data exists and is stale
            return query.state.data !== undefined && age > defaultStaleTime;
          },
          refetchType: "active", // Only refetch queries currently being observed
        });
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

    // Clear old site's cached queries when switching between sites
    // Only clear when switching from one valid site to another (not on initial load)
    // This prevents stale data from appearing when navigating between sites
    if (currentSiteId && previousSiteId && previousSiteId !== currentSiteId) {
      console.log(`Site changed from ${previousSiteId} to ${currentSiteId}, clearing site-specific cache`);

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

    console.log(`[SyncInitializer] Initialized - isLeader: ${isLeader}, siteId: ${currentSiteId}`);

    // Cleanup on unmount
    return () => {
      stopBackgroundSync();
    };
  }, [queryClient, selectedSite?.id, isTabReady, isLeader]);

  return null;
}

// RouteChangeHandler REMOVED - was causing refetch cascade on every navigation
// React Query's built-in staleTime handles data freshness automatically
