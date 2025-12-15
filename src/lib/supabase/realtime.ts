/**
 * Supabase Realtime subscriptions for critical data
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
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log(`Realtime subscribed: attendance for site ${siteId}`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`Realtime subscription failed for attendance: ${status}`, err);
      }
    });

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
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log(`Realtime subscribed: client_payments for site ${siteId}`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`Realtime subscription failed for client_payments: ${status}`, err);
      }
    });
}

/**
 * Stop all realtime listeners
 * Uses the same client instance that created the subscriptions
 */
export function stopRealtimeListeners() {
  try {
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
  } catch (error) {
    console.error("Failed to stop realtime listeners", error);
  }
}
