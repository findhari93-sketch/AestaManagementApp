import { createClient } from "@/lib/supabase/client";

/**
 * Centralized Session Manager
 *
 * Consolidates all session refresh logic into a single manager.
 * Replaces multiple refresh layers in AuthContext, useSessionRefresh, and client.ts
 *
 * Features:
 * - Single 45-minute refresh timer
 * - Activity tracking (debounced user interactions)
 * - Idle detection (15 minutes threshold)
 * - Pre-mutation session check
 * - Error recovery with user notification
 */

const REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes
const IDLE_THRESHOLD = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_DEBOUNCE = 2000; // 2 seconds
const SESSION_CHECK_DEBOUNCE = 5000; // 5 seconds - skip session check if done recently
const SESSION_CHECK_TIMEOUT = 8000; // 8 seconds - balanced timeout (was 15s)

type SessionManagerState = {
  isInitialized: boolean;
  lastActivity: number;
  lastSessionCheckTime: number;
  refreshTimer: ReturnType<typeof setInterval> | null;
  activityTimer: ReturnType<typeof setTimeout> | null;
};

class SessionManager {
  private state: SessionManagerState = {
    isInitialized: false,
    lastActivity: Date.now(),
    lastSessionCheckTime: 0,
    refreshTimer: null,
    activityTimer: null,
  };

  /**
   * Initialize the session manager
   * Should be called once when the app starts (in AuthContext)
   */
  initialize(): void {
    if (this.state.isInitialized || typeof window === "undefined") {
      return;
    }

    console.log("[SessionManager] Initializing...");

    this.state.isInitialized = true;
    this.state.lastActivity = Date.now();

    // Start refresh timer
    this.startRefreshTimer();

    // Setup activity tracking
    this.setupActivityTracking();

    console.log("[SessionManager] Initialized - will refresh every 45 minutes");
  }

  /**
   * Stop the session manager
   * Should be called when the user logs out
   */
  stop(): void {
    console.log("[SessionManager] Stopping...");

    if (this.state.refreshTimer) {
      clearInterval(this.state.refreshTimer);
      this.state.refreshTimer = null;
    }

    if (this.state.activityTimer) {
      clearTimeout(this.state.activityTimer);
      this.state.activityTimer = null;
    }

    this.cleanupActivityTracking();

    this.state.isInitialized = false;
    console.log("[SessionManager] Stopped");
  }

  /**
   * Check if user is idle
   */
  isUserIdle(): boolean {
    const timeSinceLastActivity = Date.now() - this.state.lastActivity;
    return timeSinceLastActivity > IDLE_THRESHOLD;
  }

  /**
   * Get last activity time
   */
  getLastActivity(): number {
    return this.state.lastActivity;
  }

  /**
   * Manually refresh session
   * Returns true if successful, false otherwise
   */
  async refreshSession(): Promise<boolean> {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.warn("[SessionManager] No session to refresh");
        return false;
      }

      const { error } = await supabase.auth.refreshSession();

      if (error) {
        console.error("[SessionManager] Failed to refresh:", error);
        // Dispatch event so UI can show warning
        this.dispatchRefreshFailedEvent(error.message);
        return false;
      }

      console.log("[SessionManager] Session refreshed successfully");
      return true;
    } catch (err) {
      console.error("[SessionManager] Refresh error:", err);
      return false;
    }
  }

  /**
   * Ensure session is fresh before mutation
   * Throws error only if session is actually invalid.
   * Timeouts are logged but do NOT throw - the mutation proceeds and
   * Supabase will return a proper 401/403 if the session is truly expired.
   *
   * Includes debouncing: if called multiple times within 5 seconds (e.g., batch
   * upserts), only the first call actually checks the session.
   */
  async ensureFreshSession(): Promise<void> {
    // Skip if we just checked the session recently (within 5 seconds)
    const now = Date.now();
    if (now - this.state.lastSessionCheckTime < SESSION_CHECK_DEBOUNCE) {
      return; // Session was verified recently, skip check
    }

    const sessionCheckPromise = async (): Promise<void> => {
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[SessionManager] Session check error:", error);
        throw new Error("Session expired. Please log in again.");
      }

      if (!session) {
        console.warn("[SessionManager] No active session");
        throw new Error("Session expired. Please log in again.");
      }

      // Check if token is expired or about to expire (within 5 minutes)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const fiveMinutesFromNow = Math.floor(Date.now() / 1000) + 300;
        if (expiresAt < fiveMinutesFromNow) {
          console.log("[SessionManager] Session expiring soon, refreshing...");
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error("[SessionManager] Session refresh failed:", refreshError);
            throw new Error("Session expired. Please log in again.");
          }
          console.log("[SessionManager] Session refreshed before mutation");
        }
      }

      // Mark successful check
      this.state.lastSessionCheckTime = Date.now();
    };

    // Timeout with warning only - don't throw, let mutation proceed
    // If session is truly expired, Supabase will return 401/403
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn("[SessionManager] ensureFreshSession check slow - proceeding anyway");
        this.state.lastSessionCheckTime = Date.now(); // Still mark as checked to avoid repeated timeouts
        resolve(); // Resolve instead of reject - let mutation proceed
      }, SESSION_CHECK_TIMEOUT);
    });

    // Race: first to complete wins
    // If timeout wins, we proceed without error (mutation will fail at Supabase if session invalid)
    await Promise.race([sessionCheckPromise(), timeoutPromise]);
  }

  // ==================== PRIVATE METHODS ====================

  private startRefreshTimer(): void {
    this.state.refreshTimer = setInterval(async () => {
      await this.refreshSession();
    }, REFRESH_INTERVAL);
  }

  private setupActivityTracking(): void {
    if (typeof window === "undefined") return;

    // Track user activity
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];

    activityEvents.forEach((event) => {
      window.addEventListener(event, this.handleActivity);
    });
  }

  private cleanupActivityTracking(): void {
    if (typeof window === "undefined") return;

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];

    activityEvents.forEach((event) => {
      window.removeEventListener(event, this.handleActivity);
    });
  }

  private handleActivity = (): void => {
    // Debounce activity tracking
    if (this.state.activityTimer) {
      clearTimeout(this.state.activityTimer);
    }

    this.state.activityTimer = setTimeout(() => {
      this.state.lastActivity = Date.now();
    }, ACTIVITY_DEBOUNCE);
  };

  private dispatchRefreshFailedEvent(errorMessage: string): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("session-refresh-failed", {
          detail: { error: errorMessage },
        })
      );
    }
  }
}

// Singleton instance
const sessionManager = new SessionManager();

export default sessionManager;

// Named exports for convenience
export const initializeSessionManager = () => sessionManager.initialize();
export const stopSessionManager = () => sessionManager.stop();
export const refreshSession = () => sessionManager.refreshSession();
export const ensureFreshSession = () => sessionManager.ensureFreshSession();
export const isUserIdle = () => sessionManager.isUserIdle();
export const getLastActivity = () => sessionManager.getLastActivity();
