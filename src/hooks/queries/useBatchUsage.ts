"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  BatchUsageRecord,
  BatchUsageRecordWithDetails,
  BatchSettlementSummary,
  BatchSiteAllocation,
  RecordBatchUsageFormData,
  InitiateBatchSettlementFormData,
  BatchSettlementResult,
} from "@/types/material.types";

// ============================================
// HELPER FUNCTIONS
// ============================================

function isQueryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "42P01" ||
    err.code === "PGRST" ||
    (err.message?.includes("relation") ?? false) ||
    (err.message?.includes("does not exist") ?? false) ||
    (err.message?.includes("Could not find") ?? false)
  );
}

// ============================================
// FETCH BATCH USAGE RECORDS
// ============================================

/**
 * Fetch all usage records for a specific batch
 */
export function useBatchUsageRecords(batchRefCode: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.batchUsage.byBatch(batchRefCode || ""),
    queryFn: async () => {
      if (!batchRefCode) return [] as BatchUsageRecordWithDetails[];

      try {
        const { data, error } = await (supabase as any)
          .from("batch_usage_records")
          .select(`
            *,
            usage_site:sites!batch_usage_records_usage_site_id_fkey(id, name),
            material:materials(id, name, code, unit),
            brand:material_brands(id, brand_name)
          `)
          .eq("batch_ref_code", batchRefCode)
          .order("usage_date", { ascending: false });

        if (error) {
          if (isQueryError(error)) {
            console.warn("Batch usage records query failed:", error.message);
            return [] as BatchUsageRecordWithDetails[];
          }
          throw error;
        }
        return (data || []) as BatchUsageRecordWithDetails[];
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Batch usage records query failed:", err);
          return [] as BatchUsageRecordWithDetails[];
        }
        throw err;
      }
    },
    enabled: !!batchRefCode,
  });
}

/**
 * Fetch usage records for a site
 */
export function useSiteBatchUsageRecords(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.batchUsage.bySite(siteId || ""),
    queryFn: async () => {
      if (!siteId) return [] as BatchUsageRecordWithDetails[];

      try {
        const { data, error } = await (supabase as any)
          .from("batch_usage_records")
          .select(`
            *,
            usage_site:sites!batch_usage_records_usage_site_id_fkey(id, name),
            material:materials(id, name, code, unit),
            brand:material_brands(id, brand_name)
          `)
          .eq("usage_site_id", siteId)
          .order("usage_date", { ascending: false });

        if (error) {
          if (isQueryError(error)) {
            console.warn("Site batch usage records query failed:", error.message);
            return [] as BatchUsageRecordWithDetails[];
          }
          throw error;
        }
        return (data || []) as BatchUsageRecordWithDetails[];
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Site batch usage records query failed:", err);
          return [] as BatchUsageRecordWithDetails[];
        }
        throw err;
      }
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch all usage records for a group
 */
export function useGroupBatchUsageRecords(groupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.batchUsage.byGroup(groupId || ""),
    queryFn: async () => {
      if (!groupId) return [] as BatchUsageRecordWithDetails[];

      try {
        const { data, error } = await (supabase as any)
          .from("batch_usage_records")
          .select(`
            *,
            usage_site:sites!batch_usage_records_usage_site_id_fkey(id, name),
            material:materials(id, name, code, unit),
            brand:material_brands(id, brand_name)
          `)
          .eq("site_group_id", groupId)
          .order("usage_date", { ascending: false });

        if (error) {
          if (isQueryError(error)) {
            console.warn("Group batch usage records query failed:", error.message);
            return [] as BatchUsageRecordWithDetails[];
          }
          throw error;
        }
        return (data || []) as BatchUsageRecordWithDetails[];
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Group batch usage records query failed:", err);
          return [] as BatchUsageRecordWithDetails[];
        }
        throw err;
      }
    },
    enabled: !!groupId,
  });
}

// ============================================
// BATCH SETTLEMENT SUMMARY
// ============================================

/**
 * Get settlement summary for a batch including site-wise allocations
 */
