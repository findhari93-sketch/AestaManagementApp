/**
 * Supabase configuration utilities
 */

export const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url,
    anonKey,
    isValid: Boolean(url && anonKey && url.includes("supabase.co")),
  };
};

export const validateSupabaseConfig = () => {
  const config = getSupabaseConfig();

  if (!config.url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not defined. Please check your .env.local file."
    );
  }

  if (!config.anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. Please check your .env.local file."
    );
  }

  if (!config.url.includes("supabase.co")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL appears to be invalid. It should be a Supabase URL."
    );
  }

  return config;
};
