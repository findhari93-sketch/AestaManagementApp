/**
 * Tab Coordinator Module
 *
 * Implements leader election and cross-tab communication for multi-tab support.
 * Uses Web Locks API for leader election and BroadcastChannel for messaging.
 */

// Message types for cross-tab communication
export type TabMessage =
  | { type: "CACHE_INVALIDATE"; queryKeys: unknown[][] }
  | { type: "SITE_CHANGED"; siteId: string | null }
  | { type: "LEADER_PING"; tabId: string }
  | { type: "REALTIME_UPDATE"; table: string; payload: unknown };

export interface TabCoordinator {
  readonly tabId: string;
  readonly isLeader: boolean;
  broadcast: (message: TabMessage) => void;
  subscribe: (handler: (message: TabMessage) => void) => () => void;
  destroy: () => void;
}

// Constants
const LOCK_NAME = "aesta-leader-lock";
const CHANNEL_NAME = "aesta-tab-channel";

// Module-level singleton
let coordinatorInstance: TabCoordinatorImpl | null = null;
let initPromise: Promise<TabCoordinator> | null = null;

/**
 * Generate a unique tab ID
 */
function generateTabId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if Web Locks API is supported
 */
function supportsWebLocks(): boolean {
  return typeof navigator !== "undefined" && "locks" in navigator;
}

/**
 * Check if BroadcastChannel is supported
 */
function supportsBroadcastChannel(): boolean {
  return typeof BroadcastChannel !== "undefined";
}

/**
 * Tab Coordinator Implementation
 */
class TabCoordinatorImpl implements TabCoordinator {
  readonly tabId: string;
  private _isLeader: boolean = false;
  private channel: BroadcastChannel | null = null;
  private subscribers: Set<(message: TabMessage) => void> = new Set();
  private lockAbortController: AbortController | null = null;
  private destroyed: boolean = false;

  constructor() {
    this.tabId = generateTabId();
    this.initChannel();
  }

  get isLeader(): boolean {
    return this._isLeader;
  }

  /**
   * Initialize BroadcastChannel for cross-tab communication
   */
  private initChannel(): void {
    if (!supportsBroadcastChannel()) {
      console.warn("[TabCoordinator] BroadcastChannel not supported");
      return;
    }

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<TabMessage>) => {
        this.notifySubscribers(event.data);
      };
    } catch (error) {
      console.error("[TabCoordinator] Failed to create BroadcastChannel:", error);
    }
  }

  /**
   * Attempt to acquire leadership using Web Locks API
   */
  async acquireLeadership(): Promise<void> {
    if (!supportsWebLocks()) {
      // Fallback: If Web Locks not supported, every tab is a leader
      console.warn("[TabCoordinator] Web Locks API not supported, acting as leader");
      this._isLeader = true;
      return;
    }

    this.lockAbortController = new AbortController();

    try {
      // Request the leader lock - only one tab can hold it at a time
      // The lock is held until this tab closes or releases it
      await navigator.locks.request(
        LOCK_NAME,
        { mode: "exclusive", signal: this.lockAbortController.signal },
        async () => {
          // We got the lock - we are the leader!
          this._isLeader = true;
          console.log(`[TabCoordinator] Tab ${this.tabId} became leader`);

          // Hold the lock by returning a promise that never resolves
          // (until the tab is closed or we abort)
          return new Promise<void>((resolve) => {
            // Store resolve so we can release the lock on destroy
            const checkDestroyed = () => {
              if (this.destroyed) {
                resolve();
              } else {
                setTimeout(checkDestroyed, 1000);
              }
            };
            checkDestroyed();
          });
        }
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log(`[TabCoordinator] Tab ${this.tabId} leadership aborted`);
      } else {
        console.error("[TabCoordinator] Error acquiring leadership:", error);
      }
    }
  }

  /**
   * Broadcast a message to all other tabs
   */
  broadcast(message: TabMessage): void {
    if (this.channel && !this.destroyed) {
      try {
        this.channel.postMessage(message);
      } catch (error) {
        console.error("[TabCoordinator] Failed to broadcast message:", error);
      }
    }
  }

  /**
   * Subscribe to messages from other tabs
   */
  subscribe(handler: (message: TabMessage) => void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /**
   * Notify all subscribers of a message
   * Uses queueMicrotask to avoid blocking the main thread and prevent
   * "[Violation] 'message' handler took Xms" warnings
   */
  private notifySubscribers(message: TabMessage): void {
    // Defer notifications to avoid blocking the message event handler
    queueMicrotask(() => {
      this.subscribers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error("[TabCoordinator] Subscriber error:", error);
        }
      });
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.destroyed = true;
    this._isLeader = false;

    // Abort the lock request
    if (this.lockAbortController) {
      this.lockAbortController.abort();
      this.lockAbortController = null;
    }

    // Close the channel
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    this.subscribers.clear();
    console.log(`[TabCoordinator] Tab ${this.tabId} coordinator destroyed`);
  }
}

/**
 * Initialize and get the tab coordinator singleton
 * Returns a promise that resolves once leader election is complete
 */
export async function initTabCoordinator(): Promise<TabCoordinator> {
  // Only run in browser
  if (typeof window === "undefined") {
    // Return a no-op coordinator for SSR
    return {
      tabId: "server",
      isLeader: false,
      broadcast: () => {},
      subscribe: () => () => {},
      destroy: () => {},
    };
  }

  // Return existing initialization if in progress
  if (initPromise) {
    return initPromise;
  }

  // Return existing instance if already initialized
  if (coordinatorInstance) {
    return coordinatorInstance;
  }

  // Create initialization promise
  initPromise = (async () => {
    coordinatorInstance = new TabCoordinatorImpl();

    // Start leader election (don't await - it runs until tab closes)
    // We just need to give it a moment to try to acquire the lock
    const leadershipPromise = coordinatorInstance.acquireLeadership();

    // Wait a short time for initial leader election attempt
    // If we get the lock quickly, we'll know we're the leader
    // Reduced to 50ms to minimize startup latency
    await Promise.race([
      leadershipPromise,
      new Promise((resolve) => setTimeout(resolve, 50)),
    ]);

    return coordinatorInstance;
  })();

  return initPromise;
}

/**
 * Get the current tab coordinator (synchronous)
 * Returns null if not yet initialized
 */
export function getTabCoordinator(): TabCoordinator | null {
  if (typeof window === "undefined") {
    return null;
  }
  return coordinatorInstance;
}

/**
 * Cleanup the tab coordinator (call on app unmount)
 */
export function destroyTabCoordinator(): void {
  if (coordinatorInstance) {
    coordinatorInstance.destroy();
    coordinatorInstance = null;
    initPromise = null;
  }
}
