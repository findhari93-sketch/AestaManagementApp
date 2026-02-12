/**
 * Supabase Realtime subscriptions for critical data
 * With automatic retry on connection failures
 *
 * Multi-tab support: Only the leader tab maintains Supabase realtime connections.
 * Followers receive updates via BroadcastChannel.
 *
 * Supports multiple table subscriptions with configurable invalidation patterns.
 */

import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import { getTabCoordinator, TabMessage } from "@/lib/tab/coordinator";

// ============================================
// TYPES
// ============================================

type ChannelType = ReturnType<ReturnType<typeof createClient>["channel"]>;

interface RealtimeChannelConfig {
  name: string;
  table: string;
  filterColumn?: string; // Default is site_id
  getInvalidationKeys: (siteId: string) => unknown[][];
}

interface ChannelState {
  channel: ChannelType | null;
  retryCount: number;
}

// ============================================
// CONFIGURATION
// ============================================

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const INVALIDATION_DEBOUNCE = 100; // 100ms debounce for rapid updates

/**
 * Channel configurations for all realtime-enabled tables
 */
const REALTIME_CHANNELS: RealtimeChannelConfig[] = [
  // Tier 0: Existing channels (attendance & client payments)
  {
    name: "attendance",
    table: "daily_attendance",
    getInvalidationKeys: (siteId) => [
      [...queryKeys.attendance.today(siteId)],
      [...queryKeys.attendance.active(siteId)],
      [...queryKeys.attendance.byDate(siteId, new Date().toISOString().split("T")[0])],
    ],
  },
  {
    name: "client-payments",
    table: "client_payments",
    getInvalidationKeys: (siteId) => [
      [...queryKeys.clientPayments.pending(siteId)],
      [...queryKeys.clientPayments.bySite(siteId)],
    ],
  },
  // Tier 1: Material requests and purchase orders
  {
    name: "material-requests",
    table: "material_requests",
    getInvalidationKeys: (siteId) => [
      [...queryKeys.materialRequests.bySite(siteId)],
      [...queryKeys.materialRequests.pending(siteId)],
      [...queryKeys.materialRequests.all],
    ],
  },
  {
    name: "purchase-orders",
    table: "purchase_orders",
    getInvalidationKeys: (siteId) => [
      [...queryKeys.purchaseOrders.bySite(siteId)],
      [...queryKeys.purchaseOrders.pending(siteId)],
      [...queryKeys.purchaseOrders.all],
    ],
  },
  // Tier 1: Stock inventory
  {
    name: "stock-inventory",
    table: "stock_inventory",
    getInvalidationKeys: (siteId) => [
      [...queryKeys.materialStock.bySite(siteId)],
      [...queryKeys.materialStock.lowStock(siteId)],
    ],
  },
  // Tier 1: Daily material usage
  {
    name: "material-usage",
    table: "daily_material_usage",
    getInvalidationKeys: (siteId) => [
      [...queryKeys.materialUsage.bySite(siteId)],
      [...queryKeys.materialUsage.byDate(siteId, new Date().toISOString().split("T")[0])],
    ],
  },
];

// ============================================
// STATE
// ============================================

let supabaseClient: ReturnType<typeof createClient> | null = null;
let currentSiteId: string | null = null;
let tabMessageUnsubscribe: (() => void) | null = null;
let retryTimeouts: NodeJS.Timeout[] = [];

// Channel states - map of channel name to state
const channelStates: Map<string, ChannelState> = new Map();

// Debounce timers for invalidation
const invalidationTimers: Map<string, NodeJS.Timeout> = new Map();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Debounced invalidation to prevent rapid-fire query refetches
 */
function debouncedInvalidate(
  queryClient: QueryClient,
  keys: readonly unknown[][],
  tableName: string
) {
  // Clear existing timer for this table
  const existingTimer = invalidationTimers.get(tableName);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new debounced timer
  const timer = setTimeout(() => {
    keys.forEach((key) => {
      queryClient.invalidateQueries({
        queryKey: key as unknown[],
        refetchType: "active",
      });
    });
    invalidationTimers.delete(tableName);
  }, INVALIDATION_DEBOUNCE);

  invalidationTimers.set(tableName, timer);
}

/**
 * Subscribe to a channel with retry logic
 */
function subscribeWithRetry(
  channel: ChannelType,
  channelName: string,
  state: ChannelState,
  onSuccess: () => void
) {
  channel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      console.log(`[Realtime] Subscribed: ${channelName}`);
      state.retryCount = 0; // Reset retry count on success
      onSuccess();
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      if (state.retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, state.retryCount);
        console.warn(
          `[Realtime] ${channelName} ${status}, retrying in ${delay}ms (attempt ${state.retryCount + 1}/${MAX_RETRIES})`
        );
        state.retryCount++;

        const timeoutId = setTimeout(() => {
          channel.unsubscribe();
          subscribeWithRetry(channel, channelName, state, onSuccess);
        }, delay);

        retryTimeouts.push(timeoutId);
      } else {
        console.error(
          `[Realtime] Subscription failed for ${channelName} after ${MAX_RETRIES} retries:`,
          status,
          err
        );
      }
    }
  });
}

