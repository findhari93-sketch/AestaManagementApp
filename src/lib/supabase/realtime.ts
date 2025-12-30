/**
 * Supabase Realtime subscriptions for critical data
 * With automatic retry on connection failures
 *
 * Multi-tab support: Only the leader tab maintains Supabase realtime connections.
 * Followers receive updates via BroadcastChannel.
 */

import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import { getTabCoordinator, TabMessage } from "@/lib/tab/coordinator";

// Store the client instance used for subscriptions to ensure proper cleanup
let supabaseClient: ReturnType<typeof createClient> | null = null;
let attendanceChannel: ReturnType<
  ReturnType<typeof createClient>["channel"]
> | null = null;
let clientPaymentsChannel: ReturnType<
  ReturnType<typeof createClient>["channel"]
> | null = null;
let currentSiteId: string | null = null;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds

// Track retry state
let attendanceRetryCount = 0;
let clientPaymentsRetryCount = 0;
let retryTimeouts: NodeJS.Timeout[] = [];

// Tab message subscription for follower tabs
let tabMessageUnsubscribe: (() => void) | null = null;

/**
 * Subscribe to a channel with retry logic
 */
function subscribeWithRetry(
  channel: ReturnType<ReturnType<typeof createClient>["channel"]>,
  channelName: string,
  retryCountRef: { count: number },
  onSuccess: () => void
) {
  channel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      console.log(`Realtime subscribed: ${channelName}`);
      retryCountRef.count = 0; // Reset retry count on success
      onSuccess();
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      if (retryCountRef.count < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.count);
        console.warn(
          `Realtime ${channelName} ${status}, retrying in ${delay}ms (attempt ${retryCountRef.count + 1}/${MAX_RETRIES})`
        );
        retryCountRef.count++;

        const timeoutId = setTimeout(() => {
          // Unsubscribe and resubscribe
          channel.unsubscribe();
          subscribeWithRetry(channel, channelName, retryCountRef, onSuccess);
        }, delay);

        retryTimeouts.push(timeoutId);
      } else {
        console.error(
          `Realtime subscription failed for ${channelName} after ${MAX_RETRIES} retries:`,
          status,
          err
        );
      }
    }
  });
}

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

  // Don't restart if same site (for leader tabs)
  if (siteId === currentSiteId && attendanceChannel && clientPaymentsChannel) {
    return;
  }

  // Clean up existing subscriptions first
  stopRealtimeListeners();

  if (!siteId) return;

  // Check if this tab is a follower
  if (coordinator && !coordinator.isLeader) {
    // Follower tab: Listen for realtime updates via BroadcastChannel
    console.log("[Realtime] Not leader tab - listening for broadcasts only");

    tabMessageUnsubscribe = coordinator.subscribe((message: TabMessage) => {
      if (message.type === "REALTIME_UPDATE") {
        // Handle realtime updates from leader
        const { table, payload } = message;
        if (table === "daily_attendance") {
          queryClient.invalidateQueries({
            queryKey: queryKeys.attendance.today(siteId),
            refetchType: "active",
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.attendance.active(siteId),
            refetchType: "active",
          });
        } else if (table === "client_payments") {
          queryClient.invalidateQueries({
            queryKey: queryKeys.clientPayments.pending(siteId),
            refetchType: "active",
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.clientPayments.bySite(siteId),
            refetchType: "active",
          });
        }
      } else if (message.type === "CACHE_INVALIDATE" && message.queryKeys) {
        // Handle cache invalidation from leader
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
  console.log("[Realtime] Leader tab - creating Supabase connections");

  // Create and store client for later cleanup
  supabaseClient = createClient();
  currentSiteId = siteId;
  const today = new Date().toISOString().split("T")[0];

  // Reset retry counts
  attendanceRetryCount = 0;
  clientPaymentsRetryCount = 0;

  // Attendance updates for today
  attendanceChannel = supabaseClient
    .channel(`attendance-${siteId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "daily_attendance",
        filter: `site_id=eq.${siteId}`,
      },
      () => {
        // Invalidate local queries
        queryClient.invalidateQueries({
          queryKey: queryKeys.attendance.today(siteId),
          refetchType: "active",
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.attendance.byDate(siteId, today),
          refetchType: "active",
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.attendance.active(siteId),
          refetchType: "active",
        });

        // Broadcast to follower tabs
        coordinator?.broadcast({
          type: "REALTIME_UPDATE",
          table: "daily_attendance",
          payload: null,
        });
      }
    );

  subscribeWithRetry(
    attendanceChannel,
    `attendance for site ${siteId}`,
    { count: attendanceRetryCount },
    () => {}
  );

  // Pending client payments updates
  clientPaymentsChannel = supabaseClient
    .channel(`client-payments-${siteId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "client_payments",
        filter: `site_id=eq.${siteId}`,
      },
      () => {
        // Invalidate local queries
        queryClient.invalidateQueries({
          queryKey: queryKeys.clientPayments.pending(siteId),
          refetchType: "active",
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.clientPayments.bySite(siteId),
          refetchType: "active",
        });

        // Broadcast to follower tabs
        coordinator?.broadcast({
          type: "REALTIME_UPDATE",
          table: "client_payments",
          payload: null,
        });
      }
    );

  subscribeWithRetry(
    clientPaymentsChannel,
    `client_payments for site ${siteId}`,
    { count: clientPaymentsRetryCount },
    () => {}
  );
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

    // Use the same client that created the subscriptions for proper cleanup
    if (supabaseClient) {
      if (attendanceChannel) {
        supabaseClient.removeChannel(attendanceChannel);
        attendanceChannel = null;
      }
      if (clientPaymentsChannel) {
        supabaseClient.removeChannel(clientPaymentsChannel);
        clientPaymentsChannel = null;
      }
    }
    // Clear stored references
    supabaseClient = null;
    currentSiteId = null;
    attendanceRetryCount = 0;
    clientPaymentsRetryCount = 0;
  } catch (error) {
    console.error("Failed to stop realtime listeners", error);
  }
}