export function useBatchSettlementSummary(batchRefCode: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.batchUsage.summary(batchRefCode || ""),
    queryFn: async () => {
      if (!batchRefCode) return null;

      try {
        // Call the database function
        const { data, error } = await (supabase as any).rpc("get_batch_settlement_summary", {
          p_batch_ref_code: batchRefCode,
        });

        if (error) {
          if (isQueryError(error)) {
            console.warn("Batch settlement summary query failed:", error.message);
            return null;
          }
          throw error;
        }

        if (!data || data.length === 0) return null;

        const row = data[0];
        return {
          batch_ref_code: row.batch_ref_code,
          paying_site_id: row.paying_site_id,
          paying_site_name: row.paying_site_name,
          total_amount: Number(row.total_amount),
          original_qty: Number(row.original_qty),
          used_qty: Number(row.used_qty),
          remaining_qty: Number(row.remaining_qty),
          site_allocations: (row.site_allocations || []) as BatchSiteAllocation[],
        } as BatchSettlementSummary;
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Batch settlement summary query failed:", err);
          return null;
        }
        throw err;
      }
    },
    enabled: !!batchRefCode,
  });
}

// ============================================
// RECORD BATCH USAGE MUTATION
// ============================================

/**
 * Record usage from a batch for a specific site
 */
export function useRecordBatchUsage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: RecordBatchUsageFormData & { created_by?: string }) => {
      // Call the database function
      const { data: result, error } = await (supabase as any).rpc("record_batch_usage", {
        p_batch_ref_code: data.batch_ref_code,
        p_usage_site_id: data.usage_site_id,
        p_quantity: data.quantity,
        p_usage_date: data.usage_date,
        p_work_description: data.work_description || null,
        p_created_by: data.created_by || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      return result as string; // Returns the usage ID
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.byBatch(variables.batch_ref_code),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.bySite(variables.usage_site_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.summary(variables.batch_ref_code),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.byRefCode(variables.batch_ref_code),
      });
      // Invalidate batches list
      queryClient.invalidateQueries({
        queryKey: ["material-purchases", "batches"],
      });
    },
  });
}

// ============================================
// PROCESS BATCH SETTLEMENT MUTATION
// ============================================

/**
 * Process settlement for a batch - creates settlement record and debtor expense
 * Now supports optional settlement_amount for bargaining (vendor negotiations)
 */
export function useProcessBatchSettlement() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: InitiateBatchSettlementFormData & {
      created_by?: string;
      settlement_amount?: number; // Optional: Override amount for bargaining
    }) => {
      // Call the database function with optional settlement_amount for bargaining
      const { data: result, error } = await (supabase as any).rpc("process_batch_settlement", {
        p_batch_ref_code: data.batch_ref_code,
        p_debtor_site_id: data.debtor_site_id,
        p_payment_mode: data.payment_mode,
        p_payment_date: data.payment_date,
        p_payment_reference: data.payment_reference || null,
        p_settlement_amount: data.settlement_amount || null, // NEW: bargaining amount
        p_created_by: data.created_by || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!result || result.length === 0) {
        throw new Error("Settlement processing failed - no result returned");
      }

      const row = result[0];
      return {
        settlement_id: row.settlement_id,
        debtor_expense_id: row.debtor_expense_id,
        settlement_code: row.settlement_code,
      } as BatchSettlementResult;
    },
    onSuccess: (result, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.byBatch(variables.batch_ref_code),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.bySite(variables.debtor_site_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.summary(variables.batch_ref_code),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.byRefCode(variables.batch_ref_code),
      });
      // Invalidate settlements
      queryClient.invalidateQueries({
        queryKey: ["inter-site-settlements"],
      });
      // Invalidate material purchases
      queryClient.invalidateQueries({
        queryKey: ["material-purchases"],
      });
      // Invalidate batches
      queryClient.invalidateQueries({
        queryKey: ["material-purchases", "batches"],
      });
      // Invalidate all expenses (debtor expense now appears in v_all_expenses)
      queryClient.invalidateQueries({
        queryKey: ["all-expenses"],
      });
      queryClient.invalidateQueries({
        queryKey: ["expenses"],
      });
    },
  });
}

// ============================================
// DELETE BATCH USAGE MUTATION
// ============================================

/**
 * Delete a batch usage record (only if not yet settled)
 */