/**
 * Create a realtime channel for a table configuration
 */
function createChannel(
  config: RealtimeChannelConfig,
  siteId: string,
  queryClient: QueryClient,
  coordinator: ReturnType<typeof getTabCoordinator>
): ChannelType | null {
  if (!supabaseClient) return null;

  const filterColumn = config.filterColumn || "site_id";
  const channelId = `${config.name}-${siteId}`;

  const channel = supabaseClient
    .channel(channelId)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: config.table,
        filter: `${filterColumn}=eq.${siteId}`,
      },
      () => {
        // Get invalidation keys
        const keys = config.getInvalidationKeys(siteId);

        // Debounced invalidation for local queries
        debouncedInvalidate(queryClient, keys, config.table);

        // Broadcast to follower tabs
        coordinator?.broadcast({
          type: "REALTIME_UPDATE",
          table: config.table,
          payload: null,
        });
      }
    );

  return channel;
}

/**
 * Handle follower tab realtime updates
 */
function handleFollowerUpdate(
  message: TabMessage,
  queryClient: QueryClient,
  siteId: string
) {
  if (message.type !== "REALTIME_UPDATE") return;

  const { table } = message;

  // Find matching channel config
  const config = REALTIME_CHANNELS.find((c) => c.table === table);
  if (config) {
    const keys = config.getInvalidationKeys(siteId);
    debouncedInvalidate(queryClient, keys, table);
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Start realtime listeners for the given site
 * Only leader tab creates Supabase realtime connections.
 * Followers receive updates via BroadcastChannel.
 */
export function startRealtimeListeners(
  queryClient: QueryClient,
  siteId?: string
) {
  const coordinator = getTabCoordinator();

  // Clean up existing tab message subscription
  if (tabMessageUnsubscribe) {
    tabMessageUnsubscribe();
    tabMessageUnsubscribe = null;
  }

  // Don't restart if same site and channels exist
  if (siteId === currentSiteId && channelStates.size > 0) {
    return;
  }

  // Clean up existing subscriptions first
  stopRealtimeListeners();

  if (!siteId) return;

  // Check if this tab is a follower
  if (coordinator && !coordinator.isLeader) {
    console.log("[Realtime] Follower tab - listening for broadcasts only");

    tabMessageUnsubscribe = coordinator.subscribe((message: TabMessage) => {
      if (message.type === "REALTIME_UPDATE") {
        handleFollowerUpdate(message, queryClient, siteId);
      } else if (message.type === "CACHE_INVALIDATE" && message.queryKeys) {
        message.queryKeys.forEach((queryKey) => {
          queryClient.invalidateQueries({
            queryKey: queryKey as unknown[],
            refetchType: "active",
          });
        });
      }
    });

    currentSiteId = siteId;
    return;
  }

  // Leader tab: Create Supabase realtime connections
  console.log(`[Realtime] Leader tab - creating ${REALTIME_CHANNELS.length} channels for site ${siteId}`);

  supabaseClient = createClient();
  currentSiteId = siteId;

  // Create channels for all configured tables
  for (const config of REALTIME_CHANNELS) {
    const state: ChannelState = {
      channel: null,
      retryCount: 0,
    };

    const channel = createChannel(config, siteId, queryClient, coordinator);
    if (channel) {
      state.channel = channel;
      channelStates.set(config.name, state);

      subscribeWithRetry(
        channel,
        `${config.name} for site ${siteId}`,
        state,
        () => {}
      );
    }
  }
}

/**
 * Stop all realtime listeners
 * Uses the same client instance that created the subscriptions
 */
export function stopRealtimeListeners() {
  try {
    // Clean up tab message subscription for follower tabs
    if (tabMessageUnsubscribe) {
      tabMessageUnsubscribe();
      tabMessageUnsubscribe = null;
    }

    // Clear any pending retry timeouts
    retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    retryTimeouts = [];

    // Clear any pending invalidation timers
    invalidationTimers.forEach((timer) => clearTimeout(timer));
    invalidationTimers.clear();

    // Remove all channels
    if (supabaseClient) {
      channelStates.forEach((state) => {
        if (state.channel) {
          supabaseClient!.removeChannel(state.channel);
        }
      });
    }

    // Clear stored references
    channelStates.clear();
    supabaseClient = null;
    currentSiteId = null;
  } catch (error) {
    console.error("[Realtime] Failed to stop listeners:", error);
  }
}

/**
 * Get the current realtime status
 */
export function getRealtimeStatus() {
  return {
    isConnected: channelStates.size > 0,
    siteId: currentSiteId,
    channelCount: channelStates.size,
    channels: Array.from(channelStates.keys()),
  };
}
