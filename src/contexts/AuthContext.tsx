"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient, startSessionRefreshTimer, stopSessionRefreshTimer } from "@/lib/supabase/client";
import { User } from "@/types/database.types";

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

        console.log("[AuthContext] Session:", session ? "exists" : "null");
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserProfile(session.user.id);
          // Start session refresh timer to keep session alive during long form fills
          startSessionRefreshTimer();
        }
      } catch (error) {
        console.error("[AuthContext] Error initializing auth:", error);
      } finally {
        if (mounted) {
          console.log("[AuthContext] Auth loading complete");
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      console.log("[AuthContext] Auth state changed:", _event);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserProfile(session.user.id);
        // Start session refresh timer when user signs in
        startSessionRefreshTimer();
      } else {
        setUserProfile(null);
        // Stop session refresh timer when user signs out
        stopSessionRefreshTimer();
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      // Cleanup timer on unmount
      stopSessionRefreshTimer();
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setUserProfile(null);
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
