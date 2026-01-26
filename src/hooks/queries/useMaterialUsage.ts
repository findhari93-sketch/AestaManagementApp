"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
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
 * This function:
 * 1. Finds the relevant stock inventory record
 * 2. Validates sufficient stock is available
 * 3. Reduces the stock inventory quantity
 * 4. Creates a stock transaction record
 * 5. Creates the daily usage record
 */
export function useCreateMaterialUsage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    // IMPORTANT: Disable retry for this mutation since it's not idempotent
    // Retrying would cause double stock reduction or 409 Conflict errors
    retry: false,
    mutationFn: async (
      data: UsageEntryFormData & {
        unit_cost?: number;
        total_cost?: number;
        inventory_id?: string; // Optional: specific inventory record to use
      }
    ) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Get current user for tracking who created the usage record
      // Note: auth.users.id != public.users.id, need to look up by auth_id
      let userId: string | null = null;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.id) {
          const { data: dbUser } = await supabase
            .from("users")
            .select("id")
            .eq("auth_id", authUser.id)
            .maybeSingle();
          userId = dbUser?.id || null;
        }
      } catch (userError) {
        // Non-critical - continue without user ID
        console.warn("Could not fetch user for created_by:", userError);
      }

      console.log("[useCreateMaterialUsage] Starting mutation with data:", {
        site_id: data.site_id,
        material_id: data.material_id,
        inventory_id: data.inventory_id,
        quantity: data.quantity,
      });

      // 1. Find the stock inventory record for this material
      // Build query to find matching inventory
      let inventoryQuery = supabase
        .from("stock_inventory")
        .select("id, current_qty, avg_unit_cost, brand_id")
        .eq("site_id", data.site_id)
        .eq("material_id", data.material_id)
        .gt("current_qty", 0);

      // If specific inventory_id provided, use it
      if (data.inventory_id) {
        inventoryQuery = supabase
          .from("stock_inventory")
          .select("id, current_qty, avg_unit_cost, brand_id")
          .eq("id", data.inventory_id);
      } else if (data.brand_id) {
        // If brand specified, find that specific brand's stock
        inventoryQuery = inventoryQuery.eq("brand_id", data.brand_id);
      }

      console.log("[useCreateMaterialUsage] Fetching inventory...");
      const { data: inventory, error: inventoryError } = await inventoryQuery.maybeSingle();
      console.log("[useCreateMaterialUsage] Inventory result:", { inventory, inventoryError });

      if (inventoryError) {
        throw new Error(`Failed to check stock: ${inventoryError.message}`);
      }

      // 2. Validate sufficient stock exists
      if (!inventory) {
        throw new Error("No stock available for this material. Please ensure material has been delivered and settled.");
      }

      if (inventory.current_qty < data.quantity) {
        throw new Error(
          `Insufficient stock. Available: ${inventory.current_qty}, Requested: ${data.quantity}`
        );
      }

      // 3. Calculate costs
      const unitCost = data.unit_cost || inventory.avg_unit_cost || 0;
      const totalCost = data.total_cost || (data.quantity * unitCost);

      // 4. Reduce inventory quantity
      const newQty = inventory.current_qty - data.quantity;
      console.log("[useCreateMaterialUsage] Updating stock inventory...");
      const { error: updateError } = await supabase
        .from("stock_inventory")
        .update({
          current_qty: newQty,
          last_issued_date: data.usage_date || new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", inventory.id);
      console.log("[useCreateMaterialUsage] Stock update result:", { updateError });

      if (updateError) {
        throw new Error(`Failed to update stock: ${updateError.message}`);
      }

      // 5. Create stock transaction record for this usage
      console.log("[useCreateMaterialUsage] Creating stock transaction...");
      const { error: txError } = await supabase
        .from("stock_transactions")
        .insert({
          site_id: data.site_id,
          inventory_id: inventory.id,
          transaction_type: "usage",
          transaction_date: data.usage_date || new Date().toISOString().split("T")[0],
          quantity: -data.quantity, // Negative for usage/outgoing
          unit_cost: unitCost,
          total_cost: totalCost,
          section_id: data.section_id || null,
          notes: data.work_description || "Material usage recorded",
          created_by: userId,
        });
      console.log("[useCreateMaterialUsage] Transaction result:", { txError });

      if (txError) {
        // Log but don't fail - transaction record is for audit, not critical
        console.error("Failed to create stock transaction:", txError);
      }

      // 6. Create the daily usage record
      console.log("[useCreateMaterialUsage] Creating daily usage record...");
      const { data: result, error } = await supabase
        .from("daily_material_usage")
        .insert({
          site_id: data.site_id,
          usage_date: data.usage_date,
          material_id: data.material_id,
          brand_id: data.brand_id || inventory.brand_id || null,
          quantity: data.quantity,
          unit_cost: unitCost,
          total_cost: totalCost,
          section_id: data.section_id || null,
          work_description: data.work_description || null,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        // If usage record fails, try to rollback stock update
        await supabase
          .from("stock_inventory")
          .update({
            current_qty: inventory.current_qty, // Restore original qty
            updated_at: new Date().toISOString(),
          })
          .eq("id", inventory.id);

        throw error;
      }

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
      // Also invalidate stock transactions
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.materialStock.bySite(variables.site_id), "transactions"],
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
    retry: false, // Not idempotent
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<UsageEntryFormData>;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

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
 * This function:
 * 1. Gets the usage record details
 * 2. Restores the quantity back to stock inventory
 * 3. Creates a reversal stock transaction
 * 4. Deletes the usage record
 */
export function useDeleteMaterialUsage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    retry: false, // Not idempotent - restores stock
    mutationFn: async ({ id, siteId }: { id: string; siteId: string }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Get current user for tracking who made the adjustment
      // Note: auth.users.id != public.users.id, need to look up by auth_id
      let userId: string | null = null;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.id) {
          const { data: dbUser } = await supabase
            .from("users")
            .select("id")
            .eq("auth_id", authUser.id)
            .maybeSingle();
          userId = dbUser?.id || null;
        }
      } catch (userError) {
        // Non-critical - continue without user ID
        console.warn("Could not fetch user for created_by:", userError);
      }

      // 1. Get the usage record to know quantity to restore
      const { data: usageRecord, error: fetchError } = await supabase
        .from("daily_material_usage")
        .select("material_id, brand_id, quantity, unit_cost, usage_date")
        .eq("id", id)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch usage record: ${fetchError.message}`);
      }

      // 2. Find the stock inventory record to restore quantity
      let inventoryQuery = supabase
        .from("stock_inventory")
        .select("id, current_qty")
        .eq("site_id", siteId)
        .eq("material_id", usageRecord.material_id);

      if (usageRecord.brand_id) {
        inventoryQuery = inventoryQuery.eq("brand_id", usageRecord.brand_id);
      } else {
        inventoryQuery = inventoryQuery.is("brand_id", null);
      }

      const { data: inventory } = await inventoryQuery.maybeSingle();

      if (inventory) {
        // 3. Restore quantity to inventory
        const restoredQty = inventory.current_qty + usageRecord.quantity;
        await supabase
          .from("stock_inventory")
          .update({
            current_qty: restoredQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inventory.id);

        // 4. Create reversal transaction
        await supabase
          .from("stock_transactions")
          .insert({
            site_id: siteId,
            inventory_id: inventory.id,
            transaction_type: "adjustment",
            transaction_date: new Date().toISOString().split("T")[0],
            quantity: usageRecord.quantity, // Positive to add back
            unit_cost: usageRecord.unit_cost || 0,
            total_cost: (usageRecord.unit_cost || 0) * usageRecord.quantity,
            notes: `Restored from deleted usage record (${usageRecord.usage_date})`,
            created_by: userId,
          });
      }

      // 5. Delete the usage record
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
      // Also invalidate stock queries since we restored quantity
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialStock.bySite(result.siteId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialStock.lowStock(result.siteId),
      });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.materialStock.bySite(result.siteId), "transactions"],
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
      // Ensure fresh session before mutation
      await ensureFreshSession();

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
