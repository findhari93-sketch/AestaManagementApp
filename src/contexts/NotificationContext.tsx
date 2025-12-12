"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthContext";
import { useRouter } from "next/navigation";
import { useSite } from "./SiteContext";

// Notification type from database
export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
  related_id: string | null; // site_id for attendance reminders
  related_table: string | null; // "sites" for attendance reminders
  expires_at: string | null;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  handleNotificationClick: (notification: Notification) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { setSelectedSite, sites } = useSite();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userProfile?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userProfile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id, supabase]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!userProfile?.id) return;

    fetchNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel(`notifications:${userProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userProfile.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userProfile.id}`,
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === updatedNotification.id ? updatedNotification : n
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id, supabase, fetchNotifications]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("id", id);

        if (error) throw error;

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    },
    [supabase]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.id) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", userProfile.id)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  }, [userProfile?.id, supabase]);

  // Handle notification click - navigate to relevant page
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // Mark as read
      markAsRead(notification.id);

      // If it's an attendance reminder, navigate to attendance page
      if (
        notification.notification_type === "attendance_reminder" &&
        notification.related_id &&
        notification.related_table === "sites"
      ) {
        // Find the site and set it as selected
        const site = sites.find((s) => s.id === notification.related_id);
        if (site) {
          setSelectedSite(site);
        }
        // Navigate to attendance page with autoOpen param
        router.push(`/site/attendance?autoOpen=true`);
      } else if (notification.action_url) {
        // Use the action URL if provided
        router.push(notification.action_url);
      }
    },
    [markAsRead, sites, setSelectedSite, router]
  );

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    await fetchNotifications();
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        handleNotificationClick,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
}
