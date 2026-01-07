/**
 * Sync Status Hook
 *
 * Provides sync status information and manual refresh capability.
 * Tracks last sync time and shows user-friendly status.
 */

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { manualRefresh, getLastSyncTime, getSyncOrchestrator } from "@/lib/cache/sync";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface RefreshResult {
  success: boolean;
  message: string;
}

export interface SyncStatusInfo {
  status: SyncStatus;
  lastSyncTime: number | null;
  lastSyncTimeFormatted: string | null;
  timeSinceLastSync: string | null;
  refresh: () => Promise<RefreshResult>;
  isRefreshing: boolean;
  isReady: boolean; // Whether sync orchestrator is initialized
}

/**
 * Hook to track and display sync status
 */
export function useSyncStatus(): SyncStatusInfo {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Check if sync orchestrator is ready
  useEffect(() => {
    const checkReady = () => {
      const orchestrator = getSyncOrchestrator();
      const ready = orchestrator !== null;
      setIsReady(ready);
      return ready;
    };

    // Check immediately
    if (checkReady()) {
      return; // Already ready, no need to poll
    }

    // Poll until ready (for initial app load), then stop
    const interval = setInterval(() => {
      if (checkReady()) {
        clearInterval(interval); // Stop polling once ready
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Update current time every second to refresh "time ago" display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load last sync time on mount and listen for updates
  useEffect(() => {
    const updateSyncTime = () => {
      const syncTime = getLastSyncTime();
      setLastSyncTime(syncTime);
    };

    // Initial load
    updateSyncTime();

    // Listen for storage events (sync from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sync_last") {
        updateSyncTime();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Poll for updates every 5 seconds
    const interval = setInterval(updateSyncTime, 5000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Monitor query fetching status
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === "observerResultsUpdated") {
        // Check if any query is fetching
        const isFetching = queryClient.isFetching() > 0;

        // Defer state update to avoid "Cannot update component while rendering" error
        queueMicrotask(() => {
          if (isFetching) {
            setStatus("syncing");
          } else {
            setStatus("idle");
          }
        });
      }
    });

    return unsubscribe;
  }, [queryClient]);

  /**
   * Manual refresh handler
   * Returns result with success status and user-friendly message
   */
  const refresh = useCallback(async (): Promise<RefreshResult> => {
    // Check if orchestrator is ready
    if (!isReady) {
      return {
        success: false,
        message: "App is still loading. Please wait a moment and try again.",
      };
    }

    setIsRefreshing(true);
    setStatus("syncing");

    try {
      const success = await manualRefresh();

      if (success) {
        setLastSyncTime(Date.now());
        setStatus("success");

        // Reset to idle after 2 seconds
        setTimeout(() => {
          setStatus("idle");
        }, 2000);

        return {
          success: true,
          message: "Data refreshed successfully",
        };
      } else {
        // Refresh ran but some operations failed
        console.warn("Refresh completed with some failures");
        setStatus("error");

        // Reset to idle after 3 seconds
        setTimeout(() => {
          setStatus("idle");
        }, 3000);

        return {
          success: false,
          message: "Some data could not be refreshed. Please try again.",
        };
      }
    } catch (error: any) {
      // Orchestrator not initialized or critical failure
      console.error("Manual refresh failed:", error);
      setStatus("error");

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 3000);

      return {
        success: false,
        message: error.message || "Refresh failed. Please try again.",
      };
    } finally {
      setIsRefreshing(false);
    }
  }, [isReady]);

  /**
   * Format last sync time
   */
  const lastSyncTimeFormatted = lastSyncTime
    ? formatDateTime(new Date(lastSyncTime))
    : null;

  /**
   * Calculate time since last sync
   */
  const timeSinceLastSync = lastSyncTime
    ? formatTimeAgo(currentTime - lastSyncTime)
    : null;

  return {
    status,
    lastSyncTime,
    lastSyncTimeFormatted,
    timeSinceLastSync,
    refresh,
    isRefreshing,
    isReady,
  };
}

/**
 * Format date and time for display
 */
function formatDateTime(date: Date): string {
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${dateStr} at ${timeStr}`;
}

/**
 * Format milliseconds to human-readable "time ago"
 */
function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 10) {
    return "just now";
  } else if (seconds < 60) {
    return `${seconds}s ago`;
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return `${days}d ago`;
  }
}
