import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

/**
 * Custom error for expired sessions.
 * Thrown when session refresh fails or times out.
 */
export class SessionExpiredError extends Error {
  constructor(message = "Session expired. Please log in again.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

// Singleton instance for browser client
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  // Return existing singleton if available (browser only)
  if (typeof window !== 'undefined' && browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    console.error("URL:", supabaseUrl ? "SET" : "MISSING");
    console.error("KEY:", supabaseKey ? "SET" : "MISSING");
    throw new Error(
      "Missing Supabase environment variables. Please check your .env.local file."
    );
  }

  const client = createBrowserClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  // Store as singleton in browser environment
  if (typeof window !== 'undefined') {
    browserClient = client;
  }

  return client;
}

// Track last successful session check to avoid redundant checks
let lastSessionCheckTime = 0;
const SESSION_CHECK_DEBOUNCE = 5000; // 5 seconds - skip check if done within this window

/**
 * Ensures a fresh session before performing mutations.
 * Call this before any write operation that might happen after
 * the user has been idle (e.g., filling out a form in a dialog).
 *
 * This prevents the "spinner keeps spinning" issue when sessions
 * expire while users are working on forms.
 *
 * Throws SessionExpiredError only if session is actually invalid.
 * Timeouts are logged but do NOT throw - the mutation proceeds and
 * Supabase will return a proper 401/403 if the session is truly expired.
 *
 * Includes debouncing: if called multiple times within 5 seconds (e.g., batch
 * upserts), only the first call actually checks the session.
 */
export async function ensureFreshSession(): Promise<void> {
  // Skip if we just checked the session recently (within 5 seconds)
  const now = Date.now();
  if (now - lastSessionCheckTime < SESSION_CHECK_DEBOUNCE) {
    return; // Session was verified recently, skip check
  }

  const SESSION_TIMEOUT = 15000; // 15 seconds

  const sessionCheckPromise = async (): Promise<void> => {
    const supabase = createClient();

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Session check error:", error);
      throw new SessionExpiredError();
    }

    if (!session) {
      console.warn("No active session found");
      throw new SessionExpiredError();
    }

    // Check if token is expired or about to expire (within 5 minutes for buffer)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const fiveMinutesFromNow = Math.floor(Date.now() / 1000) + 300;
      if (expiresAt < fiveMinutesFromNow) {
        // Token is expired or about to expire, refresh it
        console.log("Session expiring soon, refreshing...");
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error("Session refresh failed:", refreshError);
          throw new SessionExpiredError();
        }
        if (data.session) {
          console.log("Session refreshed successfully");
        }
      }
    }

    // Mark successful check
    lastSessionCheckTime = Date.now();
  };

  // Timeout with warning only - don't throw, let mutation proceed
  // If session is truly expired, Supabase will return 401/403
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn("ensureFreshSession check slow - proceeding anyway");
      lastSessionCheckTime = Date.now(); // Still mark as checked to avoid repeated timeouts
      resolve(); // Resolve instead of reject - let mutation proceed
    }, SESSION_TIMEOUT);
  });

  // Race: first to complete wins
  // If timeout wins, we proceed without error (mutation will fail at Supabase if session invalid)
  // If session check wins, it either succeeds or throws real error
  await Promise.race([sessionCheckPromise(), timeoutPromise]);
}

// Session refresh timer for keeping sessions alive during long form fills
let sessionRefreshInterval: ReturnType<typeof setInterval> | null = null;
let sessionRefreshStarted = false;

/**
 * Starts a background timer that refreshes the session every 45 minutes.
 * This prevents session expiry while users are filling out forms.
 * Call this once when the app initializes (e.g., in AuthContext).
 */
export function startSessionRefreshTimer(): void {
  // Only start once
  if (sessionRefreshStarted || typeof window === 'undefined') {
    return;
  }

  sessionRefreshStarted = true;

  // Refresh every 45 minutes (before 1-hour default expiry)
  const REFRESH_INTERVAL = 45 * 60 * 1000;

  sessionRefreshInterval = setInterval(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log("[SessionRefresh] No session to refresh");
        return;
      }

      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("[SessionRefresh] Failed to refresh:", error);
        // Dispatch event so UI can show warning
        window.dispatchEvent(new CustomEvent('session-refresh-failed', {
          detail: { error: error.message }
        }));
      } else {
        console.log("[SessionRefresh] Session refreshed successfully");
      }
    } catch (err) {
      console.error("[SessionRefresh] Error:", err);
    }
  }, REFRESH_INTERVAL);

  console.log("[SessionRefresh] Timer started - will refresh every 45 minutes");
}

/**
 * Stops the session refresh timer.
 * Call this when user logs out.
 */
export function stopSessionRefreshTimer(): void {
  if (sessionRefreshInterval) {
    clearInterval(sessionRefreshInterval);
    sessionRefreshInterval = null;
    sessionRefreshStarted = false;
    console.log("[SessionRefresh] Timer stopped");
  }
}
