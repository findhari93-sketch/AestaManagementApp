/**
 * React Query Persistence Configuration
 *
 * Sets up IndexedDB persistence for React Query cache.
 * Implements tiered caching strategies and automatic cleanup.
 */

import {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";
import { get, set, del, clear } from "idb-keyval";
import { getCacheTTL, shouldPersistQuery } from "./keys";
import { getTabCoordinator } from "@/lib/tab/coordinator";

const CACHE_VERSION = 1;
const CACHE_KEY = `aesta-query-cache-v${CACHE_VERSION}`;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days max retention (reduced for faster restoration)
const RESTORE_TIMEOUT = 60000; // 60 seconds for restore (increased for slower devices/large caches)
const MAX_RESTORE_RETRIES = 3;

/**
 * Create an IndexedDB persister with automatic cleanup
 */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        // Only leader tab should write to IndexedDB to prevent conflicts
        const coordinator = getTabCoordinator();
        if (coordinator && !coordinator.isLeader) {
          // Follower tabs skip writes - leader will handle persistence
          return;
        }

        // Filter out queries that shouldn't be persisted
        const filteredClient: PersistedClient = {
          ...client,
          clientState: {
            ...client.clientState,
            queries: client.clientState.queries.filter((query) => {
              // Check if query should be persisted
              if (!shouldPersistQuery(query.queryKey)) {
                return false;
              }

              // Check if query has expired based on TTL
              const ttl = getCacheTTL(query.queryKey);
              const age = Date.now() - (query.state.dataUpdatedAt || 0);

              if (age > ttl) {
                return false; // Don't persist expired queries
              }

              return true;
            }),
          },
        };

        await set(CACHE_KEY, filteredClient);
      } catch (error) {
        console.error("Failed to persist query cache:", error);
      }
    },

    restoreClient: async () => {
      // Retry logic for restore with exponential backoff
      const attemptRestore = async (attempt: number): Promise<PersistedClient | undefined> => {
        try {
          const client = await get<PersistedClient>(CACHE_KEY);

          if (!client) {
            return undefined;
          }

          // Validate cache structure - prevent corrupted cache from crashing app
          if (
            !client.clientState ||
            !Array.isArray(client.clientState.queries)
          ) {
            console.warn("Invalid cache structure, clearing...");
            await clear();
            return undefined;
          }

          // Validate cache version and age
          const cacheAge = Date.now() - (client.timestamp || 0);

          if (cacheAge > MAX_AGE) {
            console.log("Cache too old, clearing...");
            await clear();
            return undefined;
          }

          // Filter out stale queries
          const now = Date.now();
          const filteredClient: PersistedClient = {
            ...client,
            clientState: {
              ...client.clientState,
              queries: client.clientState.queries.filter((query) => {
                // Skip queries with missing or invalid dataUpdatedAt
                if (!query.state || typeof query.state.dataUpdatedAt !== "number") {
                  return false;
                }

                const ttl = getCacheTTL(query.queryKey);
                const age = now - query.state.dataUpdatedAt;

                // Keep query if it's still fresh
                return age < ttl;
              }),
            },
          };

          console.log(
            `Restored ${filteredClient.clientState.queries.length} cached queries from IndexedDB`
          );

          return filteredClient;
        } catch (error) {
          // Retry on failure with exponential backoff
          if (attempt < MAX_RESTORE_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
            console.warn(`Cache restore attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return attemptRestore(attempt + 1);
          }
          console.error("Failed to restore query cache after retries:", error);
          return undefined;
        }
      };

      const restorePromise = attemptRestore(0);

      // Race between restore and timeout
      const timeoutPromise = new Promise<undefined>((resolve) => {
        setTimeout(async () => {
          console.warn("Cache restoration timed out, clearing potentially corrupted cache and starting fresh");
          try {
            // Clear the potentially corrupted cache to prevent future timeouts
            await clear();
            console.log("Cache cleared due to restoration timeout");
          } catch (clearError) {
            console.error("Failed to clear cache after timeout:", clearError);
          }
          resolve(undefined);
        }, RESTORE_TIMEOUT);
      });

      return Promise.race([restorePromise, timeoutPromise]);
    },

    removeClient: async () => {
      try {
        await del(CACHE_KEY);
      } catch (error) {
        console.error("Failed to remove query cache:", error);
      }
    },
  };
}

/**
 * Clear all persisted cache
 */
export async function clearPersistedCache(): Promise<void> {
  try {
    await clear();
    console.log("Persisted cache cleared");
  } catch (error) {
    console.error("Failed to clear persisted cache:", error);
  }
}

/**
 * Force clear all application cache and storage
 * Use this when users encounter persistent issues with stale/corrupted data
 * Returns true if successful, false otherwise
 */
export async function forceResetAllCache(): Promise<boolean> {
  try {
    // Clear IndexedDB via idb-keyval
    await clear();

    // Clear sessionStorage (tab-specific data)
    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }

    // Clear any local storage items related to the app
    if (typeof window !== "undefined") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("aesta") || key.startsWith("sb-") || key.includes("supabase"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    console.log("All application cache has been cleared");
    return true;
  } catch (error) {
    console.error("Failed to force reset cache:", error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  exists: boolean;
  queryCount: number;
  timestamp: number;
  age: number;
} | null> {
  try {
    const client = await get<PersistedClient>(CACHE_KEY);

    if (!client) {
      return null;
    }

    const age = Date.now() - (client.timestamp || 0);

    return {
      exists: true,
      queryCount: client.clientState.queries.length,
      timestamp: client.timestamp || 0,
      age,
    };
  } catch (error) {
    console.error("Failed to get cache stats:", error);
    return null;
  }
}

/**
 * Cleanup old queries from persisted cache
 * Call this periodically to keep cache size manageable
 */
export async function cleanupPersistedCache(): Promise<void> {
  try {
    const client = await get<PersistedClient>(CACHE_KEY);

    if (!client) {
      return;
    }

    const now = Date.now();
    let removedCount = 0;

    const filteredClient: PersistedClient = {
      ...client,
      clientState: {
        ...client.clientState,
        queries: client.clientState.queries.filter((query) => {
          const ttl = getCacheTTL(query.queryKey);
          const age = now - (query.state.dataUpdatedAt || 0);

          const isValid = age < ttl;
          if (!isValid) {
            removedCount++;
          }

          return isValid;
        }),
      },
    };

    if (removedCount > 0) {
      await set(CACHE_KEY, filteredClient);
      console.log(`Cleaned up ${removedCount} stale queries from cache`);
    }
  } catch (error) {
    console.error("Failed to cleanup persisted cache:", error);
  }
}
