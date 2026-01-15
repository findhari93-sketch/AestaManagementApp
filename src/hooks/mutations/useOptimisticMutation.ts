import { useMutation, useQueryClient, QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import {
  generateOptimisticId,
  OptimisticUpdater,
  OptimisticContext,
} from "@/lib/optimistic";

/**
 * Toast notification function type
 */
type ToastFunction = (message: string, type: "success" | "error" | "info") => void;

/**
 * Configuration for optimistic mutations
 */
export interface UseOptimisticMutationOptions<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
> {
  /**
   * The mutation function that performs the actual API call
   */
  mutationFn: (variables: TVariables) => Promise<TData>;

  /**
   * The query key to invalidate/update
   */
  queryKey: QueryKey;

  /**
   * Optional: Function to update the cache optimistically
   * If not provided, only invalidation will happen on success
   */
  optimisticUpdater?: OptimisticUpdater<TContext, TVariables>;

  /**
   * Optional: Success message to show in toast
   */
  successMessage?: string | ((data: TData, variables: TVariables) => string);

  /**
   * Optional: Error message to show in toast
   */
  errorMessage?: string | ((error: TError, variables: TVariables) => string);

  /**
   * Optional: Custom success handler (called after cache update)
   */
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;

  /**
   * Optional: Custom error handler (called after rollback)
   */
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;

  /**
   * Optional: Toast function to show notifications
   */
  toast?: ToastFunction;

  /**
   * Optional: Whether to show toast notifications (default: true)
   */
  showToast?: boolean;
}

/**
 * Hook for mutations with optimistic updates
 *
 * Provides:
 * - Immediate cache update (optimistic)
 * - Automatic rollback on error
 * - Success reconciliation with server data
 * - Toast notifications
 *
 * @example
 * ```ts
 * const mutation = useOptimisticMutation({
 *   mutationFn: createSettlement,
 *   queryKey: queryKeys.settlements.list(siteId),
 *   optimisticUpdater: (oldData, context) => {
 *     const optimisticRecord = createOptimisticRecord({
 *       ...context.variables,
 *       id: context.optimisticId,
 *     });
 *     return addOptimisticRecord(oldData, optimisticRecord);
 *   },
 *   successMessage: "Settlement created!",
 * });
 *
 * // Use it
 * mutation.mutate({ amount: 5000, ... });
 * ```
 */
export function useOptimisticMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(options: UseOptimisticMutationOptions<TData, TError, TVariables, TContext>) {
  const queryClient = useQueryClient();
  const [toastState, setToastState] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast =
    options.showToast !== false &&
    (options.toast || typeof window !== "undefined");

  const mutation = useMutation<TData, TError, TVariables, OptimisticContext<TContext, TVariables>>({
    mutationFn: options.mutationFn,

    // onMutate: Apply optimistic update
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: options.queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TContext>(options.queryKey);

      // Generate optimistic ID
      const optimisticId = generateOptimisticId();

      // Optimistically update to the new value (if updater provided)
      if (options.optimisticUpdater && previousData !== undefined) {
        const optimisticData = options.optimisticUpdater(previousData, {
          previousData,
          optimisticId,
          variables,
        });
        queryClient.setQueryData(options.queryKey, optimisticData);
      }

      // Return a context object with the snapshotted value
      return { previousData, optimisticId, variables };
    },

    // onError: Rollback on failure
    onError: (error, variables, context) => {
      // Rollback to the previous value
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(options.queryKey, context.previousData);
      }

      // Show error toast
      if (showToast) {
        const message =
          typeof options.errorMessage === "function"
            ? options.errorMessage(error, variables)
            : options.errorMessage || "An error occurred. Please try again.";

        if (options.toast) {
          options.toast(message, "error");
        } else {
          setToastState({ message, type: "error" });
        }
      }

      // Call custom error handler
      if (options.onError) {
        options.onError(error, variables, context?.previousData);
      }

      console.error("[OptimisticMutation] Error:", error);
    },

    // onSuccess: Reconcile with server data
    onSuccess: (data, variables, context) => {
      // Invalidate and refetch to get the latest server data
      queryClient.invalidateQueries({ queryKey: options.queryKey });

      // Show success toast
      if (showToast) {
        const message =
          typeof options.successMessage === "function"
            ? options.successMessage(data, variables)
            : options.successMessage || "Success!";

        if (options.toast) {
          options.toast(message, "success");
        } else {
          setToastState({ message, type: "success" });
        }
      }

      // Call custom success handler
      if (options.onSuccess && context?.previousData !== undefined) {
        options.onSuccess(data, variables, context.previousData);
      }
    },

    // Always refetch after error or success to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: options.queryKey });
    },
  });

  return {
    ...mutation,
    toastState,
    clearToast: () => setToastState(null),
  };
}

/**
 * Simpler version for cases where you just want to invalidate on success
 * without optimistic updates
 */
export function useFastMutation<
  TData = unknown,
  TError = Error,
  TVariables = void
>(options: Omit<UseOptimisticMutationOptions<TData, TError, TVariables, unknown>, "optimisticUpdater">) {
  return useOptimisticMutation({
    ...options,
    optimisticUpdater: undefined,
  });
}
