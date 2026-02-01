/**
 * Domain-specific optimistic updaters for common mutation patterns
 */

import {
  OptimisticUpdater,
  createOptimisticRecord,
  addOptimisticRecord,
  updateOptimisticRecord,
  removeOptimisticRecord,
} from "./index";

/**
 * Creates an optimistic updater for status change operations (approve/reject/cancel)
 * Updates the status field and optionally other fields on a record in a list
 */
export function createStatusUpdater<
  TItem extends { id: string; status: string },
  TVariables extends { id: string }
>(
  newStatus: string,
  additionalUpdates?: (variables: TVariables) => Partial<TItem>
): OptimisticUpdater<TItem[], TVariables> {
  return (oldData, context) => {
    if (!oldData) return [];

    return oldData.map((item) => {
      if (item.id === context.variables.id) {
        const additionalFields = additionalUpdates ? additionalUpdates(context.variables) : {};
        return {
          ...item,
          status: newStatus,
          ...additionalFields,
          isPending: true,
        } as TItem & { isPending: boolean };
      }
      return item;
    });
  };
}

/**
 * Creates an optimistic updater for adding a new item to a list
 * with a factory function to create the optimistic record
 */
export function createAddItemUpdater<
  TItem extends Record<string, unknown>,
  TVariables extends Record<string, unknown>
>(
  itemFactory: (
    variables: TVariables,
    optimisticId: string
  ) => Omit<TItem, "isPending" | "optimisticId">
): OptimisticUpdater<TItem[], TVariables> {
  return (oldData, context) => {
    const baseItem = itemFactory(context.variables, context.optimisticId);
    const optimisticRecord = createOptimisticRecord(
      baseItem as TItem & Record<string, unknown>,
      context.optimisticId
    );
    return addOptimisticRecord(oldData, optimisticRecord) as TItem[];
  };
}

/**
 * Creates an optimistic updater for removing an item from a list
 */
export function createRemoveItemUpdater<
  TItem extends { id: string },
  TVariables extends { id: string }
>(): OptimisticUpdater<TItem[], TVariables> {
  return (oldData, context) => {
    return removeOptimisticRecord(oldData, context.variables.id);
  };
}

/**
 * Creates an optimistic updater for updating fields on an existing item
 */
export function createUpdateItemUpdater<
  TItem extends { id: string },
  TVariables extends Record<string, unknown>
>(
  getUpdates: (variables: TVariables) => Partial<TItem>,
  getId: (variables: TVariables) => string
): OptimisticUpdater<TItem[], TVariables> {
  return (oldData, context) => {
    const recordId = getId(context.variables);
    const updates = getUpdates(context.variables);
    return updateOptimisticRecord(oldData, recordId, {
      ...updates,
      isPending: true,
    } as Partial<TItem>);
  };
}

/**
 * Creates an optimistic updater for batch status updates
 * Updates status on multiple items at once
 */
export function createBatchStatusUpdater<
  TItem extends { id: string; status: string },
  TVariables extends { ids: string[] }
>(newStatus: string): OptimisticUpdater<TItem[], TVariables> {
  return (oldData, context) => {
    if (!oldData) return [];

    const idsToUpdate = new Set(context.variables.ids);
    return oldData.map((item) => {
      if (idsToUpdate.has(item.id)) {
        return { ...item, status: newStatus, isPending: true };
      }
      return item;
    });
  };
}

/**
 * Creates an optimistic updater for incrementing/decrementing a numeric field
 * Useful for quantity adjustments
 */
export function createQuantityAdjustmentUpdater<
  TItem extends { id: string },
  TVariables extends { id: string; adjustment: number }
>(
  quantityField: keyof TItem
): OptimisticUpdater<TItem[], TVariables> {
  return (oldData, context) => {
    if (!oldData) return [];

    return oldData.map((item) => {
      if (item.id === context.variables.id) {
        const currentValue = (item[quantityField] as number) || 0;
        return {
          ...item,
          [quantityField]: currentValue + context.variables.adjustment,
          isPending: true,
        };
      }
      return item;
    });
  };
}

/**
 * Composes multiple optimistic updaters into one
 * Useful when a mutation affects multiple query keys
 */
export function composeUpdaters<TData, TVariables>(
  ...updaters: OptimisticUpdater<TData, TVariables>[]
): OptimisticUpdater<TData, TVariables> {
  return (oldData, context) => {
    return updaters.reduce(
      (data, updater) => updater(data, context),
      oldData
    ) as TData;
  };
}