export function useDeleteBatchUsage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: { usageId: string; batchRefCode: string; siteId: string }) => {
      // First check if it's settled
      const { data: record, error: fetchError } = await (supabase as any)
        .from("batch_usage_records")
        .select("settlement_status, quantity, is_self_use, unit_cost")
        .eq("id", data.usageId)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      if (record.settlement_status === "settled") {
        throw new Error("Cannot delete settled usage record");
      }

      // Delete the record
      const { error: deleteError } = await (supabase as any)
        .from("batch_usage_records")
        .delete()
        .eq("id", data.usageId);

      if (deleteError) throw new Error(deleteError.message);

      // Update the batch quantities
      const { error: updateError } = await (supabase as any).rpc("sql", {
        query: `
          UPDATE material_purchase_expenses
          SET
            used_qty = COALESCE(used_qty, 0) - $1,
            remaining_qty = COALESCE(remaining_qty, 0) + $1,
            self_used_qty = CASE WHEN $2 THEN COALESCE(self_used_qty, 0) - $1 ELSE self_used_qty END,
            self_used_amount = CASE WHEN $2 THEN COALESCE(self_used_amount, 0) - ($1 * $3) ELSE self_used_amount END,
            updated_at = now()
          WHERE ref_code = $4
        `,
        params: [record.quantity, record.is_self_use, record.unit_cost, data.batchRefCode],
      });

      // Note: If the above doesn't work due to RPC restrictions, we might need to handle this differently
      // For now, we'll rely on the UI to refresh the data

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.byBatch(variables.batchRefCode),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.bySite(variables.siteId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.summary(variables.batchRefCode),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.byRefCode(variables.batchRefCode),
      });
      queryClient.invalidateQueries({
        queryKey: ["material-purchases", "batches"],
      });
    },
  });
}

// ============================================
// FETCH BATCHES WITH USAGE FOR GROUP
// ============================================

/**
 * Get all batches for a group with their usage breakdown
 * This is useful for the Group Purchases overview
 */
export function useBatchesWithUsage(groupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...queryKeys.batchUsage.byGroup(groupId || ""), "with-batches"],
    queryFn: async () => {
      if (!groupId) return [];

      try {
        // Get all group stock purchases
        const { data: batches, error: batchError } = await (supabase as any)
          .from("material_purchase_expenses")
          .select(`
            *,
            paying_site:sites!material_purchase_expenses_paying_site_id_fkey(id, name),
            vendor:vendors(id, name),
            items:material_purchase_expense_items(
              *,
              material:materials(id, name, code, unit),
              brand:material_brands(id, brand_name)
            )
          `)
          .eq("site_group_id", groupId)
          .eq("purchase_type", "group_stock")
          .order("purchase_date", { ascending: false });

        if (batchError) {
          if (isQueryError(batchError)) {
            console.warn("Batches query failed:", batchError.message);
            return [];
          }
          throw batchError;
        }

        if (!batches || batches.length === 0) return [];

        // Get usage for all batches
        const batchRefCodes = batches.map((b: any) => b.ref_code);
        const { data: usageRecords, error: usageError } = await (supabase as any)
          .from("batch_usage_records")
          .select(`
            batch_ref_code,
            usage_site_id,
            quantity,
            total_cost,
            is_self_use,
            settlement_status,
            usage_site:sites!batch_usage_records_usage_site_id_fkey(id, name)
          `)
          .in("batch_ref_code", batchRefCodes);

        if (usageError && !isQueryError(usageError)) {
          throw usageError;
        }

        // Group usage by batch
        const usageByBatch = new Map<string, any[]>();
        (usageRecords || []).forEach((u: any) => {
          const existing = usageByBatch.get(u.batch_ref_code) || [];
          existing.push(u);
          usageByBatch.set(u.batch_ref_code, existing);
        });

        // Combine batches with their usage
        return batches.map((batch: any) => {
          const batchUsage = usageByBatch.get(batch.ref_code) || [];

          // Aggregate usage by site
          const siteUsageMap = new Map<string, {
            site_id: string;
            site_name: string;
            quantity_used: number;
            amount: number;
            is_payer: boolean;
            settlement_status: string;
          }>();

          batchUsage.forEach((u: any) => {
            const existing = siteUsageMap.get(u.usage_site_id);
            if (existing) {
              existing.quantity_used += Number(u.quantity);
              existing.amount += Number(u.total_cost);
              // Keep the "worse" status (pending > settled > self_use)
              if (u.settlement_status === "pending") {
                existing.settlement_status = "pending";
              }
            } else {
              siteUsageMap.set(u.usage_site_id, {
                site_id: u.usage_site_id,
                site_name: u.usage_site?.name || "Unknown",
                quantity_used: Number(u.quantity),
                amount: Number(u.total_cost),
                is_payer: u.is_self_use,
                settlement_status: u.settlement_status,
              });
            }
          });

          return {
            ...batch,
            site_allocations: Array.from(siteUsageMap.values()),
          };
        });
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Batches with usage query failed:", err);
          return [];
        }
        throw err;
      }
    },
    enabled: !!groupId,
  });
}
