/**
 * Sync Status Hook
 *
 * Provides sync status information and manual refresh capability.
 * Tracks last sync time and shows user-friendly status.
 */

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { manualRefresh, getLastSyncTime } from "@/lib/cache/sync";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface SyncStatusInfo {
  status: SyncStatus;
  lastSyncTime: number | null;
  lastSyncTimeFormatted: string | null;
  timeSinceLastSync: string | null;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

/**
 * Hook to track and display sync status
 */
export function useSyncStatus(): SyncStatusInfo {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

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

        if (isFetching) {
          setStatus("syncing");
        } else {
          setStatus("idle");
        }
      }
    });

    return unsubscribe;
  }, [queryClient]);

  /**
   * Manual refresh handler
   */
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setStatus("syncing");

    try {
      await manualRefresh();
      setLastSyncTime(Date.now());
      setStatus("success");

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Manual refresh failed:", error);
      setStatus("error");

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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
