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

const CACHE_VERSION = 1;
const CACHE_KEY = `aesta-query-cache-v${CACHE_VERSION}`;
const MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days max retention

/**
 * Create an IndexedDB persister with automatic cleanup
 */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
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
      // Add timeout to prevent hanging if IndexedDB is slow/locked
      const RESTORE_TIMEOUT = 3000; // 3 seconds max

      const restorePromise = (async () => {
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
          console.error("Failed to restore query cache:", error);
          return undefined;
        }
      })();

      // Race between restore and timeout
      const timeoutPromise = new Promise<undefined>((resolve) => {
        setTimeout(() => {
          console.warn("Cache restoration timed out, starting fresh");
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
