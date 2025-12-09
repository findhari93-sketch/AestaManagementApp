import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceUser {
  id: string;
  name: string;
  joinedAt: string;
}

interface UsePresenceOptions {
  channelName: string;
  enabled?: boolean;
}

interface UsePresenceReturn {
  activeUsers: PresenceUser[];
  isConnected: boolean;
  error: string | null;
}

export function usePresence({
  channelName,
  enabled = true,
}: UsePresenceOptions): UsePresenceReturn {
  const { user, userProfile } = useAuth();
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !user || !userProfile) {
      return;
    }

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    const setupPresence = async () => {
      try {
        // Create a unique channel for this page/resource
        channel = supabase.channel(`presence:${channelName}`, {
          config: {
            presence: {
              key: user.id,
            },
          },
        });

        // Handle presence sync (when we receive the full state)
        channel.on("presence", { event: "sync" }, () => {
          const state = channel?.presenceState() || {};
          const users: PresenceUser[] = [];

          Object.entries(state).forEach(([key, presences]) => {
            // Filter out current user and get the first presence for each key
            if (key !== user.id && presences.length > 0) {
              const presence = presences[0] as unknown as {
                user_id: string;
                user_name: string;
                joined_at: string;
              };
              users.push({
                id: presence.user_id,
                name: presence.user_name,
                joinedAt: presence.joined_at,
              });
            }
          });

          setActiveUsers(users);
        });

        // Handle when users join
        channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
          if (key !== user.id && newPresences.length > 0) {
            const presence = newPresences[0] as unknown as {
              user_id: string;
              user_name: string;
              joined_at: string;
            };
            setActiveUsers((prev) => {
              // Avoid duplicates
              if (prev.some((u) => u.id === presence.user_id)) {
                return prev;
              }
              return [
                ...prev,
                {
                  id: presence.user_id,
                  name: presence.user_name,
                  joinedAt: presence.joined_at,
                },
              ];
            });
          }
        });

        // Handle when users leave
        channel.on("presence", { event: "leave" }, ({ key }) => {
          setActiveUsers((prev) => prev.filter((u) => u.id !== key));
        });

        // Subscribe and track presence
        await channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            setIsConnected(true);
            setError(null);

            // Track this user's presence
            await channel?.track({
              user_id: user.id,
              user_name: userProfile.name || "Unknown User",
              joined_at: new Date().toISOString(),
            });
          } else if (status === "CHANNEL_ERROR") {
            setError("Failed to connect to presence channel");
            setIsConnected(false);
          }
        });
      } catch (err) {
        setError("Failed to setup presence tracking");
        setIsConnected(false);
      }
    };

    setupPresence();

    // Cleanup on unmount
    return () => {
      if (channel) {
        channel.untrack();
        supabase.removeChannel(channel);
      }
      setActiveUsers([]);
      setIsConnected(false);
    };
  }, [channelName, enabled, user, userProfile]);

  return { activeUsers, isConnected, error };
}

// Hook for optimistic locking - checks if data was modified since loaded
export function useOptimisticLock() {
  const checkForConflict = useCallback(
    async (
      tableName: string,
      recordId: string,
      loadedAt: string
    ): Promise<{ hasConflict: boolean; message?: string }> => {
      const supabase = createClient();

      try {
        const { data, error } = await (supabase as any)
          .from(tableName)
          .select("updated_at")
          .eq("id", recordId)
          .single();

        if (error) {
          return { hasConflict: false }; // Can't check, allow save
        }

        const typedData = data as { updated_at?: string } | null;
        if (typedData?.updated_at && typedData.updated_at !== loadedAt) {
          return {
            hasConflict: true,
            message:
              "This record was modified by another user. Please refresh to see the latest changes before editing.",
          };
        }

        return { hasConflict: false };
      } catch {
        return { hasConflict: false };
      }
    },
    []
  );

  return { checkForConflict };
}
