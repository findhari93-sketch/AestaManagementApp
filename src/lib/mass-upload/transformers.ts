/**
 * Data Transformers for Mass Upload
 * Handles transformation of parsed data before database insert
 */

import { MassUploadTableName } from "@/types/mass-upload.types";
import { getTableConfig } from "./tableConfigs";

/**
 * Transform row data for database insert
 * Adds context fields and calculated values
 */
export function transformRowForInsert(
  row: Record<string, unknown>,
  tableName: MassUploadTableName,
  context: {
    siteId?: string;
    userId: string;
    userName: string;
  }
): Record<string, unknown> {
  const config = getTableConfig(tableName);
  if (!config) return row;

  const transformed = { ...row };

  // Add site_id if required
  if (config.requiredContext.includes("site_id") && context.siteId) {
    transformed.site_id = context.siteId;
  }

  // Add audit fields
  const now = new Date().toISOString();

  switch (tableName) {
    case "daily_attendance":
      // Calculate daily_earnings if not provided
      if (!transformed.daily_earnings && transformed.work_days && transformed.daily_rate_applied) {
        transformed.daily_earnings =
          (transformed.work_days as number) * (transformed.daily_rate_applied as number);
      }
      // Add entered_by fields
      transformed.entered_by = context.userName;
      transformed.recorded_by_user_id = context.userId;
      transformed.created_at = now;
      transformed.updated_at = now;
      break;

    case "market_laborer_attendance":
      // Calculate total_cost if not provided
      if (!transformed.total_cost && transformed.count && transformed.rate_per_person) {
        const workDays = (transformed.work_days as number) || 1;
        transformed.total_cost =
          (transformed.count as number) * (transformed.rate_per_person as number) * workDays;
      }
      // Calculate total_snacks if snacks_per_person is provided
      if (transformed.snacks_per_person && transformed.count) {
        transformed.total_snacks =
          (transformed.snacks_per_person as number) * (transformed.count as number);
      }
      transformed.entered_by = context.userName;
      transformed.entered_by_user_id = context.userId;
      transformed.created_at = now;
      transformed.updated_at = now;
      break;

    case "expenses":
      transformed.entered_by = context.userName;
      transformed.entered_by_user_id = context.userId;
      transformed.created_at = now;
      transformed.updated_at = now;
      // Default module if not provided
      if (!transformed.module) {
        transformed.module = "general";
      }
      break;

    case "labor_payments":
      transformed.recorded_by = context.userName;
      transformed.recorded_by_user_id = context.userId;
      transformed.created_at = now;
      // Default payment_date to today if not provided
      if (!transformed.payment_date) {
        transformed.payment_date = now.split("T")[0];
      }
      break;

    case "laborers":
      transformed.created_at = now;
      transformed.updated_at = now;
      // Default status
      if (!transformed.status) {
        transformed.status = "active";
      }
      break;

    case "advances":
      transformed.given_by = context.userId;
      transformed.created_at = now;
      transformed.updated_at = now;
      // Default deduction_status
      if (!transformed.deduction_status) {
        transformed.deduction_status = "pending";
      }
      // Default deducted_amount to 0
      if (transformed.deducted_amount === undefined) {
        transformed.deducted_amount = 0;
      }
      break;

    default:
      transformed.created_at = now;
      transformed.updated_at = now;
  }

  // Remove null/undefined values for optional fields
  Object.keys(transformed).forEach((key) => {
    if (transformed[key] === null || transformed[key] === undefined) {
      delete transformed[key];
    }
  });

  return transformed;
}

/**
 * Prepare batch of rows for database insert
 */
export function prepareBatchForInsert(
  rows: Record<string, unknown>[],
  tableName: MassUploadTableName,
  context: {
    siteId?: string;
    userId: string;
    userName: string;
  }
): Record<string, unknown>[] {
  return rows.map((row) => transformRowForInsert(row, tableName, context));
}

/**
 * Get upsert configuration for a table
 */
export function getUpsertConfig(tableName: MassUploadTableName): {
  canUpsert: boolean;
  conflictColumns: string[];
} {
  const config = getTableConfig(tableName);
  if (!config || !config.upsertKey || config.upsertKey.length === 0) {
    return { canUpsert: false, conflictColumns: [] };
  }

  return {
    canUpsert: true,
    conflictColumns: config.upsertKey,
  };
}

/**
 * Split data into batches for processing
 */
export function splitIntoBatches<T>(data: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  return batches;
}
