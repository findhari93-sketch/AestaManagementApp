/**
 * Supabase Realtime subscriptions for critical data
 * With automatic retry on connection failures
 */

import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";

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
 */
export function startRealtimeListeners(
  queryClient: QueryClient,
  siteId?: string
) {
  // Don't restart if same site
  if (siteId === currentSiteId && attendanceChannel && clientPaymentsChannel) {
    return;
  }

  // Clean up existing subscriptions first
  stopRealtimeListeners();

  if (!siteId) return;

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
        queryClient.invalidateQueries({
          queryKey: queryKeys.clientPayments.pending(siteId),
          refetchType: "active",
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.clientPayments.bySite(siteId),
          refetchType: "active",
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
