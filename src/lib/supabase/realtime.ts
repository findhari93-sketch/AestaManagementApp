/**
 * Supabase Realtime subscriptions for critical data
 */

import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";

let attendanceChannel: ReturnType<
  ReturnType<typeof createClient>["channel"]
> | null = null;
let clientPaymentsChannel: ReturnType<
  ReturnType<typeof createClient>["channel"]
> | null = null;

/**
 * Start realtime listeners for the given site
 */
export function startRealtimeListeners(
  queryClient: QueryClient,
  siteId?: string
) {
  stopRealtimeListeners();

  if (!siteId) return;

  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  // Attendance updates for today
  attendanceChannel = supabase
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
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`Realtime subscribed: attendance for site ${siteId}`);
      }
    });

  // Pending client payments updates
  clientPaymentsChannel = supabase
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
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`Realtime subscribed: client_payments for site ${siteId}`);
      }
    });
}

/**
 * Stop all realtime listeners
 */
export function stopRealtimeListeners() {
  try {
    if (attendanceChannel) {
      createClient().removeChannel(attendanceChannel);
      attendanceChannel = null;
    }
    if (clientPaymentsChannel) {
      createClient().removeChannel(clientPaymentsChannel);
      clientPaymentsChannel = null;
    }
  } catch (error) {
    console.error("Failed to stop realtime listeners", error);
  }
}
