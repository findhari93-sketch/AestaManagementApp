import { createClient } from "@/lib/supabase/client";
import type { QueryClient } from "@tanstack/react-query";

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

// const REFRESH_INTERVAL = 45 * 60 * 1000; // REMOVED: Conflicting with Supabase auto-refresh
const IDLE_THRESHOLD = 15 * 60 * 1000; // 15 minutes
const PROACTIVE_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes - check if refresh needed
const EXPIRY_BUFFER = 15 * 60; // 15 minutes in seconds - refresh if token expires within this time
const ACTIVITY_DEBOUNCE = 2000; // 2 seconds
const SESSION_CHECK_DEBOUNCE = 30000; // 30 seconds - trust a verified session for this long
const SESSION_CHECK_TIMEOUT = 4000; // 4 seconds - if slow, proceed and let Supabase 401 handle it
const SESSION_CHECK_TIMEOUT_POST_IDLE = 8000; // 8 seconds - longer after idle for slow mobile networks
const VISIBILITY_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes - re-auth on tab return if hidden longer than this

// Module-level singleton in-flight refresh. ALL callers (SessionManager methods,
// QueryProvider error handlers, NetworkRecoveryHandler) funnel through this so
// concurrent refresh calls cannot race and trigger refresh-token-rotation reuse
// detection (which surfaces as a 400 invalid_grant from /auth/v1/token).
let _refreshInFlight: Promise<boolean> | null = null;

type SessionManagerState = {
  isInitialized: boolean;
  lastActivity: number;
  lastSessionCheckTime: number;
  needsRefreshOnNextMutation: boolean; // Set on idle wake, cleared after refresh
  // refreshTimer: ReturnType<typeof setInterval> | null; // REMOVED
  proactiveRefreshTimer: ReturnType<typeof setInterval> | null;
  activityTimer: ReturnType<typeof setTimeout> | null;
  hiddenAt: number | null; // Set when document.visibilityState transitions to "hidden"
  queryClient: QueryClient | null;
};

class SessionManager {
  private state: SessionManagerState = {
    isInitialized: false,
    lastActivity: Date.now(),
    lastSessionCheckTime: 0,
    needsRefreshOnNextMutation: false,
    // refreshTimer: null,
    proactiveRefreshTimer: null,
    activityTimer: null,
    hiddenAt: null,
    queryClient: null,
  };

  /**
   * Hand the QueryClient to the session manager so it can cancel/invalidate
   * queries during the visibility-wake recovery sequence. Called once from
   * QueryProvider after the client is constructed.
   */
  setQueryClient(qc: QueryClient): void {
    this.state.queryClient = qc;
  }

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

    // Start refresh timer - REMOVED to avoid race condition with Supabase auto-refresh
    // this.startRefreshTimer();

    // Start proactive refresh timer to prevent session expiry during idle
    this.startProactiveRefreshTimer();

    // Setup activity tracking
    this.setupActivityTracking();

    // Setup tab visibility tracking — the primary wake-from-idle signal
    this.setupVisibilityTracking();

