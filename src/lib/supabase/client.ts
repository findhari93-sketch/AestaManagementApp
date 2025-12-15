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
