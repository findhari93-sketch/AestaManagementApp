"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// VAPID public key - this should be set in environment variables
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

interface PushNotificationState {
  permission: NotificationPermission | "unsupported";
  subscription: PushSubscription | null;
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotifications() {
  const { userProfile } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    permission: "default",
    subscription: null,
    isSupported: false,
    isLoading: true,
    error: null,
  });

  const supabase = createClient();

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    if (typeof window === "undefined") return false;
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }, []);

  // Get current subscription
  const getSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.pushManager.getSubscription();
    } catch (err) {
      console.error("Error getting subscription:", err);
      return null;
    }
  }, []);

  // Save subscription to database
  const saveSubscription = useCallback(
    async (subscription: PushSubscription) => {
      if (!userProfile?.id) return;

      const subscriptionJson = subscription.toJSON();

      try {
        const { error } = await supabase.from("push_subscriptions").upsert(
          {
            user_id: userProfile.id,
            endpoint: subscription.endpoint,
            p256dh_key: subscriptionJson.keys?.p256dh || "",
            auth_key: subscriptionJson.keys?.auth || "",
            user_agent: navigator.userAgent,
            is_active: true,
            last_used_at: new Date().toISOString(),
          },
          {
            onConflict: "endpoint",
          }
        );

        if (error) throw error;
        console.log("Push subscription saved to database");
      } catch (err) {
        console.error("Error saving subscription:", err);
        throw err;
      }
    },
    [userProfile?.id, supabase]
  );

  // Remove subscription from database
  const removeSubscription = useCallback(
    async (endpoint: string) => {
      if (!userProfile?.id) return;

      try {
        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);

        if (error) throw error;
        console.log("Push subscription removed from database");
      } catch (err) {
        console.error("Error removing subscription:", err);
      }
    },
    [userProfile?.id, supabase]
  );

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!VAPID_PUBLIC_KEY) {
      console.warn("VAPID public key not configured");
      setState((prev) => ({
        ...prev,
        error: "Push notifications not configured",
      }));
      return null;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save to database
      await saveSubscription(subscription);

      setState((prev) => ({
        ...prev,
        subscription,
        permission: Notification.permission,
        isLoading: false,
      }));

      return subscription;
    } catch (err) {
      console.error("Error subscribing to push:", err);
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to subscribe",
        isLoading: false,
      }));
      return null;
    }
  }, [saveSubscription]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const subscription = await getSubscription();
      if (subscription) {
        await removeSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setState((prev) => ({
        ...prev,
        subscription: null,
        isLoading: false,
      }));
    } catch (err) {
      console.error("Error unsubscribing:", err);
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to unsubscribe",
        isLoading: false,
      }));
    }
  }, [getSubscription, removeSubscription]);

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const result = await Notification.requestPermission();

      setState((prev) => ({
        ...prev,
        permission: result,
      }));

      if (result === "granted") {
        await subscribe();
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result === "denied" ? "Notifications blocked" : null,
        }));
      }
    } catch (err) {
      console.error("Error requesting permission:", err);
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to request permission",
        isLoading: false,
      }));
    }
  }, [subscribe]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const isSupported = checkSupport();

      if (!isSupported) {
        setState((prev) => ({
          ...prev,
          isSupported: false,
          permission: "unsupported",
          isLoading: false,
        }));
        return;
      }

      // Register service worker
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.error("Service worker registration failed:", err);
      }

      const permission = Notification.permission;
      const subscription = await getSubscription();

      setState({
        permission,
        subscription,
        isSupported: true,
        isLoading: false,
        error: null,
      });

      // If we have permission and user is logged in, make sure we have a valid subscription
      if (permission === "granted" && userProfile?.id && !subscription && VAPID_PUBLIC_KEY) {
        // Auto-resubscribe if permission was already granted
        subscribe();
      }
    };

    init();
  }, [checkSupport, getSubscription, userProfile?.id, subscribe]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}
