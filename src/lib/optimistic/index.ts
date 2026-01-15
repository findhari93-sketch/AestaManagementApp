/**
 * Optimistic Update Utilities
 *
 * Provides utilities for implementing optimistic updates in React Query mutations.
 * Optimistic updates make the UI feel instant by updating the cache immediately,
 * then reconciling with the server response.
 */

/**
 * Generates a unique temporary ID for optimistic records
 * Format: "opt-{timestamp}-{random}"
 */
export function generateOptimisticId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `opt-${timestamp}-${random}`;
}

/**
 * Creates an optimistic record with metadata
 * Adds isPending and optimisticId fields to track optimistic state
 */
export function createOptimisticRecord<T extends Record<string, any>>(
  data: T,
  optimisticId?: string
): T & { isPending: true; optimisticId: string } {
  return {
    ...data,
    isPending: true,
    optimisticId: optimisticId || generateOptimisticId(),
  };
}

/**
 * Checks if a record is optimistic (pending server confirmation)
 */
export function isOptimisticRecord(
  record: any
): record is { isPending: true; optimisticId: string } {
  return (
    record &&
    typeof record === "object" &&
    record.isPending === true &&
    typeof record.optimisticId === "string"
  );
}

/**
 * Reconciles an optimistic record with the server response
 * Replaces the optimistic record with the real server data
 */
export function reconcileOptimisticUpdate<T>(
  oldData: T[] | undefined,
  optimisticId: string,
  serverData: T
): T[] {
  if (!oldData) return [serverData];

  return oldData.map((item: any) =>
    item.optimisticId === optimisticId ? serverData : item
  );
}

/**
 * Reverts an optimistic update by removing the optimistic record
 * Used when a mutation fails
 */
export function revertOptimisticUpdate<T>(
  oldData: T[] | undefined,
  optimisticId: string
): T[] {
  if (!oldData) return [];

  return oldData.filter(
    (item: any) => !isOptimisticRecord(item) || item.optimisticId !== optimisticId
  );
}

/**
 * Adds an optimistic record to a list
 * Used in onMutate to immediately show the new item
 */
export function addOptimisticRecord<T>(
  oldData: T[] | undefined,
  optimisticRecord: T & { isPending: true; optimisticId: string }
): T[] {
  if (!oldData) return [optimisticRecord];

  // Add to the beginning of the list (most recent first)
  return [optimisticRecord, ...oldData];
}

/**
 * Updates an optimistic record in a list
 * Used for edit operations
 */
export function updateOptimisticRecord<T extends { id?: string }>(
  oldData: T[] | undefined,
  recordId: string,
  updates: Partial<T>
): T[] {
  if (!oldData) return [];

  return oldData.map((item: any) =>
    item.id === recordId || item.optimisticId === recordId
      ? { ...item, ...updates }
      : item
  );
}

/**
 * Removes an optimistic record from a list
 * Used for delete operations
 */
export function removeOptimisticRecord<T extends { id?: string }>(
  oldData: T[] | undefined,
  recordId: string
): T[] {
  if (!oldData) return [];

  return oldData.filter(
    (item: any) => item.id !== recordId && item.optimisticId !== recordId
  );
}

/**
 * Context object passed to optimistic updater functions
 */
export interface OptimisticContext<TData = any, TVariables = any> {
  previousData: TData | undefined;
  optimisticId: string;
  variables: TVariables;
}

/**
 * Optimistic updater function type
 * Takes the old data and variables, returns the new optimistic data
 */
export type OptimisticUpdater<TData = any, TVariables = any> = (
  oldData: TData | undefined,
  context: OptimisticContext<TData, TVariables>
) => TData;

/**
 * Creates a standard optimistic updater for adding items to a list
 */
export function createAddOptimisticUpdater<
  TItem extends Record<string, any>,
  TVariables extends Record<string, any>
>(
  itemFactory: (variables: TVariables, optimisticId: string) => TItem
): OptimisticUpdater<TItem[], TVariables> {
  return (oldData, context) => {
    const optimisticRecord = createOptimisticRecord(
      itemFactory(context.variables, context.optimisticId)
    );
    return addOptimisticRecord(oldData, optimisticRecord);
  };
}

/**
 * Creates a standard optimistic updater for updating items in a list
 */
export function createUpdateOptimisticUpdater<
  TItem extends { id?: string },
  TVariables extends { id: string; updates: Partial<TItem> }
>(): OptimisticUpdater<TItem[], TVariables> {
  return (oldData, context) => {
    return updateOptimisticRecord(
      oldData,
      context.variables.id,
      context.variables.updates
    );
  };
}

/**
 * Creates a standard optimistic updater for deleting items from a list
 */
export function createDeleteOptimisticUpdater<
  TItem extends { id?: string },
  TVariables extends { id: string }
>(): OptimisticUpdater<TItem[], TVariables> {
  return (oldData, context) => {
    return removeOptimisticRecord(oldData, context.variables.id);
  };
}
