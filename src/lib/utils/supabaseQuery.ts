/**
 * Supabase query wrapper with timeout support
 * Prevents queries from hanging indefinitely due to network issues or stale connections
 */

import { withTimeout, TIMEOUTS } from "./timeout";

export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Supabase query result type (thenable)
 * Supabase query builders are "thenable" (can be awaited) but not full Promises
 */
type SupabaseQueryLike<T> = PromiseLike<{ data: T | null; error: any }>;

/**
 * Wraps a Supabase query with timeout
 * @param query - The Supabase query (e.g., supabase.from('table').select(...))
 * @param timeoutMs - Timeout in milliseconds (defaults to TIMEOUTS.QUERY = 30 seconds)
 * @returns Query result with data or error
 */
export async function supabaseQueryWithTimeout<T>(
  query: SupabaseQueryLike<T>,
  timeoutMs: number = TIMEOUTS.QUERY
): Promise<QueryResult<T>> {
  try {
    // Convert thenable to Promise for compatibility with withTimeout
    const queryPromise = Promise.resolve(query);

    const result = await withTimeout(
      queryPromise,
      timeoutMs,
      "Query timed out. The server may be slow or unreachable."
    );

    if (result.error) {
      return {
        data: null,
        error: new Error(result.error.message || "Query failed"),
      };
    }

    return { data: result.data, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(error?.message || "Query failed"),
    };
  }
}
