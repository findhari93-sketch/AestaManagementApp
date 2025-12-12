// Service Worker for Push Notifications
// This is a minimal service worker for handling push notifications only

const CACHE_NAME = "aesta-notifications-v1";

// Install event - minimal setup
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker for push notifications");
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker");
  event.waitUntil(clients.claim());
});

// Push notification event
self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event);

  let data = {
    title: "Aesta Notification",
    message: "You have a new notification",
    action_url: "/",
    notification_id: null,
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error("[SW] Error parsing push data:", e);
      data.message = event.data.text();
    }
  }

  const options = {
    body: data.message,
    icon: "/favicon.png",
    badge: "/favicon.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.action_url || "/",
      notification_id: data.notification_id,
    },
    tag: data.notification_id || "default",
    renotify: true,
    requireInteraction: true,
    actions: [
      {
        action: "open",
        title: "Open",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Check if there is already a window open with the target URL
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }

        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification close event
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed");
});

// Message event for communication with the main app
self.addEventListener("message", (event) => {
  console.log("[SW] Message received:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
