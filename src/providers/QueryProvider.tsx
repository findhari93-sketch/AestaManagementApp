"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, useEffect } from "react";
import { createIDBPersister } from "@/lib/cache/persistor";
import { initBackgroundSync, stopBackgroundSync } from "@/lib/cache/sync";
import {
  startRealtimeListeners,
  stopRealtimeListeners,
} from "@/lib/supabase/realtime";
import { useSite } from "@/contexts/SiteContext";

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1 * 60 * 1000, // 1 minute - data considered fresh
            gcTime: 30 * 60 * 1000, // 30 minutes - cache garbage collection
            retry: 3, // Retry failed requests 3 times for better reliability
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
            refetchOnWindowFocus: true, // Refetch when tab regains focus
            refetchOnReconnect: true, // Refetch when network reconnects
            networkMode: "online", // Only fetch when online
          },
          mutations: {
            retry: 1,
            networkMode: "online",
          },
        },
      })
  );

  const [persister] = useState(() => createIDBPersister());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours max age for persisted data
        buster: "v1", // Change this to invalidate all persisted cache
      }}
    >
      <SyncInitializer queryClient={queryClient} />
      {children}
    </PersistQueryClientProvider>
  );
}

/**
 * Component to initialize background sync
 * Separated to access SiteContext
 */
function SyncInitializer({ queryClient }: { queryClient: QueryClient }) {
  const { selectedSite } = useSite();

  useEffect(() => {
    // Initialize background sync on mount
    initBackgroundSync(queryClient, selectedSite?.id);
    startRealtimeListeners(queryClient, selectedSite?.id);

    // Cleanup on unmount
    return () => {
      stopBackgroundSync();
      stopRealtimeListeners();
    };
  }, [queryClient, selectedSite?.id]);

  return null;
}
