"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  DailyMaterialUsage,
  DailyMaterialUsageWithDetails,
  UsageEntryFormData,
} from "@/types/material.types";
import dayjs from "dayjs";

// ============================================
// DAILY MATERIAL USAGE
// ============================================

/**
 * Fetch material usage for a site within a date range
 */
export function useMaterialUsage(
  siteId: string | undefined,
  options?: {
    startDate?: string;
    endDate?: string;
    sectionId?: string;
    materialId?: string;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.materialUsage.bySite(siteId), options]
      : ["material-usage", "unknown"],
    queryFn: async () => {
      if (!siteId) return [];

      let query = supabase
        .from("daily_material_usage")
        .select(
          `
          *,
          material:materials(id, name, code, unit),
          brand:material_brands(id, brand_name),
          section:building_sections(id, name),
          created_by_user:users!daily_material_usage_created_by_fkey(name)
        `
        )
        .eq("site_id", siteId)
        .order("usage_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (options?.startDate) {
        query = query.gte("usage_date", options.startDate);
      }
      if (options?.endDate) {
        query = query.lte("usage_date", options.endDate);
      }
      if (options?.sectionId) {
        query = query.eq("section_id", options.sectionId);
      }
      if (options?.materialId) {
        query = query.eq("material_id", options.materialId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as DailyMaterialUsageWithDetails[];
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch today's usage for a site
 */
export function useTodayUsage(siteId: string | undefined) {
  const today = dayjs().format("YYYY-MM-DD");

  return useMaterialUsage(siteId, {
    startDate: today,
    endDate: today,
  });
}

/**
 * Fetch usage summary for a site (today's totals)
 */
export function useTodayUsageSummary(siteId: string | undefined) {
  const supabase = createClient();
  const today = dayjs().format("YYYY-MM-DD");

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.materialUsage.byDate(siteId, today), "summary"]
      : ["material-usage", "summary"],
    queryFn: async () => {
      if (!siteId) return null;

      const { data, error } = await supabase
        .from("daily_material_usage")
        .select("quantity, total_cost, material:materials(unit)")
        .eq("site_id", siteId)
        .eq("usage_date", today);

      if (error) throw error;

      const totalEntries = data.length;
      const totalCost = data.reduce((sum, d) => sum + (d.total_cost || 0), 0);
      const uniqueMaterials = new Set(data.map((d) => d.material)).size;

      return {
        totalEntries,
        totalCost,
        uniqueMaterials,
      };
    },
    enabled: !!siteId,
  });
}

/**
 * Create a new material usage entry
 */
export function useCreateMaterialUsage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (
      data: UsageEntryFormData & { unit_cost?: number; total_cost?: number }
    ) => {
      // Get unit cost from stock if not provided
      let unitCost = data.unit_cost;
      let totalCost = data.total_cost;

      if (!unitCost) {
        // Fetch from stock inventory
        const { data: stock } = await supabase
          .from("stock_inventory")
          .select("avg_unit_cost")
          .eq("site_id", data.site_id)
          .eq("material_id", data.material_id)
          .maybeSingle();

        unitCost = stock?.avg_unit_cost || 0;
        totalCost = data.quantity * unitCost;
      }

      const { data: result, error } = await supabase
        .from("daily_material_usage")
        .insert({
          ...data,
          unit_cost: unitCost,
          total_cost: totalCost,
        })
        .select()
        .single();

      if (error) throw error;
      return result as DailyMaterialUsage;
    },
    onSuccess: (_, variables) => {
      const todayStr = dayjs().format("YYYY-MM-DD");
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialUsage.bySite(variables.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: [
          ...queryKeys.materialUsage.byDate(variables.site_id, todayStr),
          "summary",
        ],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialStock.bySite(variables.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialStock.lowStock(variables.site_id),
      });
    },
  });
}

/**
 * Update a material usage entry
 */
export function useUpdateMaterialUsage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<UsageEntryFormData>;
    }) => {
      const { data: result, error } = await supabase
        .from("daily_material_usage")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as DailyMaterialUsage;
    },
    onSuccess: (result) => {
      const todayStr = dayjs().format("YYYY-MM-DD");
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialUsage.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: [
          ...queryKeys.materialUsage.byDate(result.site_id, todayStr),
          "summary",
        ],
      });
    },
  });
}

/**
 * Delete a material usage entry
 */
export function useDeleteMaterialUsage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, siteId }: { id: string; siteId: string }) => {
      const { error } = await supabase
        .from("daily_material_usage")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, siteId };
    },
    onSuccess: (result) => {
      const todayStr = dayjs().format("YYYY-MM-DD");
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialUsage.bySite(result.siteId),
      });
      queryClient.invalidateQueries({
        queryKey: [
          ...queryKeys.materialUsage.byDate(result.siteId, todayStr),
          "summary",
        ],
      });
    },
  });
}

/**
 * Verify a usage entry
 */
export function useVerifyMaterialUsage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { data: result, error } = await supabase
        .from("daily_material_usage")
        .update({
          is_verified: true,
          verified_by: userId,
          verified_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as DailyMaterialUsage;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["materialUsage", result.site_id],
      });
    },
  });
}
