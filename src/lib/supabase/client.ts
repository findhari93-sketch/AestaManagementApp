import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

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

/**
 * Ensures a fresh session before performing mutations.
 * Call this before any write operation that might happen after
 * the user has been idle (e.g., filling out a form in a dialog).
 *
 * This prevents the "spinner keeps spinning" issue when sessions
 * expire while users are working on forms.
 *
 * Has a 5-second timeout to prevent hanging indefinitely.
 */
export async function ensureFreshSession(): Promise<boolean> {
  const SESSION_TIMEOUT = 5000; // 5 seconds

  const sessionCheckPromise = async (): Promise<boolean> => {
    const supabase = createClient();

    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session check error:", error);
        return false;
      }

      if (!session) {
        console.warn("No active session found");
        return false;
      }

      // Check if token is expired or about to expire (within 2 minutes)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const twoMinutesFromNow = Math.floor(Date.now() / 1000) + 120;
        if (expiresAt < twoMinutesFromNow) {
          // Token is expired or about to expire, refresh it
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error("Session refresh failed:", refreshError);
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error("ensureFreshSession error:", error);
      return false;
    }
  };

  // Add timeout to prevent hanging indefinitely
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => {
      console.warn("ensureFreshSession timed out, proceeding anyway");
      resolve(true); // Assume session is valid on timeout to avoid blocking user
    }, SESSION_TIMEOUT);
  });

  return Promise.race([sessionCheckPromise(), timeoutPromise]);
}
