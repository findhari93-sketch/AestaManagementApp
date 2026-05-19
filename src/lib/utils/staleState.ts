/**
 * Thrown by guarded mutations when the row they expected to update is no
 * longer in the expected state — e.g. an Approve mutation that filters
 * `.eq("status", "pending")` matched zero rows because the request was
 * already approved by another tab/user, or the React Query cache was
 * stale after idle and the dialog opened on data that no longer reflects
 * reality.
 *
 * Replaces the cryptic PostgREST 406 ("Not Acceptable") that `.single()`
 * produces when the underlying query returns 0 rows. Use `.maybeSingle()`
 * + an explicit null-check + `throw new StaleStateError(entity)` instead.
 *
 * The global mutation `onError` handler in QueryProvider catches this and
 * surfaces a friendly snackbar plus a silent active-query invalidation so
 * the UI reconciles to truth on its own.
 */
export class StaleStateError extends Error {
  readonly isStaleStateError = true as const;

  constructor(public readonly entity: string) {
    super(
      `This ${entity} has already been updated. Refresh the page and try again.`,
    );
    this.name = "StaleStateError";
  }
}

export function isStaleStateError(error: unknown): error is StaleStateError {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { isStaleStateError?: boolean }).isStaleStateError === true
  );
}
