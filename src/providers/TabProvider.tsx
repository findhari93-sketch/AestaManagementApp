"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  TabCoordinator,
  TabMessage,
  initTabCoordinator,
  destroyTabCoordinator,
} from "@/lib/tab/coordinator";

interface TabContextValue {
  /** Unique identifier for this tab */
  tabId: string;
  /** Whether this tab is the leader (handles sync, writes, subscriptions) */
  isLeader: boolean;
  /** Whether tab coordination is ready (leader election complete) */
  isReady: boolean;
  /** Broadcast a message to other tabs (only effective if leader) */
  broadcast: (message: TabMessage) => void;
  /** Subscribe to messages from other tabs */
  subscribe: (handler: (message: TabMessage) => void) => () => void;
}

const TabContext = createContext<TabContextValue | null>(null);

/**
 * Provider for tab coordination context
 * Handles leader election and cross-tab communication
 */
export function TabProvider({ children }: { children: React.ReactNode }) {
  const [coordinator, setCoordinator] = useState<TabCoordinator | null>(null);
  const [isReady, setIsReady] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Initialize the tab coordinator
    initTabCoordinator().then((coord) => {
      if (mountedRef.current) {
        setCoordinator(coord);
        setIsReady(true);
        console.log(
          `[TabProvider] Initialized - tabId: ${coord.tabId}, isLeader: ${coord.isLeader}`
        );
      }
    });

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      destroyTabCoordinator();
    };
  }, []);

  // Memoized broadcast function
  const broadcast = useCallback(
    (message: TabMessage) => {
      coordinator?.broadcast(message);
    },
    [coordinator]
  );

  // Memoized subscribe function
  const subscribe = useCallback(
    (handler: (message: TabMessage) => void) => {
      if (coordinator) {
        return coordinator.subscribe(handler);
      }
      return () => {};
    },
    [coordinator]
  );

  const value: TabContextValue = {
    tabId: coordinator?.tabId ?? "initializing",
    isLeader: coordinator?.isLeader ?? false,
    isReady,
    broadcast,
    subscribe,
  };

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

/**
 * Hook to access tab coordination context
 */
export function useTab(): TabContextValue {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTab must be used within a TabProvider");
  }
  return context;
}

/**
 * Hook to check if this tab is the leader
 * Returns false during initialization
 */
export function useIsLeader(): boolean {
  const { isLeader, isReady } = useTab();
  return isReady && isLeader;
}

/**
 * Hook to subscribe to tab messages
 */
export function useTabMessages(handler: (message: TabMessage) => void): void {
  const { subscribe, isReady } = useTab();

  useEffect(() => {
    if (!isReady) return;
    return subscribe(handler);
  }, [subscribe, handler, isReady]);
}
