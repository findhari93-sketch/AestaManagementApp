/**
 * Timeout utility for wrapping async operations
 * Prevents infinite hangs when database/network operations fail to respond
 */

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the specified time, it rejects with a timeout error.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message for timeout
 * @returns The result of the promise or throws a timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = "Operation timed out. Please try again."
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Default timeout values for different operation types
 */
export const TIMEOUTS = {
  /** Standard database operations (insert, update, delete) */
  DATABASE_OPERATION: 30000, // 30 seconds
  /** Complex settlement operations */
  SETTLEMENT: 60000, // 60 seconds
  /** File upload operations */
  FILE_UPLOAD: 120000, // 2 minutes
  /** Quick queries */
  QUERY: 15000, // 15 seconds
} as const;