    console.log("[SessionManager] Initialized with proactive refresh timer");
  }

  /**
   * Stop the session manager
   * Should be called when the user logs out
   */
  stop(): void {
    console.log("[SessionManager] Stopping...");

    // if (this.state.refreshTimer) {
    //   clearInterval(this.state.refreshTimer);
    //   this.state.refreshTimer = null;
    // }

    if (this.state.proactiveRefreshTimer) {
      clearInterval(this.state.proactiveRefreshTimer);
      this.state.proactiveRefreshTimer = null;
    }

    if (this.state.activityTimer) {
      clearTimeout(this.state.activityTimer);
      this.state.activityTimer = null;
    }

    this.cleanupActivityTracking();
    this.cleanupVisibilityTracking();
    this.state.hiddenAt = null;

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
   * Manually refresh session.
   * Returns true if successful, false otherwise.
   *
   * Routes through refreshSessionDeduped() so concurrent callers (SDK auto-refresh,
   * QueryCache.onError, mutation onError, NetworkRecoveryHandler, visibility wake)
   * never trigger refresh-token-rotation reuse detection (Supabase 400 invalid_grant).
   */
  async refreshSession(): Promise<boolean> {
    return this.refreshSessionDeduped();
  }

  /**
   * Single source of truth for token refresh. Holds a module-level in-flight
   * promise so all callers share the same outcome. Dispatches refresh-failed
   * event on hard failures (UI banner). The caller is responsible for deciding
   * whether to redirect to login on a hard failure (e.g. invalid_grant 400).
   */
  async refreshSessionDeduped(): Promise<boolean> {
    if (_refreshInFlight) {
      return _refreshInFlight;
    }

    _refreshInFlight = (async (): Promise<boolean> => {
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
          this.dispatchRefreshFailedEvent(error.message);
          return false;
        }

        console.log("[SessionManager] Session refreshed successfully");
        return true;
      } catch (err) {
        console.error("[SessionManager] Refresh error:", err);
        return false;
      } finally {
        _refreshInFlight = null;
      }
    })();

    return _refreshInFlight;
  }

  /**
   * Ensure session is fresh before mutation
   * Throws error only if session is actually invalid.
   * Timeouts are logged but do NOT throw - the mutation proceeds and
   * Supabase will return a proper 401/403 if the session is truly expired.
   *
   * Includes debouncing: if called multiple times within 5 seconds (e.g., batch
   * upserts), only the first call actually checks the session.
   *
   * After idle periods (15+ min), forces a token refresh instead of just
   * checking the cached session, since the token may have expired.
   */
  async ensureFreshSession(): Promise<void> {
    const now = Date.now();
    const needsRefresh = this.state.needsRefreshOnNextMutation;

    // Debounce: skip if checked recently (unless flagged for refresh after idle wake)
    if (!needsRefresh && now - this.state.lastSessionCheckTime < SESSION_CHECK_DEBOUNCE) {
      return; // Session was verified recently, skip check
    }

    // Use longer timeout if waking from idle
    const timeout = needsRefresh ? SESSION_CHECK_TIMEOUT_POST_IDLE : SESSION_CHECK_TIMEOUT;

    if (needsRefresh) {
      console.log("[SessionManager] Performing post-idle session refresh");
      // Clear the flag immediately to prevent duplicate refreshes from concurrent mutations
      this.state.needsRefreshOnNextMutation = false;
    }

    const sessionCheckPromise = async (): Promise<void> => {
      const supabase = createClient();

      // After idle wake: force a full token refresh (not just cached getSession)
      if (needsRefresh) {
        const ok = await this.refreshSessionDeduped();
        if (!ok) {
          console.error("[SessionManager] Post-idle refresh failed");
          throw new Error("Session expired. Please log in again.");
        }
        console.log("[SessionManager] Post-idle session refresh successful");
        this.state.lastSessionCheckTime = Date.now();
        return;
      }

      // Normal flow: check cached session first
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
          const ok = await this.refreshSessionDeduped();
          if (!ok) {
            console.error("[SessionManager] Session refresh failed before mutation");
            throw new Error("Session expired. Please log in again.");
          }
          console.log("[SessionManager] Session refreshed before mutation");
        }
      }

      // Mark successful check
      this.state.lastSessionCheckTime = Date.now();
    };

    // Timeout behavior depends on context:
    // - Normal check: resolve (let mutation proceed, Supabase 401 triggers retry)
    // - Post-idle check: reject (token is definitely stale, fail fast with clear error)
    const timeoutPromise = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (needsRefresh) {
          // Post-idle: token is likely expired, don't let mutation proceed with stale token
          console.warn(`[SessionManager] Post-idle session refresh timed out (${timeout / 1000}s) - session may be expired`);
          // Notify UI so user sees a warning banner
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("session-check-timeout"));
          }
          reject(new Error("Session refresh timed out. Please try again."));
        } else {
          // Normal: proceed anyway, mutation retry will handle 401 if needed
          console.warn(`[SessionManager] ensureFreshSession check slow (${timeout / 1000}s) - proceeding anyway`);
          this.state.lastSessionCheckTime = Date.now();
          resolve();
        }
      }, timeout);
    });

    // Race: first to complete wins
    await Promise.race([sessionCheckPromise(), timeoutPromise]);
  }

  // ==================== PRIVATE METHODS ====================

  // private startRefreshTimer(): void {
  //   this.state.refreshTimer = setInterval(async () => {
  //     await this.refreshSession();
  //   }, REFRESH_INTERVAL);
  // }

  private startProactiveRefreshTimer(): void {
    // Clear existing timer if any
    if (this.state.proactiveRefreshTimer) {
      clearInterval(this.state.proactiveRefreshTimer);
    }

    // Run proactive refresh check every 10 minutes
    this.state.proactiveRefreshTimer = setInterval(async () => {
      await this.proactiveRefreshIfNeeded();
    }, PROACTIVE_REFRESH_INTERVAL);

    // Also run immediately on start to catch near-expiry sessions
    this.proactiveRefreshIfNeeded();
  }

  private async proactiveRefreshIfNeeded(): Promise<void> {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No session - nothing to refresh
        return;
      }

      const expiresAt = session.expires_at;
      if (expiresAt) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - nowSeconds;

        // Refresh if within buffer period (15 minutes)
        if (timeUntilExpiry < EXPIRY_BUFFER && timeUntilExpiry > 0) {
          console.log(`[SessionManager] Proactive refresh - ${Math.round(timeUntilExpiry / 60)} min until expiry`);
          const ok = await this.refreshSessionDeduped();
          if (ok) {
            console.log("[SessionManager] Proactive refresh successful");
          }
        }
      }
    } catch (err) {
      console.error("[SessionManager] Proactive refresh error:", err);
    }
  }

  private setupVisibilityTracking(): void {
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private cleanupVisibilityTracking(): void {
    if (typeof document === "undefined") return;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }

  /**
   * Primary wake-from-idle handler. Browsers throttle setInterval/setTimeout
   * to ~1/min while the tab is hidden, so the SDK's autoRefreshToken and our
   * proactive timer both miss the actual expiry window. visibilitychange is
   * the only event guaranteed to fire on tab return.
   *
   * On hidden→visible transition where hidden duration exceeds the threshold:
   *   1. Cancel in-flight queries (they're carrying a stale Authorization).
   *   2. Force a single deduped refresh.
   *   3. On success → dispatch session-restored-after-idle so IdleRecoveryHandler
   *      invalidates active queries with the fresh token.
   *   4. On failure that looks like invalid_grant → redirect to login (the
   *      refresh token is unrecoverable; a hard reload is the only path back).
   */
  private handleVisibilityChange = (): void => {
    if (typeof document === "undefined") return;

    if (document.visibilityState === "hidden") {
      this.state.hiddenAt = Date.now();
      // Pause proactive timer — throttled in background anyway, and contributes
      // to the refresh race when it eventually fires alongside SDK auto-refresh.
      if (this.state.proactiveRefreshTimer) {
        clearInterval(this.state.proactiveRefreshTimer);
        this.state.proactiveRefreshTimer = null;
      }
      return;
    }

    if (document.visibilityState !== "visible") return;

    const hiddenAt = this.state.hiddenAt;
    this.state.hiddenAt = null;

    // Restart proactive timer
    if (!this.state.proactiveRefreshTimer && this.state.isInitialized) {
      this.startProactiveRefreshTimer();
    }

    if (hiddenAt === null) return;
    const hiddenDuration = Date.now() - hiddenAt;
    if (hiddenDuration < VISIBILITY_REFRESH_THRESHOLD) return;

    console.log(
      `[SessionManager] Tab visible after ${Math.round(hiddenDuration / 60000)} min hidden — refreshing session`
    );

    void this.recoverFromIdleWake();
  };

  private async recoverFromIdleWake(): Promise<void> {
    const qc = this.state.queryClient;

    // Drop zombie fetches before they complete with the stale token and pollute
    // the cache or trigger 401-handling races against our refresh.
    if (qc) {
      try {
        await qc.cancelQueries();
      } catch (err) {
        console.warn("[SessionManager] cancelQueries threw:", err);
      }
    }

    const ok = await this.refreshSessionDeduped();

    if (ok) {
      this.state.lastSessionCheckTime = Date.now();
      this.state.needsRefreshOnNextMutation = false;
      this.dispatchSessionRestoredEvent();
      return;
    }

    // Refresh failed. If it's an unrecoverable refresh-token state (rotated /
    // reused / expired), the only path back is a fresh login. Anything else —
    // transient network — will recover on the next user action.
    console.error("[SessionManager] Idle-wake refresh failed — redirecting to login");
    if (typeof window !== "undefined") {
      window.location.href = "/login?session_expired=true";
    }
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

    // Check if waking from idle BEFORE updating lastActivity
    const wasIdle = this.isUserIdle();

    this.state.activityTimer = setTimeout(() => {
      this.state.lastActivity = Date.now();

      // Instead of refreshing immediately (which causes race conditions with ensureFreshSession),
      // just set a flag. The next ensureFreshSession call will handle the refresh.
      if (wasIdle) {
        console.log("[SessionManager] Activity detected after idle - flagging for refresh on next mutation");
        this.state.needsRefreshOnNextMutation = true;
      }
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

  private dispatchSessionRestoredEvent(): void {
    if (typeof window !== "undefined") {
      console.log("[SessionManager] Dispatching session-restored-after-idle event");
      window.dispatchEvent(new CustomEvent("session-restored-after-idle"));
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
export const refreshSessionDeduped = () => sessionManager.refreshSessionDeduped();
export const setSessionManagerQueryClient = (qc: QueryClient) => sessionManager.setQueryClient(qc);
export const ensureFreshSession = () => sessionManager.ensureFreshSession();
export const isUserIdle = () => sessionManager.isUserIdle();
export const getLastActivity = () => sessionManager.getLastActivity();
