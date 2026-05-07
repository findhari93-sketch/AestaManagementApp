"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { initializeSessionManager, stopSessionManager } from "@/lib/auth/sessionManager";
import type { Database } from "@/types/database.types";

type User = Database["public"]["Tables"]["users"]["Row"];

interface AuthContextType {
  user: SupabaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());
  const userProfileRef = useRef<User | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log("[AuthContext] Fetching user profile...", { userId });
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AuthContext] Error fetching user profile:", error);
        setUserProfile(null);
        return;
      }

      if (!data) {
        console.warn("[AuthContext] No profile found for auth user:", userId);
        setUserProfile(null);
        return;
      }

      console.log("[AuthContext] User profile fetched successfully:", data?.name);
      setUserProfile(data);
    } catch (error) {
      console.error("[AuthContext] Error fetching user profile:", error);
      setUserProfile(null);
    }
  }, [supabase]);

  const refreshUserProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  }, [user, fetchUserProfile]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      let hasSession = false;
      try {
        console.log("[AuthContext] Initializing auth...");
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[AuthContext] Session error:", sessionError);
        }

        if (!mounted) return;

        hasSession = !!session?.user;
        console.log("[AuthContext] Session:", hasSession ? "exists" : "null");
        setUser(session?.user ?? null);

        if (session?.user) {
          // Profile fetch is handled by onAuthStateChange INITIAL_SESSION event
          // to avoid duplicate concurrent requests causing CORS errors
          initializeSessionManager();
        }
      } catch (error) {
        console.error("[AuthContext] Error initializing auth:", error);
      } finally {
        if (mounted && !hasSession) {
          // Only mark loading complete when there's no session.
          // When a session exists, onAuthStateChange will set loading=false
          // after fetchUserProfile completes, preventing SiteProvider from
          // seeing authLoading=false with userProfile=null.
          console.log("[AuthContext] No session - auth loading complete");
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Safety timeout: if onAuthStateChange hasn't fired INITIAL_SESSION within
    // 5 seconds, attempt a direct session+profile recovery before clearing the
    // loading gate. Without recovery, downstream providers (SiteProvider) see
    // authLoading=false with userProfile=null and clear their state — leaving
    // a second tab stuck on "No sites available" when cross-tab Supabase auth
    // lock contention or a slow proxy delays the SDK's INITIAL_SESSION emit.
    const safetyTimeout = setTimeout(async () => {
      if (!mounted) return;

      if (!userProfileRef.current) {
        console.warn("[AuthContext] Safety timeout - attempting profile recovery");
        const recovery = (async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!mounted || userProfileRef.current) return;
          if (session?.user) {
            setUser(session.user);
            await fetchUserProfile(session.user.id);
            initializeSessionManager();
          }
        })();
        await Promise.race([
          recovery,
          new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ]).catch((err) => {
          console.error("[AuthContext] Safety timeout recovery failed:", err);
        });
      }

      if (mounted) {
        setLoading((prev) => {
          if (prev) {
            console.warn("[AuthContext] Safety timeout - forcing auth loading complete");
          }
          return false;
        });
      }
    }, 5000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      console.log("[AuthContext] Auth state changed:", _event);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Skip profile fetch on TOKEN_REFRESHED if we already have the profile
        // This prevents unnecessary API calls on token refresh
        if (_event === "TOKEN_REFRESHED" && userProfileRef.current) {
          console.log("[AuthContext] Skipping profile fetch on TOKEN_REFRESHED - already loaded");
        } else {
          await fetchUserProfile(session.user.id);
        }
        // Initialize session manager when user signs in
        initializeSessionManager();
      } else {
        setUserProfile(null);
        // Stop session manager when user signs out
        stopSessionManager();
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      // Cleanup session manager on unmount
      stopSessionManager();
    };
  }, [supabase, fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Swallow: a missing/expired session would otherwise leave the user
      // stranded on a protected page with stale UI. Local state must be cleared
      // unconditionally so the redirect guard fires.
      console.warn("[AuthContext] signOut error (continuing):", error);
    }
    setUser(null);
    setUserProfile(null);
    stopSessionManager();
  };

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signOut,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
